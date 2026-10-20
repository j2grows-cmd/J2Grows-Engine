import type { Species } from "../data.ts";

export type ValidatedSpeciesRow = {
  id: string; name: string; scientific_name: string | null; family: string | null;
  difficulty: Species["difficulty"] | null; rarity: Species["rarity"] | null;
  image_path: string; summary: string | null; light: string | null; humidity: string | null;
  water: string | null; traits: string[];
};

const DIFFICULTIES = new Set(["Easy", "Moderate", "Advanced"]);
const RARITY_BY_LABEL = new Map<string, Species["rarity"]>([
  ["common", "Common"],
  ["uncommon", "Uncommon"],
  ["rare", "Rare"],
  ["very rare", "Very Rare"],
  ["ultra rare", "Ultra Rare"],
  ["mythic", "Mythic"],
]);
const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|avif)$/i;

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeSpeciesRow(value: unknown): ValidatedSpeciesRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = optionalText(row.id);
  const name = optionalText(row.name);
  if (!id || !name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(id)) return null;

  const rawPath = optionalText(row.image_path);
  const imagePath = rawPath && !rawPath.startsWith("/") && !rawPath.includes("..") && !rawPath.includes("\\") && !/[?#]/.test(rawPath) && IMAGE_EXTENSIONS.test(rawPath)
    ? rawPath
    : "";
  const traits = Array.isArray(row.traits)
    ? [...new Set(row.traits.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()))]
    : [];
  const difficulty = typeof row.difficulty === "string" && DIFFICULTIES.has(row.difficulty) ? row.difficulty as Species["difficulty"] : null;
  const rarity = typeof row.rarity === "string" ? RARITY_BY_LABEL.get(row.rarity.trim().toLowerCase()) ?? null : null;

  return {
    id, name,
    scientific_name: optionalText(row.scientific_name), family: optionalText(row.family),
    difficulty, rarity, image_path: imagePath,
    summary: optionalText(row.summary), light: optionalText(row.light),
    humidity: optionalText(row.humidity), water: optionalText(row.water), traits,
  };
}

export function normalizeSpeciesRows(values: unknown): ValidatedSpeciesRow[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const rows: ValidatedSpeciesRow[] = [];
  for (const value of values) {
    const row = normalizeSpeciesRow(value);
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    rows.push(row);
  }
  return rows;
}

export type SpeciesCatalogueAudit = {
  totalRows: number;
  validRows: number;
  invalidRowIndexes: number[];
  duplicateIds: string[];
  missingScientificNames: string[];
  missingFamilies: string[];
  missingCareProfiles: string[];
  missingArtworkPaths: string[];
  missingTraits: string[];
};

export function auditSpeciesRows(values: unknown): SpeciesCatalogueAudit {
  const rows = Array.isArray(values) ? values : [];
  const invalidRowIndexes: number[] = [];
  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();
  const missingScientificNames: string[] = [];
  const missingFamilies: string[] = [];
  const missingCareProfiles: string[] = [];
  const missingArtworkPaths: string[] = [];
  const missingTraits: string[] = [];
  let validRows = 0;
  rows.forEach((value, index) => {
    const normalized = normalizeSpeciesRow(value);
    if (!normalized) {
      invalidRowIndexes.push(index);
      return;
    }
    if (seenIds.has(normalized.id)) duplicateIds.add(normalized.id);
    seenIds.add(normalized.id);
    validRows += 1;
    if (!normalized.scientific_name) missingScientificNames.push(normalized.id);
    if (!normalized.family) missingFamilies.push(normalized.id);
    if (!normalized.light || !normalized.humidity || !normalized.water) missingCareProfiles.push(normalized.id);
    if (!normalized.image_path) missingArtworkPaths.push(normalized.id);
    if (!normalized.traits.length) missingTraits.push(normalized.id);
  });
  return {
    totalRows: rows.length, validRows, invalidRowIndexes, duplicateIds: [...duplicateIds].sort(),
    missingScientificNames, missingFamilies, missingCareProfiles, missingArtworkPaths, missingTraits,
  };
}
