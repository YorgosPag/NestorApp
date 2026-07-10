/**
 * ADR-619 — shared «append a freshly-built stair to the active level scene +
 * broadcast `drawing:entity-created`» helper. ΜΙΑ πηγή για το line-based stair tool
 * (`'stair'`) ΚΑΙ το «Σκάλα από περιοχή» (`'stair-from-region'`).
 *
 * Πριν, το body ζούσε inline ΜΟΝΟ στο `useSpecialTools.onStairCreated`· η προσθήκη
 * 2ου καλούντος (region tool) θα δημιουργούσε sibling clone (N.18) — γι' αυτό
 * εξήχθη εδώ ΑΥΤΟΥΣΙΟ (μηδέν αλλαγή συμπεριφοράς για το υπάρχον stair path).
 *
 * Διαφορά από το generic `appendEntityToScene`: η σκάλα ΕΜΠΛΟΥΤΙΖΕΤΑΙ με
 * `floorId`/`buildingId` (ADR-358 Phase 9C — Firestore floor link, required για το
 * Plan B batch update) ΠΡΙΝ το append, και χρησιμοποιεί bare `setLevelScene` + emit
 * (ιστορικό stair path), όχι το undoable `CreateBimEntityCommand`.
 *
 * @see ../scene/append-entity-to-scene.ts — generic (undoable) SSoT
 * @see ../../hooks/tools/useSpecialTools.ts — και οι δύο καλούντες
 * @see docs/centralized-systems/reference/adrs/ADR-619-stair-from-region.md
 */
import type { SceneModel } from '../../types/scene';
import { emitBimEntityCreated } from '../../systems/events/bim-entity-lifecycle-events';
import type { StairEntity } from '../types/stair-types';

/** Minimal level-scene accessor (satisfied by `LevelsHookReturn`). */
export interface StairSceneAccessor {
  readonly currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
}

/** ADR-358 Phase 9C — floor stamp που κολλάει στη σκάλα για το Firestore link. */
export interface StairFloorStamp {
  readonly floorId: string | null;
  readonly buildingId?: string;
}

/**
 * Append `stairEntity` (εμπλουτισμένη με floorId/buildingId) στην ενεργή σκηνή
 * επιπέδου και broadcast `drawing:entity-created` με το δοσμένο `tool` tag. No-op
 * όταν δεν υπάρχει ενεργό επίπεδο / σκηνή.
 */
export function addStairToScene(
  stairEntity: StairEntity,
  accessor: StairSceneAccessor,
  floorStamp: StairFloorStamp,
  tool: string,
): void {
  const enriched = floorStamp.floorId
    ? { ...stairEntity, floorId: floorStamp.floorId, buildingId: floorStamp.buildingId }
    : stairEntity;
  const levelId = accessor.currentLevelId;
  if (!levelId) return;
  const scene = accessor.getLevelScene(levelId);
  if (!scene) return;
  const updatedScene: SceneModel = {
    ...scene,
    entities: [...(scene.entities || []), enriched],
  };
  accessor.setLevelScene(levelId, updatedScene);
  // ADR-358 Phase Q17 9B-6 — broadcast creation so the persistence layer schedules
  // the first Firestore save (χωρίς αυτό η σκάλα μένει local-only μέχρι select+edit).
  emitBimEntityCreated(enriched, tool);
}
