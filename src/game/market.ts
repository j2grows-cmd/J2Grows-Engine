import type { RarityTier } from "./catalog.ts";

const RARITY_VOLATILITY: Record<RarityTier, number> = {
  Common: 0.08,
  Uncommon: 0.11,
  Rare: 0.15,
  "Very Rare": 0.19,
  "Ultra Rare": 0.23,
  Mythic: 0.27,
};

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0) / 0xffffffff;
}

/** Deterministic supply/demand cycle; the same species and day always produce the same quote. */
export function getMarketMultiplier(speciesId: string, rarity: RarityTier, day: number): number {
  const safeDay = Number.isFinite(day) ? Math.max(1, Math.floor(day)) : 1;
  const seed = stableHash(speciesId);
  const volatility = RARITY_VOLATILITY[rarity] ?? 0.1;
  const shortCycle = Math.sin(safeDay / 19 + seed * Math.PI * 2) * volatility;
  const longCycle = Math.sin(safeDay / 83 + seed * 7.3) * volatility * 0.55;
  const seasonal = Math.sin((safeDay % 365) / 365 * Math.PI * 2 + seed * 3) * 0.06;
  return Math.min(1.45, Math.max(0.65, 1 + shortCycle + longCycle + seasonal));
}

export function getMarketPrice(basePrice: number, speciesId: string, rarity: RarityTier, day: number): number {
  const safeBase = Number.isFinite(basePrice) ? Math.max(1, basePrice) : 1;
  return Math.max(1, Math.round(safeBase * getMarketMultiplier(speciesId, rarity, day)));
}

/** The nursery's conservative buyback offer includes a 25% trading spread. */
export function getMarketOffer(estimatedValue: number, speciesId: string, rarity: RarityTier, day: number): number {
  const safeValue = Number.isFinite(estimatedValue) ? Math.max(0, estimatedValue) : 0;
  return Math.max(0, Math.round(safeValue * getMarketMultiplier(speciesId, rarity, day) * 0.75));
}
