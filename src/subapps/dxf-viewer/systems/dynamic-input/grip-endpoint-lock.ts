/**
 * ADR-513 §grip-parity — Length/Angle lock for a plain-LINE endpoint grip drag (SSoT).
 *
 * The «Δαχτυλίδι Εντολών» typed length/angle (locked in `DynamicInputLockStore`)
 * must move the dragged endpoint EXACTLY the same in the live ghost AND in the
 * commit — otherwise WYSIWYG breaks (preview ≠ committed). This ONE pure helper is
 * called by BOTH grip seams so they can never diverge:
 *   · `useGripGhostPreview` (live ghost),
 *   · `grip-mouseup-handler`  (StretchEntityCommand commit).
 *
 * It reuses the EXACT same SSoT the line/wall DRAW uses — zero new mechanism:
 *   · fixed anchor  → `getLineGripAlignmentAnchors` (the OTHER, un-dragged endpoint),
 *   · lock geometry → `applyLengthAngleLock` (identical to `drawing-hover-handler`).
 *
 * Returns `null` (→ caller keeps the raw cursor delta) when there is no active lock
 * or the grip is not a plain-line endpoint, so wiring it into either path is a no-op
 * whenever the ring is not in use (zero regression).
 *
 * @see ./length-angle-lock.ts — the shared lock geometry SSoT
 * @see ../line/line-grips.ts — `getLineGripAlignmentAnchors` (fixed endpoint)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { LineGripKind } from '../../hooks/grip-types';
import { getLineGripAlignmentAnchors } from '../line/line-grips';
import { applyLengthAngleLock, isLengthAngleLockActive } from './length-angle-lock';

/**
 * The length/angle-locked displacement for a plain-line endpoint grip, relative to
 * the endpoint's ORIGINAL position (`anchorPos` = the dragged endpoint at grab time,
 * i.e. `grip.position`). `cursorWorld` = the live cursor in world coords
 * (`anchorPos + rawDelta`). Only grips 0/1 (start/end) with NO `lineGripKind` — the
 * rotation/move handles are excluded (they have their own flows).
 */
export function resolveLineEndpointLockedDelta(
  entity: unknown,
  gripIndex: number | undefined,
  lineGripKind: LineGripKind | null | undefined,
  anchorPos: Readonly<Point2D>,
  cursorWorld: Readonly<Point2D>,
): Point2D | null {
  if (!isLengthAngleLockActive()) return null;
  if (lineGripKind) return null;
  if (gripIndex !== 0 && gripIndex !== 1) return null;

  const line = entity as { type?: string; start?: Point2D; end?: Point2D };
  if (line.type !== 'line' || !line.start || !line.end) return null;

  const anchors = getLineGripAlignmentAnchors(
    gripIndex,
    null,
    { start: line.start, end: line.end },
    null,
  );
  const fixed = anchors?.[0];
  if (!fixed) return null;

  const locked = applyLengthAngleLock(cursorWorld, fixed);
  return { x: locked.x - anchorPos.x, y: locked.y - anchorPos.y };
}
