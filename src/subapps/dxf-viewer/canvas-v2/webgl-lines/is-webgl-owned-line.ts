/**
 * ADR-639 Στάδιο 5 — WebGL line-layer ownership predicate (SSoT, correctness invariant).
 *
 * ONE predicate decides whether an entity is drawn by the GPU line layer instead
 * of the Canvas2D `DxfRenderer`. It is consumed by BOTH sides of the hand-off so
 * they can never disagree:
 *   • the buffer builder (`webgl-line-buffer-builder.ts`) INCLUDES an entity iff
 *     this returns true → it goes into a persistent `LineSegments2` bucket;
 *   • the `DxfRenderer` LINE/polyline path SUPPRESSES its Canvas2D stroke iff this
 *     returns true → the GPU owns it.
 * Because it is the single source, an entity can never be both drawn twice nor
 * left undrawn.
 *
 * It mirrors EXACTLY the exclusions of the `DxfRenderer` LINE batch loop
 * (`DxfRenderer.ts:157-185`) so the GPU set is a strict subset of what Canvas2D
 * would otherwise stroke:
 *   type==='line' (or a plain polyline) · visible · layer-not-frozen ·
 *   not-selected · not-hovered · not-measurement · linetype solid (raw meta AND
 *   resolved dash pattern empty).
 *
 * Viewport culling is intentionally NOT part of ownership: the GPU buffer is built
 * once for the WHOLE scene (off-screen segments are clipped for free by the ortho
 * camera), and the `DxfRenderer` already culls before it reaches this check.
 *
 * Interaction independence (ADR-040 rule 3): the buffer builder passes a context
 * whose `isSelected`/`isHovered` are always-false, so selection/hover state never
 * enters the buffer or its rebuild key — a selected line stays in the GPU buffer
 * and is simply overpainted by the Canvas2D `renderSingleEntity` overlay on top.
 * The `DxfRenderer` suppression path passes the LIVE selection/hover context, so a
 * selected/hovered line is NOT suppressed and keeps its Canvas2D highlight.
 *
 * @see canvas-v2/dxf-canvas/DxfRenderer.ts:157-185 — the mirrored exclusions
 * @see canvas-v2/dxf-canvas/dxf-renderer-style-resolve.ts — resolvedStyle source
 */

import type { DxfEntityUnion, DxfPolyline } from '../dxf-canvas/dxf-types';
import type { ResolvedRenderStyle } from '../dxf-canvas/dxf-renderer-style-resolve';
// ADR-642 Φ2-B — a complex linetype (embedded text/symbols) is stroked per-entity via the
// Canvas2D complex stroker, never by the flat GPU `LineSegments2` layer.
import { isSimpleExpressible } from '../../config/complex-linetype-adapters';

/**
 * Frame/build-time context the predicate needs to mirror the `DxfRenderer` loop.
 * Providers differ per caller so ONE predicate serves both include & suppress:
 *   • buffer builder → `isSelected`/`isHovered` return false (rule-3 independence);
 *   • DxfRenderer suppression → live selection Set / hovered id.
 */
export interface WebglLineOwnershipContext {
  /** Mirror of `DxfRenderer.isEntityLayerSkipped` — frozen/invisible/cut-plane layer. */
  readonly isLayerSkipped: (entity: DxfEntityUnion) => boolean;
  /** Selection membership. Always false at buffer-build time (ADR-040 rule 3). */
  readonly isSelected: (entityId: string) => boolean;
  /** Hover membership. Always false at buffer-build time (ADR-040 rule 3). */
  readonly isHovered: (entityId: string) => boolean;
}

/** Tolerance below which a polyline bulge/width counts as "none" (straight, zero-width). */
const ZERO_EPSILON = 1e-9;

/** True when every value is absent or effectively zero (bulge-free / width-free). */
function allNegligible(values: readonly number[] | undefined): boolean {
  if (!values || values.length === 0) return true;
  for (const v of values) {
    if (Math.abs(v) > ZERO_EPSILON) return false;
  }
  return true;
}

/**
 * A polyline is "plain" (GPU-eligible) only when every segment is straight and
 * zero-width: no bulges, no per-vertex start/end widths, and no constant width.
 * Bulged or width-band polylines stay on Canvas2D (arc tessellation / variable- or
 * constant-width strokes are out of scope for the flat `LineSegments2` bulk layer —
 * those go through `PolylineRenderer.renderPolylineWidthBands`). Mirrors the
 * `hasAnyWidth`/`hasAnyBulge` gate in `PolylineRenderer.ts:66-77`, incl. the
 * `constantWidth` scalar the renderer casts in (absent from the `DxfPolyline` type).
 */
function isPlainPolyline(entity: DxfPolyline): boolean {
  const constantWidth = (entity as DxfPolyline & { constantWidth?: number }).constantWidth;
  return (
    allNegligible(entity.bulges) &&
    allNegligible(entity.startWidths) &&
    allNegligible(entity.endWidths) &&
    (constantWidth === undefined || Math.abs(constantWidth) <= ZERO_EPSILON)
  );
}

/**
 * TRUE iff the entity should be drawn by the WebGL line layer. See file header for
 * the full contract. `resolvedStyle` MUST come from `resolveEntityRenderStyle`
 * (the same SSoT the Canvas2D batch key uses) so GPU and Canvas2D never diverge.
 */
export function isWebglOwnedLine(
  entity: DxfEntityUnion,
  resolvedStyle: ResolvedRenderStyle,
  ctx: WebglLineOwnershipContext,
): boolean {
  // Geometry gate — a straight LINE, or a plain (straight, zero-width) polyline.
  const isLine = entity.type === 'line';
  const isPlainPoly = entity.type === 'polyline' && isPlainPolyline(entity as DxfPolyline);
  if (!isLine && !isPlainPoly) return false;

  // Mirror DxfRenderer.ts:159-167 (viewport cull deliberately excluded — see header).
  if (!entity.visible) return false;
  if (ctx.isLayerSkipped(entity)) return false;
  if (ctx.isSelected(entity.id)) return false;
  if (ctx.isHovered(entity.id)) return false;

  const meta = entity as DxfEntityUnion & { measurement?: boolean; lineType?: string };
  if (meta.measurement) return false;
  // Raw per-entity linetype field (DxfRenderer.ts:167) — anything non-solid opts out.
  if (meta.lineType && meta.lineType !== 'solid') return false;

  // Resolved linetype must also be solid: covers ByLayer/ByBlock/custom linetypes
  // whose dash only surfaces after style resolution. A non-empty dash pattern →
  // stays Canvas2D (LineMaterial world-unit dashes cannot match screen-px dashes).
  if (resolvedStyle.dashMm.length > 0) return false;

  // ADR-642 Φ2-B — a genuine complex linetype (embedded `──GAS──` text) is drawn by the
  // Canvas2D complex stroker along the geometry. Its geometry-only fallback dash is usually
  // non-empty (caught above), but guard explicitly (belt-and-suspenders): the flat GPU layer
  // has no text/symbol capability, so it must never own such a line.
  if (resolvedStyle.complex && !isSimpleExpressible(resolvedStyle.complex)) return false;

  return true;
}
