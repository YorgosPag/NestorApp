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

// ─── Per-scene base LTSCALE (ADR-510 Φ2H — non-persisted ambient) ────────────
//
// The persisted `store` above is the USER knob (status-bar LinetypeScaleControl,
// AutoCAD `LTSCALE`). Separately, each imported scene carries its OWN base LTSCALE
// (`SceneModel.linetypeScale`) — either the file's `$LTSCALE` or an auto-fit value
// so a meter-scale drawing's mm-convention dash patterns render at a VISIBLE density
// (without it, an ISO linetype on a 13 m line collapses to 700+ sub-pixel periods →
// looks solid). This is a per-render ambient, NOT persisted (persisting it would
// leak one drawing's scale onto the next). `DxfRenderer.render()` sets it once per
// frame from the active scene; every dash-stroke site reads the COMBINED effective
// scale so the two compose exactly like AutoCAD (drawing LTSCALE × user override).
let activeSceneScale = DEFAULT_LTSCALE;

/**
 * Set the active scene's base LTSCALE (from `SceneModel.linetypeScale`). Called once
 * per frame by the renderer before any dash is stroked. Non-positive / non-finite ⇒
 * reset to 1 (defensive; a bad scene value must not zero every dash).
 */
export function setActiveSceneLinetypeScale(next: number | undefined): void {
  activeSceneScale = Number.isFinite(next) && (next as number) > 0 ? (next as number) : DEFAULT_LTSCALE;
}

// ─── Snapshot getter (useSyncExternalStore-compatible) ───────────────────────

/** Current USER-knob LTSCALE (status-bar control). Always a finite positive number. */
export function getLinetypeScale(): number {
  return store.get();
}

/**
 * Effective LTSCALE at stroke time = active scene base × user knob. This is the
 * value EVERY dash-stroke site multiplies into `dashMmToScreenPx` (batch LINE path,
 * per-entity path, dim + BIM resolvers) so the per-scene auto-fit and the user's
 * manual override compose. The status-bar control reads/writes `getLinetypeScale`
 * (the user knob) ONLY — it must not see the scene base.
 */
export function getEffectiveLinetypeScale(): number {
  return activeSceneScale * store.get();
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
  activeSceneScale = DEFAULT_LTSCALE;
}
