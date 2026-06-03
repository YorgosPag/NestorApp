/**
 * MEP wire waypoint gesture — ADR-408 Φ7 FU#3 (pure SSoT).
 *
 * The shared "apply an in-flight waypoint edit to a system's params" logic, used
 * by BOTH the 2D overlay interaction (`use-mep-wire-waypoint-interaction`) and the
 * 3D viewport interaction (`use-bim3d-wire-waypoint-interaction-3d`). Keeping it
 * here means the insert-vs-move recompute lives in ONE place — both editors stay
 * byte-for-byte consistent, and the optimistic-vs-commit paths can recompute from
 * the same pre-gesture base (idempotent, drift-free).
 *
 * Pure — no store / React / Date / Math.random.
 *
 * @see ./mep-wire-waypoints.ts (the orientation-aware record editors)
 */

import type { MepSystemEntity, MepElectricalSystemParams } from '../types/mep-system-types';
import {
  insertWaypointOriented,
  moveWaypointOriented,
  type WirePlanPoint,
} from './mep-wire-waypoints';

/** A waypoint edit in flight: the segment + draw index being inserted/moved. */
export interface WaypointGesture {
  readonly mode: 'insert' | 'move';
  /** The system snapshot at gesture start (for the optimistic upsert host fields). */
  readonly system: MepSystemEntity;
  /** Pre-gesture params — the undo target + the base every frame recomputes from. */
  readonly startParams: MepElectricalSystemParams;
  readonly keyA: string;
  readonly keyB: string;
  readonly orientedIndex: number;
}

/**
 * Recompute `params` with the gesture's waypoint placed at `point`. Idempotent:
 * always derived from `gesture.startParams`, so calling it every drag frame (and
 * once more on commit) never accumulates drift, and `insert` vs `move` unify.
 */
export function applyWaypointGesture(gesture: WaypointGesture, point: WirePlanPoint): MepElectricalSystemParams {
  const base = gesture.startParams.wireWaypoints;
  const next =
    gesture.mode === 'insert'
      ? insertWaypointOriented(base, gesture.keyA, gesture.keyB, gesture.orientedIndex, point)
      : moveWaypointOriented(base, gesture.keyA, gesture.keyB, gesture.orientedIndex, point);
  return { ...gesture.startParams, wireWaypoints: next };
}
