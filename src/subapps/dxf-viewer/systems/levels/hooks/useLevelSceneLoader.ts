'use client';
import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n';
import { DxfFirestoreService } from '../../../services/dxf-firestore.service';
import { useAutoSaveSceneManager } from '../../../hooks/scene/useAutoSaveSceneManager';
import { countDxfEntities, type SceneSaveTicket } from '../../../hooks/scene/scene-save-ticket';
import type { SceneSaveBlockReason } from '../../../hooks/scene/execute-scene-save';
import { onSuperAdminActiveCompanyChange } from '@/services/firestore/super-admin-active-company';
import { isCrossFloorSceneLink } from '../cross-floor-link';
import { isCadLinkableEntityType } from '@/config/domain-constants';
import {
  reconcileLoadedSceneBim,
  reconcileLoadedSceneBimPreserving,
  ensureUniqueEntityIds,
} from '../scene-bim-load-policy';
import {
  detectMissingPerEntityDocIds,
  emitBackfillFirstSaves,
} from '../backfill-missing-per-entity-docs';
import type { Level } from '../config';

// 🔺 FIXED: Helper για ΠΡΑΓΜΑΤΙΚΑ κενή σκηνή χωρίς default layer
const createEmptyScene = () => ({
  entities: [],
  layersById: {},
  bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
  units: 'mm' as const,
});

type SceneManager = ReturnType<typeof useAutoSaveSceneManager>;

interface UseLevelSceneLoaderParams {
  currentLevelId: string | null;
  levels: Level[];
  sceneManager: SceneManager;
  enableFirestore: boolean;
  firestoreCollection: string;
}

interface UseLevelSceneLoaderResult {
  sceneLoading: boolean;
  linkSceneToLevel: (levelId: string, fileId: string, fileName: string) => Promise<void>;
}

/**
 * 🏢 ENTERPRISE: Scene auto-load + persistence for level switches (CAD-industry standard)
 *
 * Responsibilities:
 *  - On currentLevelId change: load the persisted DXF scene from Firestore/Storage
 *    (or create an empty scene if the level has no DXF yet).
 *  - Race-condition safe: cancels pending loads when the user switches levels rapidly
 *    (AbortController pattern).
 *  - Persist level→DXF association in Firestore when auto-save completes (linkSceneToLevel).
 *  - Wires the `onSceneSaved` callback from the scene manager so that newly saved
 *    scenes are auto-linked to their parent level.
 *
 * This replaces the old "create empty scene" approach with persistent scene loading.
 */
export function useLevelSceneLoader({
  currentLevelId,
  levels,
  sceneManager,
  enableFirestore,
  firestoreCollection,
}: UseLevelSceneLoaderParams): UseLevelSceneLoaderResult {
  const [sceneLoading, setSceneLoading] = useState(false);
  const { t } = useTranslation('dxf-viewer');

  // 🏢 ENTERPRISE: AbortController ref for cancelling pending scene loads on rapid level switch
  const sceneLoadAbortRef = React.useRef<AbortController | null>(null);
  // Track which levels have had their scenes loaded to prevent duplicate loads
  const loadedSceneLevelsRef = React.useRef<Set<string>>(new Set());

  /**
   * 🛡️ ADR-714 — σπάει έναν λάθος (cross-floor) σύνδεσμο επιπέδου→αρχείου.
   *
   * Καλείται ΜΟΝΟ αφού το `isCrossFloorSceneLink` έχει ήδη αποφανθεί ότι το αρχείο
   * ανήκει σε άλλον όροφο. Γράφει `sceneFileId: null` ώστε το επίπεδο να επανέλθει στην
   * καθαρή κατάσταση «δεν έχει κάτοψη» και ο χρήστης να μπορεί να εισάγει ξανά το DXF.
   * Δεν αγγίζει κανένα Storage blob — μόνο τον σύνδεσμο.
   */
  const unlinkCrossFloorScene = useCallback(
    async (levelId: string, levelName: string | undefined): Promise<void> => {
      if (!enableFirestore) return;
      try {
        const res = await fetch('/api/dxf-levels', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ levelId, sceneFileId: null, sceneFileName: null }),
        });
        if (!res.ok) {
          console.error('[LevelsSystem] Failed to unlink cross-floor scene:', res.status, res.statusText);
          return;
        }
        toast.warning(t('scene.crossFloorLinkCleared', { floor: levelName ?? levelId }));
      } catch (err) {
        console.error('[LevelsSystem] Failed to unlink cross-floor scene:', err);
      }
    },
    [enableFirestore, t],
  );

  // 🏢 ENTERPRISE: Auto-load DXF scene from Storage when level changes (CAD-industry standard)
  // This replaces the old "create empty scene" approach with persistent scene loading
  useEffect(() => {
    if (!currentLevelId) return;

    // Find the level to check for sceneFileId
    const level = levels.find(l => l.id === currentLevelId);
    const sceneFileId = level?.sceneFileId;

    // ADR-399 — reset the DXF auto-save target so edits on THIS level can never
    // persist into a PREVIOUSLY-loaded level's file. Root cause of cross-floor
    // contamination: the auto-save `fileRecordId` / `currentFileName` were sticky
    // across level switches, so drawing on a file-less (or wrongly-linked) floor
    // saved into — and re-linked — the previous floor's DXF file, making every
    // floor render the same scene. Nulling `currentFileName` also disables the
    // auto-save gate (it requires a filename), so a file-less level never writes a
    // DXF scene. BIM entities keep persisting through their own floorId-keyed
    // persistence, unaffected.
    const resetDxfAutoSaveTarget = () => {
      sceneManager.setFileRecordId?.(null);
      sceneManager.setSaveContext?.(null);
      sceneManager.setCurrentFileName?.(null);
    };

    // 🛡️ FIX (Α) — anti-vanish BIM load (incident 2026-06-17 «η κολώνα εμφανίζεται
    // και εξαφανίζεται»). Every load-time "empty scene" write MUST go through the
    // BIM-preservation SSoT (`reconcileLoadedSceneBim`), never a bare
    // `createEmptyScene()`. Otherwise a late, async "scene not found" / orphaned-file
    // result clobbers BIM that a per-entity subscription (`useXPersistence`, keyed by
    // floorId) already merged into the in-memory scene — the columns flash, then the
    // empty write wipes them. The reconcile keeps the loaded scene's DXF-only entities
    // (here: none) + the existing in-memory BIM. No-op when nothing is in memory yet.
    const setEmptyScenePreservingBim = () => {
      sceneManager.setLevelScene(
        currentLevelId,
        reconcileLoadedSceneBim(createEmptyScene(), sceneManager.getLevelScene(currentLevelId)),
        'load',
      );
    };

    // 🛡️ ROOT-CAUSE FIX (incident 2026-06-08 — repeated cross-floor data loss):
    // Re-point the auto-save target at the CURRENT level's file on EVERY level change,
    // BEFORE the fast-path / already-loaded early-returns below. Previously the target
    // (`fileRecordId` / `currentFileName`) was set ONLY inside the fresh-load path, so
    // switching to an already-in-memory level left the target STUCK on the PREVIOUS
    // level's file → subsequent edits auto-saved into the wrong floor's DXF, and that
    // floor's level got re-linked to it (two levels ending up sharing one sceneFileId —
    // observed on this project: revision climbing while the scene blob went empty).
    // The fast path fires only for same-floor levels that loaded with entities;
    // cross-floor / empty levels fall through to the full load path where
    // `isCrossFloorSceneLink` still guards. File-less levels clear the target so they
    // never write a DXF scene (BIM persists independently via floorId).
    // 🛡️ ADR-469 v1.2 — orphaned-target latch (SSoT in useAutoSaveSceneManager).
    // Once a previous load discovered this `sceneFileId` is orphaned (its files/cadFiles
    // doc is gone), it is latched. EVERY subsequent re-run of this effect (fires on each
    // `levels` onSnapshot) must then treat the level as file-less: it must NOT re-open the
    // DXF auto-save target — otherwise a local edit would schedule a save that throws
    // ADR-293 (`canonicalScenePath is required`). The throw's root cause was exactly this:
    // the sync set below re-pointed the target after the async reset had cleared it.
    const isOrphaned = !!sceneFileId && (sceneManager.isFileTargetOrphaned?.(sceneFileId) ?? false);

    // 🛡️ ADR-714 — δήλωσε σε ποιον όροφο ανήκει αυτό το επίπεδο ΠΡΙΝ από οποιοδήποτε
    // save μπορεί να προγραμματιστεί. Το auto-save παγώνει αυτόν τον `floorId` μέσα στο
    // ticket του, ώστε η επίλυση του αρχείου-προορισμού να είναι floor-scoped και ο
    // φρουρός cross-floor να έχει με τι να συγκρίνει.
    sceneManager.setLevelFloorScope?.(currentLevelId, level?.floorId ?? null);

    if (sceneFileId && !isOrphaned) {
      sceneManager.setFileRecordId?.(sceneFileId);
      sceneManager.setCurrentFileName?.(level?.sceneFileName ?? null);
    } else {
      resetDxfAutoSaveTarget();
    }

    // Check if scene is already in memory (fast path — instant render). The auto-save
    // target was already re-pointed above, so this early return no longer leaks the
    // previous level's save target.
    //
    // 🛡️ ADR-714 — ΣΩΣΤΗ ΕΡΩΤΗΣΗ: «έχει DXF;», ΟΧΙ «έχει κάτι;».
    //
    // Η in-memory σκηνή ενός ορόφου μπορεί κάλλιστα να είναι **μόνο-BIM**: το
    // `reconcileLoadedSceneBim` πετά το BIM του snapshot ως παράγωγο cache και τα per-entity
    // Firestore subscriptions (floorId-keyed) το ξαναγεμίζουν ΑΣΥΓΧΡΟΝΑ. Αν αυτά προλάβουν το
    // load, το παλιό `entities.length > 0` έβλεπε «γεμάτη σκηνή» → early return → **το DXF δεν
    // κατέβαινε ΠΟΤΕ από το Storage**. Μετά, το auto-save έγραφε αυτή τη μόνο-BIM σκηνή πάνω
    // από το αρχείο: ακριβώς η εγγραφή που μηδενίζει τη γεωμετρία και την οποία μπλοκάρει ο
    // `isDxfWipe`. Ο φρουρός ήταν το ΣΥΜΠΤΩΜΑ — εδώ ήταν η αιτία.
    //
    // Ίδιο μοτίβο με το ADR-469 («έχει κάτι;» → «έχει BIM;»), κατοπτρικά. Ίδιο SSoT με τον
    // φρουρό (`countDxfEntities`) — αν αλλάξει ο ορισμός του «DXF», load και guard κινούνται
    // μαζί· δύο ορισμοί θα ξανάνοιγαν το ίδιο κενό.
    //
    // Δεν δημιουργεί re-fetch loop: το `loadedSceneLevelsRef` παρακάτω κρατά την προσπάθεια
    // one-shot ακόμη κι όταν το αρχείο όντως δεν έχει DXF οντότητες.
    const existingScene = sceneManager.getLevelScene(currentLevelId);
    if (existingScene && countDxfEntities(existingScene) > 0) return;

    if (!sceneFileId || isOrphaned) {
      // No DXF linked (or a known-orphaned/file-less floor) — create empty scene (target
      // already reset above). Short-circuiting on `isOrphaned` avoids a wasteful repeat
      // loadFileV2 fetch on every `levels` snapshot for a floor we already know has no
      // backing file. BIM persists independently via floorId-keyed per-entity collections.
      if (!existingScene) {
        setEmptyScenePreservingBim();
      }
      return;
    }

    // Prevent duplicate loads for the same level
    if (loadedSceneLevelsRef.current.has(currentLevelId)) {
      if (!existingScene) {
        setEmptyScenePreservingBim();
      }
      return;
    }

    // Cancel any pending load from previous level switch
    sceneLoadAbortRef.current?.abort();
    const abortController = new AbortController();
    sceneLoadAbortRef.current = abortController;

    const loadScene = async () => {
      setSceneLoading(true);
      // Set loading guard to prevent auto-save from firing during scene load
      sceneManager.setIsLoadingFromFirestore(true);

      try {
        const fileRecord = await DxfFirestoreService.loadFileV2(sceneFileId);

        // Check if this load was cancelled (user switched to another level)
        if (abortController.signal.aborted) return;

        // 🚨 ADR-399 — cross-floor link guard. A level must only load a scene file
        // that belongs to its OWN floor. A stale / cross-linked `sceneFileId` (left
        // by the sticky auto-save target bug above, or a mis-link) would otherwise
        // load another floor's DXF into this level — making every floor render the
        // same scene — and a subsequent auto-save would overwrite that other floor's
        // file. Detect the mismatch, keep this level empty, and reset the save
        // target. See `isCrossFloorSceneLink` for the conservative predicate.
        if (isCrossFloorSceneLink(fileRecord, level?.floorId)) {
          console.warn(
            `[LevelsSystem] sceneFileId ${sceneFileId} belongs to floor ${fileRecord?.entityId} ` +
            `but level ${currentLevelId} is floor ${level?.floorId} — skipping cross-floor load.`,
          );
          resetDxfAutoSaveTarget();
          setEmptyScenePreservingBim();
          // 🛡️ ADR-714 — ΘΕΡΑΠΕΙΑ, όχι απλή αποφυγή. Μέχρι τώρα ο guard άφηνε τη λάθος
          // εγγραφή στη βάση, οπότε ο όροφος έμενε μόνιμα «άδειος με προειδοποίηση» και
          // κάθε επόμενη συνεδρία ξαναέτρεχε το ίδιο αποτυχημένο load. Σπάμε τον λάθος
          // σύνδεσμο ώστε το επίπεδο να επανέλθει σε καθαρή κατάσταση «χωρίς κάτοψη».
          // ΚΑΜΙΑ σκηνή δεν διαγράφεται — μόνο ο σύνδεσμος. Το BIM του ορόφου επιβιώνει
          // μέσω των floorId-keyed per-entity collections.
          void unlinkCrossFloorScene(currentLevelId, level?.name);
          return;
        }

        if (fileRecord?.scene && Array.isArray(fileRecord.scene.entities) && fileRecord.scene.layersById != null) {
          // 🏢 ADR-390 Phase 4 — active-floor SSoT load. The `.scene.json` snapshot is
          // a DERIVED cache (scene-write-origin.ts); its embedded BIM entities can be
          // STALE vs the authoritative per-entity Firestore docs (e.g. a column saved
          // `attached` in the snapshot while its `floorplan_columns` doc is reverted to
          // `storey-ceiling` → snapshot rendered a sloped top). Drop the snapshot BIM;
          // the per-entity subscriptions (useXPersistence) repopulate it from the DB
          // (SSoT). Preserve any BIM already merged in-memory (a subscription that
          // raced ahead of the load) so it is never clobbered/lost. The snapshot is
          // unchanged on save → multi-floor 3D (ADR-399) keeps reading other floors'
          // BIM from their snapshots.
          // 🛡️ ADR-635 Φ C.18 — server-wizard import (Door B) never first-saves its
          // per-entity entities (hatches), so on reload reconcile would drop them with
          // no doc to repopulate (117 hatches vanished, incident 2026-07-20). Detect the
          // no-doc ids up-front (read-only batch existence check), KEEP those visible via
          // the preserving reconcile, and emit their first-save below. Entities that DO
          // have docs stay out of `missing` → dropped as usual → refilled from the SSoT.
          const missingDocIds = await detectMissingPerEntityDocIds(fileRecord.scene);
          if (abortController.signal.aborted) return;
          // ADR-578 — heal legacy duplicate entity ids (Revit «Audit»-on-open)
          // before applying. Same-reference no-op for clean scenes.
          const reconciled = ensureUniqueEntityIds(
            reconcileLoadedSceneBimPreserving(
              fileRecord.scene,
              sceneManager.getLevelScene(currentLevelId),
              missingDocIds,
            ),
          );
          sceneManager.setLevelScene(currentLevelId, reconciled, 'load');
          // 🛡️ ADR-714 — κατέγραψε πόση DXF γεωμετρία ΕΧΕΙ ΗΔΗ ο προορισμός. Χωρίς αυτό
          // ο φρουρός `isDxfWipe` δεν έχει με τι να συγκρίνει και μια εγγραφή που
          // μηδενίζει τη γεωμετρία περνά αθόρυβα. Μετράμε το ΦΟΡΤΩΜΕΝΟ snapshot, όχι το
          // `reconciled` — το τελευταίο έχει ήδη αφαιρέσει BIM (δεν αλλάζει τους DXF
          // αριθμούς, αλλά το snapshot είναι η αλήθεια του δίσκου).
          sceneManager.setPersistedDxfBaseline?.(sceneFileId, countDxfEntities(fileRecord.scene));
          // 🛡️ ADR-635 Φ C.18 — first-save the no-doc entities with an EXPLICIT target
          // scope (Φ C.16), so the write lands on THIS floor independently of the
          // persistence host's render timing. `isCrossFloorSceneLink` (above) already
          // guaranteed `fileRecord` belongs to `level.floorId`, so the scope is trusted.
          emitBackfillFirstSaves(fileRecord.scene, missingDocIds, {
            levelId: currentLevelId,
            floorId: level?.floorId ?? (fileRecord.entityType === 'floor' ? fileRecord.entityId : null),
            floorplanId: sceneFileId,
          });
          // Set the filename for auto-save context
          if (fileRecord.fileName && sceneManager.setCurrentFileName) {
            sceneManager.setCurrentFileName(fileRecord.fileName);
          }
          // 🏢 ADR-293: Inject FileRecord ID + canonicalScenePath so auto-save
          // writes to the SAME storage path as the loaded scene (no lookup,
          // no race, no "canonicalScenePath is required" throw on line completion).
          sceneManager.setFileRecordId?.(sceneFileId);
          // ADR-358 Phase 9 — restore the FULL save context (not just the
          // canonical scene path) so the floor link bridge surfaces the
          // floor metadata on session resume + the stair builder seeds
          // `multiStoryConfig` from the bound floor. Without this the
          // resume path overwrote the Wizard-injected context with a
          // path-only object and `saveContext.floorId` flipped to
          // `undefined` immediately after the import.
          if (fileRecord.storagePath || fileRecord.entityType) {
            sceneManager.setSaveContext?.({
              ...(fileRecord.storagePath
                ? { canonicalScenePath: DxfFirestoreService.deriveScenePath(fileRecord.storagePath) }
                : {}),
              ...(fileRecord.companyId ? { companyId: fileRecord.companyId } : {}),
              ...(fileRecord.projectId ? { projectId: fileRecord.projectId } : {}),
              // Fail-closed: a historical FileRecord may carry an entityType the CAD
              // pipeline cannot link (e.g. 'unit'). Dropping the key beats casting it
              // into the save context, where it would 400 the next save.
              ...(isCadLinkableEntityType(fileRecord.entityType)
                ? { entityType: fileRecord.entityType }
                : {}),
              ...(fileRecord.entityType === 'floor' && fileRecord.entityId
                ? { floorId: fileRecord.entityId }
                : {}),
              ...(fileRecord.entityType === 'building' && fileRecord.entityId
                ? { buildingId: fileRecord.entityId }
                : {}),
            });
          }
          loadedSceneLevelsRef.current.add(currentLevelId);
        } else {
          // File record/scene missing (orphaned sceneFileId, corrupted, or deleted).
          // 🛡️ FIX (Β v1.2 — ADR-469) — graceful suppress (incident 2026-06-17 ADR-293
          // error spam): the level points at a `sceneFileId` whose `files`/`cadFiles` doc
          // no longer exists, so `getFileStoragePath` returns null and every local edit
          // threw "canonicalScenePath is required (ADR-293)". v1.1 only reset the target
          // here, but each `levels` snapshot re-ran this effect and re-opened it (sync set
          // above) before the async reset — leaving a window where an edit still threw.
          // v1.2: LATCH the orphaned fileId in the auto-save SSoT so the sync set above
          // never re-opens it and the gate hard-suppresses any save. Then reset + preserve
          // in-memory BIM. BIM persists independently via floorId-keyed per-entity colls.
          console.warn(`[LevelsSystem] Scene not found for fileId: ${sceneFileId} — latching orphaned target + suppressing DXF auto-save (missing file).`);
          sceneManager.markFileTargetOrphaned?.(sceneFileId);
          resetDxfAutoSaveTarget();
          setEmptyScenePreservingBim();
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.error('[LevelsSystem] Failed to load scene:', err);
          resetDxfAutoSaveTarget();
          setEmptyScenePreservingBim();
        }
      } finally {
        if (!abortController.signal.aborted) {
          // Release loading guard after next frame to prevent auto-save race condition
          requestAnimationFrame(() => {
            sceneManager.setIsLoadingFromFirestore(false);
          });
          setSceneLoading(false);
        }
      }
    };

    loadScene();

    return () => {
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLevelId, levels]); // levels dependency needed to detect sceneFileId changes from onSnapshot

  // 🏢 ENTERPRISE: Persist level→DXF association via API route (Admin SDK).
  // Firestore rules do NOT allow client-side updates on dxf_viewer_levels.
  // Uses /api/dxf-levels PATCH — same route as updateLevelContext.
  const linkSceneToLevel = useCallback(
    async (levelId: string, fileId: string, fileName: string): Promise<void> => {
      if (!enableFirestore) return;

      // Idempotent guard — skip if already linked
      const level = levels.find(l => l.id === levelId);
      if (level?.sceneFileId === fileId) return;

      // 🛡️ ADR-714 — WRITE-SIDE cross-floor guard.
      //
      // Μέχρι τώρα ο έλεγχος ορόφου υπήρχε ΜΟΝΟ στο load path (`isCrossFloorSceneLink`
      // παραπάνω): η λάθος σύνδεση γραφόταν ελεύθερα στη βάση και ανακαλυπτόταν αργότερα,
      // όταν το μόνο που μπορούσε να γίνει ήταν να μείνει ο όροφος άδειος. Ο φρουρός ήταν
      // στη λάθος πλευρά της πόρτας. Επαληθεύουμε ΠΡΙΝ γράψουμε.
      //
      // Ο διακομιστής επαναλαμβάνει τον ίδιο έλεγχο (`/api/dxf-levels` PATCH) — αυτός εδώ
      // γλιτώνει το άσκοπο round-trip και δίνει άμεση ανάδραση στον χρήστη.
      const scope = await DxfFirestoreService.getFileFloorScope(fileId);
      if (isCrossFloorSceneLink(scope, level?.floorId)) {
        console.error(
          `[LevelsSystem] ADR-714 — άρνηση σύνδεσης: το αρχείο ${fileId} ανήκει στον όροφο ` +
          `${scope?.entityId} αλλά το επίπεδο ${levelId} είναι στον όροφο ${level?.floorId}.`,
        );
        toast.error(t('scene.crossFloorSaveBlocked'));
        return;
      }

      try {
        const res = await fetch('/api/dxf-levels', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ levelId, sceneFileId: fileId, sceneFileName: fileName }),
        });
        if (!res.ok) {
          console.error('[LevelsSystem] Failed to link scene to level:', res.status, res.statusText);
        }
      } catch (err) {
        console.error('[LevelsSystem] Failed to link scene to level:', err);
      }
    },
    [enableFirestore, levels, t]
  );

  // 🏢 ENTERPRISE: Wire onSceneSaved callback — auto-save notifies us when scene is persisted
  // Dependency: setOnSceneSaved (stable ref from useCallback) — NOT the full sceneManager object
  // which changes identity every render due to object spread in useAutoSaveSceneManager
  //
  // 🛡️ ADR-714 — linkάρουμε το επίπεδο ΤΟΥ TICKET, όχι το «τρέχον».
  //
  // Πριν, το callback διάβαζε το `currentLevelId` του closure και είχε το `currentLevelId`
  // στο dependency array, οπότε ΚΑΘΕ εναλλαγή ορόφου το αντικαθιστούσε. Ένα debounced save
  // που ξεκίνησε στον όροφο Α και ολοκληρωνόταν μετά την εναλλαγή καλούσε το ΝΕΟ callback
  // → `linkSceneToLevel(όροφος Β, αρχείο του Α)`. Εκεί ακριβώς γράφτηκε το
  // `lvl_2a7ff5cc.sceneFileId = file_751f0286` (περιστατικό 2026-07-26).
  //
  // Το `ticket.levelId` είναι αμετάβλητο, άρα το callback δεν χρειάζεται πια να ξέρει
  // ποιος όροφος είναι ενεργός — και δεν εξαρτάται από αυτόν.
  const { setOnSceneSaved } = sceneManager;
  useEffect(() => {
    setOnSceneSaved((ticket: SceneSaveTicket, fileId: string) => {
      linkSceneToLevel(ticket.levelId, fileId, ticket.fileName);
    });
    return () => {
      setOnSceneSaved(null);
    };
  }, [linkSceneToLevel, setOnSceneSaved]);

  // 🛡️ ADR-714 — ορατή ανάδραση όταν ένας φρουρός δεδομένων ματαιώνει μια εγγραφή.
  // Σιωπηλή ματαίωση θα ήταν χειρότερη από το bug: ο χρήστης θα νόμιζε ότι σώθηκε.
  const { setOnSaveBlocked } = sceneManager;
  useEffect(() => {
    setOnSaveBlocked?.((reason: SceneSaveBlockReason) => {
      toast.error(
        reason === 'cross-floor-target'
          ? t('scene.crossFloorSaveBlocked')
          : t('scene.dxfWipeBlocked'),
      );
    });
    return () => {
      setOnSaveBlocked?.(null);
    };
  }, [setOnSaveBlocked, t]);

  // 🏢 ADR-354 Entry Point #4: super admin company switcher → DXF scene cache invalidation.
  // Cached scenes + dedupe set belong to the previous tenant and must be evicted before
  // useLevelsFirestoreSync delivers the new tenant's levels. Aborts pending load first
  // so an in-flight fetch can't repopulate the just-cleared cache.
  //
  // 🚨 DATA SAFETY (ADR-354 Phase B Part 1 hotfix): a plain clearAllScenes is NOT enough.
  // When the new tenant's level bootstrap fires setLevelScene with an empty scene, the
  // auto-save machinery still holds the previous tenant's fileRecordId + canonicalScenePath
  // + currentFileName and would persist the empty scene to that path — destroying the
  // previous tenant's DXF. resetSceneSession atomically: engages the load guard, cancels
  // the pending debounced save, clears scenes + fileRecordId + saveContext + filename +
  // per-file caches, and releases the guard on the next animation frame.
  // Depend on the stable `resetSceneSession` ref (useCallback [] in
  // useAutoSaveSceneManager) — NOT the full `sceneManager` object, which changes
  // identity on every edit and would needlessly re-subscribe this listener each
  // time (same rationale as the setOnSceneSaved wiring above).
  const { resetSceneSession } = sceneManager;
  useEffect(() => {
    const unsub = onSuperAdminActiveCompanyChange(() => {
      sceneLoadAbortRef.current?.abort();
      loadedSceneLevelsRef.current.clear();
      resetSceneSession();
    });
    return unsub;
  }, [resetSceneSession]);

  return { sceneLoading, linkSceneToLevel };
}
