export type RarityTier = "Common" | "Uncommon" | "Rare" | "Very Rare" | "Ultra Rare" | "Mythic";

export type SpeciesEconomy = {
  name: string;
  rarity: RarityTier;
  basePrice: number;
  confidence: "High" | "Medium" | "Low";
};

const raw = `
Alocasia Amazonica|Common|15|Medium
Alocasia Azlanii|Uncommon|12|Medium
Alocasia Bisma|Uncommon|18|Low
Alocasia Black Velvet|Common|12|High
Alocasia Brancifolia|Uncommon|18|Low
Alocasia Calidora|Common|12|High
Alocasia Cucullata|Common|10|Medium
Alocasia Cuprea Red Secret|Uncommon|17|High
Alocasia Curvy Zebrina|Rare|25|Low
Alocasia Dragon Scale|Common|10|High
Alocasia Flying Squid|Uncommon|16|High
Alocasia Frydek Variegated|Rare|33|High
Alocasia Gageana|Common|12|Medium
Alocasia Jacklyn|Common|11|High
Alocasia Lauterbachiana|Common|12|Medium
Alocasia Longiloba|Uncommon|15|Low
Alocasia Macrorrhizos|Common|10|High
Alocasia Maharani|Uncommon|18|Medium
Alocasia Melo|Uncommon|18|Medium
Alocasia Nebula|Rare|30|Low
Alocasia Ninja|Common|10|High
Alocasia Nobilis|Rare|30|Low
Alocasia Odora|Common|10|High
Alocasia Polly|Common|15|High
Alocasia Portodora|Common|12|Medium
Alocasia Regal Shield|Common|15|Medium
Alocasia Sarian|Uncommon|18|Medium
Alocasia Scalprum|Rare|25|Low
Alocasia Silver Dragon|Common|11|High
Alocasia Sinuata|Uncommon|18|Low
Alocasia Stingray|Common|15|Medium
Alocasia Tiny Dancer|Common|17|High
Alocasia Venom|Rare|36|Low
Alocasia Watsoniana|Very Rare|42|Low
Alocasia Wentii|Common|12|Medium
Alocasia Yucatan Princess|Common|12|Medium
Alocasia Zebrina|Common|7|High
Anthurium Balaoanum|Uncommon|8|Medium
Anthurium Besseae|Rare|42|Medium
Anthurium Clarinervium|Uncommon|15|High
Anthurium Clavigerum|Uncommon|18|Low
Anthurium Corrugatum|Very Rare|35|Medium
Anthurium Crystallinum|Common|9|High
Anthurium Cutucuense|Rare|23|Medium
Anthurium Forgetii|Uncommon|20|Medium
Anthurium Hookeri|Common|12|Medium
Anthurium Luxurians|Uncommon|14|High
Anthurium Magnificum|Uncommon|20|Medium
Anthurium Metallicum|Uncommon|12|Medium
Anthurium Pallidiflorum|Rare|25|High
Anthurium Papillilaminum|Rare|29|Medium
Anthurium Pedatoradiatum|Common|15|Medium
Anthurium Radicans|Uncommon|18|Low
Anthurium Regale|Uncommon|10|Medium
Anthurium Rugulosum|Very Rare|35|Low
Anthurium Veitchii|Uncommon|12|Medium
Anthurium Warocqueanum|Uncommon|13|High
Anthurium Wendlingeri|Rare|35|Medium
Monstera Adansonii|Common|8|High
Monstera Deliciosa|Common|12|Medium
Monstera Dubia|Uncommon|18|Medium
Monstera Obliqua|Uncommon|15|High
Monstera Pinnatipartita|Uncommon|18|Low
Monstera Siltepecana|Common|12|Medium
Monstera Standleyana|Uncommon|15|Medium
Philodendron Birkin|Common|7|High
Philodendron Black Cardinal|Common|11|High
Philodendron Brasil|Common|10|High
Philodendron Burle Marx Fantasy|Very Rare|50|Low
Philodendron Caramel Marble|Ultra Rare|27|Medium
Philodendron Congo Rojo|Common|12|Medium
Philodendron Dean McDowell|Rare|30|Low
Philodendron El Choco Red|Uncommon|20|Medium
Philodendron Florida Beauty|Rare|24|High
Philodendron Florida Ghost|Uncommon|16|High
Philodendron Florida Green|Common|12|Medium
Philodendron Gigas|Uncommon|18|Medium
Philodendron Gloriosum|Uncommon|18|Medium
Philodendron Imperial Green|Common|12|High
Philodendron Imperial Red|Common|12|High
Philodendron Jose Buono|Uncommon|11|Medium
Philodendron Lemon Lime|Common|10|High
Philodendron Luxurians|Very Rare|45|Low
Philodendron Majestic|Uncommon|20|Low
Philodendron Mamei|Uncommon|18|Medium
Philodendron Mayoi|Uncommon|15|Medium
Philodendron Melanochrysum|Uncommon|13|High
Philodendron Micans|Common|12|High
Philodendron Moonlight|Common|12|High
Philodendron Painted Lady|Uncommon|12|High
Philodendron Pink Princess|Common|11|High
Philodendron Prince of Orange|Common|7|High
Philodendron Red Emerald|Common|12|Medium
Philodendron Ring of Fire|Uncommon|18|Medium
Philodendron Silver Sword|Common|12|Medium
Philodendron Strawberry Shake|Ultra Rare|65|High
Philodendron Tortum|Uncommon|15|Medium
Philodendron White Knight|Uncommon|20|Medium
Philodendron White Princess|Uncommon|20|Medium
Philodendron White Wizard|Uncommon|20|Medium
`;

export const SPECIES_ECONOMY: SpeciesEconomy[] = raw.trim().split("\n").map((line) => {
  const [name, rarity, price, confidence] = line.split("|");
  return { name, rarity: rarity as RarityTier, basePrice: Number(price), confidence: confidence as SpeciesEconomy["confidence"] };
});

export function normalizeSpeciesName(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[×'’]/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

const economyByName = new Map(SPECIES_ECONOMY.map((item) => [normalizeSpeciesName(item.name), item]));

export function getSpeciesEconomy(name: string): SpeciesEconomy | undefined {
  const normalized = normalizeSpeciesName(name);
  const exact = economyByName.get(normalized);
  if (exact) return exact;
  // Suffix matching is allowed only when it identifies exactly one row.
  // Ambiguous epithets (for example shared cultivar names) must not silently
  // borrow another species' price or rarity.
  const suffixMatches = SPECIES_ECONOMY.filter((item) => {
    const candidate = normalizeSpeciesName(item.name);
    return normalized.endsWith(candidate) || candidate.endsWith(normalized);
  });
  return suffixMatches.length === 1 ? suffixMatches[0] : undefined;
}

export const SHOP_APPEARANCE_CHANCE: Record<RarityTier, number> = {
  Common: 0.82,
  Uncommon: 0.48,
  Rare: 0.22,
  "Very Rare": 0.09,
  "Ultra Rare": 0.035,
  Mythic: 0.01,
};

export function getShopAvailability(rarity: RarityTier, random: () => number = Math.random): boolean {
  return random() < SHOP_APPEARANCE_CHANCE[rarity];
}

export const STARTING_CASH = 100;

export type EconomyCatalogueAudit = {
  total: number;
  duplicateNames: string[];
  invalidPrices: string[];
  missingRarityTiers: RarityTier[];
  lowConfidenceNames: string[];
};

export function auditSpeciesEconomy(rows: readonly SpeciesEconomy[] = SPECIES_ECONOMY): EconomyCatalogueAudit {
  const names = new Map<string, number>();
  for (const row of rows) {
    const key = normalizeSpeciesName(row.name);
    names.set(key, (names.get(key) ?? 0) + 1);
  }
  const duplicateNames = [...names.entries()].filter(([, count]) => count > 1).map(([name]) => name).sort();
  const invalidPrices = rows.filter((row) => !Number.isFinite(row.basePrice) || row.basePrice <= 0).map((row) => row.name);
  const present = new Set(rows.map((row) => row.rarity));
  const missingRarityTiers = (["Common", "Uncommon", "Rare", "Very Rare", "Ultra Rare", "Mythic"] as RarityTier[]).filter((tier) => !present.has(tier));
  const lowConfidenceNames = rows.filter((row) => row.confidence === "Low").map((row) => row.name);
  return { total: rows.length, duplicateNames, invalidPrices, missingRarityTiers, lowConfidenceNames };
}
