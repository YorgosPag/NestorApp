/**
 * GripSnapStore — crosshair lock-to-grip
 *
 * Stores the world position of the currently hovered grip.
 * mouse-handler-move reads this to override setImmediatePosition
 * so the crosshair center snaps to the grip center on hover.
 */
import type { Point2D } from '../../rendering/types/Types';

let lockedWorldPos: Point2D | null = null;

export function lockGripSnapPosition(worldPos: Point2D): void {
  lockedWorldPos = worldPos;
}

export function unlockGripSnapPosition(): void {
  lockedWorldPos = null;
}

export function getLockedGripWorldPos(): Point2D | null {
  return lockedWorldPos;
}
