import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { STORAGE_TIMING } from '../../config/timing-config';
import { useSceneManager } from './useSceneManager';
// N.7.1 — το δημόσιο συμβόλαιο ζει σε `.types.ts` (ίδια σύμβαση με LevelsSystem.types.ts).
// Re-export ώστε τα `import { AutoSaveSceneManagerState } from './useAutoSaveSceneManager'`
// να συνεχίσουν να δουλεύουν: η μετακίνηση είναι εσωτερική, όχι αλλαγή API.
import type {
  AutoSaveSceneManagerState,
  AutoSaveSceneManagerOptions,
} from './useAutoSaveSceneManager.types';
export type { AutoSaveSceneManagerState, AutoSaveSceneManagerOptions };
import {
  originSchedulesAutoSave,
  DEFAULT_SCENE_WRITE_ORIGIN,
  type SceneWriteOrigin,
} from './scene-write-origin';
import type { DxfSaveContext } from '../../services/dxf-firestore.service';
import type { SceneModel } from '../../types/scene';
// 🛡️ ADR-714 — immutable write identity. Το save παγώνει τον προορισμό του στο Τ₀
// (scheduling) αντί να τον διαβάζει από refs στο Τ₀+2000ms (execution).
import { executeSceneSave, type SceneSaveBlockReason } from './execute-scene-save';
import { createSceneSaveTicket, type SceneSaveTicket } from './scene-save-ticket';
import { useAuth } from '@/auth/hooks/useAuth';
// 🚀 Ribbon-cascade fix (profiler 2026-06-28): the volatile scene save-status is
// mirrored into a dedicated zero-React store so the AutoSaveStatus widget can
// subscribe to it WITHOUT the status flowing through the LevelsSystem context
// (which churned ~40 ribbon bridges on every save cycle). See AutoSaveStatusStore.
import { autoSaveStatusStore } from '../../stores/AutoSaveStatusStore';

/**
 * 🛡️ ADR-714 — κλειδί της fileId cache: ο ΟΡΟΦΟΣ μαζί με το όνομα.
 *
 * Το σκέτο όνομα δεν ταυτοποιεί κάτοψη: το ίδιο DXF επιτρέπεται (και συνηθίζεται) να
 * φορτωθεί σε πολλούς ορόφους, οπότε δύο διαφορετικά FileRecords μοιράζονται
 * `originalFilename`. Χωρίς τον όροφο στο κλειδί, ο ένας όροφος κληρονομούσε το fileId
 * του άλλου και οι δύο έγραφαν στο ίδιο `.scene.json`.
 */
function fileIdCacheKey(floorId: string | null, fileName: string): string {
  return `${floorId ?? 'no-floor'}::${fileName}`;
}

/**
 * Το ήδη γνωστό `canonicalScenePath` στο Τ₀, ή `null` αν πρέπει να επιλυθεί async.
 * Η cache του path είναι keyed by fileId (μοναδικό), άρα διαβάζεται μόνο όταν υπάρχει.
 */
function resolveKnownScenePath(
  injectedContext: DxfSaveContext | null,
  fileId: string | null,
  scenePathCache: ReadonlyMap<string, string>,
): string | null {
  return (
    injectedContext?.canonicalScenePath
    ?? (fileId ? scenePathCache.get(fileId) : undefined)
    ?? null
  );
}

export function useAutoSaveSceneManager(
  { enabled = true }: AutoSaveSceneManagerOptions = {},
): AutoSaveSceneManagerState {
  const sceneManager = useSceneManager();
  const sceneManagerRef = useRef(sceneManager);
  sceneManagerRef.current = sceneManager;
  // 🔒 TENANT SCOPING (Sentry NESTOR-APP-3): inject authenticated user so
  // auto-save writes companyId + createdBy into cadFiles metadata, enabling
  // cross-user reads under tenant-scoped Firestore rules.
  const { user } = useAuth();
  const [currentFileName, setCurrentFileNameState] = useState<string | null>(null);
  // Ref mirrors state so setLevelSceneWithAutoSave always reads the latest value
  // even before React re-renders (avoids stale closure when called synchronously
  // after setCurrentFileName in the same event handler as setLevelScene).
  const currentFileNameRef = useRef<string | null>(null);
  // ADR-726 §13.1 — ο διακόπτης του χρήστη ξεκινά από τη δηλωμένη μονιμότητα, ώστε το
  // widget κατάστασης να λέει την αλήθεια· η ΠΥΛΗ όμως είναι το ref από κάτω.
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(enabled);
  const persistenceEnabledRef = useRef<boolean>(enabled);
  persistenceEnabledRef.current = enabled;
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // Debounce auto-save to prevent excessive Firestore writes
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Flag to prevent auto-save when loading from Firestore
  const isLoadingFromFirestoreRef = useRef<boolean>(false);
  // Flag to prevent multiple simultaneous loads
  const loadedFilesRef = useRef<Set<string>>(new Set());
  // Cache `${floorId}::${fileName}` → enterpriseId, ώστε να μη γεννιούνται νέα ids σε κάθε save.
  // 🛡️ ADR-714 — ΠΡΕΠΕΙ να περιλαμβάνει τον όροφο. Όσο ήταν keyed by σκέτο fileName, δύο
  // όροφοι με το ΙΔΙΟ αρχείο κάτοψης (νόμιμη πρακτική) μοιράζονταν μία εγγραφή: ο πρώτος
  // που έσωζε «δίδασκε» στην cache το δικό του fileId και ο δεύτερος το κληρονομούσε —
  // οπότε έγραφαν στο ίδιο `.scene.json`. Το `scenePathCacheRef` από κάτω είχε ήδη
  // θωρακιστεί για ακριβώς αυτόν τον λόγο· η cache του fileId είχε μείνει εκτεθειμένη,
  // αν και είναι η ΠΙΟ κρίσιμη από τις δύο (καθορίζει ΠΟΙΟ αρχείο γράφεται).
  const fileIdCacheRef = useRef<Map<string, string>>(new Map());
  // Cache fileId → canonicalScenePath so subsequent saves don't re-derive it.
  // MUST be keyed by fileId (unique), NOT fileName — two different files can share the same
  // originalFilename, which would cause the wrong scene path to be written to Firestore.
  const scenePathCacheRef = useRef<Map<string, string>>(new Map());
  // 🛡️ ADR-714 — levelId → floorId. Ο μόνος γραφέας είναι ο `useLevelSceneLoader`.
  const levelFloorScopeRef = useRef<Map<string, string | null>>(new Map());
  // 🛡️ ADR-714 — fileId → DXF entity count όπως είναι ΑΠΟΘΗΚΕΥΜΕΝΟ. Baseline του `isDxfWipe`.
  const persistedDxfBaselineRef = useRef<Map<string, number>>(new Map());
  // 🛡️ ADR-714 — δέκτης ειδοποίησης ματαιωμένης εγγραφής (i18n toast στο LevelsSystem).
  const onSaveBlockedRef = useRef<((reason: SceneSaveBlockReason) => void) | null>(null);
  // 🏢 ENTERPRISE: Injected FileRecord ID (from wizard/upload) — ensures cadFiles uses the same ID
  const injectedFileRecordIdRef = useRef<string | null>(null);
  // 🪜 ADR-358 Phase 8: reactive mirror of injectedFileRecordIdRef for downstream consumers.
  const [fileRecordId, setFileRecordIdState] = useState<string | null>(null);
  // 🏢 ADR-240: Injected save context from Wizard — carries entityType/floorId/purpose for dual-write
  const injectedSaveContextRef = useRef<DxfSaveContext | null>(null);
  // 🪜 ADR-358 Phase 8: reactive mirror of injectedSaveContextRef for downstream consumers.
  const [saveContext, setSaveContextState] = useState<DxfSaveContext | null>(null);
  // 🏢 ENTERPRISE: Callback after successful save — LevelsSystem uses this to persist level→DXF link
  const onSceneSavedRef = useRef<((ticket: SceneSaveTicket, fileId: string) => void) | null>(null);
  // 🛡️ ADR-469 v1.2 — SSoT orphaned-target latch: fileIds whose backing files/cadFiles doc
  // is gone. DXF scene auto-save is suppressed for them this session (BIM persists
  // independently via floorId-keyed per-entity collections). A ref/Set — NOT React state —
  // so marking never triggers a re-render (ADR-040 micro-leaf / auto-save-storm safe).
  const orphanedFileTargetsRef = useRef<Set<string>>(new Set());

  /** Stable setter — updates ref (sync) and state (triggers re-render for consumers). */
  const setCurrentFileName = useCallback((fileName: string | null) => {
    currentFileNameRef.current = fileName;
    setCurrentFileNameState(fileName);
  }, []);

  /**
   * 🏢 ENTERPRISE: Inject FileRecord ID from external source (wizard upload)
   * When set, auto-save writes to cadFiles using THIS ID instead of generating a new one.
   * This ensures cadFiles and files collections share the same document ID.
   */
  const setFileRecordId = useCallback((id: string | null) => {
    injectedFileRecordIdRef.current = id;
    setFileRecordIdState(id);
    // Cache against current filename (read from ref to avoid stale closure).
    // 🛡️ ADR-714 — το κλειδί περιλαμβάνει τον όροφο του injected context, αλλιώς αυτή
    // ακριβώς η γραμμή μόλυνε την cache για κάθε άλλο όροφο με το ίδιο όνομα αρχείου.
    const fileName = currentFileNameRef.current;
    if (id && fileName) {
      fileIdCacheRef.current.set(
        fileIdCacheKey(injectedSaveContextRef.current?.floorId ?? null, fileName),
        id,
      );
    }
  }, []);

  /** 🛡️ ADR-714 — ο loader δηλώνει σε ποιον όροφο ανήκει κάθε επίπεδο. */
  const setLevelFloorScope = useCallback((levelId: string, floorId: string | null) => {
    levelFloorScopeRef.current.set(levelId, floorId);
  }, []);

  /** 🛡️ ADR-714 — baseline του φρουρού `isDxfWipe` για έναν προορισμό. */
  const setPersistedDxfBaseline = useCallback((fileId: string, dxfCount: number) => {
    if (fileId) persistedDxfBaselineRef.current.set(fileId, dxfCount);
  }, []);

  /** 🛡️ ADR-714 — δέκτης ειδοποίησης ματαιωμένης εγγραφής. */
  const setOnSaveBlocked = useCallback(
    (cb: ((reason: SceneSaveBlockReason) => void) | null) => {
      onSaveBlockedRef.current = cb;
    },
    [],
  );

  /** 🏢 ADR-240: Inject DxfSaveContext from Wizard so dual-write uses correct entityType/floorId */
  const setSaveContext = useCallback((ctx: DxfSaveContext | null) => {
    injectedSaveContextRef.current = ctx;
    setSaveContextState(ctx);
  }, []);

  /** 🏢 ENTERPRISE: Set callback for after successful save (used by LevelsSystem) */
  const setOnSceneSaved = useCallback(
    (cb: ((ticket: SceneSaveTicket, fileId: string) => void) | null) => {
      onSceneSavedRef.current = cb;
    },
    [],
  );

  /** 🏢 ENTERPRISE: External control of loading guard (used by LevelsSystem during scene load) */
  const setIsLoadingFromFirestore = useCallback((loading: boolean) => {
    isLoadingFromFirestoreRef.current = loading;
  }, []);

  /** 🛡️ ADR-469 v1.2 — latch a fileId as orphaned (its backing file doc is gone). */
  const markFileTargetOrphaned = useCallback((fileId: string) => {
    if (fileId) orphanedFileTargetsRef.current.add(fileId);
  }, []);

  /** 🛡️ ADR-469 v1.2 — true when the fileId's backing file is known-orphaned. */
  const isFileTargetOrphaned = useCallback(
    (fileId: string | null | undefined): boolean =>
      !!fileId && orphanedFileTargetsRef.current.has(fileId),
    [],
  );

  /**
   * 🏢 ADR-354 Phase B Part 1: hard reset of every piece of session state that could
   * cause an auto-save to write the new tenant's empty scene into the previous tenant's
   * Storage path. The order matters: engage the guard FIRST (so any synchronous setLevelScene
   * triggered downstream is ignored), cancel the pending debounced save, clear in-memory
   * scene state, then null the inputs auto-save reads (fileRecordId, fileName, context, caches).
   */
  const resetSceneSession = useCallback(() => {
    isLoadingFromFirestoreRef.current = true;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = undefined;
    }
    sceneManagerRef.current.clearAllScenes();
    injectedFileRecordIdRef.current = null;
    setFileRecordIdState(null);
    injectedSaveContextRef.current = null;
    setSaveContextState(null);
    currentFileNameRef.current = null;
    setCurrentFileNameState(null);
    fileIdCacheRef.current.clear();
    scenePathCacheRef.current.clear();
    loadedFilesRef.current.clear();
    orphanedFileTargetsRef.current.clear();
    // 🛡️ ADR-714 — οι floor scopes και τα baselines ανήκουν στον ΠΡΟΗΓΟΥΜΕΝΟ tenant.
    // Αν επιβίωναν, ένα baseline του παλιού tenant θα έκρινε εγγραφή του νέου.
    levelFloorScopeRef.current.clear();
    persistedDxfBaselineRef.current.clear();
    setSaveStatus('idle');
    requestAnimationFrame(() => {
      isLoadingFromFirestoreRef.current = false;
    });
  }, []);

  /**
   * Enhanced setLevelScene with auto-save
   */
  const setLevelSceneWithAutoSave = useCallback((
    levelId: string,
    scene: SceneModel,
    origin: SceneWriteOrigin = DEFAULT_SCENE_WRITE_ORIGIN,
  ) => {
    // ALWAYS update in-memory + React state for EVERY origin — remote edits must be
    // visible in the UI even though they don't trigger our own auto-save.
    sceneManagerRef.current.setLevelScene(levelId, scene);

    // Read filename from ref — always current even before React re-renders
    // (avoids stale-closure issue when setCurrentFileName and setLevelScene are
    // called in the same synchronous block before any await).
    const fileName = currentFileNameRef.current;

    // 🛡️ DATA-INTEGRITY GUARD (incident 2026-06-08): NEVER auto-save an empty scene.
    // A failed/aborted scene load sets an empty scene (useLevelSceneLoader "Scene not
    // found" → createEmptyScene). Once the loading guard releases on the next frame, a
    // later setLevelScene would debounce-write that empty scene over the REAL file in
    // Storage and destroy it (observed: file_0df264da climbed to revision 96 @ 95 bytes
    // / 0 entities). An empty scene is never worth persisting, so skipping the write is
    // FAIL-SAFE — it can only prevent a destructive overwrite, never cause a bad save.
    // A scene the user genuinely emptied simply isn't auto-persisted (rare edge case,
    // far less harmful than silently wiping a populated floorplan).
    //
    // 🛡️ ADR-714 — ΑΥΤΟΣ Ο ΦΡΟΥΡΟΣ ΔΕΝ ΑΡΚΕΙ. Ρωτά «είναι ΤΕΛΕΙΩΣ κενό;» και αστόχησε
    // στο περιστατικό 2026-07-26: η καταστροφική εγγραφή είχε 12 κολόνες (BIM) και ΜΗΔΕΝ
    // DXF, οπότε `12 > 0` → πέρασε και έγραψε 12 πάνω από 1181. Το δεύτερο στρώμα είναι
    // ο `isDxfWipe` μέσα στον executor, που ρωτά «μηδενίζεται η DXF γεωμετρία που ήδη
    // υπάρχει;». Αυτός εδώ μένει ως φθηνό πρώτο φίλτρο (καμία εγγραφή χωρίς περιεχόμενο).
    const isEmptyScene = scene.entities.length === 0;

    // 🏢 ADR-040 SSoT GATE (root-cause #2 — auto-save storm): ONLY a `local-edit`
    // origin schedules a save. `remote-echo` (Firestore snapshot reconciliation),
    // `load` and `system-reconcile` reflect ALREADY-persisted doc state, so re-saving
    // the derived 950KB scene blob would be pure waste — and the snapshot echo from
    // that write would re-enter ~22 persistence hooks → storm. The SINGLE decision
    // lives in `originSchedulesAutoSave` (no scattered suppress flags).
    //
    // 🔒 ADR-726 §13.1 — `persistenceEnabledRef` είναι ΣΚΛΗΡΗ πύλη, πριν από κάθε άλλο
    // κριτήριο: όταν ο viewer δηλώθηκε χωρίς μονιμότητα (perf harness), καμία εγγραφή
    // δεν προγραμματίζεται — ούτε αν ο χρήστης ξαναανάψει τον διακόπτη από το UI.
    if (
      persistenceEnabledRef.current &&
      originSchedulesAutoSave(origin) &&
      autoSaveEnabled && fileName && !isLoadingFromFirestoreRef.current && !isEmptyScene &&
      // 🛡️ ADR-469 v1.2 — belt #1: never schedule a save for a known-orphaned target.
      // Its backing files/cadFiles doc is gone → there is no canonicalScenePath to write
      // → autoSaveV2 would throw ADR-293. BIM persists via floorId-keyed collections.
      !orphanedFileTargetsRef.current.has(injectedFileRecordIdRef.current ?? '')
    ) {
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // 🛡️ ADR-714 — ΠΑΓΩΣΕ ΤΟΝ ΠΡΟΟΡΙΣΜΟ ΤΩΡΑ (Τ₀), όχι σε 2 δευτερόλεπτα.
      //
      // Ό,τι ταυτοποιεί αυτή την εγγραφή διαβάζεται ΕΔΩ, τη στιγμή που ο χρήστης
      // επεξεργάστηκε αυτόν τον όροφο, και κλείνεται μέσα στο ticket. Ο executor δεν
      // ξαναδιαβάζει κανένα ref. Έτσι μια εναλλαγή ορόφου μέσα στο παράθυρο του
      // debounce δεν μπορεί πια να ανακατευθύνει την εγγραφή σε άλλο αρχείο — ούτε
      // χρειάζεται να ακυρώσουμε το pending save (καμία απώλεια δουλειάς).
      const floorId = levelFloorScopeRef.current.get(levelId) ?? null;
      const ticket = createSceneSaveTicket({
        levelId,
        floorId,
        companyId: injectedSaveContextRef.current?.companyId ?? user?.companyId ?? null,
        userUid: user?.uid ?? null,
        fileId:
          injectedFileRecordIdRef.current
          ?? fileIdCacheRef.current.get(fileIdCacheKey(floorId, fileName))
          ?? null,
        fileName,
        canonicalScenePath: resolveKnownScenePath(
          injectedSaveContextRef.current,
          injectedFileRecordIdRef.current,
          scenePathCacheRef.current,
        ),
        saveContext: injectedSaveContextRef.current,
        scene,
      });

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new debounced save
      saveTimeoutRef.current = setTimeout(async () => {
        setSaveStatus('saving');

        const outcome = await executeSceneSave(ticket, {
          getBaselineDxfCount: (id) => persistedDxfBaselineRef.current.get(id) ?? 0,
          markFileTargetOrphaned,
        });

        if (outcome.status === 'saved') {
          // Cache for subsequent saves (fileId → path· `${floorId}::${fileName}` → fileId).
          if (outcome.canonicalScenePath) {
            scenePathCacheRef.current.set(outcome.fileId, outcome.canonicalScenePath);
          }
          fileIdCacheRef.current.set(fileIdCacheKey(ticket.floorId, ticket.fileName), outcome.fileId);
          persistedDxfBaselineRef.current.set(outcome.fileId, outcome.dxfCount);
          setSaveStatus('success');
          setLastSaveTime(new Date());
          // 🏢 ENTERPRISE: Notify LevelsSystem to persist level→DXF association.
          // 🛡️ ADR-714 — το ticket λέει ΠΟΙΟ επίπεδο γέννησε την εγγραφή.
          onSceneSavedRef.current?.(ticket, outcome.fileId);
        } else if (outcome.status === 'blocked') {
          setSaveStatus('error');
          onSaveBlockedRef.current?.(outcome.reason);
        } else if (outcome.status === 'failed') {
          setSaveStatus('error');
          console.error('❌ [AutoSave] Exception during save:', outcome.error);
        } else {
          setSaveStatus('idle');
        }

        // Reset status after delay
        setTimeout(() => setSaveStatus('idle'), PANEL_LAYOUT.TIMING.SAVE_STATUS_RESET);
      }, STORAGE_TIMING.SCENE_AUTOSAVE_DEBOUNCE); // 🏢 ADR-098
    }
  }, [autoSaveEnabled, markFileTargetOrphaned, user?.companyId, user?.uid]);
  
  /**
   * Load scene from Firestore on file change
   * TEMPORARILY DISABLED TO STOP INFINITE LOOP
   */
  useEffect(() => {
    if (!currentFileName || !autoSaveEnabled) return;

    // TODO: Re-enable auto-loading after fixing the infinite loop
    // const loadFromFirestore = async () => { ... };
    // loadFromFirestore();
  }, [currentFileName, autoSaveEnabled]);
  
  /**
   * Clear loaded files cache when currentFileName changes
   */
  useEffect(() => {
    // Clear cache when filename changes to allow reloading
    return () => {
      loadedFilesRef.current.clear();
    };
  }, [currentFileName]);

  /**
   * Cleanup timeout on unmount
   */
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // 🚀 Ribbon-cascade fix (profiler 2026-06-28): mirror the save-status into the
  // dedicated reactive channel. This is the SINGLE writer — the React state above
  // stays the owner; the store is a projection consumed only by AutoSaveStatus, so
  // status changes no longer churn the LevelsSystem context / ribbon bridges.
  useEffect(() => {
    autoSaveStatusStore.set({ currentFileName, lastSaveTime, saveStatus });
  }, [currentFileName, lastSaveTime, saveStatus]);
  
  return useMemo(() => ({
    ...sceneManager,
    setLevelScene: setLevelSceneWithAutoSave,
    currentFileName,
    setCurrentFileName,
    autoSaveEnabled,
    setAutoSaveEnabled,
    lastSaveTime,
    saveStatus,
    setFileRecordId,
    fileRecordId,
    setLevelFloorScope,
    setPersistedDxfBaseline,
    setOnSaveBlocked,
    setSaveContext,
    saveContext,
    setOnSceneSaved,
    setIsLoadingFromFirestore,
    markFileTargetOrphaned,
    isFileTargetOrphaned,
    resetSceneSession,
  }), [
    sceneManager, setLevelSceneWithAutoSave, currentFileName,
    autoSaveEnabled, lastSaveTime, saveStatus,
    fileRecordId, saveContext,
    setFileRecordId, setLevelFloorScope, setPersistedDxfBaseline, setOnSaveBlocked,
    setCurrentFileName, setSaveContext, setOnSceneSaved, setIsLoadingFromFirestore,
    markFileTargetOrphaned, isFileTargetOrphaned, resetSceneSession,
  ]);
}