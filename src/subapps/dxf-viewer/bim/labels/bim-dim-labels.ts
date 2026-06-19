/**
 * Centralized BIM dimension-label SSoT (ADR-363 / ADR-436).
 *
 * One place owns: (1) the per-entity label TEXT (`formatBimDimLabels`), (2) the
 * centred multi-line pill DRAWING (`drawDimPill`), and (3) the one-line renderer
 * integration helper (`drawEntityDimLabel`). Consumed by every BIM renderer for
 * the hover/select dimension pill (Revit-style) and shares the font + pill SSoT
 * (`canvas-pill`) with the live grip-drag annotation (`useGripDimAnnotation`).
 *
 * Columns delegate to the existing `formatColumnDimLabels` (zero duplication).
 *
 * ⚠️ UNIT-SAFETY: `WallGeometry.length` / `BeamGeometry.length` are in **metres**;
 * `params.width/depth/thickness/height` are in **mm**. Foundation has no cached
 * axis length → derived from start/end via the scene-unit scale.
 *
 * DISPLAY UNITS (ADR-462): the run-LENGTH token `L=` follows the status-bar unit
 * selector via `formatLengthMm` (e.g. "L=9,75 m"); cross-section tokens
 * (`t/w/d/h`, pad footprint) stay integer **mm** (engineering convention, Revit-style).
 *
 * Pure module: zero React / stores / DOM. ADR-040 micro-leaf safe (no subscriptions,
 * no per-frame allocation beyond the small `lines` array).
 *
 * @see bim/columns/column-dim-labels.ts — column formatter SSoT (reused)
 * @see rendering/utils/canvas-pill.ts — font + pill geometry SSoT
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import {
  isColumnEntity,
  isWallEntity,
  isBeamEntity,
  isFoundationEntity,
  isOpeningEntity,
} from '../../types/entities';
import type { WallEntity } from '../types/wall-types';
import type { BeamEntity } from '../types/beam-types';
import type { OpeningEntity } from '../types/opening-types';
import type { FoundationEntity, FoundationParams } from '../types/foundation-types';
import type { BoundingBox3D } from '../types/bim-base';
import { mmScaleFor } from '../../utils/scene-units';
import { formatLengthMm } from '../../config/display-length-format';
import { formatColumnDimLabels } from '../columns/column-dim-labels';
import {
  PILL_DIM_FONT,
  PILL_DIM_LINE_HEIGHT,
  PILL_TEXT_COLOR,
  PILL_BG_COLOR,
  PILL_PADDING,
  PILL_RADIUS,
  pillPath,
} from '../../rendering/utils/canvas-pill';

/** Hide the centred pill when the screen footprint span is below this (px). */
export const BIM_LABEL_MIN_FOOTPRINT_PX = 20;

/**
 * Downward screen offset (px) of the dimension pill from the entity centre, so it
 * clears the centred 4-arrow MOVE glyph (ADR-397) and stays readable instead of
 * sitting right on top of it (Giorgio 2026-06-17). Sized to clear the hovered
 * (enlarged) arm + a small gap.
 */
export const BIM_LABEL_CENTER_OFFSET_Y_PX = 34;

/** Integer mm rounding (label tokens are always integer millimetres). */
const r = (v: number): number => Math.round(v);

// ─── Formatter dispatch (SSoT) ───────────────────────────────────────────────

/**
 * Ordered dimension label lines for ANY supported BIM entity. Columns delegate
 * to `formatColumnDimLabels`. Returns `[]` for unsupported types or degenerate
 * geometry (missing geometry, zero-length axis) so callers skip drawing.
 */
export function formatBimDimLabels(entity: Entity): string[] {
  if (isColumnEntity(entity)) return formatColumnDimLabels(entity.params);
  if (isWallEntity(entity)) return formatWallDimLabels(entity);
  if (isBeamEntity(entity)) return formatBeamDimLabels(entity);
  if (isFoundationEntity(entity)) return formatFoundationDimLabels(entity);
  if (isOpeningEntity(entity)) return formatOpeningDimLabels(entity);
  return [];
}

/** Wall → `L=…  t=…` (length is metres in geometry → mm token). */
function formatWallDimLabels(wall: WallEntity): string[] {
  const lenMm = wall.geometry ? r(wall.geometry.length * 1000) : 0;
  if (lenMm <= 0) return [];
  return [`L=${formatLengthMm(lenMm)}  t=${r(wall.params.thickness)}`];
}

/** Beam → optional profile prefix + `w=…  d=…` (section dims, mm). */
function formatBeamDimLabels(beam: BeamEntity): string[] {
  const prefix = beam.params.profileDesignation ? [beam.params.profileDesignation] : [];
  return [...prefix, `w=${r(beam.params.width)}  d=${r(beam.params.depth)}`];
}

/** Opening → `w=…  h=…` (mm). The Mark tag stays a separate concern/font. */
function formatOpeningDimLabels(opening: OpeningEntity): string[] {
  return [`w=${r(opening.params.width)}  h=${r(opening.params.height)}`];
}

/** Foundation → pad `w=…  l=…`; strip/tie-beam `L=…  w=…`. Optional profile prefix. */
function formatFoundationDimLabels(foundation: FoundationEntity): string[] {
  const p = foundation.params;
  const prefix = p.catalogProfile ? [p.catalogProfile] : [];
  if (p.kind === 'pad') return [...prefix, `w=${r(p.width)}  l=${r(p.length)}`];
  const lenMm = r(foundationAxisLengthMm(p));
  if (lenMm <= 0) return [];
  return [...prefix, `L=${formatLengthMm(lenMm)}  w=${r(p.width)}`];
}

/**
 * Axis length (mm) of a line-based foundation (strip / tie-beam) derived from
 * its start/end (scene units → mm via `mmScaleFor`). `0` for pad / degenerate.
 */
export function foundationAxisLengthMm(params: FoundationParams): number {
  if (params.kind !== 'strip' && params.kind !== 'tie-beam') return 0;
  const dx = params.end.x - params.start.x;
  const dy = params.end.y - params.start.y;
  const distScene = Math.hypot(dx, dy);
  const s = mmScaleFor(params);
  return s > 0 ? distScene / s : 0;
}

// ─── Pill drawing (SSoT) ─────────────────────────────────────────────────────

/**
 * Centred multi-line dimension pill at screen `(cx, cy)`. Each `lines` element
 * is stacked vertically. Uses `PILL_DIM_FONT` / `PILL_DIM_LINE_HEIGHT` (Revit-grade
 * readable size). Pure canvas draw — no React, no stores (ADR-040 compliant).
 *
 * (Generalised from the former `column-dim-labels.drawColumnDimPill`.)
 */
export function drawDimPill(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  cx: number,
  cy: number,
): void {
  if (lines.length === 0) return;
  ctx.save();
  ctx.font = PILL_DIM_FONT;
  const pillW = Math.max(...lines.map((l) => ctx.measureText(l).width)) + PILL_PADDING * 2;
  const pillH = PILL_DIM_LINE_HEIGHT * lines.length + PILL_PADDING * 2;
  const x = cx - pillW / 2;
  const y = cy - pillH / 2;
  pillPath(ctx, x, y, pillW, pillH, PILL_RADIUS);
  ctx.fillStyle = PILL_BG_COLOR;
  ctx.fill();
  ctx.fillStyle = PILL_TEXT_COLOR;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], cx, y + PILL_PADDING + i * PILL_DIM_LINE_HEIGHT);
  }
  ctx.restore();
}

// ─── Renderer integration helper (one-liner per renderer) ────────────────────

/**
 * Vertical placement of the dimension pill on the entity footprint:
 *  • `center-below` (default) — footprint centre, nudged DOWN to clear the MOVE glyph.
 *  • `top-mid` — on the line joining the TOP-face mid-point to the centre, halfway
 *    along it (upper-middle). Used by columns (Giorgio 2026-06-19).
 */
export type DimLabelPlacement = 'center-below' | 'top-mid';

/**
 * Draw the centred dimension pill for a BIM entity: screen bbox-centre +
 * min-footprint-px gate + `formatBimDimLabels` + `drawDimPill`. Each renderer
 * calls this once (gated on highlighted || selected) for zero duplication.
 *
 * Free function (NOT a `BaseEntityRenderer` method) to keep the generic rendering
 * layer decoupled from the BIM domain and avoid the `rendering/entities/` doc gate.
 */
export function drawEntityDimLabel(
  ctx: CanvasRenderingContext2D,
  entity: Entity,
  bbox: BoundingBox3D,
  worldToScreen: (p: Point2D) => Point2D,
  placement: DimLabelPlacement = 'center-below',
): void {
  const minS = worldToScreen({ x: bbox.min.x, y: bbox.min.y });
  const maxS = worldToScreen({ x: bbox.max.x, y: bbox.max.y });
  const span = Math.max(Math.abs(maxS.x - minS.x), Math.abs(maxS.y - minS.y));
  if (span < BIM_LABEL_MIN_FOOTPRINT_PX) return;
  const lines = formatBimDimLabels(entity);
  if (lines.length === 0) return;

  const cx = (minS.x + maxS.x) / 2;
  const centerY = (minS.y + maxS.y) / 2;
  // `top-mid`: halfway between the centre and the TOP face (smaller screen Y). Otherwise
  // offset DOWN (screen +Y) so the pill clears the centred MOVE glyph (ADR-397).
  const cy = placement === 'top-mid'
    ? (centerY + Math.min(minS.y, maxS.y)) / 2
    : centerY + BIM_LABEL_CENTER_OFFSET_Y_PX;
  drawDimPill(ctx, lines, cx, cy);
}
