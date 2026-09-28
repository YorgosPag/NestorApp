'use client';

/**
 * @fileoverview **Ο ΘΕΑΤΗΣ ΤΗΣ ΠΕΡΙΗΓΗΣΗΣ** — πανόραμα σε όλη την επιφάνεια + όνομα χώρου + στήλη ορόφων/σημείων, πάνω
 * στο μανιφέστο (ADR-884 Φ1 · §4.8 · Α2 · Φ2στ · §4.12).
 * @related `TourViewerLoader.tsx` (η σύνδεση με τις σελίδες μέσω `TourViewSurface`, Φ2γ) ·
 *   `lib/spatial-tour/viewer/*` (όλη η λογική, καθαρή) · `demo/*` (εικονικά δεδομένα, `/test-harness/tour-viewer`)
 * @module components/spatial-tour/viewer/TourViewer
 *
 * 🔑 **Ο όροφος ΠΑΡΑΓΕΤΑΙ από τον κόμβο** — καμία δεύτερη κατάσταση «τρέχων όροφος» που θα μπορούσε να διαφωνήσει.
 * 🔑 **Χωρίς WebGL** ⇒ εξήγηση + λίστα σημείων ανά όροφο, ποτέ μαύρο κουτί (`lib/browser/webgl-support.ts`).
 * 🏆 **Διάταξη Zillow 3D Home** (Φ2στ): η σκηνή γεμίζει ό,τι της δώσει ο γονέας· στην κορυφή το **όνομα του χώρου**·
 *   δεξιά **μόνιμη στήλη** (≥ lg) με όλους τους ορόφους — στο κινητό η ίδια στήλη σε `Sheet` πίσω από κουμπί.
 * ↔️ **Συρόμενη διαχωριστική** (Φ2στ-γ Γ2 · §4.14 σημείο 3): στήλη ή `Sheet` το αποφασίζει ο **χώρος του θεατή**
 *   (`useContainerClass`, 64rem), όχι το παράθυρο — και ακολουθεί το μέγεθος γραμματοσειράς του επισκέπτη (WCAG 1.4.4).
 * ⚠️ Φορτώνεται **μόνο** πίσω από `next/dynamic({ ssr: false })` — σέρνει το `three`.
 */

import { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import { MapIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useContainerClass } from '@/hooks/media/useContainerClass';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isWebGLAvailable } from '@/lib/browser/webgl-support';
import { buildViewerGraph, initialNode, neighboursOf, type TourViewerGraph } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import { initialViewerState, tourViewerReducer } from '@/lib/spatial-tour/viewer/tour-viewer-state';
import type { TourManifest } from '@/server/spatial-tour/tour-view-session';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { VIEWER_KEYS } from '../tour-access-labels';
import { TOUR_VIEWER_KEYS } from './tour-viewer-labels';
import { createTourCameraStore, type TourCameraStore } from './tour-camera-store';
import type { TourPanoramaSource } from './tour-panorama-source';
import { createTourPlanZoomStore, type TourPlanZoomStore } from './tour-plan-zoom-store';
import { TourPanoramaStage } from './TourPanoramaStage';
import { TourSidePanel } from './TourSidePanel';
import { TourViewerSplit } from './TourViewerSplit';
import { TourStopList, useLevelLabel } from './TourViewerNavigation';
import { useStopNames } from './useStopNames';

export interface TourViewerProps {
  readonly manifest: Pick<TourManifest, 'nodes' | 'stops' | 'levels'>;
  readonly source: TourPanoramaSource;
}

function TourViewerWithoutWebGL({ graph }: { readonly graph: TourViewerGraph }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const labelOf = useLevelLabel();
  return (
    <section className="space-y-2 p-4" aria-label={t(VIEWER_KEYS.title)}>
      <p role="status" className="text-sm text-muted-foreground">{t(TOUR_VIEWER_KEYS.noWebgl)}</p>
      {graph.levels.map((level) => (
        <section key={level.id} aria-label={labelOf(level)}>
          <h2 className="text-sm font-medium">{labelOf(level)}</h2>
          <TourStopList graph={graph} level={level} currentNodeId={null} />
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

interface PanelProps {
  readonly graph: TourViewerGraph;
  readonly currentNodeId: string | null;
  readonly camera: TourCameraStore;
  readonly onGo: (nodeId: string) => void;
  readonly source: TourPanoramaSource;
  readonly zoomStore: TourPlanZoomStore;
}

/** Στήλη δίπλα στο πανόραμα από αυτό το πλάτος του **θεατή** και πάνω (64rem = 1024 px στην προεπιλογή — το παλιό `lg`). */
const SPLIT_MIN_REM = 64;

/** Η στήλη στο κινητό — ίδιο περιεχόμενο με τη μόνιμη στήλη· κλείνει μόλις ο επισκέπτης διαλέξει σημείο. */
function MobilePanel({ onGo, ...panel }: PanelProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const [open, setOpen] = useState(false);
  const goAndClose = useCallback((nodeId: string) => { setOpen(false); onGo(nodeId); }, [onGo]);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" size="sm" variant="secondary" className="absolute bottom-3 right-3 gap-1 shadow">
          <MapIcon aria-hidden className="h-4 w-4" />{t(TOUR_VIEWER_KEYS.openPanel)}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[75svh] overflow-y-auto" aria-describedby={undefined}>
        <SheetTitle className="mb-2 text-base">{t(TOUR_VIEWER_KEYS.panelTitle)}</SheetTitle>
        <TourSidePanel {...panel} onGo={goAndClose} />
      </SheetContent>
    </Sheet>
  );
}

function TourViewerLive({ graph, source }: { readonly graph: TourViewerGraph; readonly source: TourPanoramaSource }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const [state, dispatch] = useReducer(tourViewerReducer, graph, (g) => initialViewerState(initialNode(g)));
  const [camera] = useState(createTourCameraStore);
  const [zoomStore] = useState(createTourPlanZoomStore);
  const root = useRef<HTMLElement | null>(null);
  const split = useContainerClass(root, SPLIT_MIN_REM) !== 'narrow';
  const nameOf = useStopNames(graph);
  const neighbours = useMemo(() => (state.nodeId === null ? [] : neighboursOf(graph, state.nodeId)), [graph, state.nodeId]);
  const go = useCallback((nodeId: string) => dispatch({ kind: 'go', nodeId }), []);
  const panel: PanelProps = { graph, currentNodeId: state.nodeId, camera, onGo: go, source, zoomStore };

  const stage = (
    <>
      <TourPanoramaStage graph={graph} state={state} dispatch={dispatch} camera={camera} source={source} neighbours={neighbours} fill />
      {state.nodeId !== null && (
        <h2 aria-live="polite"
          className="pointer-events-none absolute inset-x-0 top-3 m-0 mx-auto w-fit max-w-[70%] truncate rounded-md bg-background/75 px-3 py-1 text-base font-semibold text-foreground shadow">
          {nameOf(state.nodeId)}
        </h2>
      )}
    </>
  );

  return (
    <section ref={root} className="flex min-h-[28rem] flex-1 flex-col" aria-label={t(VIEWER_KEYS.title)}>
      {split ? (
        <TourViewerSplit stage={stage} column={<TourSidePanel {...panel} />} />
      ) : (
        <section className="relative min-h-0 flex-1">
          {stage}
          <MobilePanel {...panel} />
        </section>
      )}
    </section>
  );
}
