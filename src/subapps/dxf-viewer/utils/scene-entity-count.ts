/**
 * Scene entity-count SSoT (ADR-462 follow-up).
 *
 * ONE place answers "how many entities does this scene contain". Both DXF
 * primitives (line/arc/circle/…) and BIM entities (wall/column/beam/slab/stair/
 * foundation/…) live in the SAME `SceneModel.entities` array — the BIM
 * persistence hooks (`use*Persistence`) merge their Firestore docs back into it
 * via `setLevelScene({ ...scene, entities: [...nonX, ...nextX] })`. So a single
 * `scene.entities.length` already reflects DXF + BIM combined; there is no
 * separate BIM store to add. Centralising the read here removes the scattered
 * inline `.entities.length` count-tallies (level cards, scene manager, AI canvas
 * context, fullscreen badge, clip-command telemetry) and gives one obvious home
 * should the definition ever need to change (e.g. exclude a derived entity kind).
 *
 * SCOPE — this is the "how many entities does the user have" TALLY only. It is
 * NOT for emptiness predicates (`entities.length === 0` / `> 0`) or loop bounds —
 * those express a different intent and stay inline. Lives next to `scene-units.ts`
 * as a pure, layer-neutral util so hooks, UI components AND core commands can all
 * import it without a hooks→core layering smell.
 *
 * Pure (no React/store access) so it can be called from renderers, selectors,
 * memoised hooks and commands alike.
 *
 * @see utils/scene-units.ts — sibling pure SceneModel SSoT
 */

import type { SceneModel } from '../types/scene';

/** Total entity count of a scene (DXF + BIM), or 0 for a missing/empty scene. */
export function countSceneEntities(scene: SceneModel | null | undefined): number {
  return scene?.entities?.length ?? 0;
}

/**
 * Number of layers in a scene, or 0 for a missing/empty scene.
 *
 * ONE place answers "how many layers does this scene contain", ending the
 * scattered inline `Object.keys(scene.layersById ?? {}).length` tally
 * (checksum, sceneStats persistence, security validator, importer, worker).
 * Pure + layer-neutral, sibling to `countSceneEntities`.
 */
export function countSceneLayers(scene: SceneModel | null | undefined): number {
  return Object.keys(scene?.layersById ?? {}).length;
}
