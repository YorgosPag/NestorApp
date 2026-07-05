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

import { createExternalStore } from '../../stores/createExternalStore';

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

/** Reads the persisted enabled/radius (SSR-safe) — seeds the store's initial snapshot. */
function readInitialSnapshot(): AmbientConfigSnapshot {
  if (typeof window === 'undefined') {
    return { enabled: DEFAULT_ENABLED, radiusPx: DEFAULT_RADIUS_PX, maxMembers: DEFAULT_MAX_MEMBERS };
  }
  let enabled = DEFAULT_ENABLED;
  const savedEnabled = localStorage.getItem(KEY_ENABLED);
  if (savedEnabled !== null) enabled = savedEnabled === 'true';

  let radiusPx = DEFAULT_RADIUS_PX;
  const savedRadius = localStorage.getItem(KEY_RADIUS);
  if (savedRadius !== null) {
    const parsed = parseFloat(savedRadius);
    if (!isNaN(parsed) && parsed > 0) radiusPx = parsed;
  }
  return { enabled, radiusPx, maxMembers: DEFAULT_MAX_MEMBERS };
}

class AmbientAlignmentConfigStore {
  // SSoT pub/sub via createExternalStore (WAVE 2.6). No `equals` — setEnabled/
  // setRadiusPx always notified unconditionally in the hand-rolled version, and
  // the store itself now IS the snapshot (no separate `_cachedSnapshot` /
  // invalidate-on-notify dance needed — `get()` already returns the live value).
  private readonly store = createExternalStore<AmbientConfigSnapshot>(readInitialSnapshot());

  get enabled(): boolean { return this.store.get().enabled; }
  get radiusPx(): number { return this.store.get().radiusPx; }
  get maxMembers(): number { return this.store.get().maxMembers; }

  setEnabled(enabled: boolean): void {
    if (typeof window !== 'undefined') localStorage.setItem(KEY_ENABLED, String(enabled));
    this.store.set({ ...this.store.get(), enabled });
  }

  toggle(): void {
    this.setEnabled(!this.enabled);
  }

  setRadiusPx(radiusPx: number): void {
    if (!(radiusPx > 0)) return;
    if (typeof window !== 'undefined') localStorage.setItem(KEY_RADIUS, String(radiusPx));
    this.store.set({ ...this.store.get(), radiusPx });
  }

  /** For useSyncExternalStore — stable reference; only replaced on mutation. */
  getSnapshot(): AmbientConfigSnapshot {
    return this.store.get();
  }

  subscribe = (fn: Listener): (() => void) => this.store.subscribe(fn);
}

export const ambientAlignmentConfigStore = new AmbientAlignmentConfigStore();
