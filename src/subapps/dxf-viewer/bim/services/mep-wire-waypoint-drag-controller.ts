/**
 * MEP wire waypoint drag controller — ADR-408 Φ7 FU#3 (pure FSM).
 *
 * Owns the finite-state machine for dragging a single circuit wire waypoint:
 *
 *   idle  ──pointerdown on node / segment──▶  dragging
 *   dragging ──pointermove──▶  emit new world point (= cursor position)
 *   dragging ──pointerup──▶  commit, return to idle
 *   dragging ──cancel──▶  rollback, return to idle
 *
 * A waypoint is an **absolute** plan point (canvas units), so unlike the opening
 * tag (which stores an offset) the drag simply tracks the cursor's world point —
 * snapping/orthogonal can layer on later without changing the FSM. The target is
 * the segment's draw-direction endpoint keys + the draw-oriented index, which the
 * `*Oriented` editors in `mep-wire-waypoints.ts` consume directly.
 *
 * Pure module — no React, no Zustand, no DOM, no Date/Math.random. The hook
 * (`use-mep-wire-waypoint-interaction`) owns DOM glue + persistence.
 *
 * @see ./opening-tag-drag-controller.ts (sibling pattern)
 * @see ../mep-systems/mep-wire-waypoints.ts (orientation-aware editors)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WirePlanPoint } from '../mep-systems/mep-wire-waypoints';

export type WaypointDragFsmState = 'idle' | 'dragging';

/** Identifies the dragged waypoint within its circuit (draw orientation). */
export interface WaypointDragTarget {
  readonly systemId: string;
  readonly keyA: string;
  readonly keyB: string;
  readonly orientedIndex: number;
}

export class MepWireWaypointDragController {
  private state: WaypointDragFsmState = 'idle';
  private target: WaypointDragTarget | null = null;
  private lastPoint: WirePlanPoint | null = null;

  getState(): WaypointDragFsmState {
    return this.state;
  }

  getTarget(): WaypointDragTarget | null {
    return this.target;
  }

  /** Last emitted point — the value the commit should persist. */
  getLastPoint(): WirePlanPoint | null {
    return this.lastPoint;
  }

  /** Begin dragging `target` from `startPoint` (the node's / insertion world point). */
  startDrag(target: WaypointDragTarget, startPoint: WirePlanPoint): void {
    this.state = 'dragging';
    this.target = target;
    this.lastPoint = startPoint;
  }

  /** Process a pointermove — the new waypoint position is the cursor world point. */
  updateDrag(worldPos: Point2D): WirePlanPoint | null {
    if (this.state !== 'dragging' || !this.target) return null;
    this.lastPoint = { x: worldPos.x, y: worldPos.y };
    return this.lastPoint;
  }

  /** Commit — returns the dragged target + final point, then resets to idle. */
  endDrag(): { target: WaypointDragTarget; point: WirePlanPoint } | null {
    if (this.state !== 'dragging' || !this.target || !this.lastPoint) {
      this.reset();
      return null;
    }
    const result = { target: this.target, point: this.lastPoint };
    this.reset();
    return result;
  }

  /** Abort an in-flight drag (pointercancel / Escape). Caller rolls back. */
  cancelDrag(): WaypointDragTarget | null {
    const target = this.target;
    this.reset();
    return target;
  }

  private reset(): void {
    this.state = 'idle';
    this.target = null;
    this.lastPoint = null;
  }
}
