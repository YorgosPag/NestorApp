/**
 * LineweightDisplayStore — global "Show Lineweight" toggle (AutoCAD LWDISPLAY).
 *
 * Micro-leaf singleton (ADR-040 pattern: useSyncExternalStore-compatible).
 * Holds the drawing-wide flag that decides whether committed entities render at
 * their resolved lineweight (mm → fixed screen px, zoom-INDEPENDENT — AutoCAD LWT)
 * or all collapse to a 1px hairline for fast drafting.
 *
 * Mirror of `stores/LinetypeScaleStore.ts`: zero React state, localStorage-persisted,
 * cross-session/user-scoped. The single gate is applied in the render-style resolver
 * (`canvas-v2/dxf-canvas/dxf-renderer-style-resolve.ts`) so BOTH the LINE batch path
 * and the per-entity path honour it through one code path (ADR-510 Φ2G).
 *
 * NOTE: print/plot ALWAYS renders real weights regardless of this screen toggle
 * (AutoCAD parity) — the resolver forces it on when a print policy is active.
 */

import { createPersistedValue } from './createPersistedValue';

/** Default — AutoCAD ships LWDISPLAY OFF, but Giorgio wants weights visible by default. */
export const DEFAULT_SHOW_LINEWEIGHT = true;

/** localStorage key — session-persisted, user-scoped. */
const LS_SHOW_LINEWEIGHT = 'dxf:showLineweight';

// SSoT reactive + persisted value (createPersistedValue = createExternalStore + storage-utils).
// `equals: Object.is` reproduces the hand-rolled `if (next === showLineweight) return` identity
// guard; `removeOnDefault` mirrors the old `removeItem` on DEFAULT. NOTE on format: the
// hand-rolled version wrote raw `'1'`/`'0'` (NOT JSON `true`/`false`); storage-utils always
// JSON-parses, so a legacy `'1'`/`'0'` hydrates as the NUMBER `1`/`0`, not a boolean — `validate`
// coerces that (and any other truthy/falsy legacy value) back to a real boolean so existing
// users' persisted flag still reads correctly. Forward writes now serialize as JSON
// `true`/`false` (one-way, non-breaking upgrade — still valid JSON on re-read).
const store = createPersistedValue<boolean>(LS_SHOW_LINEWEIGHT, DEFAULT_SHOW_LINEWEIGHT, {
  equals: Object.is,
  removeOnDefault: true,
  validate: (v) => (v === true || v === false ? v : Boolean(v)),
});

// ─── Snapshot getter (useSyncExternalStore-compatible) ───────────────────────

/** Current "Show Lineweight" flag. */
export function getShowLineweight(): boolean {
  return store.get();
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

export function subscribeLineweightDisplay(cb: () => void): () => void {
  return store.subscribe(cb);
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/** Set the flag. No-ops when unchanged (avoids redundant redraws). */
export function setShowLineweight(next: boolean): void {
  if (Object.is(store.get(), next)) return;
  store.set(next); // persists via createPersistedValue (removeOnDefault on DEFAULT_SHOW_LINEWEIGHT)
}

/** Flip the flag. */
export function toggleShowLineweight(): void {
  setShowLineweight(!store.get());
}

// ─── Test-only reset ─────────────────────────────────────────────────────────

/** @internal Reset to default + clear subscribers. Tests only. */
export function __resetLineweightDisplayForTesting(): void {
  store.reset(DEFAULT_SHOW_LINEWEIGHT);
}
