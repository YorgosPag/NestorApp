/**
 * ADR-612 — Opening Info Tag DERIVED geometry (world-space SSoT).
 *
 * THE single source of truth for the tag's resolved geometry: the 3 editable cell
 * rects (frame space), the box world corners and the rotation-aware AABB. Pure +
 * idempotent — the entity params (`position` / `angleRad` / `widthMm`) are the
 * SSoT; this cache is never mutated directly. All scalars are world canonical-mm.
 *
 * Frame space `(u, v)`: `u` = along the box width, `v` = along the box height
 * (+v = up), both measured in canonical-mm from the box CENTRE (`position`).
 * `openingInfoTagFrameToWorld` folds a frame point through `angleRad` + `position`
 * — the ONE rotation formula shared by the renderer, hit-test, grips and the
 * inline cell editor (N.18: no per-consumer clone of the frame→world map).
 *
 * @see types/opening-info-tag.ts — the entity contract + constants
 * @see bim/opening-info-tag/opening-info-tag-primitives.ts — frame-space layout
 */

import type { Point2D } from '../../rendering/types/Types';
import { OPENING_INFO_TAG_ASPECT, OPENING_INFO_TAG_TEXT_HEIGHT_RATIO, type OpeningInfoTagCellRect, type OpeningInfoTagEntity, type OpeningInfoTagFramePoint, type OpeningInfoTagGeometry } from '../../types/opening-info-tag';
// ADR-794 — ΕΝΑ όνομα ανά ΧΩΡΟ, ΠΟΤΕ ανά ΑΝΤΙΚΕΙΜΕΝΟ.
import type { Bbox } from '../../types/coordinate-space';
// 🔴 ADR-794 — ΕΔΩ ΖΟΥΣΕ ΤΟ ΕΝΑ ΑΠΟ ΤΑ ΔΥΟ **BYTE-ΤΑΥΤΟΣΗΜΑ** `bboxOfCorners`
// (το άλλο στο αδελφό module). Το CHECK 3.28 (jscpd) ΔΕΝ τα έπιανε: `min-tokens: 50`,
// ο βρόχος είναι ~30 tokens — μετρημένο, γραμμένο στο ADR-793 §4.1.
import { bboxOf } from '../geometry/shared/xy-bounds';

/** Derive box height (canonical-mm) from the single width DOF. */
export function openingInfoTagHeightMm(widthMm: number): number {
  return widthMm * OPENING_INFO_TAG_ASPECT;
}

/**
 * Map a frame point `(u, v)` (canonical-mm from centre) to WORLD canonical-mm,
 * folding the entity rotation about `position`. The ONE rotation SSoT (N.18).
 */
export function openingInfoTagFrameToWorld(
  entity: Pick<OpeningInfoTagEntity, 'position' | 'angleRad'>,
  u: number,
  v: number,
): Point2D {
  const cos = Math.cos(entity.angleRad);
  const sin = Math.sin(entity.angleRad);
  return {
    x: entity.position.x + u * cos - v * sin,
    y: entity.position.y + u * sin + v * cos,
  };
}

/** The 3 editable cell rects in FRAME space (top full-width, then the two bottom halves). */
function computeCellRects(halfWidth: number, halfHeight: number): OpeningInfoTagCellRect[] {
  const topCenter: OpeningInfoTagFramePoint = { u: 0, v: halfHeight / 2 };
  const bottomLeftCenter: OpeningInfoTagFramePoint = { u: -halfWidth / 2, v: -halfHeight / 2 };
  const bottomRightCenter: OpeningInfoTagFramePoint = { u: halfWidth / 2, v: -halfHeight / 2 };
  return [
    { cell: 'top', center: topCenter, halfWidth, halfHeight: halfHeight / 2 },
    { cell: 'bottomLeft', center: bottomLeftCenter, halfWidth: halfWidth / 2, halfHeight: halfHeight / 2 },
    { cell: 'bottomRight', center: bottomRightCenter, halfWidth: halfWidth / 2, halfHeight: halfHeight / 2 },
  ];
}

/** World-space AABB of the four (rotated) box corners. */

/**
 * Compute the full derived geometry for an opening-info-tag. Pure + idempotent.
 */
export function computeOpeningInfoTagGeometry(
  entity: OpeningInfoTagEntity,
): OpeningInfoTagGeometry {
  const widthMm = entity.widthMm;
  const heightMm = openingInfoTagHeightMm(widthMm);
  const halfWidth = widthMm / 2;
  const halfHeight = heightMm / 2;

  const worldCorners: Point2D[] = [
    openingInfoTagFrameToWorld(entity, -halfWidth, -halfHeight),
    openingInfoTagFrameToWorld(entity, halfWidth, -halfHeight),
    openingInfoTagFrameToWorld(entity, halfWidth, halfHeight),
    openingInfoTagFrameToWorld(entity, -halfWidth, halfHeight),
  ];

  return {
    widthMm,
    heightMm,
    halfWidth,
    halfHeight,
    textHeightMm: heightMm * OPENING_INFO_TAG_TEXT_HEIGHT_RATIO,
    cells: computeCellRects(halfWidth, halfHeight),
    worldCorners,
    bbox: bboxOf(worldCorners),
  };
}

/**
 * Map a WORLD point back to the tag's frame space `(u, v)` (inverse of
 * `openingInfoTagFrameToWorld`). The ONE inverse-rotation SSoT (N.18) — used by
 * hit-test and the inline cell editor.
 */
export function openingInfoTagWorldToFrame(
  entity: Pick<OpeningInfoTagEntity, 'position' | 'angleRad'>,
  world: Point2D,
): OpeningInfoTagFramePoint {
  const dx = world.x - entity.position.x;
  const dy = world.y - entity.position.y;
  const cos = Math.cos(entity.angleRad);
  const sin = Math.sin(entity.angleRad);
  // Inverse rotation: R(-θ) · (dx, dy).
  return {
    u: dx * cos + dy * sin,
    v: -dx * sin + dy * cos,
  };
}

/** True when a WORLD point lands inside the (rotated) box, with an optional world-mm padding. */
export function openingInfoTagContainsWorld(
  entity: OpeningInfoTagEntity,
  world: Point2D,
  padMm = 0,
): boolean {
  const { u, v } = openingInfoTagWorldToFrame(entity, world);
  const hw = entity.widthMm / 2;
  const hh = openingInfoTagHeightMm(entity.widthMm) / 2;
  return Math.abs(u) <= hw + padMm && Math.abs(v) <= hh + padMm;
}

/** Which editable cell (if any) a WORLD point lands in — used by the inline editor's double-click. */
export function openingInfoTagCellAtWorld(
  entity: OpeningInfoTagEntity,
  world: Point2D,
): OpeningInfoTagCellRect | null {
  const { u, v } = openingInfoTagWorldToFrame(entity, world);
  const geo = computeOpeningInfoTagGeometry(entity);
  for (const rect of geo.cells) {
    if (
      Math.abs(u - rect.center.u) <= rect.halfWidth &&
      Math.abs(v - rect.center.v) <= rect.halfHeight
    ) {
      return rect;
    }
  }
  return null;
}

/** The text value stored on the entity for a given cell id. */
export function openingInfoTagCellText(
  entity: OpeningInfoTagEntity,
  cell: OpeningInfoTagCellRect['cell'],
): string {
  switch (cell) {
    case 'top':
      return entity.topText;
    case 'bottomLeft':
      return entity.bottomLeftText;
    case 'bottomRight':
      return entity.bottomRightText;
  }
}

/** The entity field key for a given cell id — used by the inline editor's `UpdateEntityCommand` patch. */
export function openingInfoTagCellField(
  cell: OpeningInfoTagCellRect['cell'],
): 'topText' | 'bottomLeftText' | 'bottomRightText' {
  switch (cell) {
    case 'top':
      return 'topText';
    case 'bottomLeft':
      return 'bottomLeftText';
    case 'bottomRight':
      return 'bottomRightText';
  }
}
