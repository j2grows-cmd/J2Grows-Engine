import type { Specimen } from "../data.ts";
import type { PlantEnvironment } from "./genetics.ts";
import { genomeFromPhenotype, normalizeGenome } from "./alleles.ts";

const VALID_STAGES = new Set(["Corm / Seedling", "Juvenile", "Growing", "Mature", "Breeding-ready"]);
const VALID_PROPAGATION_METHODS = new Set(["corm", "cutting", "division", "tissue-culture"]);
const VALID_PROPAGATION_PHASES = new Set(["Corm", "Sprouting", "Establishing", "Cutting", "Rooting", "New Growth"]);

export type SpecimenRecovery = { specimens: Specimen[]; dropped: number; repaired: number };
export type SaveEnvelopeCheck = { valid: boolean; reason?: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finite(value: unknown, fallback: number, min: number, max: number, integer = false): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const clamped = Math.min(max, Math.max(min, value));
  return integer ? Math.floor(clamped) : clamped;
}

function validGenetics(value: unknown): Specimen["genetics"] | undefined {
  if (!isRecord(value) || !isRecord(value.genetics) || !isRecord(value.research) || !Array.isArray(value.research.mutations)) return undefined;
  const profile = value.genetics;
  const environmentRaw = value.environment;
  const research = value.research;
  if (!isRecord(environmentRaw)) return undefined;
  if (!["variegationPotential", "stability", "hiddenPotential", "growthPotential"].every((key) => typeof profile[key] === "number" && Number.isFinite(profile[key]))) return undefined;
  if (!Array.isArray(profile.mutationIds) || !Array.isArray(value.observations)) return undefined;
  const environmentKeys = ["light", "nutrition", "humidity", "health"];
  if (!environmentKeys.every((key) => typeof environmentRaw[key] === "number" && Number.isFinite(environmentRaw[key]))) return undefined;
  if (!["points", "observationCount", "analysisLevel"].every((key) => typeof research[key] === "number" && Number.isFinite(research[key])) || !Array.isArray(research.discoveredTraits)) return undefined;
  const mutationsRaw = research.mutations as unknown[];
  const mutations = mutationsRaw.filter((item: unknown) => isRecord(item) && typeof item.id === "string" && typeof item.category === "string").map((item: unknown) => { const mutation = item as Record<string, unknown>; const origin = ["latent", "growth", "propagation", "breeding", "analysis", "legacy"].includes(String(mutation.origin)) ? mutation.origin : "legacy"; const tissueDistribution = ["sectoral", "meristematic", "whole-plant", "unknown"].includes(String(mutation.tissueDistribution)) ? mutation.tissueDistribution : "unknown"; return { ...mutation, strength: finite(mutation.strength, 20, 0, 100), detected: mutation.detected === true, origin, tissueDistribution, ...(typeof mutation.originDay === "number" && Number.isFinite(mutation.originDay) && mutation.originDay >= 1 ? { originDay: Math.floor(mutation.originDay) } : {}), ...(Array.isArray(mutation.parentMutationIds) ? { parentMutationIds: mutation.parentMutationIds.filter((id): id is string => typeof id === "string") } : {}) }; });
  const environment = Object.fromEntries(environmentKeys.map((key) => [key, finite(environmentRaw[key], 65, 0, 100)]));
  return {
    genetics: {
      variegationPotential: finite(profile.variegationPotential, 0, 0, 100),
      stability: finite(profile.stability, 50, 0, 100),
      hiddenPotential: finite(profile.hiddenPotential, 50, 0, 100),
      growthPotential: finite(profile.growthPotential, 50, 0, 100),
      mutationGenePresent: typeof profile.mutationGenePresent === "boolean" ? profile.mutationGenePresent : false,
      mutationIds: profile.mutationIds.filter((item): item is string => typeof item === "string"),
      genome: normalizeGenome(profile.genome) ?? genomeFromPhenotype({ variegationPotential: finite(profile.variegationPotential, 0, 0, 100), stability: finite(profile.stability, 50, 0, 100), growthPotential: finite(profile.growthPotential, 50, 0, 100), hiddenPotential: finite(profile.hiddenPotential, 50, 0, 100) }),
    },
    expression: finite(value.expression, 0, 0, 100),
    environment: environment as unknown as PlantEnvironment,
    observations: value.observations.map((item) => finite(item, 0, 0, 100)),
    research: { points: finite(research.points, 0, 0, 1_000_000_000), observationCount: finite(research.observationCount, 0, 0, 1_000_000, true), analysisLevel: finite(research.analysisLevel, 0, 0, 3, true), discoveredTraits: research.discoveredTraits.filter((item): item is string => typeof item === "string"), mutations },
  } as Specimen["genetics"];
}

export function normalizeSpecimens(value: unknown): SpecimenRecovery {
  if (!Array.isArray(value)) return { specimens: [], dropped: 0, repaired: 0 };
  const specimens: Specimen[] = [];
  let dropped = 0;
  let repaired = 0;
  const ids = new Set<string>();
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id.trim() || typeof raw.speciesId !== "string" || !raw.speciesId.trim() || typeof raw.nickname !== "string" || typeof raw.location !== "string" || !VALID_STAGES.has(String(raw.stage)) || typeof raw.protected !== "boolean") {
      dropped++;
      continue;
    }
    if (ids.has(raw.id)) { dropped++; continue; }
    const health = finite(raw.health, 100, 0, 100);
    const valueAmount = finite(raw.value, 0, 0, 1_000_000_000);
    const variegation = finite(raw.variegation, 0, 0, 100);
    if ([raw.health, raw.value, raw.variegation].some((item) => typeof item !== "number" || !Number.isFinite(item)) || health !== raw.health || valueAmount !== raw.value || variegation !== raw.variegation) repaired++;
    const specimen: Specimen = {
      id: raw.id, speciesId: raw.speciesId, nickname: raw.nickname.slice(0, 120), location: raw.location.slice(0, 160),
      health, stage: raw.stage as Specimen["stage"], value: valueAmount, protected: raw.protected, variegation,
      ...(typeof raw.dead === "boolean" ? { dead: raw.dead } : {}),
      ...(typeof raw.discovered === "boolean" ? { discovered: raw.discovered } : {}),
      ...(typeof raw.geneticLineId === "string" ? { geneticLineId: raw.geneticLineId } : {}),
      ...(Array.isArray(raw.lineParentIds) ? { lineParentIds: raw.lineParentIds.filter((item): item is string => typeof item === "string") } : {}),
      ...(isRecord(raw.stabilityGenerations) ? { stabilityGenerations: Object.fromEntries(Object.entries(raw.stabilityGenerations).filter(([, n]) => typeof n === "number" && Number.isFinite(n)).map(([key, n]) => [key, finite(n, 0, 0, 1_000_000, true)])) } : {}),
      ...(Array.isArray(raw.stableMutationIds) ? { stableMutationIds: raw.stableMutationIds.filter((item): item is string => typeof item === "string") } : {}),
      ...(typeof raw.reservedByProjectId === "string" ? { reservedByProjectId: raw.reservedByProjectId } : {}),
      ...(typeof raw.generation === "number" && Number.isFinite(raw.generation) ? { generation: finite(raw.generation, 0, 0, 1000, true) } : {}),
      ...(typeof raw.stageDays === "number" && Number.isFinite(raw.stageDays) ? { stageDays: finite(raw.stageDays, 0, 0, 1_000_000, true) } : {}),
      ...(typeof raw.lastObservedDay === "number" && Number.isFinite(raw.lastObservedDay) ? { lastObservedDay: finite(raw.lastObservedDay, 0, 0, 1_000_000_000, true) } : {}),
      ...(typeof raw.mutationAnalysisCompleted === "boolean" ? { mutationAnalysisCompleted: raw.mutationAnalysisCompleted } : {}),
      ...(typeof raw.lastCormHarvestYear === "number" && Number.isFinite(raw.lastCormHarvestYear) ? { lastCormHarvestYear: finite(raw.lastCormHarvestYear, 0, 0, 1_000_000, true) } : {}),
      ...(typeof raw.purchasePrice === "number" && Number.isFinite(raw.purchasePrice) ? { purchasePrice: finite(raw.purchasePrice, 0, 0, 1_000_000_000) } : {}),
    };
    if (isRecord(raw.propagation) && VALID_PROPAGATION_METHODS.has(String(raw.propagation.method)) && VALID_PROPAGATION_PHASES.has(String(raw.propagation.phase))) {
      specimen.propagation = { method: raw.propagation.method as NonNullable<Specimen["propagation"]>["method"], phase: raw.propagation.phase as NonNullable<Specimen["propagation"]>["phase"], daysInPhase: finite(raw.propagation.daysInPhase, 0, 0, 1_000_000, true), daysToSprout: finite(raw.propagation.daysToSprout, 1, 1, 1000, true), daysToEstablish: finite(raw.propagation.daysToEstablish, 1, 1, 1000, true), ...(typeof raw.propagation.daysToJuvenile === "number" && Number.isFinite(raw.propagation.daysToJuvenile) ? { daysToJuvenile: finite(raw.propagation.daysToJuvenile, 1, 1, 1000, true) } : {}) };
    } else if (raw.propagation !== undefined) repaired++;
    const genetics = validGenetics(raw.genetics);
    if (raw.genetics !== undefined && !genetics) repaired++;
    if (genetics) specimen.genetics = genetics;
    ids.add(raw.id);
    specimens.push(specimen);
  }
  return { specimens, dropped, repaired };
}

export function checkSaveEnvelope(value: unknown): SaveEnvelopeCheck {
  if (!isRecord(value)) return { valid: false, reason: "Save data is not an object." };
  if (![1, 2, 3, 4, 5, 6, 7, 8, 9].includes(Number(value.version))) return { valid: false, reason: "Save version is missing or unsupported." };
  if (!Array.isArray(value.specimens)) return { valid: false, reason: "Specimen collection is missing or malformed." };
  for (const key of ["cash", "research", "day", "savedAt"]) if (typeof value[key] !== "number" || !Number.isFinite(value[key])) return { valid: false, reason: `Save field '${key}' is missing or invalid.` };
  return { valid: true };
}

export function normalizeManualSaveSlots(value: unknown): Record<string, unknown | null> {
  const slots: Record<string, unknown | null> = { "1": null, "2": null, "3": null };
  if (!isRecord(value)) return slots;
  for (const key of Object.keys(slots)) {
    const candidate = value[key];
    if (candidate === null || candidate === undefined) continue;
    if (checkSaveEnvelope(candidate).valid && isRecord(candidate)) {
      const recovered = normalizeSpecimens(candidate.specimens);
      const relationships = normalizeBreedingProjectRelations(recovered.specimens, candidate.breedingProjects);
      const projects = relationships.projects;
      const env = isRecord(candidate.greenhouseEnvironment) ? candidate.greenhouseEnvironment : {};
      const envValue = (field: string, fallback: number) => finite(env[field], fallback, 0, 100);
      slots[key] = { ...candidate, version: 9, simulationSeed: typeof candidate.simulationSeed === "string" && candidate.simulationSeed.length > 0 ? candidate.simulationSeed : `migrated-${String(candidate.savedAt)}-${String(candidate.day)}`, offlineProgressEnabled: false, specimens: relationships.specimens, breedingProjects: projects,
        cash: finite(candidate.cash, 0, 0, 1_000_000_000),
        research: finite(candidate.research, 0, 0, 1_000_000_000),
        day: finite(candidate.day, 1, 1, 1_000_000_000, true),
        savedAt: finite(candidate.savedAt, Date.now(), 0, Number.MAX_SAFE_INTEGER),
        researchUnlocks: Array.isArray(candidate.researchUnlocks) ? candidate.researchUnlocks.filter((item: unknown): item is string => typeof item === "string") : [],
        analysisEquipmentLevel: finite(candidate.analysisEquipmentLevel, 0, 0, 3, true),
        greenhouseEnvironment: { light: envValue("light", 65), nutrition: envValue("nutrition", 65), humidity: envValue("humidity", 65), health: envValue("health", 100) },
        analysisTargetSpecimenId: typeof candidate.analysisTargetSpecimenId === "string" && recovered.specimens.some((item) => item.id === candidate.analysisTargetSpecimenId) ? candidate.analysisTargetSpecimenId : undefined,
        analysisStartedDay: typeof candidate.analysisStartedDay === "number" && Number.isFinite(candidate.analysisStartedDay) ? finite(candidate.analysisStartedDay, 1, 1, 1_000_000_000, true) : undefined,
        projectStarted: Boolean(candidate.projectStarted && typeof candidate.analysisTargetSpecimenId === "string" && recovered.specimens.some((item) => item.id === candidate.analysisTargetSpecimenId) && typeof candidate.analysisStartedDay === "number" && Number.isFinite(candidate.analysisStartedDay)),
      };
    }
  }
  return slots;
}


export type BreedingProjectRecovery = {
  specimens: Specimen[];
  projects: Record<string, unknown>[];
  dropped: number;
  repaired: number;
};

/**
 * Repairs cross-record save relationships after individual records are normalized.
 * Active projects must reference two distinct existing parents, and each parent may
 * be reserved by at most one active project. Orphaned reservations are cleared.
 */
export function normalizeBreedingProjectRelations(
  specimensInput: Specimen[],
  projectsInput: unknown,
): BreedingProjectRecovery {
  const specimens = specimensInput.map((item) => ({ ...item }));
  const specimenById = new Map(specimens.map((item) => [item.id, item]));
  const rawProjects = Array.isArray(projectsInput) ? projectsInput : [];
  const projects: Record<string, unknown>[] = [];
  const projectIds = new Set<string>();
  const reservedParents = new Set<string>();
  let dropped = 0;
  let repaired = 0;

  for (const raw of rawProjects) {
    if (!isRecord(raw)
      || typeof raw.id !== "string" || !raw.id.trim()
      || typeof raw.parentAId !== "string" || typeof raw.parentBId !== "string"
      || raw.parentAId === raw.parentBId
      || typeof raw.startedDay !== "number" || !Number.isFinite(raw.startedDay)
      || typeof raw.completesOnDay !== "number" || !Number.isFinite(raw.completesOnDay)
      || typeof raw.cost !== "number" || !Number.isFinite(raw.cost) || raw.cost < 0
      || !["active", "completed", "cancelled"].includes(String(raw.status))
      || typeof raw.lineId !== "string"
      || typeof raw.failureChance !== "number" || !Number.isFinite(raw.failureChance)
      || raw.failureChance < 0 || raw.failureChance > 1
      || raw.startedDay < 1 || raw.completesOnDay < raw.startedDay) {
      dropped++;
      continue;
    }
    if (projectIds.has(raw.id)) {
      dropped++;
      continue;
    }
    const isActive = raw.status === "active";
    const parentA = specimenById.get(raw.parentAId);
    const parentB = specimenById.get(raw.parentBId);
    if (isActive && (!parentA || !parentB || reservedParents.has(raw.parentAId) || reservedParents.has(raw.parentBId))) {
      dropped++;
      continue;
    }
    const project = { ...raw };
    if (project.targetTrait !== undefined && !["variegationPotential", "stability", "growthPotential", "hiddenPotential"].includes(String(project.targetTrait))) {
      delete project.targetTrait;
      repaired++;
    }
    projects.push(project);
    projectIds.add(raw.id);
    if (isActive) {
      reservedParents.add(raw.parentAId);
      reservedParents.add(raw.parentBId);
      if (parentA!.reservedByProjectId !== raw.id) {
        parentA!.reservedByProjectId = raw.id;
        repaired++;
      }
      if (parentB!.reservedByProjectId !== raw.id) {
        parentB!.reservedByProjectId = raw.id;
        repaired++;
      }
    }
  }

  for (const specimen of specimens) {
    if (specimen.reservedByProjectId && !projects.some((project) =>
      project.id === specimen.reservedByProjectId
      && project.status === "active"
      && (project.parentAId === specimen.id || project.parentBId === specimen.id))) {
      specimen.reservedByProjectId = undefined;
      repaired++;
    }
    if (Array.isArray(specimen.lineParentIds)) {
      const validParents = [...new Set(specimen.lineParentIds.filter((id) => id !== specimen.id && specimenById.has(id)))];
      if (validParents.length !== specimen.lineParentIds.length || validParents.some((id, index) => id !== specimen.lineParentIds![index])) {
        specimen.lineParentIds = validParents;
        repaired++;
      }
    }
  }
  return { specimens, projects, dropped, repaired };
}
