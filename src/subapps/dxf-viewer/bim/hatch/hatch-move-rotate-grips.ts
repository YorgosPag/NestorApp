/**
 * ADR-627 — Whole-hatch MOVE cross + rotation handle grip SSoT (pure helper).
 *
 * Gives a hatch the EXACT same two whole-entity handles the area outline / plain
 * polyline already show (ADR-561): a 4-arrow MOVE cross + a curved rotation handle.
 * Both grip paths append these right after the boundary-vertex / edge-midpoint /
 * gradient grips:
 *   - `buildHatchGrips` (grip-computation-producers) → interaction + hit-testing.
 *   - `HatchRenderer.getGrips`                        → on-canvas 2D grip painting.
 *
 * PLACEMENT is NOT re-derived here — it delegates to the SHARED
 * {@link resolveMoveRotateHandleWorld} (`systems/polyline/polyline-grips`), the SAME
 * placement SSoT the polyline/area outline uses, on the hatch's OUTER boundary ring
 * (`boundaryPaths[0]`, always a closed ring). So «όλα ΙΔΙΑ με το περίγραμμα εμβαδού»:
 * rect-box parity for a rectangular boundary, longest-segment ¼-points otherwise. Only
 * the grip-kind tagging (`on:'hatch'`) differs from the polyline sibling — ZERO new
 * placement formula (N.18 — the twin the shared helper prevents).
 *
 * Zero React / DOM / Firestore / canvas deps.
 *
 * @see systems/polyline/polyline-grips.ts — `resolveMoveRotateHandleWorld` (placement SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-627-hatch-grip-parity.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo } from '../../hooks/grip-types';
import { resolveMoveRotateHandleWorld } from '../../systems/polyline/polyline-grips';
import { HATCH_MOVE_KIND, HATCH_ROTATION_KIND } from './hatch-grips';

/**
 * The 2 whole-hatch handles (MOVE cross + rotation) for the outer boundary ring,
 * placed via the shared {@link resolveMoveRotateHandleWorld} SSoT (area parity).
 * `startIndex` continues the running grip index after every prior hatch grip so
 * interaction ≡ render assign the SAME indices (paint ↔ hit-test correspondence).
 * A degenerate outer ring (<2 vertices) gets no handles.
 */
export function getHatchMoveRotateGrips(
  entityId: string,
  outerRing: readonly Point2D[],
  startIndex: number,
): GripInfo[] {
  // Hatch boundary rings are always closed loops (modulo-wrap, no duplicate closing
  // vertex) → `closed = true` unconditionally, exactly like a closed area polyline.
  const pos = resolveMoveRotateHandleWorld(outerRing, true);
  if (!pos) return [];
  return [
    {
      entityId, gripIndex: startIndex, type: 'center',
      position: pos.move, movesEntity: true,
      gripKind: { on: 'hatch', kind: HATCH_MOVE_KIND },
    },
    {
      entityId, gripIndex: startIndex + 1, type: 'vertex',
      position: pos.rotation, movesEntity: false,
      gripKind: { on: 'hatch', kind: HATCH_ROTATION_KIND },
    },
  ];
}
