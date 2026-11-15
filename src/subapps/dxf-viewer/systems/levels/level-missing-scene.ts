/**
 * level-missing-scene — τι γίνεται με ένα επίπεδο του οποίου το `sceneFileId` **δεν** έδωσε σκηνή (ADR-913 §2).
 *
 * 🔴 Πριν (2026-11-15, μετρημένο ζωντανά στο `file_2b45ad70`, `.scene.json` με `entities: []`): ο κλάδος «Scene not
 *    found» του `useLevelSceneLoader` έκανε latch **ορφανό** (ADR-469) κάθε αρχείο χωρίς σκηνή. Ένα αρχείο που
 *    απλώς ήταν **άδειο** έκλεινε τον στόχο auto-save για όλη τη συνεδρία ⇒ καμία νέα γραμμή δεν σωζόταν ποτέ, άρα
 *    το αρχείο έμενε άδειο, άρα και στην επόμενη συνεδρία ξανά «ορφανό» — αυτο-διαιωνιζόμενο.
 *
 * ## Η απόφαση (fail-closed)
 * Ο στόχος **ανοίγει** (baseline 0) **μόνο** όταν ΟΛΑ ισχύουν:
 *  1. η αποθήκη είπε `empty` — κάθε βαθμίδα «δεν υπάρχει» ή «ρητά άδεια», **κανένα** σφάλμα/άκυρο (`dxf-scene-storage-load.ts`)
 *  2. το FileRecord υπάρχει, έχει πηγή σκηνής (`fileRecordSceneSource`) και **δεν** είναι αποσυρμένο (`isFileRecordRetired`)
 *  3. το αρχείο ανήκει σε **αυτόν** τον όροφο (`isCrossFloorSceneLink` — ο ίδιος κριτής με τη φόρτωση/εγγραφή)
 * Οτιδήποτε άλλο ⇒ `orphaned` = **ακριβώς** η προηγούμενη συμπεριφορά (ADR-469 latch).
 *
 * Το baseline 0 είναι **αλήθεια του δίσκου**, όχι υπόθεση: γεωμετρία που δεν διαβάστηκε (δίκτυο, κατεστραμμένο JSON)
 * δεν φτάνει ποτέ εδώ ως `empty`, άρα ο `isDxfWipe` (ADR-714) δεν χάνει τίποτα. Ο φρουρός «καμία εγγραφή άδειας
 * σκηνής» μένει: τίποτα δεν γράφεται μέχρι να σχεδιάσει ο χρήστης.
 *
 * @module subapps/dxf-viewer/systems/levels/level-missing-scene
 * @see docs/centralized-systems/reference/adrs/ADR-913-level-drawing-birth.md
 * @see docs/centralized-systems/reference/adrs/ADR-469-cross-floor-per-entity-bim-load.md
 */

import type { DxfSaveContext } from '../../services/dxf-firestore.types';
import type { StorageSceneLoad } from '../../services/dxf-scene-storage-load';
import { isCrossFloorSceneLink } from './cross-floor-link';
import { buildLoadedLevelSaveContext } from './level-loaded-save-context';

/** `'open-empty'` = υπαρκτό, άδειο αρχείο του ορόφου· `'orphaned'` = κλείσε τον στόχο (ADR-469). */
export type MissingSceneDecision = 'open-empty' | 'orphaned';

/** Pure — βλ. τους 3 κανόνες στην κεφαλίδα. */
export function classifyMissingLevelScene(
  load: StorageSceneLoad,
  levelFloorId: string | null | undefined,
): MissingSceneDecision {
  if (load.kind !== 'absent' || load.reason !== 'empty' || !load.file) return 'orphaned';
  const { file } = load;
  if (file.retired || !file.storagePath) return 'orphaned';
  if (isCrossFloorSceneLink(file, levelFloorId)) return 'orphaned';
  return 'open-empty';
}

/** Ό,τι χρειάζεται η εφαρμογή της απόφασης από τον auto-save manager (δομικό υποσύνολό του). */
export interface MissingSceneTargetPort {
  markFileTargetOrphaned?(fileId: string): void;
  setFileRecordId?(id: string | null): void;
  setCurrentFileName?(fileName: string | null): void;
  setSaveContext?(ctx: DxfSaveContext | null): void;
  setPersistedDxfBaseline?(fileId: string, dxfCount: number): void;
}

export interface MissingSceneContext {
  readonly sceneFileId: string;
  readonly levelFloorId: string | null | undefined;
  /** Το `sceneFileName` του επιπέδου — εφεδρεία όταν το FileRecord δεν δίνει όνομα. */
  readonly levelFileName: string | null | undefined;
  /** Κλείνει τον στόχο auto-save (ADR-399 reset του loader). */
  readonly resetTarget: () => void;
  /** Άδεια σκηνή με διατήρηση του BIM στη μνήμη (anti-vanish, FIX Α). */
  readonly setEmptyScene: () => void;
  /** Το επίπεδο φορτώθηκε (one-shot) — καμία επαναφόρτωση σε κάθε `levels` snapshot. */
  readonly markLevelLoaded: () => void;
}

/** Εφαρμόζει την απόφαση. Επιστρέφει ό,τι αποφασίστηκε (για log/tests). */
export function settleMissingLevelScene(
  load: StorageSceneLoad,
  port: MissingSceneTargetPort,
  ctx: MissingSceneContext,
): MissingSceneDecision {
  const decision = classifyMissingLevelScene(load, ctx.levelFloorId);
  if (decision === 'orphaned' || load.kind !== 'absent' || !load.file) {
    const reason = load.kind === 'absent' ? load.reason : 'unexpected-shape';
    console.warn(
      `[LevelsSystem] Scene not found for fileId: ${ctx.sceneFileId} (${reason}) — latching orphaned target + suppressing DXF auto-save.`,
    );
    port.markFileTargetOrphaned?.(ctx.sceneFileId);
    ctx.resetTarget();
    ctx.setEmptyScene();
    return 'orphaned';
  }
  // Υπαρκτό, άδειο αρχείο του ορόφου: ο στόχος μένει ΑΝΟΙΧΤΟΣ πάνω στο ΙΔΙΟ αρχείο (ADR-293 — καμία αναζήτηση).
  const { file } = load;
  ctx.setEmptyScene();
  port.setPersistedDxfBaseline?.(ctx.sceneFileId, 0);
  port.setCurrentFileName?.(file.fileName || ctx.levelFileName || null);
  port.setFileRecordId?.(ctx.sceneFileId);
  const loadedContext = buildLoadedLevelSaveContext(file, ctx.sceneFileId);
  if (loadedContext) port.setSaveContext?.(loadedContext);
  ctx.markLevelLoaded();
  return 'open-empty';
}
