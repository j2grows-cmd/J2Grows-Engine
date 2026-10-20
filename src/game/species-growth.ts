import type { PlantEnvironment } from "./genetics.ts";

export type SpeciesCareProfile = { preferredLight: number; preferredHumidity: number; preferredNutrition: number; baseGrowthFactor: number };

const PROFILES: Record<string, SpeciesCareProfile> = {
  alocasia: { preferredLight: 62, preferredHumidity: 78, preferredNutrition: 70, baseGrowthFactor: 1.08 },
  anthurium: { preferredLight: 52, preferredHumidity: 78, preferredNutrition: 68, baseGrowthFactor: 1.12 },
  monstera: { preferredLight: 66, preferredHumidity: 65, preferredNutrition: 62, baseGrowthFactor: 0.96 },
  philodendron: { preferredLight: 60, preferredHumidity: 68, preferredNutrition: 65, baseGrowthFactor: 0.98 },
  begonia: { preferredLight: 48, preferredHumidity: 68, preferredNutrition: 58, baseGrowthFactor: 1.02 },
  default: { preferredLight: 60, preferredHumidity: 65, preferredNutrition: 65, baseGrowthFactor: 1 },
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function getSpeciesCareProfile(scientificName: string, difficulty: "Easy" | "Moderate" | "Advanced" = "Moderate"): SpeciesCareProfile {
  const genus = scientificName.trim().split(/\s+/)[0]?.toLocaleLowerCase("en-GB") || "default";
  const profile = PROFILES[genus] ?? PROFILES.default;
  const difficultyFactor = difficulty === "Advanced" ? 1.12 : difficulty === "Easy" ? 0.92 : 1;
  return { ...profile, baseGrowthFactor: profile.baseGrowthFactor * difficultyFactor };
}

/** Scores how closely the current conditions fit this plant rather than treating all genera identically. */
export function calculateSpeciesSuitability(scientificName: string, difficulty: "Easy" | "Moderate" | "Advanced", environment: PlantEnvironment): number {
  const profile = getSpeciesCareProfile(scientificName, difficulty);
  const light = 100 - Math.abs(clamp(environment.light) - profile.preferredLight) * 1.35;
  const humidity = 100 - Math.abs(clamp(environment.humidity) - profile.preferredHumidity) * 1.15;
  const nutrition = 100 - Math.abs(clamp(environment.nutrition) - profile.preferredNutrition) * 1.1;
  const health = clamp(environment.health);
  return Math.round(clamp((light + humidity + nutrition + health) / 4));
}

export function speciesGrowthDurationFactor(scientificName: string, difficulty: "Easy" | "Moderate" | "Advanced"): number {
  return Math.max(0.7, Math.min(1.6, getSpeciesCareProfile(scientificName, difficulty).baseGrowthFactor));
}