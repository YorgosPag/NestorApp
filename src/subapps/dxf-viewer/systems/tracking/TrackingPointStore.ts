/**
 * TRACKING POINT STORE — ADR-357 §4 G4 (Object Snap Tracking)
 *
 * Singleton SSoT for acquired tracking points. Mirrors the HoverStore /
 * ImmediatePositionStore pattern: zero React state, mutable internal state,
 * `useSyncExternalStore`-compatible getter/subscribe pair.
 *
 * Capacity: max 7 simultaneous acquired points (FIFO — oldest decays first).
 * Acquisition: hover ≥ ACQUISITION_DURATION_MS on a snap point OR Shift+click.
 * Decay: clear on ESC / completion / `INACTIVITY_TIMEOUT_MS` since last touch.
 *
 * Architecture: this is a Tier-3 micro-leaf SSoT (ADR-040). React consumers
 * subscribe via `subscribeTrackingPoints` + `getTrackingPointsSnapshot`.
 * The snapshot reference is stable across no-op mutations so React bails out
 * cheaply when the array is logically unchanged.
 */

import type { Point2D } from '../../rendering/types/Types';

export interface AcquiredTrackingPoint {
  readonly x: number;
  readonly y: number;
  /** Wall-clock acquisition timestamp (`performance.now()`). */
  readonly acquiredAt: number;
  /** Snap engine id that produced the point (e.g. `'endpoint'`, `'midpoint'`). */
  readonly sourceSnapType: string;
}

type Listener = () => void;

/** Max simultaneous acquired points before FIFO eviction kicks in. */
export const MAX_TRACKING_POINTS = 7;
/** Hover duration (ms) needed on a stable snap candidate before acquisition. */
export const ACQUISITION_DURATION_MS = 1000;
/** Inactivity window (ms) after which all acquired points decay. */
export const INACTIVITY_TIMEOUT_MS = 5000;

class TrackingPointStoreClass {
  private points: AcquiredTrackingPoint[] = [];
  private listeners: Set<Listener> = new Set();
  /** Stable snapshot — only replaced when `points` actually mutates. */
  private snapshot: readonly AcquiredTrackingPoint[] = [];
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Acquire a new tracking point. FIFO-evicts the oldest entry when the
   * capacity is exceeded. Resets the inactivity timer regardless.
   */
  acquirePoint(point: Point2D, sourceSnapType: string): void {
    const next: AcquiredTrackingPoint = {
      x: point.x,
      y: point.y,
      acquiredAt: performance.now(),
      sourceSnapType,
    };
    const filtered = this.points.filter(p => !isSamePoint(p, next));
    const withNew = [...filtered, next];
    this.points = withNew.length > MAX_TRACKING_POINTS
      ? withNew.slice(withNew.length - MAX_TRACKING_POINTS)
      : withNew;
    this.snapshot = this.points.slice();
    this.armInactivityTimer();
    this.notify();
  }

  /** Bump the inactivity timer without mutating the point set. */
  touch(): void {
    if (this.points.length === 0) return;
    this.armInactivityTimer();
  }

  /** Drop all acquired points immediately (ESC / completion / explicit reset). */
  clearAll(): void {
    if (this.points.length === 0) return;
    this.points = [];
    this.snapshot = this.points;
    this.cancelInactivityTimer();
    this.notify();
  }

  /** Read-only mutable view of acquired points (do not mutate). */
  getPoints(): readonly AcquiredTrackingPoint[] {
    return this.snapshot;
  }

  /** `useSyncExternalStore`-compatible snapshot — referentially stable. */
  getSnapshot = (): readonly AcquiredTrackingPoint[] => this.snapshot;

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  private armInactivityTimer(): void {
    this.cancelInactivityTimer();
    this.inactivityTimer = setTimeout(() => {
      this.clearAll();
    }, INACTIVITY_TIMEOUT_MS);
  }

  private cancelInactivityTimer(): void {
    if (this.inactivityTimer !== null) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  private notify(): void {
    this.listeners.forEach(fn => {
      try { fn(); } catch (err) { console.error('TrackingPointStore listener error:', err); }
    });
  }
}

function isSamePoint(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001;
}

export const TrackingPointStore = new TrackingPointStoreClass();

export const subscribeTrackingPoints = TrackingPointStore.subscribe;
export const getTrackingPointsSnapshot = TrackingPointStore.getSnapshot;
