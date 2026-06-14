/**
 * column-renderer-overlays — ADR-363 / ADR-449.
 *
 * Pure canvas overlay painters extracted from `ColumnRenderer` (Google file-size
 * SSoT — 500-line limit, N.7.1). Each painter is a free function: it receives the
 * `ctx`, the `column`, the active `scale`, and a `worldToScreen` projector — and
 * owns ZERO store subscriptions of its own beyond the very same SSoT resolvers the
 * class already used (ADR-040 compliant: the renderer leaf still owns the
 * subscription model; these helpers stay pure-draw).
 *
 * @see ColumnRenderer.ts — the owning renderer (calls every export here)
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnEntity, ColumnKind } from '../types/column-types';
import {
  computeHatchPlan,
  computeCircularHatchPlan,
  resolveMaterialKey,
  HATCH_STROKE_RGBA,
  HATCH_LINE_WIDTH_PX,
  RC_DOT_RADIUS_PX,
  type ColumnMaterialKey,
  type HatchPlan,
} from '../columns/column-hatch-patterns';
import {
  COL_SECTION_OFFSET_PX,
  COL_SECTION_MIN_SCALE,
  COL_SECTION_MIN_FOOTPRINT_PX,
  COL_SECTION_FILL_COLOR,
  COL_SECTION_STROKE_COLOR,
} from '../columns/column-section-profile';
import { resolveColumnSectionOutline } from '../columns/column-section-symbol';
import { resolveSubcategoryStyle } from '../../config/bim-line-weight-resolver';
import { resolveCutState } from '../../config/bim-view-range';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { getLayer } from '../../stores/LayerStore';
import { isConcreteLineweight } from '../../config/lineweight-iso-catalog';

/** Projector from world coordinates to screen coordinates (`worldToScreen`). */
type Projector = (p: Point2D) => Point2D;

/** Read-only vertex list shape shared across the overlay painters. */
type Verts = ReadonlyArray<{ x: number; y: number }>;

// ADR-449 Slice X2 μέρος Β — το `drawColumnFinishOutline` (per-element 2Δ) αφαιρέθηκε: ο σοβάς
// σχεδιάζεται ως ΕΝΑ scene-level merged-silhouette pass στον `DxfRenderer` (κοινή SSoT με 3Δ).

/**
 * Phase 4.5c.2/4.5c.3 — per-material hatch pattern inside footprint clip.
 * Mirror του `SlabRenderer.drawReinforcementHatch` pattern.
 *
 * Circular kind routes through `computeCircularHatchPlan()` (concentric arcs for
 * RC, bbox-clipped lines otherwise)· non-circular routes through `computeHatchPlan`.
 * Skip: `scale < 0.001` (invisible zoom-out, perf saver).
 */
export function drawColumnMaterialHatch(
  ctx: CanvasRenderingContext2D,
  column: ColumnEntity,
  scale: number,
  worldToScreen: Projector,
): void {
  if (scale < 0.001) return;

  const key: ColumnMaterialKey = resolveMaterialKey(column.params.material);
  const plan: HatchPlan = column.kind === 'circular'
    ? computeCircularHatchPlan(
        { x: column.params.position.x, y: column.params.position.y },
        column.params.width / 2,
        key,
      )
    : computeHatchPlan(column.geometry.bbox, key);

  if (plan.lines.length === 0 && plan.dots.length === 0 && plan.arcs.length === 0) return;

  ctx.save();
  drawFootprintPath(ctx, column.geometry.footprint.vertices, worldToScreen);
  ctx.clip();
  ctx.strokeStyle = HATCH_STROKE_RGBA;
  ctx.fillStyle = HATCH_STROKE_RGBA;
  ctx.lineWidth = HATCH_LINE_WIDTH_PX[key];
  ctx.setLineDash([]);
  paintHatchPlan(ctx, plan, scale, worldToScreen);
  ctx.restore();
}

/** Paint the resolved hatch plan (lines + RC dots + circular arcs) inside the clip. */
function paintHatchPlan(
  ctx: CanvasRenderingContext2D,
  plan: HatchPlan,
  scale: number,
  worldToScreen: Projector,
): void {
  for (const line of plan.lines) {
    const a = worldToScreen(line.start);
    const b = worldToScreen(line.end);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const dot of plan.dots) {
    const s = worldToScreen(dot.center);
    ctx.beginPath();
    ctx.arc(s.x, s.y, RC_DOT_RADIUS_PX, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const arc of plan.arcs) {
    const s = worldToScreen(arc.center);
    const rPx = arc.radiusMm * scale;
    if (rPx < 0.5) continue;
    ctx.beginPath();
    ctx.arc(s.x, s.y, rPx, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * Phase 4.5c.3 — dimension labels for L-shape (armLength + armWidth), T-shape
 * (flangeLength + webThickness), polygon (`N=k`) and I-shape (b/h) when the column
 * is highlighted. Vertex order matches `buildLshapeLocal`/`buildTshapeLocal`/
 * `buildIShapeLocal` in `column-geometry.ts`. Pure canvas draw (ADR-040).
 */
export function drawColumnVariantDimensionLabels(
  ctx: CanvasRenderingContext2D,
  column: ColumnEntity,
  worldToScreen: Projector,
): void {
  if (!hasVariantLabels(column.kind)) return;
  const verts = column.geometry.footprint.vertices;

  ctx.save();
  ctx.font = '8px sans-serif';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.60)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (column.kind === 'L-shape' && verts.length === 6) {
    drawDimLabel(ctx, verts[3], verts[4], `${Math.round(column.params.depth / 3)} `, worldToScreen);
    drawDimLabel(ctx, verts[0], verts[3], `${Math.round(column.params.width / 3)} `, worldToScreen);
  } else if (column.kind === 'T-shape' && verts.length === 8) {
    const fl = column.params.tshape?.flangeLength ?? column.params.width;
    const wt = column.params.tshape?.webThickness ?? Math.round(column.params.depth / 3);
    drawDimLabel(ctx, verts[4], verts[5], `${Math.round(fl)} `, worldToScreen);
    drawDimLabel(ctx, verts[1], verts[2], `${Math.round(wt)} `, worldToScreen);
  } else if (column.kind === 'polygon' && verts.length >= 3) {
    drawPolygonSideLabel(ctx, column, verts, worldToScreen);
  } else if (column.kind === 'I-shape' && verts.length === 12) {
    drawIShapeLabels(ctx, column, verts, worldToScreen);
  }

  ctx.restore();
}

/**
 * ADR-363 Phase 8 — polygon `N=k` annotation centred above the top vertex.
 * `params.polygon.sides` falls back to the rendered vertex count when the
 * override is absent (clamped already by `column-geometry`).
 */
function drawPolygonSideLabel(
  ctx: CanvasRenderingContext2D,
  column: ColumnEntity,
  verts: Verts,
  worldToScreen: Projector,
): void {
  const sides = column.params.polygon?.sides ?? verts.length;
  const top = verts[pickTopVertexIndex(verts)];
  const s = worldToScreen({ x: top.x, y: top.y });
  ctx.fillText(`N=${sides}`, s.x, s.y - 10);
}

/**
 * ADR-363 Phase 8 — I-shape dimensions. Vertex 0 lives at (-b/2, -h/2) and
 * vertex 6 at (+b/2, +h/2) for the canonical 12-vertex CCW outline emitted by
 * `buildIShapeLocal()`. Flange width spans verts[0]↔verts[1]; section depth spans
 * verts[1]↔verts[6] across the right flange-edge.
 */
function drawIShapeLabels(
  ctx: CanvasRenderingContext2D,
  column: ColumnEntity,
  verts: Verts,
  worldToScreen: Projector,
): void {
  drawDimLabel(ctx, verts[0], verts[1], `b=${Math.round(column.params.width)} `, worldToScreen);
  drawDimLabel(ctx, verts[1], verts[6], `h=${Math.round(column.params.depth)} `, worldToScreen);
}

/**
 * Draw a small dimension label at the midpoint of segment [a, b] with a short
 * perpendicular tick mark.
 */
function drawDimLabel(
  ctx: CanvasRenderingContext2D,
  a: Readonly<{ x: number; y: number }>,
  b: Readonly<{ x: number; y: number }>,
  text: string,
  worldToScreen: Projector,
): void {
  const sa = worldToScreen(a);
  const sb = worldToScreen(b);
  const mx = (sa.x + sb.x) / 2;
  const my = (sa.y + sb.y) / 2;
  const dx = sb.x - sa.x;
  const dy = sb.y - sa.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 6) return;
  const nx = -dy / len;
  const ny = dx / len;
  const OFFSET_PX = 9;

  ctx.save();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 0.7;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(sa.x, sa.y);
  ctx.lineTo(sb.x, sb.y);
  ctx.stroke();
  ctx.restore();

  ctx.fillText(text, mx + nx * OFFSET_PX, my + ny * OFFSET_PX);
}

/**
 * Phase 4.5c.6 / 8 / 2b — section-profile symbol (hover + selection only).
 *
 * Draws a fixed-size section symbol to the right of the column bbox, vertically
 * centred. The per-kind outline + material gate live in the
 * `resolveColumnSectionOutline` SSoT (∟/⊤ steel L/T, Π/σύνθετο RC τοιχία); this
 * helper owns only canvas placement + styling. ADR-040 compliant: ZERO new store
 * subscriptions beyond the same V/G resolver the class used.
 */
export function drawColumnSectionProfile(
  ctx: CanvasRenderingContext2D,
  column: ColumnEntity,
  scale: number,
  worldToScreen: Projector,
): void {
  if (scale < COL_SECTION_MIN_SCALE) return;
  const outline = resolveColumnSectionOutline(column);
  if (!outline || outline.length === 0) return;

  const { lineWidthPx, color } = resolveSectionProfileStyle(column);

  const bb = column.geometry.bbox;
  const minS = worldToScreen({ x: bb.min.x, y: bb.min.y });
  const maxS = worldToScreen({ x: bb.max.x, y: bb.max.y });
  const footprintSpan = Math.max(Math.abs(maxS.x - minS.x), Math.abs(maxS.y - minS.y));
  if (footprintSpan < COL_SECTION_MIN_FOOTPRINT_PX) return;

  // Symbol centre: to the right of bbox, vertically centred in screen space.
  const cx = Math.max(minS.x, maxS.x) + COL_SECTION_OFFSET_PX;
  const cy = (minS.y + maxS.y) / 2;
  paintSectionSymbol(ctx, outline, cx, cy, lineWidthPx, color);
}

/** Resolve the section-profile lineweight + colour via the shared V/G SSoT. */
function resolveSectionProfileStyle(
  column: ColumnEntity,
): { lineWidthPx: number; color: string | null } {
  const ds = useDrawingScaleStore.getState();
  const layer = column.layerId ? getLayer(column.layerId) : null;
  const layerOverride = layer ? {
    lineweightMm: isConcreteLineweight(layer.lineweight) ? layer.lineweight : undefined,
    color: layer.color ?? undefined,
  } : undefined;
  const cutState = resolveCutState(
    { zBottomMm: column.params.baseOffset ?? 0, zTopMm: (column.params.baseOffset ?? 0) + column.params.height, category: 'column' },
    ds.viewRange,
  );
  return resolveSubcategoryStyle({
    category: 'column', subcategoryKey: 'section-profile',
    cutState, scaleDenominator: ds.drawingScale,
    dpi: 96, objectStyles: ds.objectStyles,
    elementOverride: column.styleOverride, layerOverride,
  });
}

/** Paint the closed section outline at screen-space centre (cx, cy). */
function paintSectionSymbol(
  ctx: CanvasRenderingContext2D,
  outline: Verts,
  cx: number,
  cy: number,
  lineWidthPx: number,
  strokeColor: string | null,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(outline[0].x, outline[0].y);
  for (let i = 1; i < outline.length; i++) {
    ctx.lineTo(outline[i].x, outline[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = COL_SECTION_FILL_COLOR;
  ctx.fill();
  ctx.strokeStyle = strokeColor ?? COL_SECTION_STROKE_COLOR;
  ctx.lineWidth = lineWidthPx;
  ctx.stroke();
  ctx.restore();
}

/** Build a closed footprint path in screen space (caller decides fill/clip/stroke). */
function drawFootprintPath(
  ctx: CanvasRenderingContext2D,
  vertices: Verts,
  worldToScreen: Projector,
): void {
  if (vertices.length < 3) return;
  ctx.beginPath();
  const first = worldToScreen({ x: vertices[0].x, y: vertices[0].y });
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < vertices.length; i++) {
    const s = worldToScreen({ x: vertices[i].x, y: vertices[i].y });
    ctx.lineTo(s.x, s.y);
  }
  ctx.closePath();
}

/** Kinds whose highlighted state shows dimension annotations. shear-wall stays
 *  unannotated — its rectangular outline is self-explanatory. */
function hasVariantLabels(kind: ColumnKind): boolean {
  return kind === 'L-shape' || kind === 'T-shape' || kind === 'polygon' || kind === 'I-shape';
}

/** Index of the vertex with the maximum world Y (top of polygon). */
function pickTopVertexIndex(verts: Verts): number {
  let idx = 0;
  let topY = verts[0].y;
  for (let i = 1; i < verts.length; i++) {
    if (verts[i].y > topY) {
      topY = verts[i].y;
      idx = i;
    }
  }
  return idx;
}
