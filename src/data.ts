import { getSpeciesEconomy, normalizeSpeciesName, SPECIES_ECONOMY, type RarityTier } from "./game/catalog.ts";
import type { SpecimenGenetics } from "./game/genetics.ts";

export type Species = {
  id: string;
  name: string;
  latin: string;
  family: string;
  difficulty: "Easy" | "Moderate" | "Advanced";
  rarity: RarityTier;
  basePrice?: number;
  summary: string;
  light: string;
  humidity: string;
  water: string;
  traits: string[];
};

export type Specimen = {
  id: string;
  speciesId: string;
  nickname: string;
  location: string;
  health: number;
  stage: "Corm / Seedling" | "Juvenile" | "Growing" | "Mature" | "Breeding-ready";
  /** Stable genetic-line identity; offspring retain both parents in lineParentIds. */
  geneticLineId?: string;
  lineParentIds?: string[];
  generation?: number;
  stabilityGenerations?: Record<string, number>;
  stableMutationIds?: string[];
  /** Reserved by an active breeding project; prevents sale or reuse. */
  reservedByProjectId?: string;
  /** Current pest pressure on a 0–100 scale. */
  pestLoad?: number;
  /** Current disease pressure on a 0–100 scale. */
  diseaseLoad?: number;
  /** Dead specimens remain in the collection record but cannot be used. */
  dead?: boolean;
  /** Simulated days spent in the current established growth stage. */
  stageDays?: number;
  /** Last simulation day this specimen was observed; prevents repeated research farming. */
  lastObservedDay?: number;
  /** Mutation Analysis can be completed only once per specimen, whether or not a mutation is found. */
  mutationAnalysisCompleted?: boolean;
  /** Simulation-calendar year in which this Alocasia last yielded a corm. */
  lastCormHarvestYear?: number;
  /** Original shop price; used to prevent instant buy-and-resell arbitrage while allowing value to rise with growth. */
  purchasePrice?: number;
  /** Development state for a newly propagated specimen; omitted for established plants. */
  propagation?: { method: "corm" | "cutting" | "division" | "tissue-culture"; phase: "Corm" | "Sprouting" | "Establishing" | "Cutting" | "Rooting" | "New Growth"; daysInPhase: number; daysToSprout: number; daysToEstablish: number; daysToJuvenile?: number };
  value: number;
  protected: boolean;
  variegation: number;
  discovered?: boolean;
  genetics?: SpecimenGenetics;
};

const prototypeSpecies: Species[] = [
  {
    id: "alocasia-polly",
    name: "Alocasia Polly",
    latin: "Alocasia × amazonica",
    family: "Araceae",
    difficulty: "Moderate",
    rarity: "Common",
    summary: "A compact Alocasia with dramatic arrow-shaped leaves and contrasting pale veins.",
    light: "Bright, indirect",
    humidity: "60–80%",
    water: "Keep lightly moist, never waterlogged",
    traits: ["Arrow-shaped leaves", "Contrasting veins", "Compact growth"],
  },
  {
    id: "anthurium-clarinervium",
    name: "Anthurium clarinervium",
    latin: "Anthurium clarinervium",
    family: "Araceae",
    difficulty: "Moderate",
    rarity: "Uncommon",
    summary: "A velvet-leaved Anthurium with bold pale veins and heart-shaped foliage.",
    light: "Bright, indirect",
    humidity: "60–80%",
    water: "Allow the upper mix to partly dry",
    traits: ["Velvety leaves", "Heart-shaped foliage", "Prominent veins"],
  },
  {
    id: "anthurium-magnificum",
    name: "Anthurium Magnificum",
    latin: "Anthurium magnificum",
    family: "Araceae",
    difficulty: "Moderate",
    rarity: "Uncommon",
    basePrice: 20,
    summary: "A velvety Anthurium with large heart-shaped leaves and striking pale veins.",
    light: "Bright, indirect",
    humidity: "60–80%",
    water: "Allow the upper mix to partly dry",
    traits: ["Velvety leaves", "Large foliage", "Prominent veins"],
  },
  {
    id: "monstera-adansonii",
    name: "Monstera Adansonii",
    latin: "Monstera adansonii",
    family: "Araceae",
    difficulty: "Easy",
    rarity: "Common",
    summary: "A climbing Monstera known for its distinctive perforated leaves.",
    light: "Bright, indirect",
    humidity: "50–75%",
    water: "Water when the upper mix begins to dry",
    traits: ["Fenestrated leaves", "Climbing", "Fast-growing"],
  },
  {
    id: "philodendron-birkin",
    name: "Philodendron Birkin",
    latin: "Philodendron 'Birkin'",
    family: "Araceae",
    difficulty: "Easy",
    rarity: "Uncommon",
    summary: "A compact Philodendron with fine pale pinstripes across deep green leaves.",
    light: "Bright, indirect",
    humidity: "50–70%",
    water: "Allow the upper mix to partly dry",
    traits: ["Pinstripe variegation", "Compact growth", "Variable markings"],
  },

  {
    id: "philodendron-white-princess",
    name: "White Princess",
    latin: "Philodendron erubescens",
    family: "Araceae",
    difficulty: "Moderate",
    rarity: "Uncommon",
    summary: "A climbing aroid prized for crisp white variegation and contrasting green foliage.",
    light: "Bright, indirect",
    humidity: "60–80%",
    water: "When top 2–3 cm dries",
    traits: ["White variegation", "Climbing", "Pink stems"],
  },
  {
    id: "alocasia-frydek",
    name: "Frydek Variegated",
    latin: "Alocasia micholitziana",
    family: "Araceae",
    difficulty: "Advanced",
    rarity: "Rare",
    summary: "Velvety arrow-shaped leaves with pale veins and unpredictable variegated sectors.",
    light: "Bright, filtered",
    humidity: "70–90%",
    water: "Evenly moist, never soggy",
    traits: ["Leaf-shape variation", "White variegation", "High humidity"],
  },
  {
    id: "monstera-thai",
    name: "Thai Constellation",
    latin: "Monstera deliciosa",
    family: "Araceae",
    difficulty: "Easy",
    rarity: "Uncommon",
    summary: "Cream-speckled foliage with fenestrations that become more pronounced with maturity.",
    light: "Bright, indirect",
    humidity: "50–75%",
    water: "When top layer dries",
    traits: ["Cream variegation", "Fenestration", "Climbing"],
  },
  {
    id: "anthurium-luxurians",
    name: "Luxurians",
    latin: "Anthurium luxurians",
    family: "Araceae",
    difficulty: "Advanced",
    rarity: "Very Rare",
    summary: "Deeply quilted, sculptural leaves with a glossy, almost reptilian texture.",
    light: "Medium, indirect",
    humidity: "70–90%",
    water: "Airy mix; lightly moist",
    traits: ["Quilted texture", "Compact growth", "Collector favourite"],
  },
  {
    id: "philodendron-pink-princess",
    name: "Philodendron Pink Princess",
    latin: "Philodendron erubescens",
    family: "Araceae",
    difficulty: "Moderate",
    rarity: "Uncommon",
    summary: "Dark foliage with vivid pink sectors whose expression can vary between leaves.",
    light: "Bright, indirect",
    humidity: "60–80%",
    water: "When top 2–3 cm dries",
    traits: ["Pink variegation", "Climbing", "Expression variability"],
  },
  {
    id: "alocasia-dragon-scale",
    name: "Dragon Scale",
    latin: "Alocasia baginda",
    family: "Araceae",
    difficulty: "Advanced",
    rarity: "Rare",
    summary: "Textured, metallic-looking leaves with contrasting venation.",
    light: "Bright, filtered",
    humidity: "65–85%",
    water: "Lightly moist, airy substrate",
    traits: ["Metallic texture", "Prominent veins", "Compact growth"],
  },
];

const offlineSpecies: Species[] = [
  ...prototypeSpecies.filter((local) => Boolean(getSpeciesEconomy(local.name))),
  ...SPECIES_ECONOMY.filter((entry) => !prototypeSpecies.some((local) => {
    const genus = entry.name.split(" ")[0].toLowerCase();
    return local.latin.split(" ")[0].toLowerCase() === genus
      && (normalizeSpeciesName(entry.name) === normalizeSpeciesName(local.name)
        || normalizeSpeciesName(entry.name).endsWith(" " + normalizeSpeciesName(local.name)));
  })).map((entry) => ({
    id: normalizeSpeciesName(entry.name).replace(/ /g, "-"),
    name: entry.name,
    latin: entry.name,
    family: "Araceae",
    difficulty: "Moderate" as const,
    rarity: entry.rarity,
    basePrice: entry.basePrice,
    summary: "Catalogue species. Further botanical and care notes can be researched in-game.",
    light: "Bright, indirect",
    humidity: "60–80%",
    water: "Keep appropriately moist for the species",
    traits: ["Catalogue species", "Genetic traits can be discovered"],
  })),
].map((plant) => {
  const economy = getSpeciesEconomy(plant.name);
  return { ...plant, rarity: economy?.rarity ?? plant.rarity, basePrice: economy?.basePrice ?? plant.basePrice ?? 15 };
});

// The local catalogue remains available when Supabase is not configured or unreachable.
export let species: Species[] = offlineSpecies;

export function setSpeciesCatalog(next: Species[]) {
  species = next.length ? next : offlineSpecies;
}

export function makeStorageSpecies(slug: string, image: string): Species {
  const local = offlineSpecies.find((plant) => plant.id === slug) ?? prototypeSpecies.find((plant) => plant.id === slug);
  if (local) return { ...local,  };
  const name = slug.split("-").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
  const economy = getSpeciesEconomy(name) ?? getSpeciesEconomy(slug);
  return {
    id: slug,
    name: name || slug,
    latin: "Species details not yet recorded",
    family: "Araceae",
    difficulty: "Moderate",
    rarity: economy?.rarity ?? "Common",
    basePrice: economy?.basePrice ?? 15,
    summary: "Species details are not stored in the image catalogue yet.",
    light: "Not recorded",
    humidity: "Not recorded",
    water: "Not recorded",
    traits: ["Catalogue record"],
  };
}

export const initialSpecimens: Specimen[] = [
  { id: "J2G-PHI-0001", speciesId: "philodendron-white-princess", nickname: "Ivory", location: "Greenhouse · Zone 1", health: 94, stage: "Mature", value: 185, protected: true, variegation: 42 },
  { id: "J2G-ALO-0007", speciesId: "alocasia-frydek", nickname: "Ghostline", location: "Humidity Cabinet", health: 86, stage: "Growing", value: 240, protected: true, variegation: 27 },
  { id: "J2G-MON-0003", speciesId: "monstera-thai", nickname: "Constellation", location: "Greenhouse · Zone 2", health: 98, stage: "Mature", value: 125, protected: false, variegation: 35 },
  { id: "J2G-ANT-0002", speciesId: "anthurium-luxurians", nickname: "Basalt", location: "Humidity Cabinet", health: 79, stage: "Growing", value: 310, protected: true, variegation: 0 },
  { id: "J2G-PHI-0012", speciesId: "philodendron-pink-princess", nickname: "Rosette", location: "Greenhouse · Zone 1", health: 91, stage: "Growing", value: 95, protected: false, variegation: 31 },
  { id: "J2G-ALO-0015", speciesId: "alocasia-dragon-scale", nickname: "Scale Study", location: "Propagation Bench", health: 68, stage: "Juvenile", value: 75, protected: false, variegation: 0 },
];

export const findSpecies = (id: string) => species.find((plant) => plant.id === id) ?? offlineSpecies.find((plant) => plant.id === id) ?? prototypeSpecies.find((plant) => plant.id === id) ?? offlineSpecies[0];
