export type CatalogueSource = "supabase-table" | "storage-folders" | "local";
export type ArtworkState = "loaded" | "fallback";

export function getCatalogueSourceLabel(source: CatalogueSource): string {
  switch (source) {
    case "supabase-table": return "Supabase species table";
    case "storage-folders": return "Supabase Storage folders";
    case "local": return "Local prototype data";
  }
}

export function getArtworkStatusSummary(species: Array<{ id: string; image: string }>, states: Record<string, ArtworkState>) {
  const loaded = species.filter((plant) => states[plant.id] === "loaded").length;
  const pending = species.filter((plant) => (plant.image.startsWith("https://") || plant.image.startsWith("http://")) && !states[plant.id]).length;
  return { loaded, pending, fallback: species.length - loaded - pending, total: species.length };
}
