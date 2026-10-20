/** Deterministic pseudo-random source for reproducible simulation and tests.
 * This is not cryptographically secure and must never be used for security decisions.
 */
export type RandomSource = () => number;

function hashSeed(seed: string | number): number {
  const text = String(seed);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Create a repeatable [0, 1) random stream from a string or numeric seed. */
export function createSeededRandom(seed: string | number): RandomSource {
  let state = hashSeed(seed);
  return () => {
    // Mulberry32: compact, deterministic PRNG suitable for game simulation.
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Return a deterministic integer in the inclusive range [min, max]. */
export function randomInteger(random: RandomSource, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new RangeError("randomInteger requires integer bounds with max >= min.");
  }
  return min + Math.floor(random() * (max - min + 1));
}

/** Derive an independent, repeatable stream for a named simulation event. */
export function createEventRandom(seed: string | number, eventKey: string): RandomSource {
  return createSeededRandom(`${String(seed)}::${eventKey}`);
}
