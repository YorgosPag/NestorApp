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

import { createPersistedValue } from './createPersistedValue';

/** Default LTSCALE — AutoCAD convention. */
export const DEFAULT_LTSCALE = 1.0;

/** localStorage key — session-persisted, user-scoped. */
const LS_LTSCALE = 'dxf:ltscale';

// SSoT reactive + persisted value (createPersistedValue = createExternalStore + storage-utils).
// `equals: Object.is` reproduces the hand-rolled `if (next === scale) return` identity guard;
// `removeOnDefault` mirrors the old `removeItem` on DEFAULT; `validate` reproduces the
// finite-&-positive hydrate check. JSON number format === the old `String(n)` for numbers.
const store = createPersistedValue<number>(LS_LTSCALE, DEFAULT_LTSCALE, {
  equals: Object.is,
  removeOnDefault: true,
  validate: (v) => (Number.isFinite(v) && v > 0 ? v : DEFAULT_LTSCALE),
});

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
  store.set(next); // persists via createPersistedValue (removeOnDefault on DEFAULT_LTSCALE)
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
