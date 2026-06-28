'use client';

/**
 * SCENE STORE — zero-React mutable singleton SSoT for the per-level scene record
 * (`Record<levelId, SceneModel>`).
 *
 * ADR-547 Stage 0 (foundation). Mirrors `systems/selection/SelectedEntitiesStore.ts`
 * and `systems/cursor/ImmediateTransformStore.ts`: a module-level mutable record +
 * named getters/subscribe, hand-rolled (no generic factory — ADR-040 choice).
 *
 * WHY a store: the scene previously lived in a per-instance `useState` inside
 * `useSceneManager`, so a `SceneModel` edit produced a new `currentScene` reference
 * that was prop-drilled to ~28 persistence hosts + the BIM properties panel + the
 * ribbon scope + the orchestrator → a full-tree re-render on every entity edit
 * (React-DevTools 2026-06-28: ~2695 fibers / 252ms per column-param change). This
 * store is the SSoT that later stages read through granular leaf selectors so each
 * consumer re-renders only when ITS slice changes — the scene-axis analog of
 * ADR-532 (selection SSoT).
 *
 * Caching rule (mirror ADR-532): `getRecord` returns the current record reference,
 * which changes ONLY on a mutation, so `useSyncExternalStore`'s getSnapshot is
 * reference-stable (a fresh object per read would infinite-loop React).
 *
 * Single instance: this REPLACES the per-instance `useState` — previously two
 * `useSceneManager()` call sites (`useAutoSaveSceneManager` and the dead-read in
 * `useProSnapIntegration`) held SEPARATE empty records. The store unifies them into
 * one source of truth (the pro-snap read fed only an unconsumed `stats` object, so
 * unifying it is functionally inert — see ADR-547 §Stage 0).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-547 (scene-model SSoT — PROPOSED)
 * @see HANDOFFS/PLAN_2026-06-28_scene-model-ssot-cascade.md
 */

import type { SceneModel } from '../../types/scene';
import { countSceneEntities } from '../../utils/scene-entity-count';

type Listener = () => void;

// ─── Internal mutable state ───────────────────────────────────────────────────
let record: Record<string, SceneModel> = {};
let version = 0;
const listeners = new Set<Listener>();

function emit(): void {
  version += 1;
  listeners.forEach((l) => l());
}

// ─── Getters (reference-stable record snapshot) ────────────────────────────────
function getRecord(): Record<string, SceneModel> { return record; }
function getVersion(): number { return version; }
function getLevelScene(levelId: string): SceneModel | null { return record[levelId] ?? null; }
function hasSceneForLevel(levelId: string): boolean { return !!record[levelId]; }
function getSceneEntityCount(levelId: string): number { return countSceneEntities(record[levelId]); }

// ─── Mutators ──────────────────────────────────────────────────────────────────

/**
 * Store/replace a level's scene. No-op if the pointer is unchanged (mirrors the
 * old `useSceneManager` guard — avoids re-render loops). Synchronous write so a
 * sequential CompoundCommand reads the latest via `getLevelScene` within the tick
 * (the invariant the old `levelScenesRef` provided).
 */
function setLevelScene(levelId: string, scene: SceneModel): void {
  if (record[levelId] === scene) return;
  record = { ...record, [levelId]: scene };
  emit();
}

/** Remove a level's scene (behaviour-identical to the old unguarded clear). */
function clearLevelScene(levelId: string): void {
  const { [levelId]: _removed, ...rest } = record;
  record = rest;
  emit();
}

/** Drop all level scenes (used by tenant-switch `resetSceneSession`). */
function clearAllScenes(): void {
  record = {};
  emit();
}

// ─── Subscription ──────────────────────────────────────────────────────────────
function subscribe(cb: Listener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Test-only: reset record + version to empty (keeps active listeners, like
 *  SelectedEntitiesStore — renderHook subscriptions stay valid across resets). */
function _resetForTests(): void {
  record = {};
  version = 0;
}

// ─── Facade ────────────────────────────────────────────────────────────────────
export const SceneStore = {
  // getters
  getRecord, getVersion, getLevelScene, hasSceneForLevel, getSceneEntityCount,
  // mutators
  setLevelScene, clearLevelScene, clearAllScenes,
  // subscription
  subscribe,
  // test
  _resetForTests,
} as const;

// Named exports for stable module-level refs in useSyncExternalStore hooks.
export {
  subscribe as subscribeScene,
  getRecord as getSceneRecord,
  getVersion as getSceneVersion,
  getLevelScene as getSceneForLevel,
};
