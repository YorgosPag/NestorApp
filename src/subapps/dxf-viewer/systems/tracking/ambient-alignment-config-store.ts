/**
 * AMBIENT ALIGNMENT CONFIG STORE — ADR-357 extension (Revit-style auto-tracking)
 *
 * Singleton SSoT for the ambient (auto) alignment toggle + tunables. Zero React
 * state — reads/writes localStorage directly, subscribers notified synchronously
 * (micro-leaf pattern, ADR-040 — readable at event-time from the hover hot path).
 *
 * Clones the `polar-tracking-store` pattern rather than the Firestore-backed
 * `useCadToggles` slice: this aid needs no cloud persistence and avoids the
 * schema-migration + multi-instance echo machinery.
 *
 * Default ON (Giorgio: «πάντα ON, όπως το Revit») — defeatable from the
 * status-bar «AutoAlign» toggle.
 *
 * Search radius is SCREEN-relative (Giorgio 2026-06-21: «zoom-adaptive») — a
 * constant pixel radius the caller converts to world units via `1/scale`, so the
 * "members near my cursor" feel stays constant at every zoom.
 *
 * Keys: dxf:ambient.enabled, dxf:ambient.radiusPx
 */

const KEY_ENABLED = 'dxf:ambient.enabled';
const KEY_RADIUS = 'dxf:ambient.radiusPx';
const DEFAULT_ENABLED = true;
const DEFAULT_RADIUS_PX = 400;
const DEFAULT_MAX_MEMBERS = 6;

type Listener = () => void;

export interface AmbientConfigSnapshot {
  readonly enabled: boolean;
  /** Screen-space search radius (px) — caller multiplies by `1/scale` → world units. */
  readonly radiusPx: number;
  readonly maxMembers: number;
}

class AmbientAlignmentConfigStore {
  private _enabled = DEFAULT_ENABLED;
  private _radiusPx = DEFAULT_RADIUS_PX;
  private readonly _maxMembers = DEFAULT_MAX_MEMBERS;
  private readonly listeners = new Set<Listener>();
  private _cachedSnapshot: AmbientConfigSnapshot | null = null;

  constructor() {
    if (typeof window === 'undefined') return;
    const savedEnabled = localStorage.getItem(KEY_ENABLED);
    if (savedEnabled !== null) this._enabled = savedEnabled === 'true';
    const savedRadius = localStorage.getItem(KEY_RADIUS);
    if (savedRadius !== null) {
      const parsed = parseFloat(savedRadius);
      if (!isNaN(parsed) && parsed > 0) this._radiusPx = parsed;
    }
  }

  get enabled(): boolean { return this._enabled; }
  get radiusPx(): number { return this._radiusPx; }
  get maxMembers(): number { return this._maxMembers; }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    if (typeof window !== 'undefined') localStorage.setItem(KEY_ENABLED, String(enabled));
    this.notify();
  }

  toggle(): void {
    this.setEnabled(!this._enabled);
  }

  setRadiusPx(radiusPx: number): void {
    if (!(radiusPx > 0)) return;
    this._radiusPx = radiusPx;
    if (typeof window !== 'undefined') localStorage.setItem(KEY_RADIUS, String(radiusPx));
    this.notify();
  }

  /** For useSyncExternalStore — stable reference; only replaced on mutation. */
  getSnapshot(): AmbientConfigSnapshot {
    if (!this._cachedSnapshot) {
      this._cachedSnapshot = {
        enabled: this._enabled,
        radiusPx: this._radiusPx,
        maxMembers: this._maxMembers,
      };
    }
    return this._cachedSnapshot;
  }

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  private notify(): void {
    this._cachedSnapshot = null;
    this.listeners.forEach(fn => fn());
  }
}

export const ambientAlignmentConfigStore = new AmbientAlignmentConfigStore();
