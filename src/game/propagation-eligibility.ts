const OFFSET_ELIGIBLE_STAGES = new Set(["Mature", "Breeding-ready"]);

/** Offsets can only be taken from established, reproductively mature plants. */
export function canCreateOffset(stage: string): boolean {
  return OFFSET_ELIGIBLE_STAGES.has(stage);
}
