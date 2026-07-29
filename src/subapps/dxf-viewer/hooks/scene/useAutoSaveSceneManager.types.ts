import type { SceneManagerState } from './useSceneManager';
import type { SceneSaveBlockReason } from './execute-scene-save';
import type { SceneSaveTicket } from './scene-save-ticket';
import type { DxfSaveContext } from '../../services/dxf-firestore.service';

/**
 * Public contract of {@link import('./useAutoSaveSceneManager').useAutoSaveSceneManager}.
 *
 * Extracted from the hook file (N.7.1 file-size limit) following the existing
 * `*.types.ts` convention (cf. `systems/levels/LevelsSystem.types.ts`). Pure type
 * surface — no logic lives here.
 */
export interface AutoSaveSceneManagerState extends SceneManagerState {
  currentFileName: string | null;
  setCurrentFileName: (fileName: string | null) => void;
  autoSaveEnabled: boolean;
  setAutoSaveEnabled: (enabled: boolean) => void;
  lastSaveTime: Date | null;
  saveStatus: 'idle' | 'saving' | 'success' | 'error';
  /** 🏢 ENTERPRISE: Inject existing FileRecord ID so cadFiles uses the same ID */
  setFileRecordId: (id: string | null) => void;
  /**
   * 🛡️ ADR-714 — δηλώνει σε ποιον όροφο ανήκει ένα επίπεδο.
   *
   * Ο `useLevelSceneLoader` το καλεί σε κάθε αλλαγή επιπέδου. Το auto-save το διαβάζει
   * **μόνο τη στιγμή του scheduling**, για να παγώσει τον `floorId` μέσα στο
   * {@link SceneSaveTicket}. Κρατιέται ως map (levelId → floorId) και όχι ως σκέτο
   * «τρέχον», ώστε η αντιστοίχιση να μην εξαρτάται από το πότε έτρεξε τελευταία ο loader.
   */
  setLevelFloorScope: (levelId: string, floorId: string | null) => void;
  /**
   * 🛡️ ADR-714 — καταγράφει πόσες DXF οντότητες έχει ΗΔΗ ο αποθηκευμένος προορισμός.
   *
   * Ο `useLevelSceneLoader` το καλεί μετά από κάθε επιτυχή φόρτωση. Είναι το baseline
   * του φρουρού `isDxfWipe`: χωρίς αυτό, ο φρουρός δεν ξέρει τι θα χαθεί.
   */
  setPersistedDxfBaseline: (fileId: string, dxfCount: number) => void;
  /**
   * 🛡️ ADR-714 — ειδοποίηση ότι μια εγγραφή ματαιώθηκε από φρουρό δεδομένων.
   * Ο `useLevelSceneLoader` το συνδέει με το i18n toast.
   */
  setOnSaveBlocked: (cb: ((reason: SceneSaveBlockReason) => void) | null) => void;
  /**
   * 🪜 ADR-358 Phase 8: reactive mirror of the injected FileRecord id so
   * downstream consumers (e.g. `useStairPersistence` via `StairAdvancedPanelHost`)
   * can subscribe to it as state. The setter still updates the internal ref
   * synchronously for auto-save reads.
   */
  fileRecordId: string | null;
  /** 🏢 ADR-240: Inject save context (entityType/floorId/purpose) from Wizard import */
  setSaveContext: (ctx: DxfSaveContext | null) => void;
  /**
   * 🪜 ADR-358 Phase 8: reactive mirror of the injected save context so
   * `projectId` (and any other context field) propagates to React subtrees
   * needing tenant/project scope (Phase 8 stair persistence).
   */
  saveContext: DxfSaveContext | null;
  /**
   * 🏢 ENTERPRISE: Callback after successful scene save — used by LevelsSystem to link scene→level.
   *
   * 🛡️ ADR-714 — παίρνει το ΠΑΓΩΜΕΝΟ ticket, όχι σκέτο `fileId`. Πριν, ο δέκτης
   * linkάριζε το «τρέχον» επίπεδο· αν ο χρήστης άλλαζε όροφο όσο έτρεχε το debounced
   * save, το save του ορόφου Α linkάριζε τον όροφο Β στο αρχείο του Α. Το
   * `ticket.levelId` λέει ποιος ΓΕΝΝΗΣΕ την εγγραφή — και αυτός είναι που linkάρεται.
   */
  setOnSceneSaved: (cb: ((ticket: SceneSaveTicket, fileId: string) => void) | null) => void;
  /** 🏢 ENTERPRISE: Set loading guard to prevent auto-save during scene load from Storage */
  setIsLoadingFromFirestore: (loading: boolean) => void;
  /**
   * 🛡️ ADR-469 v1.2 — SSoT orphaned-target latch (writer). Marks a `fileId` whose
   * backing `files`/`cadFiles` doc is gone (orphaned / file-less floor) so DXF scene
   * auto-save is permanently suppressed for it this session. The DXF floorplan blob
   * no longer exists to overwrite; the floor's BIM persists independently via its
   * floorId-keyed per-entity collections (ADR-420/469). Prevents the ADR-293
   * `canonicalScenePath is required` throw on every local edit of such a floor.
   */
  markFileTargetOrphaned: (fileId: string) => void;
  /** 🛡️ ADR-469 v1.2 — orphaned-target latch (reader). See `markFileTargetOrphaned`. */
  isFileTargetOrphaned: (fileId: string | null | undefined) => boolean;
  /**
   * 🏢 ADR-354 Phase B Part 1: full session reset for super admin company switch.
   * Cancels pending debounced auto-save, clears scenes + saveContext + fileRecordId +
   * currentFileName + per-file caches, and engages the loading guard so any subsequent
   * setLevelScene (triggered by the new tenant's level bootstrap) does NOT auto-save the
   * empty scene over the previous tenant's file. The guard is released on the next
   * animation frame so the next genuine scene load from useLevelSceneLoader proceeds.
   */
  resetSceneSession: () => void;
}

/** ADR-726 §13.1 — options for `useAutoSaveSceneManager`. */
export interface AutoSaveSceneManagerOptions {
  /**
   * `false` ⇒ **καμία** εγγραφή προγραμματίζεται ποτέ, ό,τι κι αν κάνει ο χρήστης με
   * τον διακόπτη «Αυτόματη αποθήκευση» (`AutoSaveStatus`). Σκληρή πύλη, όχι απλώς
   * αρχική τιμή: ένας viewer που του δηλώθηκε «χωρίς μονιμότητα» δεν πρέπει να μπορεί
   * να πέσει σε δίκτυο κατά λάθος.
   *
   * Μοναδικός καταναλωτής σήμερα: `LevelsSystem` → `DxfViewerApp enablePersistence`,
   * για τον harness μέτρησης καρέ (hermeticity — μηδέν backend στον βρόχο μέτρησης).
   * Default `true` ⇒ η παραγωγή μένει ακριβώς όπως ήταν.
   */
  enabled?: boolean;
}
