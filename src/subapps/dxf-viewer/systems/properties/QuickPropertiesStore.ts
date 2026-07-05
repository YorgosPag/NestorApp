/**
 * QUICK PROPERTIES STORE — ADR-357 §4 G9 Phase 8
 *
 * Singleton SSoT for hover-triggered Quick Properties display.
 * Subscribes to HoverStore internally; notifies subscribers after
 * HOVER_DELAY_MS (800ms) of stable hover on the same entity.
 * Position captured from ImmediatePositionStore at acquisition time.
 *
 * Pattern mirrors TrackingPointStore / HoverStore (ADR-040 micro-leaf).
 * Zero React state — useSyncExternalStore consumers only.
 */

import { subscribeHoveredEntity, getHoveredEntity } from '../hover/HoverStore';
import { getImmediatePosition } from '../cursor/ImmediatePositionStore';
import { DXF_TIMING } from '../../config/dxf-timing';
import { createExternalStore } from '../../stores/createExternalStore';

/** ms of stable hover required before showing Quick Properties. */
const HOVER_DELAY_MS = DXF_TIMING.gesture.HOVER_REVEAL; // ADR-516

export interface QuickPropertiesSnapshot {
  readonly entityId: string | null;
  readonly position: { readonly x: number; readonly y: number } | null;
  readonly acquiredAt: number;
}

const EMPTY_SNAPSHOT: QuickPropertiesSnapshot = {
  entityId: null,
  position: null,
  acquiredAt: 0,
};

type Listener = () => void;

class QuickPropertiesStoreClass {
  // SSoT pub/sub via createExternalStore (WAVE 2.6). No `equals` — scheduleAcquire
  // always builds a brand-new snapshot object (unconditional notify, matching the
  // original); clearImmediate keeps its own manual `entityId === null` guard.
  private readonly store = createExternalStore<QuickPropertiesSnapshot>(EMPTY_SNAPSHOT);
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    subscribeHoveredEntity(() => {
      const id = getHoveredEntity();
      if (id !== null) {
        this.scheduleAcquire(id);
      } else {
        this.clearImmediate();
      }
    });
  }

  private scheduleAcquire(id: string): void {
    this.cancelTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      const cssPos = getImmediatePosition();
      this.store.set({
        entityId: id,
        position: cssPos ? { x: cssPos.x, y: cssPos.y } : null,
        acquiredAt: Date.now(),
      });
    }, HOVER_DELAY_MS);
  }

  private clearImmediate(): void {
    this.cancelTimer();
    if (this.store.get().entityId === null) return;
    this.store.set(EMPTY_SNAPSHOT);
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  getSnapshot = (): QuickPropertiesSnapshot => this.store.get();

  subscribe = (fn: Listener): (() => void) => this.store.subscribe(fn);
}

export const QuickPropertiesStore = new QuickPropertiesStoreClass();
