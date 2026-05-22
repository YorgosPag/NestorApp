/**
 * Wall Face Corner Projection Snap — ADR-371 extension
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
import type { WallEntity } from '../../bim/types/wall-types';
import type { ProSnapResult } from '../../snapping/extended-types';
import { mmToSceneUnits } from '../../utils/scene-units';

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

  // The two face corners at the dragged endpoint
  const faceCorners = [
    {
      pt: { x: cursorPos.x + perpX * halfWidthWorld, y: cursorPos.y + perpY * halfWidthWorld },
      offsetX: perpX * halfWidthWorld,
      offsetY: perpY * halfWidthWorld,
    },
    {
      pt: { x: cursorPos.x - perpX * halfWidthWorld, y: cursorPos.y - perpY * halfWidthWorld },
      offsetX: -perpX * halfWidthWorld,
      offsetY: -perpY * halfWidthWorld,
    },
  ];

  let best: FaceCornerSnapResult | null = null;

  for (const corner of faceCorners) {
    const result = findSnapPoint(corner.pt.x, corner.pt.y);
    if (!result?.found || !result.snappedPoint) continue;

    const dist = result.distance ?? 0;
    if (!best || dist < (best.snapResult.distance ?? Infinity)) {
      best = {
        snapResult: result,
        adjustedAxisPos: {
          x: result.snappedPoint.x - corner.offsetX,
          y: result.snappedPoint.y - corner.offsetY,
        },
      };
    }
  }

  return best;
}
