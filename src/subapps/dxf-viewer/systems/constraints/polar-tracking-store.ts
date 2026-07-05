/**
 * POLAR TRACKING STORE — ADR-357 Phase 1
 *
 * Singleton SSoT for polar angle settings.
 * Zero React state — reads/writes localStorage directly.
 * Subscribers notified synchronously on change (micro-leaf pattern, ADR-040).
 *
 * Keys: dxf:polar.increment, dxf:polar.additional
 */

import { createExternalStore } from '../../stores/createExternalStore';

const KEY_INCREMENT = 'dxf:polar.increment';
const KEY_ADDITIONAL = 'dxf:polar.additional';
// ADR-510 Φ1 (Q2): dense polar tracking — magnet every 15° by default (0/15/30/45…),
// so orthogonal 0/90 stay a subset. User-overridable from the status-bar dropdown
// (persisted to localStorage); an existing saved value always wins over this default.
const DEFAULT_INCREMENT = 15;

type Listener = () => void;

interface PolarSnapshot {
  readonly incrementAngle: number;
  readonly additionalAngles: readonly number[];
}

/** Hydrate the initial snapshot from localStorage (browser only). */
function readInitialSnapshot(): PolarSnapshot {
  let incrementAngle = DEFAULT_INCREMENT;
  let additionalAngles: number[] = [];

  if (typeof window === 'undefined') {
    return { incrementAngle, additionalAngles };
  }

  const savedIncrement = localStorage.getItem(KEY_INCREMENT);
  if (savedIncrement !== null) {
    const parsed = parseFloat(savedIncrement);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 360) {
      incrementAngle = parsed;
    }
  }
  const savedAdditional = localStorage.getItem(KEY_ADDITIONAL);
  if (savedAdditional !== null) {
    try {
      const parsed: unknown = JSON.parse(savedAdditional);
      if (Array.isArray(parsed)) {
        additionalAngles = parsed.filter(
          (a): a is number => typeof a === 'number' && isFinite(a),
        );
      }
    } catch {
      // corrupt localStorage — ignore, keep default
    }
  }

  return { incrementAngle, additionalAngles };
}

class PolarTrackingStore {
  // SSoT pub/sub via createExternalStore (WAVE 2.6). `get()` already returns a
  // stable reference until the next `set`, so the manual `_cachedSnapshot`
  // invalidation the hand-rolled store used is no longer needed. No `equals` —
  // every `setIncrementAngle` / `setAdditionalAngles` call notified unconditionally.
  private readonly store = createExternalStore<PolarSnapshot>(readInitialSnapshot());

  get incrementAngle(): number {
    return this.store.get().incrementAngle;
  }

  get additionalAngles(): readonly number[] {
    return this.store.get().additionalAngles;
  }

  setIncrementAngle(angle: number): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(KEY_INCREMENT, String(angle));
    }
    this.store.set({ ...this.store.get(), incrementAngle: angle });
  }

  setAdditionalAngles(angles: number[]): void {
    const next = [...angles];
    if (typeof window !== 'undefined') {
      localStorage.setItem(KEY_ADDITIONAL, JSON.stringify(angles));
    }
    this.store.set({ ...this.store.get(), additionalAngles: next });
  }

  /** For useSyncExternalStore — stable reference; only replaced on mutation. */
  getSnapshot(): PolarSnapshot {
    return this.store.get();
  }

  subscribe(fn: Listener): () => void {
    return this.store.subscribe(fn);
  }
}

export const polarTrackingStore = new PolarTrackingStore();
