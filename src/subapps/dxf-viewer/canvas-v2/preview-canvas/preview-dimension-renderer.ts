/**
 * ADR-362 Phase C2 — Live dimension preview renderer (PreviewCanvas overlay).
 *
 * Pure function `renderPreviewDimension` that draws a dim entity-in-construction
 * on the PreviewCanvas overlay (ADR-040). Reuses the Phase B geometry builder
 * + Phase C1 text/arrowhead helpers; overrides styling with preview tokens:
 *   - solid stroke in `CAD_UI_COLORS.entity.preview` (bright green) — matches
 *     the convention of `preview-entity-renderers.ts` for line/circle/etc.
 *   - `globalAlpha = OPACITY.HIGH` (0.9) so the dim still reads as "under
 *     construction" without losing legibility.
 *   - text + arrows reuse the Phase C1 pipeline; preview color is injected via
 *     a temporary DIMSTYLE clone (`dimclrd`/`dimclre`/`dimclrt` → ACI sentinel
 *     `ByLayer` + `layerColour` override = preview color).
 *
 * The geometry builder is called WITHOUT a `DimensionLookup`, so baseline /
 * continued chains during initial creation fall back to a no-op (their parent
 * isn't yet committed). The builder throws on missing parent → we swallow and
 * render nothing (consistent with `DimensionRenderer.resolveFromEntity`).
 *
 * Out of scope (later phases):
 *   - Rubber-band helper line between cursor and dim line offset point — added
 *     when Phase D1 wires the creation flow (extra `helperPath: Point2D[]`
 *     param will arrive here with a dashed render path).
 *   - Snap markers + grips (Phase I).
 *   - Multi-step previews for baseline/continued chains (Phase D3).
 */

import type { DimensionEntity, DimStyle } from '../../types/dimension';
import type { LineweightMm } from '../../types/entities';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
// ADR-562 Φ2 — WYSIWYG preview: honor the committed per-part lineweight + dash
// via the SAME shared SSoT the main renderer uses (keeps the preview color).
import { resolveDimStroke } from '../../rendering/entities/dimension/dim-stroke-resolver';
import {
  buildDimensionGeometry,
  type AngularDimGeometry,
  type DimGeometry,
  type DimLineSegment,
  type RadialDimGeometry,
} from '../../systems/dimensions/dim-geometry-builder';
import { renderDimArrowheadPair } from '../../rendering/entities/dimension/dim-arrowhead-renderer';
import { renderDimensionText } from '../../rendering/entities/dimension/dim-text-renderer';
// ADR-362 Phase M — text-fit resolver (SRP split): decides the DIMATFIT/DIMTMOVE
// fit via the shared `assembleDimFit` SSoT so preview === committed decision.
import { computePreviewFit, type PreviewFit } from './preview-dimension-fit';
import { resolveEffectiveDimscale } from '../../utils/annotation-scale';
import { addPoints, scalePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { resolveArrowBlockNames } from '../../systems/dimensions/dim-arrowhead-blocks';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { CAD_UI_COLORS, OPACITY } from '../../config/color-config';
import { LINE_DASH_PATTERNS } from '../../config/text-rendering-config';
import { applyOverlayLineStyle } from './overlay-line-style';
import { projectorScaleAt, type OverlayProjector } from './overlay-projector';

// ──────────────────────────────────────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────────────────────────────────────

export interface PreviewDimensionRenderOptions {
  /** Stroke + arrow + text color. Default = bright green preview token. */
  readonly color?: string;
  /** Canvas globalAlpha applied to the whole preview. Default = OPACITY.HIGH. */
  readonly opacity?: number;
  /** Optional rubber-band helper polyline (dashed). Phase D1+ supplies this. */
  readonly helperPath?: readonly Point2D[];
  /** Color for `helperPath`. Default = same as `color`. */
  readonly helperColor?: string;
  /** Alpha for `helperPath`. Default = OPACITY.MEDIUM. */
  readonly helperOpacity?: number;
  /**
   * ADR-508 §dim — stroke the dim line + extension lines with the shared overlay-guide-line
   * SSoT (`applyOverlayLineStyle`: 0.5px dashed [8,5]) instead of the committed-dim solid 1px.
   * `true` for listening dims so they match the alignment traces / polar line exactly.
   */
  readonly overlayLineStyle?: boolean;
}

export interface PreviewDimensionRenderParams {
  readonly ctx: CanvasRenderingContext2D;
  readonly entity: DimensionEntity;
  readonly style: DimStyle;
  readonly transform: ViewTransform;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly opts?: PreviewDimensionRenderOptions;
  /**
   * ADR-362 Round 5 — active scene unit system. Optional because the preview
   * auto-scales DIMSCALE anyway (≈10px arrows regardless of unit); forwarding
   * `sceneUnits` keeps text + DIMTFILL math consistent with the persistent
   * `DimensionRenderer` path. Default `'mm'`.
   */
  readonly sceneUnits?: 'mm' | 'cm' | 'm' | 'in' | 'ft';
  /**
   * ADR-544 — όταν δίνεται, η προβολή world→screen + το sizing (arrows/arc radius) περνούν από
   * αυτόν τον projector αντί για `transform` (3D camera overlay). Όταν `undefined`, το 2D path
   * μένει **byte-identical** (χρησιμοποιεί `transform.scale` + `worldToScreen` όπως πάντα). Το
   * text (`renderDimensionText`) εξακολουθεί να διαβάζει `transform`· οι overlay listening dims
   * καταστέλλουν το text (`userText: ''`), οπότε στο 3D δεν ζωγραφίζεται text μέσω αυτού.
   */
  readonly project?: OverlayProjector;
}

/** Screen px ανά 1 world/scene unit: από τον projector (ADR-544) όταν υπάρχει, αλλιώς `transform.scale`. */
function viewScaleOf(params: PreviewDimensionRenderParams): number {
  if (!params.project) return params.transform.scale;
  return projectorScaleAt(params.project, params.entity.defPoints[0] ?? { x: 0, y: 0 });
}

// ──────────────────────────────────────────────────────────────────────────────
// Resolved options
// ──────────────────────────────────────────────────────────────────────────────

interface ResolvedOpts {
  readonly color: string;
  readonly opacity: number;
  readonly helperPath: readonly Point2D[] | null;
  readonly helperColor: string;
  readonly helperOpacity: number;
  readonly overlayLineStyle: boolean;
}

function resolveOpts(o: PreviewDimensionRenderOptions | undefined): ResolvedOpts {
  const color = o?.color ?? CAD_UI_COLORS.entity.preview;
  return {
    color,
    opacity: o?.opacity ?? OPACITY.HIGH,
    helperPath: o?.helperPath && o.helperPath.length >= 2 ? o.helperPath : null,
    helperColor: o?.helperColor ?? color,
    helperOpacity: o?.helperOpacity ?? OPACITY.MEDIUM,
    overlayLineStyle: o?.overlayLineStyle ?? false,
  };
}

/**
 * Stroke setup for the dim line + extension lines. Either the shared overlay
 * SSoT (listening dims — special dashed state, untouched by per-part styling) or,
 * for a normal preview, the resolved per-part weight + dash (ADR-562 Φ2) so the
 * preview matches what the committed dim will look like — while keeping the
 * preview color override (green under-construction convention).
 */
function applyDimStroke(
  ctx: CanvasRenderingContext2D,
  opts: ResolvedOpts,
  lineweight: LineweightMm,
  linetype: string,
  worldToScreenScale: number,
  ltScale?: number,
): void {
  if (opts.overlayLineStyle) {
    applyOverlayLineStyle(ctx, opts.color);
    return;
  }
  // ADR-362 — WYSIWYG: mirror the committed per-style DIMLTSCALE density (Path A).
  const stroke = resolveDimStroke(lineweight, linetype, worldToScreenScale, ltScale);
  ctx.strokeStyle = opts.color;
  ctx.lineWidth = stroke.lineWidthPx;
  ctx.setLineDash(stroke.dashPx);
  ctx.lineCap = 'butt';
}

// ──────────────────────────────────────────────────────────────────────────────
// Entry point
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Render a dim entity-in-construction onto the PreviewCanvas overlay.
 * Geometry-builder failures (e.g. partial def points, missing chain parent)
 * are swallowed so a half-built dim doesn't crash the overlay.
 */
export function renderPreviewDimension(params: PreviewDimensionRenderParams): void {
  // Auto-scale DIMSCALE so arrows + text appear at ~10 px on screen regardless
  // of the drawing's unit scale. Formula: target_px = dimasz * dimscale * scale
  // → dimscale = 4 / scale keeps arrows ≈ 10px (2.5 * 4 = 10).
  const autoScale = 4 / Math.max(viewScaleOf(params), 1e-6);
  const scaledParams: PreviewDimensionRenderParams = {
    ...params,
    style: { ...params.style, dimscale: autoScale },
  };

  const opts = resolveOpts(scaledParams.opts);
  const geometry = tryBuildGeometry(scaledParams.entity, scaledParams.style);

  // AutoCAD/Revit rubber-band: when geometry isn't yet buildable (e.g. only 1
  // click placed so far and we're waiting for the 2nd), derive a dashed
  // polyline from the available defPoints so the user sees real-time feedback.
  // Explicit opts.helperPath always wins over auto-derived.
  const autoHelper: readonly Point2D[] | null =
    !geometry && !opts.helperPath && scaledParams.entity.defPoints.length >= 2
      ? scaledParams.entity.defPoints
      : null;
  const resolvedOpts: ResolvedOpts = autoHelper
    ? { ...opts, helperPath: autoHelper }
    : opts;

  if (!geometry && !resolvedOpts.helperPath) return;

  scaledParams.ctx.save();
  scaledParams.ctx.globalAlpha = resolvedOpts.opacity;

  if (geometry) {
    // ADR-362 Phase M — text-fit decided from the REAL (committed-scale) metrics so
    // the preview decision matches the persistent DimensionRenderer (preview===commit).
    const fit = computePreviewFit({
      ctx: params.ctx,
      entity: params.entity,
      style: params.style,
      geometry,
      transform: params.transform,
      viewport: params.viewport,
      sceneUnits: params.sceneUnits,
      viewScale: viewScaleOf(params),
    });
    drawExtensionLines(scaledParams, geometry, resolvedOpts);
    drawDimLineOrArc(scaledParams, geometry, resolvedOpts, fit);
    drawArrowheads(scaledParams, geometry, resolvedOpts, fit);
    drawFitLeader(scaledParams, resolvedOpts, fit);
    // ADR-362 R9 — text uses the ORIGINAL params (real dimscale + real sceneUnits) so
    // preview text matches committed DimensionRenderer output; autoScale applies only to arrows.
    drawText(params, geometry, resolvedOpts, fit);
  }

  if (resolvedOpts.helperPath) {
    drawHelperPolyline(scaledParams, resolvedOpts);
  }

  scaledParams.ctx.restore();
}

function tryBuildGeometry(entity: DimensionEntity, style: DimStyle): DimGeometry | null {
  try {
    return buildDimensionGeometry(entity, style);
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Geometry pieces — mirror DimensionRenderer.drawX but with preview styling
// ──────────────────────────────────────────────────────────────────────────────

function drawExtensionLines(
  params: PreviewDimensionRenderParams,
  geometry: DimGeometry,
  opts: ResolvedOpts,
): void {
  const ext1 = readExtLine(geometry, 1);
  const ext2 = readExtLine(geometry, 2);
  if (!ext1 && !ext2) return;
  applyDimStroke(params.ctx, opts, params.style.dimlwe, params.style.dimltex1, viewScaleOf(params), params.style.dimltexscale);
  if (ext1 && !params.style.suppressExtLine1) strokeSegment(params, ext1);
  if (ext2 && !params.style.suppressExtLine2) strokeSegment(params, ext2);
}

function drawDimLineOrArc(
  params: PreviewDimensionRenderParams,
  geometry: DimGeometry,
  opts: ResolvedOpts,
  fit?: PreviewFit | null,
): void {
  applyDimStroke(params.ctx, opts, params.style.dimlwd, params.style.dimltype, viewScaleOf(params), params.style.dimltscale);
  switch (geometry.kind) {
    case 'linear':
      if (!params.style.suppressDimLine1 && !params.style.suppressDimLine2) {
        // ADR-362 Phase M — mirror DimensionRenderer: suppress the inside dim line
        // only when both text + arrows go outside w/o DIMTOFL; add outside stubs.
        if (!fit || fit.fit.drawDimLineInside) {
          strokeSegment(params, geometry.dimLine);
        }
        if (fit?.fit.arrowsOutside) {
          const len = 2 * fit.arrowSize;
          strokeSegment(params, {
            start: geometry.dimLine.start,
            end: addPoints(geometry.dimLine.start, scalePoint(geometry.arrowDirection1, len)),
          });
          strokeSegment(params, {
            start: geometry.dimLine.end,
            end: addPoints(geometry.dimLine.end, scalePoint(geometry.arrowDirection2, len)),
          });
        }
      }
      return;
    case 'angular':
      strokeArc(params, geometry);
      // ADR-362 Phase M — tangent stubs at the arc ends when arrows flip outside.
      if (fit?.fit.arrowsOutside) {
        const len = 2 * fit.arrowSize;
        strokeSegment(params, {
          start: geometry.arrowAnchor1,
          end: addPoints(geometry.arrowAnchor1, scalePoint(geometry.arrowDirection1, len)),
        });
        strokeSegment(params, {
          start: geometry.arrowAnchor2,
          end: addPoints(geometry.arrowAnchor2, scalePoint(geometry.arrowDirection2, len)),
        });
      }
      return;
    case 'radial':
      strokeLeader(params, geometry);
      return;
    default: {
      const _exhaustive: never = geometry;
      throw new Error(`[preview-dimension-renderer] Unknown geometry kind: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function drawArrowheads(
  params: PreviewDimensionRenderParams,
  geometry: DimGeometry,
  opts: ResolvedOpts,
  fit?: PreviewFit | null,
): void {
  const { block1, block2 } = resolveArrowBlockNames(params.style);
  const unitPx = params.style.dimasz * params.style.dimscale * viewScaleOf(params);
  // ADR-362 §7 — block-pair resolution, the per-side suppress gate, and the
  // stamping loop live in the shared `renderDimArrowheadPair` SSoT (preview ≡ commit:
  // the ghost must vanish/appear exactly like the committed dim). What differs per
  // renderer — unitPx, preview color, ctx, screen-projected anchors/dirs — is input.
  renderDimArrowheadPair(params.ctx, {
    block1Name: block1,
    block2Name: block2,
    anchor1Screen: toScreen(params, geometry.arrowAnchor1),
    anchor2Screen: toScreen(params, geometry.arrowAnchor2),
    // ADR-362 Phase M — flipped directions when DIMATFIT pushes arrows outside.
    dir1: fit?.placement.arrowDirection1 ?? geometry.arrowDirection1,
    dir2: fit?.placement.arrowDirection2 ?? geometry.arrowDirection2,
    unitPx,
    color: opts.color,
    suppress1: params.style.suppressArrow1,
    suppress2: params.style.suppressArrow2,
  });
}

/**
 * ADR-362 Phase M — leader from the dim line to the moved-out text (DIMTMOVE=1),
 * mirroring `DimensionRenderer.drawFitLeader`. Uses the preview stroke SSoT.
 */
function drawFitLeader(
  params: PreviewDimensionRenderParams,
  opts: ResolvedOpts,
  fit?: PreviewFit | null,
): void {
  const path = fit?.placement.leaderPath;
  if (!path || path.length < 2) return;
  applyDimStroke(params.ctx, opts, params.style.dimlwd, params.style.dimltype, viewScaleOf(params), params.style.dimltscale);
  for (let i = 1; i < path.length; i++) {
    strokeSegment(params, { start: path[i - 1], end: path[i] });
  }
}

function drawText(
  params: PreviewDimensionRenderParams,
  geometry: DimGeometry,
  opts: ResolvedOpts,
  fit?: PreviewFit | null,
): void {
  // ADR-362 R14 — preview text must match committed output, which heals dimscale
  // via the same SSoT in DimensionRenderer.resolveFromEntity. Apply the identical
  // `resolveEffectiveDimscale` here (real dimscale, NOT the arrow autoScale) so a
  // built-in dimscale=1 renders at the drawingScale size in the preview too.
  const drawingScale = useDrawingScaleStore.getState().drawingScale;
  const healedStyle = {
    ...params.style,
    dimscale: resolveEffectiveDimscale(params.style.dimscale, drawingScale),
  };
  // Text renderer reads style.dimclrt for color; force it to the preview
  // color via the layerColour fallback (DIMSTYLE clone sets clrt = ByLayer).
  const previewStyle = withPreviewColors(healedStyle);
  renderDimensionText(params.ctx, {
    entity: params.entity,
    geometry,
    style: previewStyle,
    transform: params.transform,
    viewport: params.viewport,
    layerColour: opts.color,
    sceneUnits: params.sceneUnits,
    // ADR-362 Phase M — draw text at the moved-out anchor when DIMATFIT pushes it outside.
    textAnchorOverride: fit && fit.fit.textOutside ? fit.placement.textAnchor : undefined,
  });
}

function drawHelperPolyline(
  params: PreviewDimensionRenderParams,
  opts: ResolvedOpts,
): void {
  if (!opts.helperPath) return;
  params.ctx.save();
  params.ctx.globalAlpha = opts.helperOpacity;
  params.ctx.strokeStyle = opts.helperColor;
  params.ctx.lineWidth = 1;
  params.ctx.setLineDash([...LINE_DASH_PATTERNS.DASHED]);
  params.ctx.beginPath();
  const first = toScreen(params, opts.helperPath[0]);
  params.ctx.moveTo(first.x, first.y);
  for (let i = 1; i < opts.helperPath.length; i++) {
    const p = toScreen(params, opts.helperPath[i]);
    params.ctx.lineTo(p.x, p.y);
  }
  params.ctx.stroke();
  params.ctx.restore();
}

// ──────────────────────────────────────────────────────────────────────────────
// Canvas helpers
// ──────────────────────────────────────────────────────────────────────────────

const ACI_BYLAYER = 256;

function withPreviewColors(style: DimStyle): DimStyle {
  // Cheap clone: only the color fields need overriding. ByLayer (256) routes
  // resolveDimColor() to the `layerColour` fallback which the caller has set
  // to the preview color.
  // ADR-562 Φ7 — also clear the true-color companions so a stored exact hex does
  // not shadow the ByLayer→preview-colour routing above.
  return {
    ...style,
    dimclrd: ACI_BYLAYER, dimclre: ACI_BYLAYER, dimclrt: ACI_BYLAYER,
    dimclrdTrueColor: null, dimclreTrueColor: null, dimclrtTrueColor: null, arrowTrueColor: null,
  };
}

function strokeSegment(params: PreviewDimensionRenderParams, seg: DimLineSegment): void {
  const a = toScreen(params, seg.start);
  const b = toScreen(params, seg.end);
  params.ctx.beginPath();
  params.ctx.moveTo(a.x, a.y);
  params.ctx.lineTo(b.x, b.y);
  params.ctx.stroke();
}

function strokeArc(params: PreviewDimensionRenderParams, geom: AngularDimGeometry): void {
  const centre = toScreen(params, geom.arcCenter);
  const radiusPx = geom.arcRadius * viewScaleOf(params);
  // Mirror DimensionRenderer: Y-flip → negate angles + invert orientation.
  const start = -geom.arcStartAngle;
  const end = -geom.arcEndAngle;
  const counterclockwise = (geom.arcEndAngle - geom.arcStartAngle) > 0;
  params.ctx.beginPath();
  params.ctx.arc(centre.x, centre.y, radiusPx, start, end, counterclockwise);
  params.ctx.stroke();
}

function strokeLeader(params: PreviewDimensionRenderParams, geom: RadialDimGeometry): void {
  if (geom.leaderPath.length < 2) return;
  params.ctx.beginPath();
  const first = toScreen(params, geom.leaderPath[0]);
  params.ctx.moveTo(first.x, first.y);
  for (let i = 1; i < geom.leaderPath.length; i++) {
    const p = toScreen(params, geom.leaderPath[i]);
    params.ctx.lineTo(p.x, p.y);
  }
  params.ctx.stroke();
}

function toScreen(params: PreviewDimensionRenderParams, p: Point2D): Point2D {
  // ADR-544 — 3D camera projector όταν υπάρχει· αλλιώς το 2D `worldToScreen` (αμετάβλητο).
  return params.project ? params.project(p) : CoordinateTransforms.worldToScreen(p, params.transform, params.viewport);
}

function readExtLine(geom: DimGeometry, side: 1 | 2): DimLineSegment | null {
  if (geom.kind === 'linear' || geom.kind === 'angular') {
    return side === 1 ? geom.extLine1 : geom.extLine2;
  }
  return null;
}
