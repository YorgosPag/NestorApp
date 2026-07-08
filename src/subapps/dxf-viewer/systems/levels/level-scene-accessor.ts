/**
 * ADR-591 — Canonical level-scene accessor capability interfaces (SSoT).
 *
 * Replaces the hand-written `LevelManagerLike` interface shape that was
 * re-declared verbatim across ~45 DXF Viewer consumers. Each consumer imports
 * the narrowest capability it actually needs:
 *   • CurrentLevelRef  — read the active level id only
 *   • LevelSceneReader — read active id + per-level scenes
 *   • LevelSceneWriter — read + write per-level scenes (auto-save origin aware)
 *
 * Consumers that additionally need `levels` (or other LevelsSystem fields)
 * extend the relevant capability interface and add ONLY the extra field.
 *
 * The canonical `useLevels()` manager structurally satisfies `LevelSceneWriter`
 * (same `currentLevelId` / `getLevelScene` / `setLevelScene` signatures) — the
 * 106 `Pick<ReturnType<typeof useLevels>, …>` aliases can migrate onto these
 * interfaces in a follow-up pass (B1-bis).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-591-level-scene-accessor-ssot.md
 */
import type { SceneModel } from '../../types/scene';
import type { SceneWriteOrigin } from '../../hooks/scene/scene-write-origin';

/** Read-only reference to the currently active level id. */
export interface CurrentLevelRef {
  readonly currentLevelId: string | null;
}

/**
 * Minimal read-one-scene capability (subset of the LevelsSystem manager).
 * Consumers that resolve a scene by id but never touch the active-level id
 * (e.g. the entity Detail hosts) depend on this narrowest capability only —
 * Interface Segregation, so they don't over-require `currentLevelId`.
 */
export interface LevelSceneGetter {
  getLevelScene(levelId: string): SceneModel | null;
}

/** Read access to per-level scenes (subset of the LevelsSystem manager). */
export interface LevelSceneReader extends CurrentLevelRef, LevelSceneGetter {}

/**
 * Read + write access to per-level scenes (subset of the LevelsSystem manager).
 * `setLevelScene` accepts an optional ADR-040 write origin that drives the
 * auto-save gate; consumers that never pass an origin remain compatible.
 */
export interface LevelSceneWriter extends LevelSceneReader {
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}
