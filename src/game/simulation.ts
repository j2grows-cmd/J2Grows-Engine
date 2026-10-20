export type EstablishedStage = "Corm / Seedling" | "Juvenile" | "Growing" | "Mature" | "Breeding-ready";
export type GrowthTransition = "seedling-established" | "juvenile-growing" | "growing-mature" | "mature-breeding-ready";

export function calculateDailyHealth(currentHealth: number, environmentalMean: number): number {
  const current = Number.isFinite(currentHealth) ? Math.max(0, Math.min(100, currentHealth)) : 0;
  const environment = Number.isFinite(environmentalMean) ? Math.max(0, Math.min(100, environmentalMean)) : 0;
  const next = environment < 35 ? current - 5
    : environment < 50 ? current - 2
    : environment >= 75 && current < 100 ? current + 2
    : current;
  return Math.max(0, Math.min(100, next));
}

export function advanceEstablishedGrowthStage(
  stage: EstablishedStage,
  stageDays: number,
  health: number,
  speciesFactor: number,
  conditionFactor: number,
): { stage: EstablishedStage; stageDays: number; transition?: GrowthTransition } {
  const days = Math.max(0, Math.floor(Number.isFinite(stageDays) ? stageDays : 0)) + 1;
  const healthy = Number.isFinite(health) ? Math.max(0, Math.min(100, health)) : 0;
  const species = Number.isFinite(speciesFactor) ? Math.max(0.1, speciesFactor) : 1;
  const conditions = Number.isFinite(conditionFactor) ? Math.max(0.1, conditionFactor) : 1;
  if (stage === "Corm / Seedling" && healthy >= 40 && days >= 5) return { stage: "Juvenile", stageDays: 0, transition: "seedling-established" };
  if (stage === "Juvenile" && healthy >= 40 && days >= Math.ceil(10 * species * conditions)) return { stage: "Growing", stageDays: 0, transition: "juvenile-growing" };
  if (stage === "Growing" && healthy >= 50 && days >= Math.ceil(21 * species * conditions)) return { stage: "Mature", stageDays: 0, transition: "growing-mature" };
  if (stage === "Mature" && healthy >= 70 && days >= Math.ceil(14 * species * conditions)) return { stage: "Breeding-ready", stageDays: 0, transition: "mature-breeding-ready" };
  return { stage, stageDays: days };
}

export type PropagationState = {
  method: "corm" | "cutting" | "division" | "tissue-culture";
  phase: "Corm" | "Sprouting" | "Establishing" | "Cutting" | "Rooting" | "New Growth";
  daysInPhase: number;
  daysToSprout: number;
  daysToEstablish: number;
  daysToJuvenile?: number;
};
export type PropagationTransition = "cutting-rooting" | "rooting-new-growth" | "propagation-established" | "corm-sprouting" | "no-transition";

export function advancePropagationPhase(
  current: PropagationState,
  suitabilityDelay: number,
  benchLevel: number,
): { propagation: PropagationState | undefined; transition: PropagationTransition } {
  const delay = Math.max(0, Math.min(2, Math.floor(Number.isFinite(suitabilityDelay) ? suitabilityDelay : 0)));
  const level = Math.max(0, Math.min(3, Math.floor(Number.isFinite(benchLevel) ? benchLevel : 0)));
  const days = Math.max(0, Math.floor(Number.isFinite(current.daysInPhase) ? current.daysInPhase : 0)) + 1;
  const timed = (base: number) => Math.max(1, Math.ceil(Math.max(1, Number.isFinite(base) ? base : 1) + delay) - level);
  if (current.phase === "Cutting" && days >= timed(current.daysToSprout)) {
    return { propagation: { ...current, phase: "Rooting", daysInPhase: 0 }, transition: "cutting-rooting" };
  }
  if (current.phase === "Rooting" && days >= timed(current.daysToEstablish)) {
    return { propagation: { ...current, phase: "New Growth", daysInPhase: 0 }, transition: "rooting-new-growth" };
  }
  if (current.phase === "New Growth" && days >= timed(current.daysToJuvenile ?? 5)) {
    return { propagation: undefined, transition: "propagation-established" };
  }
  if (current.phase === "Corm" && days >= current.daysToSprout + delay) {
    return { propagation: { ...current, phase: "Sprouting", daysInPhase: 0 }, transition: "corm-sprouting" };
  }
  if (current.phase === "Sprouting" && days >= current.daysToEstablish + delay) {
    return { propagation: undefined, transition: "propagation-established" };
  }
  if (current.phase === "Establishing" && days >= current.daysToEstablish + delay) {
    return { propagation: undefined, transition: "propagation-established" };
  }
  return { propagation: { ...current, daysInPhase: days }, transition: "no-transition" };
}
