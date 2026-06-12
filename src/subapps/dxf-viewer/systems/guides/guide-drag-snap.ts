/**
 * Guide-drag snapping (ADR-189) — SSoT for resolving the target offset of a guide
 * being MOVED, honouring the active OSNAP point (endpoint/intersection/etc).
 *
 * Bug it fixes (Giorgio 2026-06-12): dragging a guide near an entity's endpoint shows
 * the snap (✛) marker, but the guide landed at the RAW cursor — the move ignored the
 * snap, so releasing did not put the guide line through that point.
 *
 * The general snap pipeline (`mouse-handler-move`) already computes the nearest snap
 * each frame and stores it in {@link ImmediateSnapStore}. Both the live drag
 * (`useCanvasMouse`) and the commit (`useCanvasContainerHandlers`) read THIS module so
 * the moving line, the locked crosshair, and the committed `MoveGuideCommand` all agree.
 *
 * When a snap is engaged the line passes THROUGH the snap point (offset = the snap's
 * perpendicular component); otherwise it free-tracks the cursor by the grab delta.
 * XZ (diagonal) guides keep their existing delta translation (no offset snap).
 *
 * @see systems/cursor/ImmediateSnapStore.ts — snap source (set by mouse-handler-move)
 */
import type { Point2D } from '../../rendering/types/Types';
import type { GridAxis } from './guide-types';
import { getImmediateSnap } from '../cursor/ImmediateSnapStore';

/** The active snap point during a guide drag (endpoint/intersection/…), or null. */
export function getGuideDragSnapPoint(): Point2D | null {
  const snap = getImmediateSnap();
  return snap?.found && snap.point ? { x: snap.point.x, y: snap.point.y } : null;
}

/**
 * Resolve the 1D offset for an X/Y guide drag. If a snap point is engaged the line
 * snaps to pass through it; otherwise it free-tracks via the grab delta. Returns the
 * offset AND the snap point used (null when free) so the caller can also lock the
 * crosshair onto the snap point.
 */
export function resolveGuideDrag(
  axis: GridAxis,
  rawWorld: Point2D,
  startMouseWorld: Point2D,
  originalOffset: number,
): { offset: number; snapPoint: Point2D | null } {
  const snapPoint = getGuideDragSnapPoint();
  if (snapPoint && (axis === 'X' || axis === 'Y')) {
    return { offset: axis === 'X' ? snapPoint.x : snapPoint.y, snapPoint };
  }
  const delta = axis === 'X' ? rawWorld.x - startMouseWorld.x : rawWorld.y - startMouseWorld.y;
  return { offset: originalOffset + delta, snapPoint: null };
}
