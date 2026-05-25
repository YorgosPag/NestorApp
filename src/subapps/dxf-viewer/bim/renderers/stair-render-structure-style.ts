/**
 * ADR-358 Phase 7c — 2D plan symbology per `StairStructureType`.
 *
 * Pure render helpers consumed by `StairRenderer`. The 2D plan view used to
 * render the same pixel output for every structure type because both the
 * geometry pipeline and the renderer ignored `params.structureType`; the
 * select on the contextual ribbon mutated state with no visible effect.
 *
 * This module differentiates the render at the renderer boundary
 * (geometry stays SSoT) using the Revit / ArchiCAD / AutoCAD Architecture
 * plan symbology convention:
 *
 * | structureType    | Treads                              | Stringers                       |
 * |------------------|-------------------------------------|---------------------------------|
 * | monolithic       | solid (mass concrete tread outline) | none (mass reads from outline)  |
 * | stringer-1side   | solid                               | outer only, bold solid          |
 * | stringer-2side   | solid                               | both, bold solid (legacy)       |
 * | central-stringer | solid                               | walkline (geometric center), bold solid |
 * | cantilever       | solid                               | inner only (wall mount edge), bold solid |
 * | suspended        | solid                               | both, thin dashed (cable indication) |
 * | glass-tread      | translucent dashed outline          | both, bold solid (frame)        |
 * | steel-grating    | solid + 45° hatch (ISO grating)     | both, bold solid (frame)        |
 *
 * Strokes inherit `ctx.strokeStyle` set upstream by `PhaseManager`
 * (hover glow / selected color / normal entity color) — these helpers
 * never overwrite the upstream phase style; they only mutate `lineWidth`,
 * `setLineDash`, and `fillStyle` (which is local to the tread fill).
 */

import type { Point2D, Point3D } from '../../rendering/types/Types';
import type { StairGeometry, StairStructureType } from '../types/stair-types';

/**
 * Render-helper deps. `worldToScreen` is `BaseEntityRenderer.worldToScreen`
 * bound to the same `transform` the parent renderer is using.
 *
 * ADR-375 Phase B (2026-05-26): `baseLineWidth` is the resolver-computed
 * width (category 'stair' + cutState + scale + objectStyles) that ALL stair
 * plan lines share, mirroring the WallRenderer single-lineWidth pattern.
 * Visual hierarchy (stringer / tread / walkline) is delegated to
 * Object Subcategories (Phase C.3, pending).
 */
export interface StairStyleContext {
  readonly ctx: CanvasRenderingContext2D;
  readonly worldToScreen: (point: { x: number; y: number }) => Point2D;
  readonly baseLineWidth: number;
}

const TREAD_FILL_ALPHA = 0.12;
const GLASS_TREAD_FILL_ALPHA = 0.04;
const GLASS_TREAD_OUTLINE_DASH: readonly [number, number] = [4, 3];
const SUSPENDED_STRINGER_DASH: readonly [number, number] = [5, 3];
const STEEL_GRATING_HATCH_SPACING_PX = 6;
const STEEL_GRATING_HATCH_ANGLE_RAD = Math.PI / 4;

/** Default translucent slate fill — used for every type that is not glass. */
const TREAD_FILL_DEFAULT = `rgba(120, 144, 156, ${TREAD_FILL_ALPHA})`;
const TREAD_FILL_GLASS = `rgba(120, 144, 156, ${GLASS_TREAD_FILL_ALPHA})`;

// ─── Treads ──────────────────────────────────────────────────────────────────

/**
 * Render tread polygons in the plan-view symbology of `structureType`.
 *
 * Behaviour:
 * - glass-tread: dashed outline, very light fill (translucent indicator)
 * - steel-grating: solid outline + 45° hatch lines inside the polygon
 *   (ISO grating symbol — drawn via canvas clip + parallel screen-space lines)
 * - all others: solid outline + standard translucent slate fill
 *
 * `options.skipFill` suppresses the fill for the glow pre-pass — required
 * so the hover halo stroke is not clobbered by an adjacent tread's fill
 * (ADR-358 Phase 8 regression, see StairRenderer line 65 comment block).
 */
export function renderTreadsForStructure(
  scx: StairStyleContext,
  structureType: StairStructureType,
  treads: ReadonlyArray<ReadonlyArray<Point3D>>,
  options: { skipFill?: boolean } = {},
): void {
  if (treads.length === 0) return;

  const { ctx } = scx;
  const isGlass = structureType === 'glass-tread';
  const isGrating = structureType === 'steel-grating';
  const fillStyle = isGlass ? TREAD_FILL_GLASS : TREAD_FILL_DEFAULT;

  ctx.save();
  ctx.lineWidth = scx.baseLineWidth;
  if (!options.skipFill) ctx.fillStyle = fillStyle;
  if (isGlass) ctx.setLineDash(GLASS_TREAD_OUTLINE_DASH as unknown as number[]);

  for (const tread of treads) {
    if (tread.length < 3) continue;
    tracePolygon(scx, tread);
    if (!options.skipFill) ctx.fill();
    ctx.stroke();
    if (isGrating && !options.skipFill) {
      // Re-trace the polygon as a clip path and overlay the hatch lines
      // inside; clip is auto-released by the surrounding ctx.restore loop.
      ctx.save();
      tracePolygon(scx, tread);
      ctx.clip();
      drawSteelGratingHatch(scx, tread);
      ctx.restore();
    }
  }

  ctx.restore();
}

// ─── Stringers ───────────────────────────────────────────────────────────────

/**
 * Render stringer polylines per `structureType`. Picks from the canonical
 * `geometry.stringers.inner/outer` (computed by `StairGeometryService`)
 * plus `geometry.walkline` (used as the structural centerline for
 * `central-stringer`, since walkline is the symmetric offset between
 * inner and outer in `buildStringersFromWalkline`).
 *
 * Strokes inherit `ctx.strokeStyle` from the upstream phase style; this
 * helper only sets `lineWidth` + `setLineDash`. `monolithic` is a no-op
 * (mass concrete reads from the tread outline alone).
 */
export function renderStringersForStructure(
  scx: StairStyleContext,
  structureType: StairStructureType,
  geometry: StairGeometry,
): void {
  const { stringers, walkline } = geometry;

  switch (structureType) {
    case 'monolithic':
      return;

    case 'stringer-1side':
      drawSolidPolyline(scx, stringers.outer, scx.baseLineWidth);
      return;

    case 'central-stringer':
      drawSolidPolyline(scx, walkline, scx.baseLineWidth);
      return;

    case 'cantilever':
      drawSolidPolyline(scx, stringers.inner, scx.baseLineWidth);
      return;

    case 'suspended':
      drawDashedPolyline(
        scx,
        stringers.inner,
        scx.baseLineWidth,
        SUSPENDED_STRINGER_DASH,
      );
      drawDashedPolyline(
        scx,
        stringers.outer,
        scx.baseLineWidth,
        SUSPENDED_STRINGER_DASH,
      );
      return;

    case 'stringer-2side':
    case 'glass-tread':
    case 'steel-grating':
    default:
      drawSolidPolyline(scx, stringers.inner, scx.baseLineWidth);
      drawSolidPolyline(scx, stringers.outer, scx.baseLineWidth);
      return;
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function tracePolygon(
  scx: StairStyleContext,
  poly: ReadonlyArray<Point3D>,
): void {
  const { ctx } = scx;
  ctx.beginPath();
  const first = scx.worldToScreen({ x: poly[0].x, y: poly[0].y });
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < poly.length; i++) {
    const s = scx.worldToScreen({ x: poly[i].x, y: poly[i].y });
    ctx.lineTo(s.x, s.y);
  }
  ctx.closePath();
}

function drawSolidPolyline(
  scx: StairStyleContext,
  poly: ReadonlyArray<Point3D>,
  lineWidth: number,
): void {
  if (poly.length < 2) return;
  const { ctx } = scx;
  ctx.save();
  ctx.lineWidth = lineWidth;
  ctx.setLineDash([]);
  strokePolyline(scx, poly);
  ctx.restore();
}

function drawDashedPolyline(
  scx: StairStyleContext,
  poly: ReadonlyArray<Point3D>,
  lineWidth: number,
  dash: readonly [number, number],
): void {
  if (poly.length < 2) return;
  const { ctx } = scx;
  ctx.save();
  ctx.lineWidth = lineWidth;
  ctx.setLineDash(dash as unknown as number[]);
  strokePolyline(scx, poly);
  ctx.restore();
}

function strokePolyline(
  scx: StairStyleContext,
  poly: ReadonlyArray<Point3D>,
): void {
  const { ctx } = scx;
  ctx.beginPath();
  const first = scx.worldToScreen({ x: poly[0].x, y: poly[0].y });
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < poly.length; i++) {
    const s = scx.worldToScreen({ x: poly[i].x, y: poly[i].y });
    ctx.lineTo(s.x, s.y);
  }
  ctx.stroke();
}

/**
 * 45° hatch inside the current clip path (caller already clipped to the
 * tread polygon). Draws screen-space parallel lines across the polygon's
 * AABB, spaced `STEEL_GRATING_HATCH_SPACING_PX` apart. Industry symbol
 * for steel open grating (ISO 128 / ASME Y14.2 hatch convention).
 */
function drawSteelGratingHatch(
  scx: StairStyleContext,
  poly: ReadonlyArray<Point3D>,
): void {
  const { ctx } = scx;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) {
    const s = scx.worldToScreen({ x: p.x, y: p.y });
    if (s.x < minX) minX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.x > maxX) maxX = s.x;
    if (s.y > maxY) maxY = s.y;
  }
  if (!Number.isFinite(minX)) return;

  const cos = Math.cos(STEEL_GRATING_HATCH_ANGLE_RAD);
  const sin = Math.sin(STEEL_GRATING_HATCH_ANGLE_RAD);
  const w = maxX - minX;
  const h = maxY - minY;
  const span = w + h;

  ctx.save();
  ctx.lineWidth = 0.6;
  ctx.setLineDash([]);
  ctx.beginPath();
  // Sweep parallel lines along the diagonal. Offset `t` is the signed
  // distance from the AABB centre along the hatch normal; covering ±span
  // guarantees every line that intersects the AABB is drawn.
  for (let t = -span; t <= span; t += STEEL_GRATING_HATCH_SPACING_PX) {
    const cx = (minX + maxX) * 0.5 + t * -sin;
    const cy = (minY + maxY) * 0.5 + t * cos;
    const halfLen = span;
    ctx.moveTo(cx - cos * halfLen, cy - sin * halfLen);
    ctx.lineTo(cx + cos * halfLen, cy + sin * halfLen);
  }
  ctx.stroke();
  ctx.restore();
}
