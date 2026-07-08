'use client';

/**
 * ADR-557 — `useCurrentLevelScene`: THE single source of truth for "the LIVE `SceneModel` of
 * the currently active level" as a React render-time value.
 *
 * WHY (Giorgio 2026-07-08): the derivation `currentLevelId ? getLevelScene(currentLevelId) ?? null
 * : null` was hand-copied into ~15 hooks (`useSceneState`, `useCurrentSceneModel`,
 * `useLayerManagerState`, `useProSnapIntegration`, the analytical-overlay painters, …). Two of
 * them wrapped it in a `useMemo` keyed on `[currentLevelId, getLevelScene]` — but `getLevelScene`
 * is a STABLE `useCallback([])` ref, so the memo froze the scene snapshot and never saw content
 * mutations → the text ribbon looked the selection up in a stale scene → `selectedIds: []` → every
 * edit silently no-op'd. Collapsing the derivation here (NO memo — a direct manager read, stable
 * object ref until a real mutation) fixes that class of bug in ONE place and removes the copies.
 *
 * Returns `null` when no level is active — callers short-circuit before using the scene.
 *
 * @module systems/levels/useCurrentLevelScene
 */

import { useLevelsOptional } from './useLevels';
import type { SceneModel } from '../../types/scene';

/**
 * The live scene of the active level (or `null` if none). Direct read — see the module note.
 *
 * Uses `useLevelsOptional` (NOT `useLevels`) so it is safe for EVERY caller: the analytical-overlay
 * painters and other consumers that render defensively outside a `LevelsSystem` provider get `null`
 * instead of a thrown error, while in-provider callers behave identically to a direct read.
 */
export function useCurrentLevelScene(): SceneModel | null {
  const levels = useLevelsOptional();
  const currentLevelId = levels?.currentLevelId ?? null;
  const getLevelScene = levels?.getLevelScene;
  return currentLevelId && getLevelScene ? getLevelScene(currentLevelId) ?? null : null;
}
