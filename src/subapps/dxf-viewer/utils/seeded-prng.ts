/**
 * SEEDED PRNG — deterministic pseudo-random SSoT (ADR-353 M1).
 *
 * A tiny, dependency-free, deterministic generator used by the array "scatter/jitter" feature
 * (rotation / scale / lateral-offset variation + random source pick). Deterministic is the whole
 * point: the SAME `seed` always yields the SAME sequence, so a scattered array is stable across
 * re-render, save/reload and undo/redo — never re-shuffling under the user (Google-level: idempotent).
 *
 * Algorithm: `mulberry32` — a well-known 32-bit generator (public-domain / MIT-equivalent, by Tommy
 * Ettinger / bryc). Fast, good distribution for visual scatter, zero external deps (SOS N.5 license-safe).
 * NOT cryptographic — visual layout only.
 *
 * No other PRNG exists in the dxf-viewer; anything needing determinism reuses THIS (N.0/SSoT).
 */

/** A deterministic random source: each call returns the next float in [0, 1). */
export type Prng = () => number;

/**
 * Build a deterministic generator from an integer seed. Two calls with the same seed produce
 * identical sequences. The seed is coerced to a uint32 so any finite number (incl. an item index
 * mixed with the array seed) is valid.
 */
export function createPrng(seed: number): Prng {
  // Coerce to uint32; guarantee a non-degenerate internal state even for seed 0.
  let a = (seed >>> 0) || 0x9e3779b9;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draw a symmetric jitter in [-amplitude, +amplitude] from `rng`. amplitude ≤ 0 → 0 (no jitter),
 * so a disabled scatter control is a clean no-op regardless of seed.
 */
export function symmetricJitter(rng: Prng, amplitude: number): number {
  if (!(amplitude > 0)) return 0;
  return (rng() * 2 - 1) * amplitude;
}

/**
 * Deterministically combine an array-level seed with a per-item index into a fresh uint32 seed, so
 * each item gets an independent-looking (but reproducible) sub-stream. Avoids correlation artefacts
 * from feeding `seed + i` directly into a linear generator.
 */
export function mixSeed(seed: number, index: number): number {
  let h = (seed >>> 0) ^ Math.imul(index + 1, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
