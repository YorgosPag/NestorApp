/**
 * ADR-639 Στάδιο 5 — WebGL line-layer LOD (pure, zero re-upload).
 *
 * Each bucket's segments are packed sorted DESC by world length (buffer builder).
 * Because they are sorted, "draw only segments ≥ cutoffPx on screen" is a single
 * binary search for the first index where `worldLen*scale < cutoffPx`; that index
 * IS the `LineSegments2.geometry.instanceCount` to set for the frame. No buffer is
 * touched — only an integer changes — so dropping detail while navigating costs
 * O(log n) and zero GPU upload (Revit/Navisworks/Figma "drop detail while moving").
 *
 * Everything drawn is ≥ cutoffPx; everything dropped is sub-pixel (invisible anyway).
 * `cutoffPx` is ~1 at idle (pixel-identical) and ~2-3 during active pan/zoom; an
 * optional hard `deviceCap` clamps instance count on weak GPUs during interaction.
 *
 * @see webgl-line-buffer-builder.ts — produces the DESC-sorted worldLengths
 */

/**
 * Number of leading (longest) segments whose on-screen length ≥ cutoffPx.
 *
 * @param sortedWorldLengths world lengths, sorted DESCENDING (as packed by the builder)
 * @param scale              current view scale (px per world unit) — `transform.scale`
 * @param cutoffPx           minimum on-screen segment length to draw (≈1 idle, ≈2-3 active)
 * @param deviceCap          optional hard upper bound on instance count (weak-GPU valve)
 */
export function computeInstanceCount(
  sortedWorldLengths: Float32Array,
  scale: number,
  cutoffPx: number,
  deviceCap?: number,
): number {
  const n = sortedWorldLengths.length;
  // Degenerate scale → nothing meaningful to draw this frame.
  if (n === 0 || !Number.isFinite(scale) || scale <= 0) return 0;

  // Binary-search the first index where worldLen*scale < cutoffPx. Since lengths are
  // DESC, [0, lo) are all ≥ cutoff (drawn) and [lo, n) are all below it (dropped).
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sortedWorldLengths[mid] * scale >= cutoffPx) lo = mid + 1;
    else hi = mid;
  }

  return deviceCap !== undefined ? Math.min(lo, deviceCap) : lo;
}
