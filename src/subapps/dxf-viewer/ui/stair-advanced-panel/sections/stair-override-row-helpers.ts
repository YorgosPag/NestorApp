/**
 * Shared per-sub-element override row helpers (ADR-358 Q19 Φ5/Φ7).
 *
 * Generic over the override value type so the per-TREAD (`{material,nosing,customProfile}`)
 * and per-RISER (`{material}`) override tables share ONE SSoT for row-index math —
 * sort, click-into merge, next-free pick, omit — instead of cloning it (N.18).
 * Keys are the 0-based GLOBAL build-order index (== the 3D `stairComponentIndex` tag).
 */

export type OverrideMap<T> = Readonly<Record<number, T>>;

/** Sorted 0-based override keys (numeric ascending). */
export function sortedOverrideIndices<T>(overrides: OverrideMap<T>): readonly number[] {
  return Object.keys(overrides)
    .map((k) => Number.parseInt(k, 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

/** Merge the clicked-into sub-element into the row list (transient if not persisted), kept sorted. */
export function withActiveIndex(
  indices: readonly number[],
  activeIndex: number | null,
): readonly number[] {
  if (activeIndex === null || indices.includes(activeIndex)) return indices;
  return [...indices, activeIndex].sort((a, b) => a - b);
}

/** First free 0-based index in `[0, count)` for the "+" add button, or null when full. */
export function pickNextFreeIndex<T>(overrides: OverrideMap<T>, count: number): number | null {
  for (let i = 0; i < count; i += 1) {
    if (overrides[i] === undefined) return i;
  }
  return null;
}

/** Return a copy of `overrides` without `index` (the "−" remove button). */
export function omitIndex<T>(overrides: OverrideMap<T>, index: number): OverrideMap<T> {
  const next: Record<number, T> = {};
  for (const key of Object.keys(overrides)) {
    const num = Number.parseInt(key, 10);
    if (num === index) continue;
    next[num] = overrides[num]!;
  }
  return next;
}
