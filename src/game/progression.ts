import type { GeneticProfile, PlantEnvironment } from "./genetics";
import { inheritGenome, phenotypeFromGenome } from "./alleles.ts";
import type { RarityTier } from "./catalog";

/** Canonical plant lifecycle agreed for J2Grows. Propagation phase remains separate from plant stage. */
export const GROWTH_STAGES = ["Corm / Seedling", "Juvenile", "Growing", "Mature", "Breeding-ready"] as const;
export type GrowthStage = typeof GROWTH_STAGES[number];

export type SimulationClock = {
  day: number;
  lastProcessedAt: number;
  lastOfflineDays: number;
};

export type BreedingProject = {
  id: string;
  parentAId: string;
  parentBId: string;
  startedDay: number;
  completesOnDay: number;
  cost: number;
  status: "active" | "completed" | "cancelled";
  failureChance: number;
  lineId: string;
  targetTrait?: "variegationPotential" | "stability" | "growthPotential" | "hiddenPotential";
};

export type GeneticLine = {
  id: string;
  name: string;
  parentLineIds: string[];
  parentSpecimenIds: string[];
  generation: number;
  createdDay: number;
  profile: GeneticProfile;
  mutationIds: string[];
  confirmedMutationIds: string[];
  stabilityGenerations: number;
  stabilityScore: number | null;
};

export type ResearchBranch = "cultivation" | "genetics" | "propagation" | "automation";
export type ResearchNode = {
  id: string;
  branch: ResearchBranch;
  cost: number;
  prerequisites: string[];
  description: string;
  effect: "breeding-risk" | "breeding-duration" | "mutation-odds" | "trait-targeting" | "batch-breeding" | "automation" | "analysis";
};

export const RESEARCH_TREE: readonly ResearchNode[] = [
  { id: "field-notes", branch: "cultivation", cost: 10, prerequisites: [], description: "Record observations and milestones as specimen evidence.", effect: "analysis" },
  { id: "controlled-environment", branch: "cultivation", cost: 35, prerequisites: ["field-notes"], description: "Improve condition management and reduce avoidable breeding risk.", effect: "breeding-risk" },
  { id: "genetic-baseline", branch: "genetics", cost: 20, prerequisites: ["field-notes"], description: "Unlock first-level genetic analysis.", effect: "analysis" },
  { id: "inheritance-mapping", branch: "genetics", cost: 50, prerequisites: ["genetic-baseline"], description: "Reveal hidden potential and inheritance patterns.", effect: "trait-targeting" },
  { id: "mutation-screening", branch: "genetics", cost: 75, prerequisites: ["inheritance-mapping"], description: "Investigate mutation details and stability.", effect: "mutation-odds" },
  { id: "selective-breeding", branch: "genetics", cost: 90, prerequisites: ["inheritance-mapping"], description: "Reduce breeding failure risk and shorten project duration.", effect: "breeding-duration" },
  { id: "propagation-science", branch: "propagation", cost: 30, prerequisites: ["field-notes"], description: "Improve propagation outcomes and mutation screening.", effect: "mutation-odds" },
  { id: "batch-breeding", branch: "genetics", cost: 150, prerequisites: ["selective-breeding", "mutation-screening"], description: "Unlock batch breeding for established genetic lines.", effect: "batch-breeding" },
  { id: "routine-automation", branch: "automation", cost: 60, prerequisites: ["controlled-environment"], description: "Unlock automation for repeatable care tasks.", effect: "automation" },
] as const;

export type ResearchState = { points: number; unlocked: string[]; completed: string[] };

export function canUnlockResearch(nodeId: string, state: ResearchState): boolean {
  const node = RESEARCH_TREE.find((candidate) => candidate.id === nodeId);
  return Boolean(node && !state.unlocked.includes(nodeId) && node.prerequisites.every((id) => state.unlocked.includes(id)) && state.points >= node.cost);
}

export function unlockResearch(nodeId: string, state: ResearchState): ResearchState | null {
  if (!canUnlockResearch(nodeId, state)) return null;
  const node = RESEARCH_TREE.find((candidate) => candidate.id === nodeId)!;
  return { points: state.points - node.cost, unlocked: [...state.unlocked, nodeId], completed: [...new Set([...state.completed, nodeId])] };
}

/** One authoritative clock. Offline advancement is validated, bounded and never grants research by itself. */
export function calculateElapsedDays(now: number, lastProcessedAt: number, dayLengthMs = 60 * 60 * 1000, capDays = 14): number {
  if (!Number.isFinite(now) || !Number.isFinite(lastProcessedAt) || now < lastProcessedAt || dayLengthMs <= 0) return 0;
  return Math.min(capDays, Math.floor((now - lastProcessedAt) / dayLengthMs));
}

export function advanceClock(clock: SimulationClock, elapsedDays = 1, now = Date.now()): SimulationClock {
  const days = Math.max(0, Math.floor(Number.isFinite(elapsedDays) ? elapsedDays : 0));
  return { day: clock.day + days, lastProcessedAt: now, lastOfflineDays: days };
}

export function canBreed(stageA: string, stageB: string, healthA: number, healthB: number, parentAReserved = false, parentBReserved = false): boolean {
  return stageA === "Breeding-ready" && stageB === "Breeding-ready" && healthA > 0 && healthB > 0 && !parentAReserved && !parentBReserved;
}

const rarityCost: Record<RarityTier, number> = { Common: 8, Uncommon: 12, Rare: 18, "Very Rare": 28, "Ultra Rare": 42, Mythic: 60 };

/** Cost is transparent and bounded; facility/research discounts never make projects free. */
export function calculateBreedingCost(rarityA: RarityTier, rarityB: RarityTier, complexity = 1, discount = 0): number {
  const complexityFactor = Math.max(1, Math.min(4, Number.isFinite(complexity) ? complexity : 1));
  const discountFactor = Math.max(0.5, Math.min(1, 1 - Math.max(0, Math.min(50, discount)) / 100));
  return Math.max(1, Math.round(((rarityCost[rarityA] + rarityCost[rarityB]) / 2) * complexityFactor * discountFactor));
}

export function breedingDurationDays(baseDays = 5, upgrades = 0): number {
  return Math.max(2, Math.round(Math.max(2, baseDays) * Math.max(0.5, 1 - Math.min(50, Math.max(0, upgrades)) / 100)));
}

export function breedingFailureChance(researchLevel: number, condition: number): number {
  const poorConditions = Math.max(0, Math.min(100, 70 - condition)) / 100;
  const researchReduction = Math.min(0.8, Math.max(0, researchLevel) * 0.15);
  return Math.max(0.01, Math.min(0.45, 0.08 + poorConditions * 0.35 - researchReduction));
}

export type TargetableTrait = "variegationPotential" | "stability" | "growthPotential" | "hiddenPotential";

/** Targeting is an expensive, probabilistic bias—not a guaranteed result. */
export function applyTraitTargeting(
  inherited: GeneticProfile,
  parentA: GeneticProfile,
  parentB: GeneticProfile,
  targetTrait: TargetableTrait | undefined,
  random: () => number = Math.random,
): GeneticProfile {
  if (!targetTrait || random() >= 0.7) return inherited;
  const strongestParent = Math.max(parentA[targetTrait], parentB[targetTrait]);
  const current = inherited[targetTrait];
  // A small positive nudge towards the stronger parental expression; never a guarantee.
  const nudged = Math.max(current, Math.round(current + Math.max(0, strongestParent - current) * 0.3));
  return { ...inherited, [targetTrait]: Math.min(100, nudged) };
}

export function calculateTargetedBreedingCost(baseCost: number, targeted: boolean): number {
  if (!Number.isFinite(baseCost) || baseCost <= 0) return 0;
  return Math.max(1, Math.ceil(baseCost * (targeted ? 1.25 : 1)));
}

export function calculateTargetedFailureChance(baseChance: number, targeted: boolean): number {
  return Math.max(0, Math.min(0.95, baseChance + (targeted ? 0.08 : 0)));
}

/** Explicit trait-wise inheritance with bounded randomness, rather than unrestricted blending. */
export function inheritTraits(parentA: GeneticProfile, parentB: GeneticProfile, random: () => number = Math.random): GeneticProfile {
  const genome = parentA.genome && parentB.genome ? inheritGenome(parentA.genome, parentB.genome, random) : undefined;
  const phenotype = genome ? phenotypeFromGenome(genome) : undefined;
  const inherit = (a: number, b: number, spread: number) => Math.max(0, Math.min(100, Math.round((random() < 0.5 ? a : b) * 0.65 + ((a + b) / 2) * 0.35 + (random() * 2 - 1) * spread)));
  return {
    ...(genome ? { genome } : {}),
    variegationPotential: phenotype?.variegationPotential ?? inherit(parentA.variegationPotential, parentB.variegationPotential, 5),
    stability: phenotype?.stability ?? inherit(parentA.stability, parentB.stability, 4),
    hiddenPotential: phenotype?.hiddenPotential ?? inherit(parentA.hiddenPotential, parentB.hiddenPotential, 6),
    growthPotential: phenotype?.growthPotential ?? inherit(parentA.growthPotential, parentB.growthPotential, 5),
    mutationGenePresent: random() < 0.5 ? parentA.mutationGenePresent : parentB.mutationGenePresent,
    mutationIds: [...new Set([...parentA.mutationIds, ...parentB.mutationIds])],
  };
}

export type MutationRoute = "growth" | "propagation" | "breeding";
export function mutationChance(route: MutationRoute, environment: PlantEnvironment, researchLevel = 0, upgradeBonus = 0): number {
  const base: Record<MutationRoute, number> = { growth: 0.0015, propagation: 0.012, breeding: 0.025 };
  const condition = Math.max(0, Math.min(100, environment.health)) / 100;
  const researchBonus = Math.min(0.02, Math.max(0, researchLevel) * 0.002);
  return Math.max(0, Math.min(0.08, base[route] * (0.5 + condition) + researchBonus + Math.max(0, Math.min(0.03, upgradeBonus))));
}

export function mutationOccurs(route: MutationRoute, environment: PlantEnvironment, researchLevel = 0, upgradeBonus = 0, random: () => number = Math.random): boolean {
  return random() < mutationChance(route, environment, researchLevel, upgradeBonus);
}

export function mutationConfirmed(evidenceCount: number, threshold = 3): boolean {
  return Number.isFinite(evidenceCount) && evidenceCount >= Math.max(1, threshold);
}

export function stableAcrossGenerations(consistentGenerations: number): boolean {
  return consistentGenerations >= 3;
}

export function geneticLineValue(baseValue: number, health: number, maturityMultiplier: number, demonstratedPotential: number, confirmedStableMutationCount = 0): number {
  const healthFactor = Math.max(0, Math.min(100, health)) / 100;
  const maturity = Math.max(1, maturityMultiplier);
  const potentialFactor = 0.75 + Math.max(0, Math.min(100, demonstratedPotential)) / 200;
  const discoveryBonus = Math.max(0, confirmedStableMutationCount) * 5;
  return Math.max(0, Math.round(baseValue * healthFactor * maturity * potentialFactor + discoveryBonus));
}

export type MutationStabilityAssessment = {
  stable: boolean;
  generationCount: number;
  mutationStability: number;
  reason: "insufficient-generations" | "low-intrinsic-stability" | "stable";
};

/** A line is only labelled stable after repeated inheritance and a high mutation stability score. */
export function assessMutationStability(generations: number, mutationStability: number, minimumGenerations = 3, minimumStability = 75): MutationStabilityAssessment {
  const generationCount = Math.max(0, Math.floor(Number.isFinite(generations) ? generations : 0));
  const stability = Math.max(0, Math.min(100, Number.isFinite(mutationStability) ? mutationStability : 0));
  if (generationCount < Math.max(1, Math.floor(minimumGenerations))) {
    return { stable: false, generationCount, mutationStability: stability, reason: "insufficient-generations" };
  }
  if (stability < Math.max(0, Math.min(100, minimumStability))) {
    return { stable: false, generationCount, mutationStability: stability, reason: "low-intrinsic-stability" };
  }
  return { stable: true, generationCount, mutationStability: stability, reason: "stable" };
}
