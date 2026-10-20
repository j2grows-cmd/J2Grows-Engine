/** Creates collision-resistant UUIDs for newly created specimen records.
 * Existing IDs are deliberately not normalised or rewritten, so old saves and
 * lineage references remain stable across load/save cycles.
 */
export function createUniqueSpecimenId(
  existingIds: Iterable<string> = [],
  randomUUID: () => string = () => globalThis.crypto.randomUUID(),
): string {
  const used = new Set(existingIds);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const id = randomUUID();
    if (isUuid(id) && !used.has(id)) return id;
  }
  throw new Error("Unable to generate a unique specimen UUID after 100 attempts.");
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
