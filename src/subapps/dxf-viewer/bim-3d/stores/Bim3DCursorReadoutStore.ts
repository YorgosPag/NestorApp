/**
 * Bim3DCursorReadoutStore — 3D cursor world-coordinate readout (X/Y/Z, mm).
 *
 * The 3D counterpart of `ImmediatePositionStore`'s 2D `worldPosition` channel: a
 * zero-React singleton carrying the live world coordinates of the cursor in the 3D
 * viewport, in DXF-plan space (mm) — x = east, y = north, z = elevation (the same
 * triple `worldToDxfPlan` produces). The status-bar coordinate readout
 * (`ToolbarCoordinatesDisplay`) subscribes imperatively (textContent, no React
 * re-render) — same bypass-React pattern as the 2D channel.
 *
 * SSoT separation: kept apart from the 2D `ImmediatePositionStore` (Point2D, pan
 * lock, 2D transforms) exactly like `Selection3DStore`/`QuickProperties3DStore` are
 * separate from their 2D peers. The actual coordinate math is reused, not duplicated
 * (`raycastFloorPoint` + `worldToDxfPlan`); this store only transports the result.
 *
 * ADR-366 §B.2.Q1 follow-up (3D status-bar coordinates, Giorgio 2026-06-29).
 */
import { createExternalStore } from '../../stores/createExternalStore';

/** Cursor world coordinates in DXF-plan space (mm). z = elevation. */
export interface Bim3DCursorReadout {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

type ReadoutListener = (readout: Bim3DCursorReadout | null) => void;

// WAVE 2.7: high-frequency (per-mousemove) channel — the `equals` field-compare below
// is preserved byte-identical to the hand-rolled dedup guard it replaces (same skip
// condition: both null, or both non-null with equal x/y/z), so the per-frame call cost
// is unchanged. Flagged for a browser perf-verify pass over the 3D viewport cursor.
function readoutEquals(a: Bim3DCursorReadout | null, b: Bim3DCursorReadout | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

class Bim3DCursorReadoutStoreClass {
  private readonly store = createExternalStore<Bim3DCursorReadout | null>(null, {
    equals: readoutEquals,
  });

  /** Set the live readout (null = cursor outside the 3D viewport / not in 3D mode). */
  setReadout(readout: Bim3DCursorReadout | null): void {
    this.store.set(readout);
  }

  /** Clear the readout (cursor left the 3D viewport). */
  clear(): void {
    this.setReadout(null);
  }

  getReadout(): Bim3DCursorReadout | null {
    return this.store.get();
  }

  subscribe(listener: ReadoutListener): () => void {
    return this.store.subscribe(() => listener(this.store.get()));
  }
}

export const Bim3DCursorReadoutStore = new Bim3DCursorReadoutStoreClass();

export function setBim3DCursorReadout(readout: Bim3DCursorReadout | null): void {
  Bim3DCursorReadoutStore.setReadout(readout);
}

export function clearBim3DCursorReadout(): void {
  Bim3DCursorReadoutStore.clear();
}

export function getBim3DCursorReadout(): Bim3DCursorReadout | null {
  return Bim3DCursorReadoutStore.getReadout();
}

export function subscribeBim3DCursorReadout(listener: ReadoutListener): () => void {
  return Bim3DCursorReadoutStore.subscribe(listener);
}
