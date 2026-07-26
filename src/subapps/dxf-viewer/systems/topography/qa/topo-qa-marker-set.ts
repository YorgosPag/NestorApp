/**
 * ADR-650 M5α.2 — what a QA report contributes to a marker overlay, in one place.
 *
 * The 2D (`canvas-layer-stack-topo-qa-overlay`) and 3D (`TopoQaMarkers3DOverlay`) overlays differ
 * ONLY in how a flag becomes a position — 2D reads `flag.at` straight (world mm IS the canvas
 * frame), 3D runs the geo/datum/axis chain. Everything else was identical in both: the same
 * flag→glyph mapping, the same null-report-means-empty-array shape. `jscpd --diff` caught it as a
 * clone inside the very commit that introduced the second copy (N.18).
 *
 * So the two overlays now keep only their own `map` callback, and the parts that must never
 * disagree — the severity→glyph vocabulary, and the guarantee that both arrays are index-aligned
 * with `report.flags` — live here. Index alignment is the load-bearing one: the layer positions
 * marker `i` using `project(i)`, so a positions array that ever gets filtered while the glyph array
 * does not would silently draw every marker at its neighbour's spot.
 *
 * Pure functions, not hooks: the callers wrap them in `useMemo(…, [report])` themselves, because
 * only they know their own dependencies.
 *
 * @see ../../../components/dxf-layout/clash-markers/ClashMarkerGlyph.tsx — the shared ⊙
 */

import type { ClashMarkerGlyphProps } from '../../../components/dxf-layout/clash-markers/ClashMarkerGlyph';
import type { TopoQaFlag, TopoQaReport } from './topo-qa-types';

/**
 * One glyph spec per flag, index-aligned with `report.flags`.
 *
 * QA severity IS the clash severity vocabulary (`high`/`medium`/`low`), so the glyph is reused
 * verbatim — one attention-marker shape across the app (ADR-435 SSoT). `soft` is always false: QA
 * has no «clearance» variant, because a survey blunder is never a near-miss.
 *
 * `selectedFlagId` marks the row the engineer just clicked so its ⊙ stands out (bigger + selection
 * halo). It lives here rather than in each overlay so 2D and 3D cannot disagree about which marker
 * is the focused one — the exact drift the shared glyph exists to prevent.
 */
export function topoQaMarkerGlyphs(
  report: TopoQaReport | null,
  selectedFlagId: string | null = null,
): ClashMarkerGlyphProps[] {
  if (!report) return [];
  return report.flags.map((f) => ({
    severity: f.severity,
    soft: false,
    selected: f.id === selectedFlagId,
  }));
}

/**
 * One position per flag, index-aligned with `report.flags` — `map` supplies the view's own frame.
 *
 * Note `map` may return `null` (3D: no resolvable elevation); the slot is KEPT so the alignment
 * with {@link topoQaMarkerGlyphs} holds, and the caller's projector hides it.
 */
export function topoQaMarkerPositions<T>(
  report: TopoQaReport | null,
  map: (flag: TopoQaFlag) => T,
): T[] {
  if (!report) return [];
  return report.flags.map(map);
}
