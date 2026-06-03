/**
 * ADR-375 Phase C.7 — BIM 3D Edge Style Resolver.
 *
 * Mirror του 2D resolveSubcategoryStyle στο 3D pipeline. Reuses the same
 * priority stack — zero duplication.
 *
 * Priority (highest → lowest):
 *   1. cutState=hidden                            → invisible
 *   2. parent.visible=false (C.4)                 → invisible
 *   3. elementOverride.visible=false (C.5)        → invisible
 *   4. elementOverride.cutPen/projectionPen (C.5) → override
 *   5. layerOverride.lineweightMm (C.6)           → bypass pen table
 *   6. subcategory pen / objectStyles / DEFAULT
 *
 * Industry alignment (Phase 1 research):
 *   - Default thresholdAngle 30° matches Revit silhouette + ArchiCAD contour.
 *   - lineWidthPx is the same screen-space pixel value the 2D resolver
 *     produces, applied to LineMaterial.linewidth × devicePixelRatio at the
 *     overlay builder.
 */
import {
  resolveSubcategoryStyle,
  type SubcategoryResolutionContext,
} from '../../config/bim-line-weight-resolver';
import { type LinePatternKey } from '../../config/bim-line-patterns';

/** Revit silhouette default. ArchiCAD contour default. */
export const DEFAULT_EDGE_THRESHOLD_DEG = 30;

export interface Resolved3DEdgeStyle {
  /** Pixel line width — feed into LineMaterial.linewidth × devicePixelRatio. */
  lineWidthPx: number;
  /** Color hex or null (null = caller decides default). */
  color: string | null;
  /**
   * Line pattern key (ADR-377 Phase E). 'solid' → continuous edge overlay;
   * dashed/dotted/etc. → caller maps to LineMaterial dash via
   * `linePatternToDashArray`. Mirrors the 2D resolver's `linePattern` output.
   */
  linePattern: LinePatternKey;
  /** false → caller should skip building the edge overlay entirely. */
  visible: boolean;
  /** EdgesGeometry threshold angle in degrees. */
  thresholdAngle: number;
}

export interface Resolve3DEdgeOptions {
  /** Override the 30° default (e.g. flatter solids may need 45°). */
  thresholdAngleDeg?: number;
}

/**
 * Resolve the edge overlay style for a BIM 3D mesh.
 *
 * Caller passes the same SubcategoryResolutionContext used by the 2D resolver.
 * Returned `visible=false` signals the 2D resolver mapped the input to
 * zero-width (hidden state, V/G off, or per-element invisible) — the caller
 * should NOT build an overlay in that case.
 */
export function resolve3DEdgeStyle(
  ctx: SubcategoryResolutionContext,
  opts: Resolve3DEdgeOptions = {},
): Resolved3DEdgeStyle {
  const style = resolveSubcategoryStyle(ctx);
  const visible = style.lineWidthPx > 0;
  return {
    lineWidthPx: style.lineWidthPx,
    color: style.color,
    linePattern: style.linePattern,
    visible,
    thresholdAngle: opts.thresholdAngleDeg ?? DEFAULT_EDGE_THRESHOLD_DEG,
  };
}
