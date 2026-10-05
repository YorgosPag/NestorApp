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
// HOOK
// ============================================================================

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
  const bytesSource = source && isBytesSource(source) ? source : null;

  // Live-sync: when the DXF auto-save updates files/{id} in Firestore (version bump),
  // increment refetchToken so the scene-load effect re-runs and fetches new content.
  const [refetchToken, setRefetchToken] = useState(0);
  const initialSnapshotSeenRef = useRef(false);

  useEffect(() => {
    if (!currentFile?.id || !isDxf) return;
    initialSnapshotSeenRef.current = false;
    const unsub = firestoreQueryService.subscribeDoc(
      'FILES',
      currentFile.id,
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
  }, [currentFile?.id, isDxf]);

  // ADR-899 §4.1 — ⚠️ ΠΑΓΙΔΑ CAD: σε εγγραφές CAD το αποθηκευμένο `downloadUrl` δείχνει στο **`.scene.json`**
  //    (μετρημένο στην παραγωγή, ADR-899 §2.2) ενώ το `ext` λέει `dxf`. Γι' αυτό η μορφή των bytes ΔΕΝ βγαίνει
  //    από το `ext`: τη λέει το ίδιο το περιεχόμενο (`loadSceneFromBytes`, §9 θέμα 8).
  const bytesUrl = bytesSource?.url ?? (currentFile ? fileDisplayUrl(currentFile) : null);
  const bytesFileName = bytesSource?.fileName ?? currentFile?.originalFilename ?? '';

  useEffect(() => {
    // Guard: only DXF/JSON files
    if (!source || !isDxf) {
      setLoadedScene(null);
      return;
    }

    let cancelled = false;

    /** Κοινό περιτύλιγμα φόρτωσης: σημαία, σφάλμα, ακύρωση — ένα για όλα τα μονοπάτια με I/O. */
    const run = async (label: string, load: () => Promise<DxfSceneData | null>) => {
      setIsLoading(true);
      setSceneError(null);
      try {
        const scene = await load();
        if (!cancelled && scene) setLoadedScene(scene);
      } catch (err) {
        if (cancelled) return;
        logger.warn(label, { error: err });
        setSceneError(
          err instanceof UnreadableScenePayloadError ? t('floorplan.sceneError')
            : err instanceof Error ? err.message : 'Unknown error',
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    const loadScene = async () => {
      // -- PATH A: V1 Legacy — embedded scene in processedData --
      if (currentFile?.processedData?.scene) {
        setLoadedScene(currentFile.processedData.scene);
        return;
      }

      // -- PATH B: V3 — processedDataPath via API --
      if (currentFile?.processedData?.processedDataPath && currentFile.id) {
        const fileId = currentFile.id;
        await run('Failed to load scene via API', async () => {
          const outcome = await fetchSceneViaApi(fileId);
          if (outcome.kind === 'scene') return outcome.scene;
          if (!cancelled) setSceneError(t('floorplan.processingInProgress'));
          return null;
        });
        return;
      }

      // -- PATH C: bytes (scene JSON or original DXF — the payload decides) --
      if (!bytesUrl) return;
      // Πρωτότυπο DXF εγγραφής διαβάζεται μόνο όταν το ανέβασμα ολοκληρώθηκε· τα `.json` της
      // FloorplanSaveOrchestrator και οι πηγές «μόνο bytes» δεν έχουν τέτοια φάση.
      if (currentFile && fileExt !== 'json' && currentFile.status !== 'ready') return;

      await run('Failed to load scene from bytes', () =>
        loadSceneFromBytes({
          url: bytesUrl,
          fileName: bytesFileName,
          userDrawingUnits: currentFile?.userDrawingUnits,
        }),
      );
    };

    loadScene();
    return () => { cancelled = true; };
    // ADR-716 Φ5 — το `userDrawingUnits` ΕΙΝΑΙ είσοδος του parse: αν αλλάξει, η σκηνή
    // πρέπει να ξαναχτιστεί, αλλιώς η οθόνη δείχνει την παλιά κλίμακα.
    // Η ταυτότητα της πηγής είναι τα πεδία της, όχι το αντικείμενο (ο καταναλωτής μπορεί να το ξαναχτίζει ανά render).
  }, [currentFile?.id, currentFile?.processedData, bytesUrl, bytesFileName,
      currentFile?.status, currentFile?.userDrawingUnits,
      isDxf, fileExt, t, refetchToken]);

  const isEmpty = !!loadedScene && !loadedScene.entities?.length;
  return { loadedScene, isLoading, sceneError, isEmpty };
}
