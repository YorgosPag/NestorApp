/**
 * ADR-583 Φ2 — Scale-bar division / subdivision boundary math (single home).
 *
 * A graphic scale bar is split into `N` equal MAJOR segments across its span, plus
 * (optionally) `M` fine SUB-ticks inside a left-hand extension that is exactly one
 * major-division wide (the classic cartographic "0-and-back" extension). This is
 * the ONE place that owns that boundary arithmetic — it deliberately does NOT clone
 * the dimension tick-spacing code (a different problem: dimension chooses a *nice*
 * spacing for an arbitrary measured length; here the span is already a nice number
 * and we divide it into equal parts).
 *
 * All values are model distances ALONG the axis in canonical-mm (the caller passes
 * the already-converted `realDistanceToModelMm` span), so this module is pure
 * arithmetic with no unit awareness.
 *
 * @see bim/geometry/scale-bar-geometry.ts — the consumer
 * @see bim/scale-bar/scale-bar-length-snap.ts — span quantizer (upstream)
 */

/** Coerce a division/subdivision count to a safe positive integer (defaults to `1`). */
function normalizeCount(count: number, fallback: number): number {
  if (!Number.isFinite(count)) return fallback;
  const floored = Math.floor(count);
  return floored > 0 ? floored : fallback;
}

/**
 * Major division boundaries across `[0, totalModelLengthMm]`, evenly spaced.
 * Returns `divisions + 1` offsets (the leading `0` and trailing `total` inclusive),
 * so consumers can pair adjacent entries into segments directly.
 *
 * `divisions ≤ 0` / non-finite collapses to a single segment (`[0, total]`).
 */
export function computeDivisionBoundaries(
  totalModelLengthMm: number,
  divisions: number,
): number[] {
  const n = normalizeCount(divisions, 1);
  const step = totalModelLengthMm / n;
  const boundaries: number[] = [];
  for (let i = 0; i <= n; i++) boundaries.push(step * i);
  return boundaries;
}

/**
 * Fine sub-tick offsets inside the left extension, returned as POSITIVE magnitudes
 * measured LEFT of the '0' tick (the renderer negates them along the axis). The
 * extension is one major division wide, so `extensionModelLengthMm` should be the
 * major-division step. Returns `subdivisions` offsets (excluding the shared `0`
 * origin, including the far extension end). Empty when `subdivisions ≤ 0`.
 */
export function computeSubdivisionOffsets(
  extensionModelLengthMm: number,
  subdivisions: number,
): number[] {
  if (!Number.isFinite(subdivisions) || subdivisions <= 0) return [];
  const m = Math.floor(subdivisions);
  if (m <= 0) return [];
  const step = extensionModelLengthMm / m;
  const offsets: number[] = [];
  for (let k = 1; k <= m; k++) offsets.push(step * k);
  return offsets;
}

/** The width (canonical-mm) of one major division = the left extension length. */
export function computeDivisionStep(totalModelLengthMm: number, divisions: number): number {
  return totalModelLengthMm / normalizeCount(divisions, 1);
}
