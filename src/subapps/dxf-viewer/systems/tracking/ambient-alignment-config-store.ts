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
 * Keys: dxf:ambient.enabled, dxf:ambient.radiusMm
 */

const KEY_ENABLED = 'dxf:ambient.enabled';
const KEY_RADIUS = 'dxf:ambient.radiusMm';
const DEFAULT_ENABLED = true;
const DEFAULT_RADIUS_MM = 4000;
const DEFAULT_MAX_COLUMNS = 6;

type Listener = () => void;

export interface AmbientConfigSnapshot {
  readonly enabled: boolean;
  readonly radiusMm: number;
  readonly maxColumns: number;
}

class AmbientAlignmentConfigStore {
  private _enabled = DEFAULT_ENABLED;
  private _radiusMm = DEFAULT_RADIUS_MM;
  private readonly _maxColumns = DEFAULT_MAX_COLUMNS;
  private readonly listeners = new Set<Listener>();
  private _cachedSnapshot: AmbientConfigSnapshot | null = null;

  constructor() {
    if (typeof window === 'undefined') return;
    const savedEnabled = localStorage.getItem(KEY_ENABLED);
    if (savedEnabled !== null) this._enabled = savedEnabled === 'true';
    const savedRadius = localStorage.getItem(KEY_RADIUS);
    if (savedRadius !== null) {
      const parsed = parseFloat(savedRadius);
      if (!isNaN(parsed) && parsed > 0) this._radiusMm = parsed;
    }
  }

  get enabled(): boolean { return this._enabled; }
  get radiusMm(): number { return this._radiusMm; }
  get maxColumns(): number { return this._maxColumns; }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    if (typeof window !== 'undefined') localStorage.setItem(KEY_ENABLED, String(enabled));
    this.notify();
  }

  toggle(): void {
    this.setEnabled(!this._enabled);
  }

  setRadiusMm(radiusMm: number): void {
    if (!(radiusMm > 0)) return;
    this._radiusMm = radiusMm;
    if (typeof window !== 'undefined') localStorage.setItem(KEY_RADIUS, String(radiusMm));
    this.notify();
  }

  /** For useSyncExternalStore — stable reference; only replaced on mutation. */
  getSnapshot(): AmbientConfigSnapshot {
    if (!this._cachedSnapshot) {
      this._cachedSnapshot = {
        enabled: this._enabled,
        radiusMm: this._radiusMm,
        maxColumns: this._maxColumns,
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
