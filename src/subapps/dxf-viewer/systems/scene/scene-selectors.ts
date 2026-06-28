'use client';

/**
 * SCENE SELECTORS — granular, reference-stable reads over the {@link SceneStore}
 * SSoT (ADR-547 Stage 2/3).
 *
 * The monolithic `currentScene` prop forced ~28 persistence hosts + the BIM
 * properties panel to re-run a `useMemo`/`useEffect` on EVERY entity edit, because
 * each edit produces a new `SceneModel` reference (React-DevTools 2026-06-28:
 * ~2695 fibers / 252ms per column-param change). These selectors replace that
 * prop with leaf subscriptions so a consumer re-renders ONLY when ITS slice
 * changes — the scene-axis analog of `SelectedEntitiesStore` cached selectors
 * (ADR-532).
 *
 * REFERENCE-STABILITY INVARIANT (the whole point):
 * `LevelSceneManagerAdapter.updateEntity` rebuilds the entity array via
 * `entities.map(e => e.id === id ? {...e, ...updates} : e)` — every UNCHANGED
 * entity keeps its SAME object reference; only the edited one is replaced. So a
 * per-type slice (`filter`) yields an array whose elements are reference-identical
 * to the previous slice whenever a DIFFERENT type was edited. By caching the last
 * slice per (guard, levelId) and returning it unchanged when the elements are
 * shallow-equal, a Wall host does NOT re-render when a Column is edited.
 *
 * The cache is version-gated: it recomputes the `filter` only when the store's
 * mutation counter advanced since the last read for that key, so a host that
 * subscribes pays O(n) at most once per edit (not once per render).
 *
 * @see systems/scene/SceneStore.ts (the SSoT this reads)
 * @see docs/centralized-systems/reference/adrs/ADR-547 (scene-model SSoT — PROPOSED)
 */

import type { SceneModel, AnySceneEntity } from '../../types/scene';
import { getSceneForLevel, getSceneVersion } from './SceneStore';

/** Stable empty result so a null/absent level never mints a fresh array (which
 *  would make `useSyncExternalStore` loop). */
const EMPTY: readonly never[] = Object.freeze([]);

type SliceGuard<T extends AnySceneEntity> = (e: AnySceneEntity) => e is T;

interface SliceCacheEntry { version: number; value: readonly AnySceneEntity[]; }

// Per-guard → per-level cache of the last filtered slice + the store version it
// was computed at. WeakMap keyed by the (stable, module-level) guard function so
// distinct entity types never collide and entries are GC'd with their guard.
// `let` (not `const`) so tests can swap in a fresh map — the store's version
// counter resets to 0 in tests, which would otherwise alias stale cached versions.
let sliceCache = new WeakMap<SliceGuard<AnySceneEntity>, Map<string, SliceCacheEntry>>();

function shallowEqualArrays(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * All entities of one type in a level's scene, as a REFERENCE-STABLE array.
 *
 * Returns the SAME array reference across reads until the slice's contents
 * actually change (an entity of this type added/removed/edited). Editing an
 * entity of a DIFFERENT type leaves this reference untouched, so a subscriber
 * does not re-render. Pass a stable, module-level type guard (e.g. `isWallEntity`).
 */
export function getSceneEntitiesByType<T extends AnySceneEntity>(
  levelId: string | null,
  guard: SliceGuard<T>,
): readonly T[] {
  if (!levelId) return EMPTY as readonly T[];

  let perLevel = sliceCache.get(guard as SliceGuard<AnySceneEntity>);
  if (!perLevel) {
    perLevel = new Map<string, SliceCacheEntry>();
    sliceCache.set(guard as SliceGuard<AnySceneEntity>, perLevel);
  }

  const version = getSceneVersion();
  const cached = perLevel.get(levelId);
  // Fast path: nothing mutated since we last computed this slice.
  if (cached && cached.version === version) return cached.value as readonly T[];

  const scene: SceneModel | null = getSceneForLevel(levelId);
  const next = (scene?.entities ?? []).filter(guard);

  // Preserve the previous reference when the contents are unchanged (a different
  // type was edited) so useSyncExternalStore sees a stable snapshot.
  if (cached && shallowEqualArrays(cached.value, next)) {
    cached.version = version;
    return cached.value as readonly T[];
  }

  const value: readonly T[] = next;
  perLevel.set(levelId, { version, value });
  return value;
}

// Per-(levelId|id) cache of the last looked-up entity + the version it was read
// at. The entity object reference is itself stable for unchanged entities (see
// updateEntity), so this only ever changes when THAT entity changes.
const byIdCache = new Map<string, { version: number; value: AnySceneEntity | null }>();

/**
 * A single entity by id from a level's scene, reference-stable across edits to
 * OTHER entities. Returns the same object reference until that specific entity is
 * mutated (or selection moves to another id). Pair with a type guard at the call
 * site to narrow.
 */
export function getSceneEntityById(
  levelId: string | null,
  entityId: string | null,
): AnySceneEntity | null {
  if (!levelId || !entityId) return null;

  const key = `${levelId}|${entityId}`;
  const version = getSceneVersion();
  const cached = byIdCache.get(key);
  if (cached && cached.version === version) return cached.value;

  const scene = getSceneForLevel(levelId);
  const found = scene?.entities.find((e) => e.id === entityId) ?? null;

  // Same reference for an unchanged entity → keep the cached value so subscribers
  // don't re-render when an unrelated entity changed.
  if (cached && cached.value === found) {
    cached.version = version;
    return cached.value;
  }

  byIdCache.set(key, { version, value: found });
  return found;
}

/** Test-only: drop both selector caches so the store's version reset to 0 cannot
 *  alias a stale cached version. Mirrors `SceneStore._resetForTests`. */
export function _resetSelectorCachesForTests(): void {
  byIdCache.clear();
  sliceCache = new WeakMap<SliceGuard<AnySceneEntity>, Map<string, SliceCacheEntry>>();
}
