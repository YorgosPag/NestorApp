/**
 * IsolateEffectsStore — Layer Isolate runtime effects micro-leaf (ADR-358 §5.6.bis).
 *
 * Holds the *current isolate session* state — the set of isolated layer ids,
 * the active mode (dim or freeze), and the dim opacity percent. Read inline by
 * `DxfRenderer.resolveStyleForRender` to override `transparency` for non-
 * isolated layers when mode='dim' is active. Zero-cost passthrough when
 * `active === false` (single boolean branch in the render loop).
 *
 * Lifecycle:
 *   - `LayerIsolateCommand.execute()` → `setIsolateEffects({ active: true, ... })`
 *   - `LayerUnisolateCommand.execute()` → `clearIsolateEffects()`
 *   - Session-only; not persisted. Reset on level switch or page reload.
 *
 * Pattern: ADR-040 micro-leaf subscriber (mirror of `systems/hover/HoverStore.ts`).
 * `useSyncExternalStore` compatible.
 */

import { dequal } from 'dequal';
import { createExternalStore } from '../../stores/createExternalStore';

type IsolateEffectsListener = () => void;

export interface IsolateEffectsSnapshot {
  /** True when an isolate session is currently active. */
  readonly active: boolean;
  /** Mode for the current session — `'dim'` or `'freeze'`. */
  readonly mode: 'dim' | 'freeze';
  /** Set of isolated layer ids (the kept-visible layers). */
  readonly isolatedLayerIds: ReadonlySet<string>;
  /**
   * Set of isolated ENTITY ids (Revit "Isolate Element"). When non-empty the
   * session is ENTITY-scoped: only these entities stay visible, everything else
   * is hidden (freeze) or dimmed (dim) — regardless of layer membership. Empty
   * ⇒ the session is LAYER-scoped (`isolatedLayerIds` governs). The two scopes
   * are mutually exclusive in practice but coexist harmlessly in the snapshot.
   */
  readonly isolatedEntityIds: ReadonlySet<string>;
  /**
   * Set of isolated BimCategory ids (Revit "Isolate Category"). When non-empty
   * the session is CATEGORY-scoped: only entities whose category ∈ this set stay
   * visible (e.g. all walls), everything else hidden (freeze) / dimmed (dim).
   * Empty ⇒ governed by entity- or layer-scope. The three scopes are mutually
   * exclusive in practice but coexist harmlessly in the snapshot.
   */
  readonly isolatedCategories: ReadonlySet<string>;
  /** Display-side opacity percent (5..90) for dim mode. Inverted to transparency at render. */
  readonly dimOpacityPercent: number;
  /** Optional human-readable label for the status-bar badge (e.g. category name). */
  readonly category: string | null;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

const INITIAL_SNAPSHOT: IsolateEffectsSnapshot = Object.freeze({
  active: false,
  mode: 'dim' as const,
  isolatedLayerIds: EMPTY_SET,
  isolatedEntityIds: EMPTY_SET,
  isolatedCategories: EMPTY_SET,
  dimOpacityPercent: 30,
  category: null
});

// SSoT pub/sub plumbing via createExternalStore (WAVE 2.7). No `equals` option —
// `setIsolateEffects` already runs its own dequal-based field-compare guard
// before deciding whether to write a new frozen snapshot, so the store itself
// always-notifies on `set` (byte-identical to the hand-rolled `notify()`).
const store = createExternalStore<IsolateEffectsSnapshot>(INITIAL_SNAPSHOT);

// ─── Snapshot getter (useSyncExternalStore-compatible) ───────────────────────

export function getIsolateEffectsSnapshot(): IsolateEffectsSnapshot {
  return store.get();
}

// ─── Subscription ────────────────────────────────────────────────────────────

export function subscribeIsolateEffects(cb: IsolateEffectsListener): () => void {
  return store.subscribe(cb);
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export interface SetIsolateEffectsInput {
  mode: 'dim' | 'freeze';
  isolatedLayerIds: ReadonlySet<string> | ReadonlyArray<string>;
  /** Entity-scope isolate (Revit "Isolate Element"). Omit/empty ⇒ layer-scope. */
  isolatedEntityIds?: ReadonlySet<string> | ReadonlyArray<string>;
  /** Category-scope isolate (Revit "Isolate Category"). Omit/empty ⇒ other scope. */
  isolatedCategories?: ReadonlySet<string> | ReadonlyArray<string>;
  dimOpacityPercent: number;
  category?: string | null;
}

/**
 * Activate or update the isolate effects. Skip-if-unchanged via deep-equality
 * on the fields (Set identity OR same-size + same-membership).
 */
export function setIsolateEffects(input: SetIsolateEffectsInput): void {
  const nextLayerSet: ReadonlySet<string> =
    input.isolatedLayerIds instanceof Set
      ? input.isolatedLayerIds
      : new Set(input.isolatedLayerIds);
  const nextEntitySet: ReadonlySet<string> =
    input.isolatedEntityIds === undefined
      ? EMPTY_SET
      : input.isolatedEntityIds instanceof Set
        ? input.isolatedEntityIds
        : new Set(input.isolatedEntityIds);
  const nextCategorySet: ReadonlySet<string> =
    input.isolatedCategories === undefined
      ? EMPTY_SET
      : input.isolatedCategories instanceof Set
        ? input.isolatedCategories
        : new Set(input.isolatedCategories);

  const current = store.get();
  if (
    current.active &&
    current.mode === input.mode &&
    current.dimOpacityPercent === input.dimOpacityPercent &&
    current.category === (input.category ?? null) &&
    dequal(current.isolatedLayerIds, nextLayerSet) &&
    dequal(current.isolatedEntityIds, nextEntitySet) &&
    dequal(current.isolatedCategories, nextCategorySet)
  ) {
    return;
  }

  store.set(Object.freeze({
    active: true,
    mode: input.mode,
    isolatedLayerIds: nextLayerSet,
    isolatedEntityIds: nextEntitySet,
    isolatedCategories: nextCategorySet,
    dimOpacityPercent: input.dimOpacityPercent,
    category: input.category ?? null
  }));
}

/** Deactivate isolate effects (zero-cost passthrough until next `setIsolateEffects`). */
export function clearIsolateEffects(): void {
  if (!store.get().active) return;
  store.set(INITIAL_SNAPSHOT);
}

// ─── Test-only reset (NOT exported from index — direct import only) ──────────

/** @internal Reset to empty state + clear subscribers. Tests only. */
export function __resetIsolateEffectsForTesting(): void {
  store.reset(INITIAL_SNAPSHOT);
}
