/**
 * POLAR TRACKING STORE — ADR-357 Phase 1
 *
 * Singleton SSoT for polar angle settings.
 * Zero React state — reads/writes localStorage directly.
 * Subscribers notified synchronously on change (micro-leaf pattern, ADR-040).
 *
 * Keys: dxf:polar.increment, dxf:polar.additional
 */

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

class PolarTrackingStore {
  private _incrementAngle = DEFAULT_INCREMENT;
  private _additionalAngles: number[] = [];
  private readonly listeners = new Set<Listener>();
  private _cachedSnapshot: PolarSnapshot | null = null;

  constructor() {
    if (typeof window === 'undefined') return;
    const savedIncrement = localStorage.getItem(KEY_INCREMENT);
    if (savedIncrement !== null) {
      const parsed = parseFloat(savedIncrement);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 360) {
        this._incrementAngle = parsed;
      }
    }
    const savedAdditional = localStorage.getItem(KEY_ADDITIONAL);
    if (savedAdditional !== null) {
      try {
        const parsed: unknown = JSON.parse(savedAdditional);
        if (Array.isArray(parsed)) {
          this._additionalAngles = parsed.filter(
            (a): a is number => typeof a === 'number' && isFinite(a),
          );
        }
      } catch {
        // corrupt localStorage — ignore, keep default
      }
    }
  }

  get incrementAngle(): number {
    return this._incrementAngle;
  }

  get additionalAngles(): number[] {
    return this._additionalAngles;
  }

  setIncrementAngle(angle: number): void {
    this._incrementAngle = angle;
    if (typeof window !== 'undefined') {
      localStorage.setItem(KEY_INCREMENT, String(angle));
    }
    this.notify();
  }

  setAdditionalAngles(angles: number[]): void {
    this._additionalAngles = [...angles];
    if (typeof window !== 'undefined') {
      localStorage.setItem(KEY_ADDITIONAL, JSON.stringify(angles));
    }
    this.notify();
  }

  /** For useSyncExternalStore — stable reference; only replaced on mutation. */
  getSnapshot(): PolarSnapshot {
    if (!this._cachedSnapshot) {
      this._cachedSnapshot = {
        incrementAngle: this._incrementAngle,
        additionalAngles: this._additionalAngles,
      };
    }
    return this._cachedSnapshot;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private notify(): void {
    this._cachedSnapshot = null;
    this.listeners.forEach(fn => fn());
  }
}

export const polarTrackingStore = new PolarTrackingStore();
