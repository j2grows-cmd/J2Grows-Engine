import type { GeneticProfile } from "./genetics.ts";
import type { TargetableTrait } from "./progression.ts";

export type ParentSummary = {
  id: string;
  genus: string;
  stage: string;
  health: number;
  dead?: boolean;
  reserved?: boolean;
};

export type CrossEligibility = { eligible: boolean; reason?: string };

/** Central eligibility rules used by UI, action handlers and regression tests. */
export function assessCrossEligibility(a: ParentSummary | undefined, b: ParentSummary | undefined): CrossEligibility {
  if (!a || !b) return { eligible: false, reason: "Choose two available parent specimens." };
  if (a.id === b.id) return { eligible: false, reason: "A specimen cannot be crossed with itself." };
  if (a.dead || b.dead || a.health <= 0 || b.health <= 0) return { eligible: false, reason: "Both parents must be alive and healthy." };
  if (a.stage !== "Breeding-ready" || b.stage !== "Breeding-ready") return { eligible: false, reason: "Both parents must be breeding-ready." };
  if (a.reserved || b.reserved) return { eligible: false, reason: "A parent is already reserved by another project." };
  if (normalizeGenus(a.genus) !== normalizeGenus(b.genus)) return { eligible: false, reason: "This prototype supports crosses within the same genus." };
  return { eligible: true };
}

function normalizeGenus(value: string): string {
  return value.trim().toLocaleLowerCase("en-GB");
}

/** Stable project/line IDs: no wall-clock time or unseeded randomness enters saved lineage. */
export function createBreedingIdentity(day: number, projectOrdinal: number, parentAId: string, parentBId: string): { projectId: string; lineId: string } {
  const safeDay = Math.max(1, Math.floor(Number.isFinite(day) ? day : 1));
  const safeOrdinal = Math.max(1, Math.floor(Number.isFinite(projectOrdinal) ? projectOrdinal : 1));
  const slug = (value: string) => value.trim().replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 48) || "unknown";
  const parents = [slug(parentAId), slug(parentBId)].sort();
  const identity = parents.join("--");
  return { projectId: "BRD-" + safeDay + "-" + safeOrdinal + "-" + identity, lineId: "LINE-" + safeDay + "-" + identity };
}

export type TraitTargetForecast = {
  target: TargetableTrait;
  baselineMean: number;
  strongestParent: number;
  expectedMeanAfterTargeting: number;
  probabilityOfNudge: number;
};

/** Transparent expectation model for the 70% targeted-cross nudge; it is not a guarantee. */
export function forecastTraitTargeting(a: GeneticProfile, b: GeneticProfile, target: TargetableTrait): TraitTargetForecast {
  const left = a[target];
  const right = b[target];
  const baselineMean = (left + right) / 2;
  const strongestParent = Math.max(left, right);
  const nudgedMean = baselineMean + Math.max(0, strongestParent - baselineMean) * 0.3;
  const probabilityOfNudge = 0.7;
  return {
    target,
    baselineMean,
    strongestParent,
    expectedMeanAfterTargeting: baselineMean * (1 - probabilityOfNudge) + nudgedMean * probabilityOfNudge,
    probabilityOfNudge,
  };
}
