/**
 * ADR-363 Slice C — Column ⇄ RectFrame adapter (rectangular / shear-wall only).
 *
 * Bridges the TRUE-rectangle column kinds (`rectangular`, `shear-wall`) to the
 * shared `rect-grip-engine` SSoT so their corner + edge resize math is the SAME
 * code the wall (straight) and foundation (pad) use — Giorgio 2026-06-10 «παντού
 * ίδιος κώδικας, μηδέν διπλότυπα». Variant (L/T/I/U), circular and polygon kinds
 * are NOT rectangles → they keep their own grip transforms (column-grips /
 * column-variant-grips); this module returns `null` for them so the caller falls
 * back.
 *
 * SEMANTICS (engine): corner → opposite corner fixed; width/depth edge → opposite
 * edge fixed (replaces the prior anchor-symmetric resize for rect/shear-wall).
 * `position` (the anchor reference) is recomputed as the inverse of
 * `computeCentroidWorld`, so the anchor follows the resized rectangle.
 *
 * Zero React / DOM / Firestore / canvas deps.
 *
 * @see bim/grips/rect-grip-engine.ts — shared corner/edge SSoT
 * @see bim/foundations/foundation-grips.ts — pad adapter (1st consumer)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, ColumnGripKind } from '../../hooks/useGripMovement';
import type { ColumnEntity, ColumnParams } from '../types/column-types';
import { ANCHOR_OFFSETS, MIN_COLUMN_DIMENSION_MM } from '../types/column-types';
import { mmScaleFor } from '../../utils/scene-units';
import { rotateVector, farEdgeSign } from '../grips/grip-math';
import type { RectFrame, RectCorner } from '../grips/rect-frame';
import {
  applyRectCornerDrag,
  applyRectEdgeDrag,
  type RectResizeLimits,
} from '../grips/rect-grip-engine';
import {
  computeCentroidWorld,
  depthHandleWorld,
  localToWorld,
  rotationHandleWorld,
  widthHandleWorld,
} from './column-grip-utils';

/** True-rectangle column kinds that share the rect-grip-engine. */
export function isRectColumn(params: ColumnParams): boolean {
  return params.kind === 'rectangular' || params.kind === 'shear-wall';
}

/** `column-corner-*` grip kind → local-axis signs for the engine. */
const COLUMN_CORNER_MAP: Partial<Record<ColumnGripKind, RectCorner>> = {
  'column-corner-ne': { sx: 1, sy: 1 },
  'column-corner-nw': { sx: -1, sy: 1 },
  'column-corner-sw': { sx: -1, sy: -1 },
  'column-corner-se': { sx: 1, sy: -1 },
};

/**
 * `column-{width|depth|edge-w|edge-s}` → engine edge axis + face. `near:false` =
 * the FAR face from the anchor (E=width, N=depth)· `near:true` = the OPPOSITE face
 * (W, S). One table → one engine call (DRY: no per-edge if-branch). Sign derives
 * from `farEdgeSign(anchorOffset)` so every anchor resizes the correct face.
 */
const COLUMN_EDGE_MAP: Partial<Record<ColumnGripKind, { axis: 'x' | 'y'; near: boolean }>> = {
  'column-width': { axis: 'x', near: false },
  'column-edge-w': { axis: 'x', near: true },
  'column-depth': { axis: 'y', near: false },
  'column-edge-s': { axis: 'y', near: true },
};

/** Rect column params → centroid `RectFrame` (scene units). width=local X, depth=local Y. */
function columnToRectFrame(params: ColumnParams): RectFrame {
  const s = mmScaleFor(params);
  return {
    center: computeCentroidWorld(params),
    rotationDeg: params.rotation,
    halfWidth: (params.width * s) / 2,
    halfLength: (params.depth * s) / 2,
  };
}

/** `RectFrame` (post-resize) → column params, preserving the anchor reference. */
function rectFrameToColumnParams(frame: RectFrame, params: ColumnParams): ColumnParams {
  const s = mmScaleFor(params);
  const width = (frame.halfWidth * 2) / s;
  const depth = (frame.halfLength * 2) / s;
  const { dx, dy } = ANCHOR_OFFSETS[params.anchor];
  const shift = rotateVector({ x: dx * width * s, y: dy * depth * s }, frame.rotationDeg);
  return {
    ...params,
    width,
    depth,
    position: { x: frame.center.x + shift.x, y: frame.center.y + shift.y, z: params.position.z ?? 0 },
  };
}

/** Min half-extents (scene units) for the engine clamp = `MIN_COLUMN_DIMENSION_MM`. */
function columnResizeLimits(params: ColumnParams): RectResizeLimits {
  const half = (MIN_COLUMN_DIMENSION_MM * mmScaleFor(params)) / 2;
  return { minHalfWidth: half, minHalfLength: half };
}

/**
 * The 4 corner grips (indices 4..7) for a rect/shear-wall column. Positions read
 * via the shared `localToWorld` (centroid + rotation + scene scale), mirror pad.
 */
export function rectColumnCornerGrips(entity: Readonly<ColumnEntity>): GripInfo[] {
  const { params } = entity;
  const cw = (sx: number, sy: number): Point2D =>
    localToWorld({ x: (sx * params.width) / 2, y: (sy * params.depth) / 2 }, params);
  return [
    { entityId: entity.id, gripIndex: 4, type: 'vertex', position: cw(1, 1), movesEntity: false, columnGripKind: 'column-corner-ne' },
    { entityId: entity.id, gripIndex: 5, type: 'vertex', position: cw(-1, 1), movesEntity: false, columnGripKind: 'column-corner-nw' },
    { entityId: entity.id, gripIndex: 6, type: 'vertex', position: cw(-1, -1), movesEntity: false, columnGripKind: 'column-corner-sw' },
    { entityId: entity.id, gripIndex: 7, type: 'vertex', position: cw(1, -1), movesEntity: false, columnGripKind: 'column-corner-se' },
  ];
}

/**
 * ADR-363 — full grip set for a rect / shear-wall column (Giorgio 2026-06-15):
 *   0 → center (MOVE, re-added για ορθογώνια — translate `position`)
 *   1 → rotation (στο μέσο κέντρου↔κάτω-μέσης, local (0,−depth/4) — `rotationHandleWorld`)
 *   2 → width  (EAST edge midpoint, `column-width`)
 *   3 → depth  (NORTH edge midpoint, `column-depth`)
 *       column-edge-w (WEST edge midpoint)  ┐ οι «άλλες δύο πλευρές» → 4 edges total
 *       column-edge-s (SOUTH edge midpoint) ┘
 *   4..7 → corners (`rectColumnCornerGrips`)
 * Όλες οι θέσεις μέσω του ΙΔΙΟΥ `localToWorld`/`*HandleWorld` SSoT· τα 4 edges +
 * 4 corners κάνουν resize μέσω του κοινού `rect-grip-engine` (μηδέν διπλότυπα).
 */
export function rectColumnGrips(entity: Readonly<ColumnEntity>): GripInfo[] {
  const { id, params } = entity;
  return [
    { entityId: id, gripIndex: 0, type: 'center', position: computeCentroidWorld(params), movesEntity: true, columnGripKind: 'column-center' },
    { entityId: id, gripIndex: 1, type: 'vertex', position: rotationHandleWorld(params), movesEntity: false, columnGripKind: 'column-rotation' },
    { entityId: id, gripIndex: 2, type: 'edge', position: widthHandleWorld(params), movesEntity: false, columnGripKind: 'column-width' },
    { entityId: id, gripIndex: 3, type: 'edge', position: depthHandleWorld(params), movesEntity: false, columnGripKind: 'column-depth' },
    { entityId: id, gripIndex: 8, type: 'edge', position: localToWorld({ x: -params.width / 2, y: 0 }, params), movesEntity: false, columnGripKind: 'column-edge-w' },
    { entityId: id, gripIndex: 9, type: 'edge', position: localToWorld({ x: 0, y: -params.depth / 2 }, params), movesEntity: false, columnGripKind: 'column-edge-s' },
    ...rectColumnCornerGrips(entity),
  ];
}

/**
 * Apply a rectangular-column grip (corner / width / depth) via the shared engine.
 * Returns `null` when `gripKind` is not a rect grip OR the column is not a true
 * rectangle — the caller then falls back to the variant/circular/polygon path.
 */
export function applyRectColumnGrip(
  gripKind: ColumnGripKind,
  params: ColumnParams,
  delta: Point2D,
): ColumnParams | null {
  if (!isRectColumn(params)) return null;
  const limits = columnResizeLimits(params);
  const corner = COLUMN_CORNER_MAP[gripKind];
  if (corner) {
    return rectFrameToColumnParams(applyRectCornerDrag(columnToRectFrame(params), corner, delta, limits), params);
  }
  const edge = COLUMN_EDGE_MAP[gripKind];
  if (edge) {
    const { dx, dy } = ANCHOR_OFFSETS[params.anchor];
    const far = farEdgeSign(edge.axis === 'x' ? dx : dy) === 1 ? 1 : -1;
    const sign = edge.near ? (-far as 1 | -1) : far;
    return rectFrameToColumnParams(
      applyRectEdgeDrag(columnToRectFrame(params), { axis: edge.axis, sign }, delta, limits),
      params,
    );
  }
  return null;
}
