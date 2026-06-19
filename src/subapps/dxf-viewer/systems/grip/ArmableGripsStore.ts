/**
 * ADR-501 Slice 2 — Armable-grips SSoT (module singleton).
 *
 * Holds the set of grips that are ELIGIBLE to be armed by a marquee rubber-band
 * (the "standard", non-hot-kind DXF grips of the current selection). The grip
 * hook (`useUnifiedGripInteraction`) publishes this list at LOW frequency (only on
 * selection / scene / grip-style change — never per frame), and the marquee
 * mouse-up handler READS it at event time to classify which grips fall inside the
 * box → arms them via {@link GripArmedStore} (orange, Slice 1).
 *
 * Why a store and not a threaded callback? This mirrors the established
 * `systems/grip/*Store.ts` pattern (GripAltMoveStore, GripBasePointStore, …): a
 * vanilla singleton that React WRITES to and event handlers READ from at event
 * time via a plain getter. ADR-040 cardinal rule #2 — event handlers receive
 * getters, not snapshots threaded through 6 micro-leaf component layers.
 *
 * ADR-040 compliant: the write is a low-frequency publish (selection change), not
 * a 60fps drag subscription; there is NO React subscription here (the armed-set
 * repaint is owned by GripArmedStore's `subscribe` in the grip hook).
 *
 * @see systems/grip/grip-marquee-arm.ts — pure classify + arm (reads getSnapshot)
 * @see systems/grip/GripArmedStore.ts — the armed-set the marquee writes into
 * @see hooks/grips/useUnifiedGripInteraction.ts — the sole publisher (`set`)
 * @see docs/centralized-systems/reference/adrs/ADR-501-dxf-grip-multi-arm-group-move.md
 */

import type { Point2D } from '../../rendering/types/Types';

/** A grip eligible for marquee arming — its world position + canonical identity. */
export interface ArmableGrip {
  readonly entityId: string;
  readonly gripIndex: number;
  readonly position: Point2D;
}

const EMPTY: readonly ArmableGrip[] = [];

class ArmableGripsStoreImpl {
  private grips: readonly ArmableGrip[] = EMPTY;

  /** Publish the current armable grips (called by the grip hook on change). */
  set(grips: readonly ArmableGrip[]): void {
    this.grips = grips.length === 0 ? EMPTY : grips;
  }

  /** Read the armable grips at event time (marquee mouse-up). */
  getSnapshot(): readonly ArmableGrip[] {
    return this.grips;
  }

  /** Clear (grip hook unmount). */
  clear(): void {
    this.grips = EMPTY;
  }
}

export const ArmableGripsStore = new ArmableGripsStoreImpl();
