/**
 * Wall Face Corner Projection Snap — ADR-597 extension
 *
 * Re-homed to `bim/walls/` (was `systems/cursor/`) to sit beside its sibling
 * `bim/columns/column-corner-snap.ts` — both are BIM corner-snap helpers over the
 * shared `systems/cursor/corner-projection-snap` core (ADR-378 §Step 5/#6).
 *
 * When dragging a wall endpoint grip, the cursor sits on the axis.
 * The face corners (± halfThickness × perpendicular) may be near a BIM corner
 * of an adjacent entity. This utility finds that alignment and returns the
 * adjusted axis position so the face corner snaps exactly to the target corner.
 *
 * Industry pattern: Revit "Wall Endpoint snap to adjacent wall face",
 * ArchiCAD "Hotspot on edges", Vectorworks "Smart Cursor wall corner".
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WallEntity } from '../types/wall-types';
import type { ProSnapResult } from '../../snapping/extended-types';
import { mmToSceneUnits } from '../../utils/scene-units';
import { findBestCornerProjection } from '../../systems/cursor/corner-projection-snap';

export interface FaceCornerSnapResult {
  /** Snap result at the beam/wall corner (indicator shows HERE) */
  snapResult: ProSnapResult;
  /** Where the axis endpoint must move so the face corner aligns */
  adjustedAxisPos: Point2D;
}

/**
 * Tries to snap a wall's face corners to nearby BIM corners during grip drag.
 *
 * @param wall          The wall entity being dragged
 * @param gripKind      'wall-start' | 'wall-end'
 * @param cursorPos     Current cursor world position (= dragged axis endpoint)
 * @param findSnapPoint Snap engine query function
 */
export function findWallFaceCornerSnap(
  wall: WallEntity,
  gripKind: 'wall-start' | 'wall-end',
  cursorPos: Point2D,
  findSnapPoint: (x: number, y: number) => ProSnapResult | null,
): FaceCornerSnapResult | null {
  const { params } = wall;

  // Fixed endpoint = the opposite end from the grip being dragged
  const fixedPt: Point2D = gripKind === 'wall-start'
    ? { x: params.end.x, y: params.end.y }
    : { x: params.start.x, y: params.start.y };

  const dx = cursorPos.x - fixedPt.x;
  const dy = cursorPos.y - fixedPt.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return null; // degenerate: cursor at fixed end

  const dirX = dx / len;
  const dirY = dy / len;
  // Perpendicular (left = +, right = -)
  const perpX = -dirY;
  const perpY = dirX;

  const halfWidthWorld = (params.thickness / 2) * mmToSceneUnits(params.sceneUnits ?? 'mm');

  // The two face corners at the dragged endpoint (axis ± halfThickness ⟂).
  const faceCorners: Point2D[] = [
    { x: cursorPos.x + perpX * halfWidthWorld, y: cursorPos.y + perpY * halfWidthWorld },
    { x: cursorPos.x - perpX * halfWidthWorld, y: cursorPos.y - perpY * halfWidthWorld },
  ];

  // Delegate the query/best/correction loop to the shared SSoT core (ADR-398).
  // `adjustedCursorPos` (= cursor + (target − corner)) equals the wall's historical
  // `adjustedAxisPos` because each face corner is a fixed ⟂ offset from the axis.
  const projection = findBestCornerProjection(faceCorners, cursorPos, findSnapPoint);
  if (!projection) return null;
  return { snapResult: projection.snapResult, adjustedAxisPos: projection.adjustedCursorPos };
}
