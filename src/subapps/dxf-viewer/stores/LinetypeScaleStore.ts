/**
 * LinetypeScaleStore — global LTSCALE knob (ADR-510 Φ2).
 *
 * Micro-leaf singleton (ADR-040 pattern: useSyncExternalStore-compatible).
 * Holds the drawing-wide linetype scale factor (AutoCAD `LTSCALE`) that the
 * canvas dash renderer multiplies into every dash pattern, on top of the live
 * zoom factor (`rendering/linetype-dash-resolver.ts`).
 *
 * Mirror of `stores/QuickStyleStore.ts`: zero React state, localStorage-persisted,
 * cross-session/user-scoped. UI status-bar control is deferred — for now the
 * value defaults to 1.0 and can be set programmatically / from DXF $LTSCALE.
 *
 * The "hidden/center lines look continuous" classic CAD bug is an LTSCALE
 * mismatch vs drawing size (ADR-510 §2.2); this knob is the fix surface.
 */

import { createExternalStore } from './createExternalStore';

/** Default LTSCALE — AutoCAD convention. */
export const DEFAULT_LTSCALE = 1.0;

/** localStorage key — session-persisted, user-scoped. */
const LS_LTSCALE = 'dxf:ltscale';

function loadInitialScale(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_LTSCALE;
  const raw = localStorage.getItem(LS_LTSCALE);
  if (raw === null) return DEFAULT_LTSCALE;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LTSCALE;
}

function persist(next: number): void {
  if (typeof localStorage === 'undefined') return;
  if (next === DEFAULT_LTSCALE) {
    localStorage.removeItem(LS_LTSCALE);
  } else {
    localStorage.setItem(LS_LTSCALE, String(next));
  }
}

// SSoT pub/sub plumbing via createExternalStore (WAVE 2.6). `equals: Object.is`
// reproduces the hand-rolled `if (next === scale) return` identity guard. The
// wrapper also short-circuits explicitly before persisting, so an unchanged
// value never touches localStorage — byte-identical to the original.
const store = createExternalStore<number>(loadInitialScale(), { equals: Object.is });

// ─── Snapshot getter (useSyncExternalStore-compatible) ───────────────────────

/** Current global LTSCALE. Always a finite positive number. */
export function getLinetypeScale(): number {
  return store.get();
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

export function subscribeLinetypeScale(cb: () => void): () => void {
  return store.subscribe(cb);
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/**
 * Set the global LTSCALE. Non-positive / non-finite values are ignored
 * (AutoCAD rejects `LTSCALE <= 0`). No-ops when the value is unchanged.
 */
export function setLinetypeScale(next: number): void {
  if (!Number.isFinite(next) || next <= 0) return;
  if (Object.is(store.get(), next)) return;
  store.set(next);
  persist(next);
}

/** Reset to the AutoCAD default (1.0). */
export function resetLinetypeScale(): void {
  setLinetypeScale(DEFAULT_LTSCALE);
}

// ─── Test-only reset ─────────────────────────────────────────────────────────

/** @internal Reset to default + clear subscribers. Tests only. */
export function __resetLinetypeScaleForTesting(): void {
  store.reset(DEFAULT_LTSCALE);
}
