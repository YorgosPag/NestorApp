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

type IsolateEffectsListener = () => void;

export interface IsolateEffectsSnapshot {
  /** True when an isolate session is currently active. */
  readonly active: boolean;
  /** Mode for the current session — `'dim'` or `'freeze'`. */
  readonly mode: 'dim' | 'freeze';
  /** Set of isolated layer ids (the kept-visible layers). */
  readonly isolatedLayerIds: ReadonlySet<string>;
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
  dimOpacityPercent: 30,
  category: null
});

let snapshot: IsolateEffectsSnapshot = INITIAL_SNAPSHOT;
const subscribers = new Set<IsolateEffectsListener>();

function notify(): void {
  subscribers.forEach((cb) => cb());
}

// ─── Snapshot getter (useSyncExternalStore-compatible) ───────────────────────

export function getIsolateEffectsSnapshot(): IsolateEffectsSnapshot {
  return snapshot;
}

// ─── Subscription ────────────────────────────────────────────────────────────

export function subscribeIsolateEffects(cb: IsolateEffectsListener): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export interface SetIsolateEffectsInput {
  mode: 'dim' | 'freeze';
  isolatedLayerIds: ReadonlySet<string> | ReadonlyArray<string>;
  dimOpacityPercent: number;
  category?: string | null;
}

/**
 * Activate or update the isolate effects. Skip-if-unchanged via deep-equality
 * on the four fields (Set identity OR same-size + same-membership).
 */
export function setIsolateEffects(input: SetIsolateEffectsInput): void {
  const nextSet: ReadonlySet<string> =
    input.isolatedLayerIds instanceof Set
      ? input.isolatedLayerIds
      : new Set(input.isolatedLayerIds);

  if (
    snapshot.active &&
    snapshot.mode === input.mode &&
    snapshot.dimOpacityPercent === input.dimOpacityPercent &&
    snapshot.category === (input.category ?? null) &&
    sameMembership(snapshot.isolatedLayerIds, nextSet)
  ) {
    return;
  }

  snapshot = Object.freeze({
    active: true,
    mode: input.mode,
    isolatedLayerIds: nextSet,
    dimOpacityPercent: input.dimOpacityPercent,
    category: input.category ?? null
  });
  notify();
}

/** Deactivate isolate effects (zero-cost passthrough until next `setIsolateEffects`). */
export function clearIsolateEffects(): void {
  if (!snapshot.active) return;
  snapshot = INITIAL_SNAPSHOT;
  notify();
}

function sameMembership(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
}

// ─── Test-only reset (NOT exported from index — direct import only) ──────────

/** @internal Reset to empty state + clear subscribers. Tests only. */
export function __resetIsolateEffectsForTesting(): void {
  snapshot = INITIAL_SNAPSHOT;
  subscribers.clear();
}
