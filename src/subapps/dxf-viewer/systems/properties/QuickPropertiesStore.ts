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
  private snapshot: QuickPropertiesSnapshot = EMPTY_SNAPSHOT;
  private listeners = new Set<Listener>();
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
      this.snapshot = {
        entityId: id,
        position: cssPos ? { x: cssPos.x, y: cssPos.y } : null,
        acquiredAt: Date.now(),
      };
      this.notify();
    }, HOVER_DELAY_MS);
  }

  private clearImmediate(): void {
    this.cancelTimer();
    if (this.snapshot.entityId === null) return;
    this.snapshot = EMPTY_SNAPSHOT;
    this.notify();
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private notify(): void {
    this.listeners.forEach(fn => {
      try { fn(); } catch (e) { console.error('QuickPropertiesStore listener error:', e); }
    });
  }

  getSnapshot = (): QuickPropertiesSnapshot => this.snapshot;

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };
}

export const QuickPropertiesStore = new QuickPropertiesStoreClass();
