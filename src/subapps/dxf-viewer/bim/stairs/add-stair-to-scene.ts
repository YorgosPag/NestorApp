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
 * ADR-632 Φ4.1 (2026-07-11) — μετά το append, τρέχει `reconcileAssociativeGeometryOnCreate`
 * (creation-time associative reconcile): μια νέα σκάλα κάτω από υπάρχουσα πλάκα ανοίγει
 * ΑΜΕΣΩΣ το auto stairwell «well» opening (mirror του `CreateBimEntityCommand` για το
 * undoable slab path). Επειδή αυτό το path είναι raw-`setLevelScene` (μη-undoable), το
 * opening δεν μπαίνει σε undo stack — συνεπές με τη μη-undoable σκάλα (Φ5: migrate σε command).
 *
 * @see ../scene/append-entity-to-scene.ts — generic (undoable) SSoT
 * @see ../cascade/associative-geometry-reconcile.ts — create-time reconcile SSoT (ADR-632 Φ4.1)
 * @see ../../hooks/tools/useSpecialTools.ts — και οι δύο καλούντες
 * @see docs/centralized-systems/reference/adrs/ADR-619-stair-from-region.md
 */
import type { SceneModel } from '../../types/scene';
import type { Entity } from '../../types/entities';
import { emitBimEntityCreated } from '../../systems/events/bim-entity-lifecycle-events';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { reconcileAssociativeGeometryOnCreate } from '../cascade/associative-geometry-reconcile';
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
  // ADR-632 Φ4.1 — create-time trigger: αν η νέα σκάλα «καπακώνεται» από υπάρχουσα
  // πλάκα κάτω από το ελεύθερο ύψος → άνοιξε αμέσως το auto «well» opening. Ο cascade
  // διαβάζει την τρέχουσα σκηνή μέσω του cached adapter (ADR-527) — idempotent, zero-loop.
  const adapter = createLevelSceneManagerAdapter(accessor.getLevelScene, accessor.setLevelScene, levelId);
  reconcileAssociativeGeometryOnCreate(enriched as unknown as Entity, adapter);
}
