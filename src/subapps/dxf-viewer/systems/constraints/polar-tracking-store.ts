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
const DEFAULT_INCREMENT = 90;

type Listener = () => void;

class PolarTrackingStore {
  private _incrementAngle = DEFAULT_INCREMENT;
  private _additionalAngles: number[] = [];
  private readonly listeners = new Set<Listener>();

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

  /** For useSyncExternalStore — stable snapshot object reference changes on every store mutation. */
  getSnapshot(): { incrementAngle: number; additionalAngles: number[] } {
    return { incrementAngle: this._incrementAngle, additionalAngles: this._additionalAngles };
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private notify(): void {
    this.listeners.forEach(fn => fn());
  }
}

export const polarTrackingStore = new PolarTrackingStore();
