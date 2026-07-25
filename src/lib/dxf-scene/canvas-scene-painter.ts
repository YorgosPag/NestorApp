/**
 * =============================================================================
 * SSoT: DXF scene primitive geometry → Canvas 2D
 * =============================================================================
 *
 * ONE owner of the `line / polyline / circle / arc` stroke pass. Three surfaces
 * used to carry a byte-identical copy of this switch — the gallery renderer
 * (`floorplan-dxf-renderer`), the upload thumbnail generator
 * (`services/thumbnail-generator`) and the project floorplan tab
 * (`FloorplanViewerTab`) — and they had already drifted: the project tab passed
 * DXF **degrees** straight into `ctx.arc()` (which takes radians) with the start
 * and end angles swapped, so every arc it drew was wrong.
 *
 * Painting responsibility split — deliberate:
 *  - GEOMETRY (here): identical everywhere, so it is centralized.
 *  - STYLE (`ctx.strokeStyle` / `lineWidth`): the caller sets it before calling,
 *    because colour resolution genuinely differs per surface (drawing-mode ink
 *    override, entity colour, layer colour).
 *  - TEXT: NOT handled here. Baseline, font clamping and run-colour resolution
 *    legitimately differ per surface (ADR-370 forbids a font floor in the gallery
 *    but the thumbnail keeps one), so each caller owns its own text branch.
 *
 * @module lib/dxf-scene/canvas-scene-painter
 * @enterprise ADR-033 (Floorplan Processing), ADR-370 (Read-only render)
 */

import {
  projectX,
  projectY,
  type FitTransform,
  type SceneBounds,
  type Vec2,
} from './scene-fit-transform';

/** Minimal entity contract — structural, satisfied by every parsed DXF entity shape. */
export interface PaintableEntityLike {
  readonly type: string;
}

function strokeLine(
  ctx: CanvasRenderingContext2D,
  e: Record<string, unknown>,
  bounds: SceneBounds,
  fit: FitTransform,
): void {
  const start = e.start as Vec2 | undefined;
  const end = e.end as Vec2 | undefined;
  if (!start || !end) return;

  ctx.beginPath();
  ctx.moveTo(projectX(start.x, bounds, fit), projectY(start.y, bounds, fit));
  ctx.lineTo(projectX(end.x, bounds, fit), projectY(end.y, bounds, fit));
  ctx.stroke();
}

function strokePolyline(
  ctx: CanvasRenderingContext2D,
  e: Record<string, unknown>,
  bounds: SceneBounds,
  fit: FitTransform,
): void {
  const vertices = e.vertices as Vec2[] | undefined;
  if (!vertices || !Array.isArray(vertices) || vertices.length < 2) return;

  ctx.beginPath();
  const first = vertices[0];
  ctx.moveTo(projectX(first.x, bounds, fit), projectY(first.y, bounds, fit));
  for (let i = 1; i < vertices.length; i += 1) {
    const v = vertices[i];
    ctx.lineTo(projectX(v.x, bounds, fit), projectY(v.y, bounds, fit));
  }
  if (e.closed as boolean | undefined) ctx.closePath();
  ctx.stroke();
}

function strokeCircle(
  ctx: CanvasRenderingContext2D,
  e: Record<string, unknown>,
  bounds: SceneBounds,
  fit: FitTransform,
): void {
  const center = e.center as Vec2 | undefined;
  const radius = e.radius as number | undefined;
  if (!center || !radius) return;

  ctx.beginPath();
  ctx.arc(
    projectX(center.x, bounds, fit),
    projectY(center.y, bounds, fit),
    radius * fit.scale,
    0,
    2 * Math.PI,
  );
  ctx.stroke();
}

/**
 * DXF arcs: angles in DEGREES, counter-clockwise from East, Y+ up.
 * Canvas arcs: angles in RADIANS, clockwise from East, Y+ down.
 * Conversion: deg→rad, negate both angles, and draw counter-clockwise
 * (`anticlockwise = true`) to compensate for the Y-axis inversion.
 */
function strokeArc(
  ctx: CanvasRenderingContext2D,
  e: Record<string, unknown>,
  bounds: SceneBounds,
  fit: FitTransform,
): void {
  const center = e.center as Vec2 | undefined;
  const radius = e.radius as number | undefined;
  const startAngleDeg = e.startAngle as number | undefined;
  const endAngleDeg = e.endAngle as number | undefined;
  if (!center || !radius || startAngleDeg === undefined || endAngleDeg === undefined) return;

  const startRad = (startAngleDeg * Math.PI) / 180;
  const endRad = (endAngleDeg * Math.PI) / 180;

  ctx.beginPath();
  ctx.arc(
    projectX(center.x, bounds, fit),
    projectY(center.y, bounds, fit),
    radius * fit.scale,
    -startRad,
    -endRad,
    true,
  );
  ctx.stroke();
}

/**
 * Stroke one scene entity's primitive geometry onto a 2D context.
 *
 * The caller sets `ctx.strokeStyle` / `ctx.lineWidth` beforehand and handles any
 * type this function reports as unhandled (notably `text` / `mtext`).
 *
 * @returns `true` when the entity type was painted here, `false` when the caller
 *          must handle it itself.
 */
export function paintSceneEntityGeometry(
  ctx: CanvasRenderingContext2D,
  entity: PaintableEntityLike,
  bounds: SceneBounds,
  fit: FitTransform,
): boolean {
  const e = entity as unknown as Record<string, unknown>;

  switch (entity.type) {
    case 'line':
      strokeLine(ctx, e, bounds, fit);
      return true;
    case 'polyline':
      strokePolyline(ctx, e, bounds, fit);
      return true;
    case 'circle':
      strokeCircle(ctx, e, bounds, fit);
      return true;
    case 'arc':
      strokeArc(ctx, e, bounds, fit);
      return true;
    default:
      return false;
  }
}
