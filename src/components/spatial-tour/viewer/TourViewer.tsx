'use client';

/**
 * @fileoverview **Ο ΘΕΑΤΗΣ ΤΗΣ ΠΕΡΙΗΓΗΣΗΣ** — πανόραμα + κάτοψη με κώνο + όροφοι + επόμενα σημεία, πάνω στο μανιφέστο
 * (ADR-884 Φ1 · §4.8 · Α2).
 * @related `TourViewerLoader.tsx` (η σύνδεση με τις σελίδες μέσω `TourViewSurface`, Φ2γ) ·
 *   `lib/spatial-tour/viewer/*` (όλη η λογική, καθαρή) · `demo/*` (εικονικά δεδομένα, `/test-harness/tour-viewer`)
 * @module components/spatial-tour/viewer/TourViewer
 *
 * 🔑 **Ο όροφος ΠΑΡΑΓΕΤΑΙ από τον κόμβο** — καμία δεύτερη κατάσταση «τρέχων όροφος» που θα μπορούσε να διαφωνήσει.
 * 🔑 **Χωρίς WebGL** ⇒ εξήγηση + λίστα σημείων ανά όροφο, ποτέ μαύρο κουτί (`lib/browser/webgl-support.ts`).
 * ⚠️ Φορτώνεται **μόνο** πίσω από `next/dynamic({ ssr: false })` — σέρνει το `three`.
 */

import { useCallback, useMemo, useReducer, useState } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isWebGLAvailable } from '@/lib/browser/webgl-support';
import {
  buildViewerGraph, firstNodeOfLevel, initialNode, neighboursOf, type TourViewerGraph,
} from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import { initialViewerState, tourViewerReducer } from '@/lib/spatial-tour/viewer/tour-viewer-state';
import type { TourManifest } from '@/server/spatial-tour/tour-view-session';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { VIEWER_KEYS } from '../tour-access-labels';
import { TOUR_VIEWER_KEYS } from './tour-viewer-labels';
import { createTourCameraStore } from './tour-camera-store';
import type { TourPanoramaSource } from './tour-panorama-source';
import { TourPanoramaStage } from './TourPanoramaStage';
import { TourPlanMap } from './TourPlanMap';
import { TourFloorSwitcher, TourNearbyList, useLevelLabel } from './TourViewerNavigation';

export interface TourViewerProps {
  readonly manifest: Pick<TourManifest, 'nodes' | 'stops' | 'levels'>;
  readonly source: TourPanoramaSource;
}

function TourViewerWithoutWebGL({ graph }: { readonly graph: TourViewerGraph }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const labelOf = useLevelLabel();
  return (
    <section className="space-y-2" aria-label={t(VIEWER_KEYS.title)}>
      <p role="status" className="text-sm text-muted-foreground">{t(TOUR_VIEWER_KEYS.noWebgl)}</p>
      {graph.levels.map((level) => (
        <section key={level.id} aria-label={labelOf(level)}>
          <h2 className="text-sm font-medium">{labelOf(level)}</h2>
          <ul className="m-0 list-disc pl-5 text-sm">
            {level.nodeIds.map((id) => <li key={id}>{t(TOUR_VIEWER_KEYS.point, { number: graph.stops.get(id)?.number ?? 0 })}</li>)}
          </ul>
        </section>
      ))}
    </section>
  );
}

export function TourViewer({ manifest, source }: TourViewerProps) {
  const graph = useMemo(() => buildViewerGraph(manifest, manifest.levels), [manifest]);
  const [webgl] = useState(isWebGLAvailable);
  if (!webgl) return <TourViewerWithoutWebGL graph={graph} />;
  return <TourViewerLive graph={graph} source={source} />;
}

function TourViewerLive({ graph, source }: { readonly graph: TourViewerGraph; readonly source: TourPanoramaSource }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const [state, dispatch] = useReducer(tourViewerReducer, graph, (g) => initialViewerState(initialNode(g)));
  const [camera] = useState(createTourCameraStore);
  const current = state.nodeId === null ? undefined : graph.stops.get(state.nodeId);
  const level = graph.levels.find((l) => l.id === current?.levelId);
  const neighbours = useMemo(() => (state.nodeId === null ? [] : neighboursOf(graph, state.nodeId)), [graph, state.nodeId]);
  const go = useCallback((nodeId: string) => dispatch({ kind: 'go', nodeId }), []);
  const selectLevel = useCallback((levelId: string) => {
    const nodeId = firstNodeOfLevel(graph, levelId);
    if (nodeId !== null) dispatch({ kind: 'go', nodeId });
  }, [graph]);

  return (
    <section className="space-y-3" aria-label={t(VIEWER_KEYS.title)}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <TourFloorSwitcher levels={graph.levels} currentLevelId={level?.id ?? null} onSelect={selectLevel} />
        {current !== undefined && (
          <p className="m-0 text-sm text-muted-foreground" aria-live="polite">{t(TOUR_VIEWER_KEYS.youAreHere, { number: current.number })}</p>
        )}
      </header>
      <section className="relative">
        <TourPanoramaStage graph={graph} state={state} dispatch={dispatch} camera={camera} source={source} neighbours={neighbours} />
        {level?.hasPlan && (
          <aside aria-label={t(TOUR_VIEWER_KEYS.plan)} className="absolute bottom-3 left-3 h-32 w-40 rounded-md border border-border bg-card/90 p-1 shadow sm:h-40 sm:w-52">
            <TourPlanMap graph={graph} level={level} currentNodeId={state.nodeId} camera={camera} onGo={go} />
          </aside>
        )}
      </section>
      <TourNearbyList neighbours={neighbours} levels={graph.levels} currentLevelId={level?.id ?? null} onGo={go} />
    </section>
  );
}
