'use client';

/**
 * ADR-650 — Topographic surface-definition Firestore persistence React adapter.
 *
 * Bridges `TopoSurfaceFirestoreService` to the five topo stores (survey / contour
 * config / contour display / 3D / cut-fill). SITE-level (one terrain per project)
 * model — the terrain is an `IfcSite` object visible on every storey, NOT per-floor:
 *   - **Load**: subscribe on `projectId` → hydrate (apply state to stores →
 *     REGENERATE contours onto the active level).
 *   - **Save**: any topo store change → debounced `setDoc`/`updateDoc`.
 *   - **Show on every storey**: the subscription does NOT re-key per floor (the survey
 *     stays loaded). A separate level-change effect re-regenerates the contours onto the
 *     newly-active level's scene so the terrain appears on foundation, ground floor and
 *     every other level (Revit Toposurface / Civil 3D surface: one site object, shown
 *     everywhere).
 *
 * `floorId`/`floorplanId` are still stamped on the doc, but only as provenance (which
 * storey/file the survey was captured on), never the scope key.
 *
 * Anti-echo: the signature of the last save is compared to the incoming doc so our own
 * write returning does NOT re-apply + re-regenerate (loop guard).
 *
 * @see ../../systems/topography/persistence/topo-firestore-service.ts
 * @see ../../systems/topography/persistence/regenerate-topo.ts
 * @see ../../bim/persistence/bim-floor-scope.ts — buildProjectScopeConstraints
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DXF_TIMING } from '../../config/dxf-timing';
import { useLevels } from '../../systems/levels';
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
  /** ADR-650 — SITE-level scope key (one terrain per project). */
  readonly projectId: string | null | undefined;
  /** Provenance only — the source DXF FileRecord id the survey was captured on. */
  readonly floorplanId: string | null | undefined;
  /** Provenance only — the building-storey (`flr_*`) the survey was captured on. */
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
  const { currentLevelId, sceneLoading, getLevelScene, setLevelScene } = useLevels();

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

  // Provenance stamped on the doc at CREATE only (never the scope key). Mirror the
  // durable floorId into the file slot for a storey with no DXF file yet (rules
  // require floorplanId). Kept in a ref so it never re-instantiates the service.
  const provenanceRef = useRef<{ floorplanId: string; floorId?: string } | null>(null);
  const provFile = floorplanId || floorId || null;
  provenanceRef.current = provFile
    ? { floorplanId: provFile, ...(floorId ? { floorId } : {}) }
    : null;

  // SITE-level scope: one terrain per project → the key does NOT change per floor.
  const scopeKey =
    companyId && projectId && userId ? `${companyId}|${projectId}` : null;

  /** Silent scene write (no autosave, no undo) for the regenerated products. */
  const commitScene = useCallback(
    (scene: Parameters<typeof setLevelScene>[1]) =>
      setLevelScene(levelIdRef.current, scene, 'system-reconcile'),
    [setLevelScene],
  );

  // Instantiate service when the SITE scope (company/project/user) is ready.
  useEffect(() => {
    if (!companyId || !projectId || !userId) {
      serviceRef.current = null;
      setServiceReady(false);
      return;
    }
    serviceRef.current = createTopoSurfaceFirestoreService({ companyId, projectId, userId });
    setServiceReady(true);
  }, [companyId, projectId, userId]);

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

  // Subscribe + per-project reset (+ flush-on-ready for a survey imported pre-scope).
  // Re-runs only when the SITE scope (project) changes — never on a floor switch.
  useEffect(() => {
    const svc = serviceRef.current;
    if (!svc || !scopeKey) return;

    // Capture a survey imported before the scope was ready (never persisted yet).
    const pending = collectTopoState();
    const hasPending = !isEmptyTopoState(pending);

    // Per-project reset — start from a clean survey for the new project/site.
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

  // Show the SITE terrain on EVERY storey: when the active level changes (and its
  // scene has finished loading), rebuild the contours onto that level's scene from
  // the already-loaded project survey. Idempotent (regenerate clears stale contours
  // first) and silent (`system-reconcile` → no autosave/undo, no topo-store mutation
  // → no save echo). The write touches neither `levelId` nor `sceneLoading`, so it
  // never re-triggers this effect (no loop).
  useEffect(() => {
    if (!scopeKey || sceneLoading) return;
    regenerateTopoContours({ getScene: getLevelScene, commitScene, levelId });
  }, [levelId, sceneLoading, scopeKey, getLevelScene, commitScene]);

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
        docIdRef.current = await svc.createTopo({
          state,
          version: nextVersion,
          provenance: provenanceRef.current ?? undefined,
        });
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
