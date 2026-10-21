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

function preferredLightFromDescription(description: string | undefined, fallback: number): number {
  const value = (description ?? "").toLowerCase();
  if (/low\s*(to|-)\s*medium/.test(value)) return 42;
  if (/medium\s*(to|-)\s*bright/.test(value)) return 58;
  if (value.includes("direct")) return 82;
  if (value.includes("low")) return 35;
  if (value.includes("medium")) return 50;
  if (value.includes("bright")) return 68;
  return fallback;
}
function preferredHumidityFromDescription(description: string | undefined, fallback: number): number {
  const match = (description ?? "").match(/(\d{2,3})\s*[–-]\s*(\d{2,3})\s*%?/);
  if (!match) return fallback;
  const low = Number(match[1]), high = Number(match[2]);
  if (!Number.isFinite(low) || !Number.isFinite(high) || low < 0 || high > 100 || low > high) return fallback;
  return (low + high) / 2;
}

/** Scores conditions against both genus baselines and the catalogue's species-level care guidance. */
export function calculateSpeciesSuitability(
  scientificName: string,
  difficulty: "Easy" | "Moderate" | "Advanced",
  environment: PlantEnvironment,
  care?: { light?: string; humidity?: string },
): number {
  const profile = getSpeciesCareProfile(scientificName, difficulty);
  const preferredLight = preferredLightFromDescription(care?.light, profile.preferredLight);
  const preferredHumidity = preferredHumidityFromDescription(care?.humidity, profile.preferredHumidity);
  const light = 100 - Math.abs(clamp(environment.light) - preferredLight) * 1.35;
  const humidity = 100 - Math.abs(clamp(environment.humidity) - preferredHumidity) * 1.15;
  const nutrition = 100 - Math.abs(clamp(environment.nutrition) - profile.preferredNutrition) * 1.1;
  const health = clamp(environment.health);
  return Math.round(clamp((light + humidity + nutrition + health) / 4));
}

export function speciesGrowthDurationFactor(scientificName: string, difficulty: "Easy" | "Moderate" | "Advanced"): number {
  return Math.max(0.7, Math.min(1.6, getSpeciesCareProfile(scientificName, difficulty).baseGrowthFactor));
}