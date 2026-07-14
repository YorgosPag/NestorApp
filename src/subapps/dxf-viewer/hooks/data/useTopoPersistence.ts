'use client';

/**
 * ADR-650 — Topographic surface-definition Firestore persistence React adapter.
 *
 * Bridges `TopoSurfaceFirestoreService` to the five topo stores (survey / contour
 * config / contour display / 3D / cut-fill). Single-doc-per-floor model, mirror of
 * `useGridGuidePersistence` (ADR-441):
 *   - **Load**: subscribe → hydrate (apply state to stores → REGENERATE contours/TIN).
 *   - **Save**: any topo store change → debounced `setDoc`/`updateDoc`.
 *   - **Per-floor scope**: on floor change → reset stores → new subscription loads that
 *     floor's survey (Revit: every storey its own ground).
 *
 * Anti-echo: the signature of the last save is compared to the incoming doc so our own
 * write returning does NOT re-apply + re-regenerate (loop guard).
 *
 * @see ../../systems/topography/persistence/topo-firestore-service.ts
 * @see ../../systems/topography/persistence/regenerate-topo.ts
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DXF_TIMING } from '../../config/dxf-timing';
import { useLevels } from '../../systems/levels';
import { resolveBimPersistenceScope } from '../../bim/persistence/bim-floor-scope';
import {
  createTopoSurfaceFirestoreService,
  TopoSurfaceFirestoreService,
} from '../../systems/topography/persistence/topo-firestore-service';
import {
  docToTopoState, isEmptyTopoState, topoStateSignature, withSurfaces,
  type TopoSurfaceDoc, type TopoPersistedState,
} from '../../systems/topography/persistence/topo-persistence-types';
import { collectTopoState, applyTopoState } from '../../systems/topography/persistence/topo-state-io';
import { regenerateTopoContours } from '../../systems/topography/persistence/regenerate-topo';
import { subscribeTopo } from '../../systems/topography/TopoPointStore';
import { subscribeContourConfig } from '../../systems/topography/contour-config-store';
import { subscribeContourDisplay } from '../../systems/topography/contour-display-store';
import { subscribeTerrain3D } from '../../systems/topography/terrain-3d-store';
import { subscribeCutFill } from '../../systems/topography/cut-fill-store';

export type TopoSaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface UseTopoPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-420 — stable building-storey scope key. */
  readonly floorId: string | null | undefined;
  readonly userId: string | null;
}

export interface UseTopoPersistenceResult {
  readonly saveState: TopoSaveState;
  readonly error: string | null;
}

const SAVE_DEBOUNCE_MS = DXF_TIMING.persist.TOPO_SURFACE;

/** Empty state — used to reset every store on a floor switch (Revit per-storey ground). */
const EMPTY_TOPO_STATE: TopoPersistedState = {
  surfaces: { existing: { points: [], breaklines: [] }, proposed: { points: [], breaklines: [] } },
  boundary: null,
  contourConfig: { intervalMm: 500, majorEvery: 5, baseElevationMm: 0, labelMajors: true, labelDecimals: 2 },
  contourDisplayStyle: 'exact',
  terrain3d: { visible: false, style: 'shaded' },
  cutFill: { mode: 'datum', datumZMm: 0 },
};

export function useTopoPersistence(params: UseTopoPersistenceParams): UseTopoPersistenceResult {
  const { companyId, projectId, floorplanId, floorId, userId } = params;
  const { currentLevelId, getLevelScene, setLevelScene } = useLevels();

  const [saveState, setSaveState] = useState<TopoSaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [serviceReady, setServiceReady] = useState<boolean>(false);

  const serviceRef = useRef<TopoSurfaceFirestoreService | null>(null);
  const docIdRef = useRef<string | null>(null);
  const versionRef = useRef<number>(0);
  const suppressSaveRef = useRef<boolean>(false);
  const lastSavedSigRef = useRef<string>(topoStateSignature(EMPTY_TOPO_STATE));
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The level the derived contours are (re)built on — matches useTopoContours.
  const levelId = currentLevelId || '0';
  const levelIdRef = useRef(levelId);
  levelIdRef.current = levelId;

  const scopeKey =
    companyId && projectId && (floorId || floorplanId) && userId
      ? `${companyId}|${projectId}|${floorId ?? floorplanId}`
      : null;

  /** Silent scene write (no autosave, no undo) for the regenerated products. */
  const commitScene = useCallback(
    (scene: Parameters<typeof setLevelScene>[1]) =>
      setLevelScene(levelIdRef.current, scene, 'system-reconcile'),
    [setLevelScene],
  );

  // Instantiate service when scope ready.
  useEffect(() => {
    const scope = resolveBimPersistenceScope({ companyId, projectId, userId, floorId, floorplanId });
    if (!scope) {
      serviceRef.current = null;
      setServiceReady(false);
      return;
    }
    serviceRef.current = createTopoSurfaceFirestoreService({
      companyId: scope.companyId,
      projectId: scope.projectId,
      floorplanId: scope.floorplanId,
      floorId: scope.floorId,
      userId: scope.userId,
    });
    setServiceReady(true);
  }, [companyId, projectId, floorplanId, floorId, userId]);

  // Restore a state into the stores (echo-guarded) then rebuild the derived contours.
  const applyAndRegenerate = useCallback((state: TopoPersistedState, docId: string | null, version: number, sig: string) => {
    suppressSaveRef.current = true;
    applyTopoState(state);
    docIdRef.current = docId;
    versionRef.current = version;
    lastSavedSigRef.current = sig;
    suppressSaveRef.current = false;
    regenerateTopoContours({ getScene: getLevelScene, commitScene, levelId: levelIdRef.current });
  }, [getLevelScene, commitScene]);

  // Hydrate from a Firestore doc (reads the offloaded blob when present).
  const hydrate = useCallback(async (doc: TopoSurfaceDoc) => {
    let state = docToTopoState(doc);
    if (doc.pointsStoragePath && serviceRef.current) {
      try {
        state = withSurfaces(state, await serviceRef.current.readSurfacesBlob(doc.pointsStoragePath));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'TOPO_BLOB_READ_ERROR');
        setSaveState('error');
        return;
      }
    }
    const incomingSig = topoStateSignature(state);
    if (incomingSig === lastSavedSigRef.current && docIdRef.current === doc.id) return; // our echo
    applyAndRegenerate(state, doc.id, doc.version, incomingSig);
  }, [applyAndRegenerate]);

  // Subscribe + per-floor reset (+ flush-on-ready for a survey imported pre-scope).
  useEffect(() => {
    const svc = serviceRef.current;
    if (!svc || !scopeKey) return;

    // Capture a survey imported before the scope was ready (never persisted yet).
    const pending = collectTopoState();
    const hasPending = !isEmptyTopoState(pending);

    // Per-floor reset — start from a clean survey for the new storey.
    applyAndRegenerate(EMPTY_TOPO_STATE, null, 0, topoStateSignature(EMPTY_TOPO_STATE));

    let settled = false;
    const unsubscribe = svc.subscribeTopo(
      (docs) => {
        if (docs.length > 0) {
          settled = true; // remote wins — drop pre-scope pending
          void hydrate(docs[0]);
          return;
        }
        if (hasPending && !settled && docIdRef.current === null) {
          settled = true; // no remote doc: keep the pre-scope survey so the save persists it
          applyAndRegenerate(pending, null, 0, topoStateSignature(pending));
        }
      },
      (err) => { setError(err.message); setSaveState('error'); },
    );
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, serviceReady, hydrate, applyAndRegenerate]);

  // Persist current store state (debounced caller).
  const doSave = useCallback(async () => {
    const svc = serviceRef.current;
    if (!svc) return;
    const state = collectTopoState();
    if (!docIdRef.current && isEmptyTopoState(state)) return; // never create an empty doc
    const sig = topoStateSignature(state);
    if (sig === lastSavedSigRef.current) return; // no-op
    const nextVersion = versionRef.current + 1;
    setSaveState('saving');
    setError(null);
    try {
      if (docIdRef.current) {
        await svc.updateTopo(docIdRef.current, { state, version: nextVersion });
      } else {
        docIdRef.current = await svc.createTopo({ state, version: nextVersion });
      }
      versionRef.current = nextVersion;
      lastSavedSigRef.current = sig;
      setSaveState('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'TOPO_SAVE_ERROR');
      setSaveState('error');
    }
  }, []);

  // Subscribe to EVERY topo store → debounced save (skipped during hydrate/reset).
  useEffect(() => {
    const scheduleSave = () => {
      if (suppressSaveRef.current) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => void doSave(), SAVE_DEBOUNCE_MS);
    };
    const unsubs = [
      subscribeTopo(scheduleSave),
      subscribeContourConfig(scheduleSave),
      subscribeContourDisplay(scheduleSave),
      subscribeTerrain3D(scheduleSave),
      subscribeCutFill(scheduleSave),
    ];
    return () => {
      for (const u of unsubs) u();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [doSave]);

  return useMemo(() => ({ saveState, error }), [saveState, error]);
}
