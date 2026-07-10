/**
 * ADR-619 / ADR-632 Φ5 — thin stair wrapper over the `appendEntityToScene`
 * SSoT, so the line-based stair tool (`'stair'`) and «Σκάλα από περιοχή»
 * (`'stair-from-region'`) share ONE **undoable** insertion routine.
 *
 * Διαφορά από το generic `appendEntityToScene`: η σκάλα ΕΜΠΛΟΥΤΙΖΕΤΑΙ με
 * `floorId`/`buildingId` (ADR-358 Phase 9C — Firestore floor link, required για το
 * Plan B batch update) ΠΡΙΝ το append. Αυτή είναι η ΜΟΝΗ stair-specific λογική· ό,τι
 * ακολουθεί (undoable `CreateBimEntityCommand`, create-time associative reconcile,
 * `drawing:entity-created` broadcast) ζει ΜΙΑ φορά στο generic SSoT (N.0.2 — κανένα
 * copy-paste του persistence trigger, κανένα τρίτο stair-append path).
 *
 * ADR-632 Φ5 (2026-07-11) — UNDOABLE stair create. Πριν, αυτό το path έκανε raw
 * `setLevelScene` + sync emit + χειροκίνητο `reconcileAssociativeGeometryOnCreate`
 * (ιστορικό ADR-619 μη-undoable path), οπότε μια νεο-σχεδιασμένη σκάλα ΔΕΝ έμπαινε
 * σε undo stack — ασύμμετρο με το slab path. Πλέον περνά από `appendEntityToScene`
 * → `CreateBimEntityCommand`: Ctrl+Z αναιρεί τη σκάλα **και** (μέσω του command's
 * undo → cascade) το auto stairwell «well» opening της· redo τα ξαναφτιάχνει
 * (Revit-grade: κάθε create = ένα undoable transaction). Το `emitBimEntityCreated`
 * (τώρα deferred μέσα στο command) + το create-time reconcile έρχονται ΑΠΟΚΛΕΙΣΤΙΚΑ
 * από το command — καμία χειροκίνητη κλήση εδώ (μηδέν διπλός cascade).
 *
 * Η σκάλα ΔΕΝ ανήκει στο `STRUCTURAL_OVERLAP_TYPES` (ADR-567 · wall/column/beam/
 * slab/foundation), άρα ο overlap guard του generic κάνει no-op — σκάλα κάτω από
 * πλάκα by design δεν μπλοκάρεται.
 *
 * @see ../scene/append-entity-to-scene.ts — generic (undoable) SSoT
 * @see ../columns/add-column-to-scene.ts — ίδιο thin-wrapper μοτίβο
 * @see ../../hooks/tools/useSpecialTools.ts — και οι δύο callers
 * @see docs/centralized-systems/reference/adrs/ADR-619-stair-from-region.md
 * @see docs/centralized-systems/reference/adrs/ADR-632-stairwell-auto-opening-ssot.md §5
 */
import { appendEntityToScene, type SceneAppendAccessor } from '../scene/append-entity-to-scene';
import type { StairEntity } from '../types/stair-types';

/** @deprecated χρησιμοποίησε `SceneAppendAccessor` — alias για υπάρχοντα imports. */
export type StairSceneAccessor = SceneAppendAccessor;

/** ADR-358 Phase 9C — floor stamp που κολλάει στη σκάλα για το Firestore link. */
export interface StairFloorStamp {
  readonly floorId: string | null;
  readonly buildingId?: string;
}

/**
 * Append `stairEntity` (εμπλουτισμένη με floorId/buildingId) στην ενεργή σκηνή
 * επιπέδου ως **undoable** create (`CreateBimEntityCommand`) και broadcast
 * `drawing:entity-created` με το δοσμένο `tool` tag. No-op όταν δεν υπάρχει ενεργό
 * επίπεδο / σκηνή (ο generic guard).
 */
export function addStairToScene(
  stairEntity: StairEntity,
  accessor: SceneAppendAccessor,
  floorStamp: StairFloorStamp,
  tool: string,
): void {
  const enriched = floorStamp.floorId
    ? { ...stairEntity, floorId: floorStamp.floorId, buildingId: floorStamp.buildingId }
    : stairEntity;
  appendEntityToScene(accessor, enriched, tool);
}
