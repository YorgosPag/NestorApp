/**
 * cross-floor-link — pure guard for the level↔scene isolation invariant (ADR-399).
 *
 * A DXF `Level` may only load a scene file that belongs to its OWN floor. A stale
 * or mis-linked `sceneFileId` (root cause: the auto-save `fileRecordId` was sticky
 * across level switches, so drawing on one floor re-linked the previous floor's
 * file) would otherwise load another floor's DXF into this level — making every
 * floor render the same scene — and a later auto-save would overwrite that other
 * floor's file. `useLevelSceneLoader` calls this to skip such cross-floor loads.
 *
 * Pure + dependency-free so it unit-tests standalone.
 *
 * @module subapps/dxf-viewer/systems/levels/cross-floor-link
 * @see docs/centralized-systems/reference/adrs/ADR-399-dxf-floor-navigation-tabs.md
 */

import type { SceneModel } from '../../types/scene';

/** Minimal structural view of a loaded FileRecord needed for the floor check. */
export interface FloorScopedFileRecord {
  readonly entityType?: string;
  readonly entityId?: string;
  /** The persisted scene snapshot (present on loaded `DxfFileRecord`s). */
  readonly scene?: SceneModel;
}

/**
 * True when `fileRecord` is floor-scoped and belongs to a DIFFERENT floor than the
 * level it is about to be loaded into.
 *
 * Conservative by design — returns `false` (i.e. allow the load) unless ALL hold:
 *  - the file is floor-scoped (`entityType === 'floor'`),
 *  - the level has a known `floorId`,
 *  - the file carries an `entityId`,
 *  - and the two floor ids differ.
 *
 * So legacy file-less levels, project/building-scoped scenes, and correctly-linked
 * floors are never affected.
 */
export function isCrossFloorSceneLink(
  fileRecord: FloorScopedFileRecord | null | undefined,
  levelFloorId: string | null | undefined,
): boolean {
  return (
    fileRecord?.entityType === 'floor' &&
    !!levelFloorId &&
    !!fileRecord.entityId &&
    fileRecord.entityId !== levelFloorId
  );
}

/**
 * SSoT για όλους τους all-floors aggregators (3Δ `useFloors3DAggregator`, 2Δ
 * `useBuildingFloorScenes`, cross-level `useFoundationLevelSync`): επιστρέφει το
 * scene snapshot ενός φορτωμένου `fileRecord` **μόνο** όταν είναι έγκυρο ΚΑΙ ανήκει
 * στον ίδιο τον όροφο που το ζητάει — αλλιώς `null`.
 *
 * Belt-and-suspenders πάνω από το per-entity `stripForeignFloorBim`: ο τελευταίος
 * κρατά τα untagged (χωρίς `floorId`) entities, οπότε ένα **legacy shared**
 * `sceneFileId` (δύο όροφοι δείχνουν στο ίδιο αρχείο, ADR-399 sticky-fileId) θα
 * διέρρεε ολόκληρη τη σκηνή του άλλου ορόφου. Αυτός ο file-level guard τη μπλοκάρει
 * **πριν** το aggregate. Οι aggregators τότε πέφτουν στο ADR-469 per-entity fallback
 * (own-floor entities από τα `floorplan_*`). Pure + dependency-free.
 *
 * @param fileRecord   Το `DxfFileRecord` όπως φορτώθηκε από `loadFileV2` (ή null).
 * @param levelFloorId Το `Floor.id` του ορόφου που ζητάει το scene.
 */
export function resolveFloorScopedScene(
  fileRecord: FloorScopedFileRecord | null | undefined,
  levelFloorId: string | null | undefined,
): SceneModel | null {
  const scene = fileRecord?.scene;
  if (!scene || !Array.isArray(scene.entities)) return null;
  if (isCrossFloorSceneLink(fileRecord, levelFloorId)) return null;
  return scene;
}
