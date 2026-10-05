/**
 * =============================================================================
 * ENTERPRISE: Floorplan Scene Loader Hook
 * =============================================================================
 *
 * Custom hook for loading DXF scene data with 3 fallback paths:
 *   A) V1 embedded scene in processedData
 *   B) V3 authenticated API
 *   C) Bytes — scene JSON **or** original DXF, decided by the payload itself
 *      (`loadSceneFromBytes`, ADR-899 §9 θέμα 8· ήταν δύο κλάδοι που διάλεγαν από το `ext`)
 *
 * Extracted from FloorplanGallery.tsx for SRP compliance (ADR-033).
 *
 * @module components/shared/files/media/useFloorplanSceneLoader
 */

import { useEffect, useRef, useState } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { auth } from '@/lib/firebase';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { API_ROUTES } from '@/config/domain-constants';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { FileRecord, DxfSceneData } from '@/types/file-record';
import { fileDisplayUrl } from '@/lib/files/file-display-url';
import { loadSceneFromBytes, UnreadableScenePayloadError } from './floorplan-scene-bytes';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Σκηνή από **σκέτα bytes** — για επιφάνειες που ΔΕΝ έχουν εγγραφή στο χέρι (σελίδα κοινοποίησης, υπογεγραμμένο
 * URL του πρωτοτύπου). ⚠️ Όποιος **έχει** `FileRecord` δίνει την εγγραφή: μόνο εκείνη ξέρει το `processedData`
 * (PATH A/B). Η χειροποίητη «ελάχιστη εγγραφή» του `DxfPreview` έκρυβε ακριβώς αυτό (ADR-899 §9 θέμα 8).
 */
export interface SceneBytesSource {
  readonly kind: 'bytes';
  readonly url: string;
  readonly fileName: string;
}

export type FloorplanSceneSource = FileRecord | SceneBytesSource;

interface FloorplanSceneLoaderResult {
  /** Loaded DXF scene data, or null if not loaded yet */
  loadedScene: DxfSceneData | null;
  /** Whether the scene is currently being loaded */
  isLoading: boolean;
  /** Error message from loading, or null */
  sceneError: string | null;
  /**
   * Η σκηνή φορτώθηκε και έχει **0 οντότητες**. Ονομασμένη έκβαση: ο καμβάς δεν έχει τι να ζωγραφίσει, και ένας
   * άδειος καμβάς δεν ξεχωρίζει από σφάλμα (ADR-899 §9 θέμα 8 — «σιωπηλό λευκό»).
   */
  isEmpty: boolean;
}

type SceneApiOutcome = { readonly kind: 'scene'; readonly scene: DxfSceneData } | { readonly kind: 'processing' };

// ============================================================================
// LOGGER
// ============================================================================

const logger = createModuleLogger('useFloorplanSceneLoader');

// ============================================================================
// HELPERS
// ============================================================================

const isBytesSource = (source: FloorplanSceneSource): source is SceneBytesSource =>
  'kind' in source && source.kind === 'bytes';

/** PATH B — η σκηνή από το API (auth προαιρετικό: τα δημόσια έργα επιτρέπονται). */
async function fetchSceneViaApi(fileId: string): Promise<SceneApiOutcome> {
  const headers: HeadersInit = {};
  if (auth.currentUser) {
    headers['Authorization'] = `Bearer ${await auth.currentUser.getIdToken()}`;
  }
  const response = await fetch(API_ROUTES.FLOORPLANS.SCENE(fileId), { method: 'GET', headers });
  if (response.status === 202) return { kind: 'processing' };
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
  return { kind: 'scene', scene: await response.json() };
}

// ============================================================================
// ΟΙ ΤΡΕΙΣ ΔΡΟΜΟΙ — καθαρή απόφαση, χωριστά από την εκτέλεση (ADR-899 §9 θέμα 9, χρέος GOL)
// ============================================================================

/**
 * **Από ποιον δρόμο έρχεται η σκηνή;** — κλειστό σύνολο. Η απόφαση είναι καθαρή συνάρτηση της πηγής· το I/O
 * και η κατάσταση του React ζουν αλλού.
 */
export type SceneLoadPlan =
  /** PATH A — V1 Legacy: η σκηνή είναι ενσωματωμένη στο `processedData`. Καμία λήψη. */
  | { readonly kind: 'embedded'; readonly scene: DxfSceneData }
  /** PATH B — V3: `processedDataPath` ⇒ το scene API. */
  | { readonly kind: 'api'; readonly fileId: string }
  /** PATH C — bytes: JSON σκηνής **ή** πρωτότυπο DXF· το λέει το ίδιο το περιεχόμενο. */
  | { readonly kind: 'bytes'; readonly url: string; readonly fileName: string; readonly userDrawingUnits: FileRecord['userDrawingUnits'] }
  /** Τίποτα να φορτωθεί (χωρίς URL, ή το ανέβασμα δεν ολοκληρώθηκε). */
  | { readonly kind: 'none' };

const NO_PLAN = { kind: 'none' } as const satisfies SceneLoadPlan;

/** Ο δρόμος μιας **εγγραφής**: ενσωματωμένη → API → bytes του πρωτοτύπου. */
function planRecordSceneLoad(file: FileRecord, fileExt: string): SceneLoadPlan {
  if (file.processedData?.scene) return { kind: 'embedded', scene: file.processedData.scene };
  if (file.processedData?.processedDataPath && file.id) return { kind: 'api', fileId: file.id };

  // ADR-899 §4.1 / §9 θέμα 9 — ο ΕΝΑΣ αναγνώστης: δίνει το αντικείμενο του `storagePath`, ακόμη κι όταν το
  //    αποθηκευμένο `downloadUrl` ονομάζει το συνοδευτικό `.scene.json`. Η μορφή των bytes ΔΕΝ βγαίνει από το `ext`.
  const url = fileDisplayUrl(file);
  if (!url) return NO_PLAN;
  // Πρωτότυπο DXF εγγραφής διαβάζεται μόνο όταν το ανέβασμα ολοκληρώθηκε· τα `.json` της
  // FloorplanSaveOrchestrator δεν έχουν τέτοια φάση.
  if (fileExt !== 'json' && file.status !== 'ready') return NO_PLAN;
  return { kind: 'bytes', url, fileName: file.originalFilename ?? '', userDrawingUnits: file.userDrawingUnits };
}

/** **Ο δρόμος για αυτή την πηγή.** Οι πηγές «μόνο bytes» δεν έχουν ούτε `processedData` ούτε φάση ανεβάσματος. */
export function planSceneLoad(source: FloorplanSceneSource, fileExt: string): SceneLoadPlan {
  if (!isBytesSource(source)) return planRecordSceneLoad(source, fileExt);
  if (!source.url) return NO_PLAN;
  return { kind: 'bytes', url: source.url, fileName: source.fileName, userDrawingUnits: undefined };
}

/** Τι έφερε ένας δρόμος με I/O: τη σκηνή, ή «ακόμη επεξεργάζεται» (202 του scene API). */
type SceneLoadResult = { readonly scene: DxfSceneData | null; readonly processing: boolean };

/** Η **εκτέλεση** των δύο δρόμων με I/O — καμία κατάσταση React, τα σφάλματα ανεβαίνουν στον καλούντα. */
async function executeSceneLoad(plan: Extract<SceneLoadPlan, { kind: 'api' | 'bytes' }>): Promise<SceneLoadResult> {
  if (plan.kind === 'api') {
    const outcome = await fetchSceneViaApi(plan.fileId);
    return outcome.kind === 'scene' ? { scene: outcome.scene, processing: false } : { scene: null, processing: true };
  }
  const scene = await loadSceneFromBytes({
    url: plan.url,
    fileName: plan.fileName,
    userDrawingUnits: plan.userDrawingUnits,
  });
  return { scene, processing: false };
}

const LOAD_FAILURE_LABEL: Readonly<Record<'api' | 'bytes', string>> = {
  api: 'Failed to load scene via API',
  bytes: 'Failed to load scene from bytes',
};

/** Το μήνυμα για τον άνθρωπο: «δεν διαβάζεται ως σχέδιο» έχει δικό του κείμενο, τα υπόλοιπα το μήνυμα του σφάλματος. */
function sceneLoadErrorMessage(err: unknown, unreadableText: string): string {
  if (err instanceof UnreadableScenePayloadError) return unreadableText;
  return err instanceof Error ? err.message : 'Unknown error';
}

/** Πού γράφει μια φόρτωση με I/O — η κατάσταση του hook, και τα δύο κείμενα που χρειάζεται. */
interface SceneLoadSink {
  readonly setScene: (scene: DxfSceneData) => void;
  readonly setError: (message: string | null) => void;
  readonly setLoading: (loading: boolean) => void;
  readonly processingText: string;
  readonly unreadableText: string;
}

/**
 * Κοινό περιτύλιγμα φόρτωσης: σημαία, σφάλμα, ακύρωση — **ένα** για όλους τους δρόμους με I/O.
 * @returns ο ακυρωτής· μετά από αυτόν καμία εγγραφή στο sink (η πηγή άλλαξε ή το component έφυγε).
 */
function startSceneLoad(plan: Extract<SceneLoadPlan, { kind: 'api' | 'bytes' }>, sink: SceneLoadSink): () => void {
  let cancelled = false;
  sink.setLoading(true);
  sink.setError(null);
  executeSceneLoad(plan)
    .then(({ scene, processing }) => {
      if (cancelled) return;
      if (processing) sink.setError(sink.processingText);
      if (scene) sink.setScene(scene);
    })
    .catch((err: unknown) => {
      if (cancelled) return;
      logger.warn(LOAD_FAILURE_LABEL[plan.kind], { error: err });
      sink.setError(sceneLoadErrorMessage(err, sink.unreadableText));
    })
    .finally(() => { if (!cancelled) sink.setLoading(false); });
  return () => { cancelled = true; };
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Live-sync: when the DXF auto-save updates files/{id} in Firestore (version bump), the token increments so
 * the scene-load effect re-runs and fetches new content. The first snapshot is the current state, not a change.
 */
function useSceneRefetchToken(fileId: string | undefined, isDxf: boolean): number {
  const [refetchToken, setRefetchToken] = useState(0);
  const initialSnapshotSeenRef = useRef(false);

  useEffect(() => {
    if (!fileId || !isDxf) return;
    initialSnapshotSeenRef.current = false;
    const unsub = firestoreQueryService.subscribeDoc(
      'FILES',
      fileId,
      () => {
        if (!initialSnapshotSeenRef.current) {
          initialSnapshotSeenRef.current = true;
          return;
        }
        setRefetchToken((n) => n + 1);
      },
      () => { /* version-bump listener — errors are non-critical */ },
    );
    return unsub;
  }, [fileId, isDxf]);

  return refetchToken;
}

/**
 * Load DXF scene data for a floorplan file.
 * Returns loading state, loaded scene data, the empty-scene outcome, and any error.
 */
export function useFloorplanSceneLoader(
  source: FloorplanSceneSource | null,
  isDxf: boolean,
  fileExt: string,
): FloorplanSceneLoaderResult {
  const { t } = useTranslation(['files', 'files-media']);
  const [loadedScene, setLoadedScene] = useState<DxfSceneData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sceneError, setSceneError] = useState<string | null>(null);

  const currentFile = source && !isBytesSource(source) ? source : null;
  const refetchToken = useSceneRefetchToken(currentFile?.id, isDxf);
  const plan = source && isDxf ? planSceneLoad(source, fileExt) : null;
  // Η ταυτότητα του δρόμου `bytes` είναι τα πεδία του, όχι το αντικείμενο (ξαναχτίζεται ανά render).
  const bytesUrl = plan?.kind === 'bytes' ? plan.url : null;
  const bytesFileName = plan?.kind === 'bytes' ? plan.fileName : '';

  useEffect(() => {
    if (!plan) { setLoadedScene(null); return; } // Guard: only DXF/JSON files
    if (plan.kind === 'none') return;
    if (plan.kind === 'embedded') { setLoadedScene(plan.scene); return; }

    return startSceneLoad(plan, {
      setScene: setLoadedScene,
      setError: setSceneError,
      setLoading: setIsLoading,
      processingText: t('floorplan.processingInProgress'),
      unreadableText: t('floorplan.sceneError'),
    });
    // ADR-716 Φ5 — το `userDrawingUnits` ΕΙΝΑΙ είσοδος του parse: αν αλλάξει, η σκηνή
    // πρέπει να ξαναχτιστεί, αλλιώς η οθόνη δείχνει την παλιά κλίμακα.
    // Η ταυτότητα της πηγής είναι τα πεδία της, όχι το αντικείμενο (ο καταναλωτής μπορεί να το ξαναχτίζει ανά render).
  }, [currentFile?.id, currentFile?.processedData, bytesUrl, bytesFileName,
      currentFile?.status, currentFile?.userDrawingUnits,
      isDxf, fileExt, t, refetchToken]);

  const isEmpty = !!loadedScene && !loadedScene.entities?.length;
  return { loadedScene, isLoading, sceneError, isEmpty };
}
