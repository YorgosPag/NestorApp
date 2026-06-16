/**
 * Scene entity-count SSoT (ADR-462 follow-up).
 *
 * ONE place answers "how many entities does this scene contain". Both DXF
 * primitives (line/arc/circle/…) and BIM entities (wall/column/beam/slab/stair/
 * foundation/…) live in the SAME `SceneModel.entities` array — the BIM
 * persistence hooks (`use*Persistence`) merge their Firestore docs back into it
 * via `setLevelScene({ ...scene, entities: [...nonX, ...nextX] })`. So a single
 * `scene.entities.length` already reflects DXF + BIM combined; there is no
 * separate BIM store to add. Centralising the read here removes the duplicate
 * inline counts (level cards + scene manager) and gives one obvious home should
 * the definition ever need to change (e.g. exclude a derived entity kind).
 *
 * Pure (no React/store access) so it can be called from renderers, selectors and
 * memoised hooks alike.
 *
 * @see hooks/scene/useSceneManager.ts — getSceneEntityCount (reactive wrapper)
 * @see ui/components/LevelPanel.tsx — level-card entity count
 */

import type { SceneModel } from '../../types/scene';

/** Total entity count of a scene (DXF + BIM), or 0 for a missing/empty scene. */
export function countSceneEntities(scene: SceneModel | null | undefined): number {
  return scene?.entities?.length ?? 0;
}
