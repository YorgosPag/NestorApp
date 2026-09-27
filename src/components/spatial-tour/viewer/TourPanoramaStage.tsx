'use client';

/**
 * @fileoverview **Η ΣΚΗΝΗ ΤΟΥ ΠΑΝΟΡΑΜΑΤΟΣ** — καμβάς + είσοδος + κουμπιά συνδέσμων πάνω στην εικόνα + μεγέθυνση
 * (ADR-884 Φ1 · §4.8).
 * @related `useTourPanoramaEngine.ts` · `useTourNavigation.ts` · `useTourPanoramaInput.ts` · `TourViewer.tsx` (κάτοχος)
 * @module components/spatial-tour/viewer/TourPanoramaStage
 *
 * 🔑 **Οι σύνδεσμοι είναι πραγματικά `<button>`** πάνω από τον καμβά (Tab · Enter · `aria-label`), όχι σχέδια μέσα στο
 *   WebGL όπως στα PSV/Pannellum — προσβάσιμοι σε πληκτρολόγιο και αναγνώστη οθόνης.
 * 🔑 **Η θέση τους γράφεται imperative σε κάθε καρέ** (`engine.onFrame`), όχι με React state: 60 re-render/δευτ. για
 *   να κουνηθεί ένα κουμπί είναι το αντι-πρότυπο που το ADR-040 απαγορεύει. Κουμπί πίσω από τον θεατή ⇒ `hidden`.
 * ✏️ **Οθόνη τοποθέτησης** (Φ2δ · §4.10): με `editing` τα βελάκια **σέρνονται** και ένα στόχαστρο δείχνει το κέντρο· τα
 *   εργαλεία του υπευθύνου παίρνουν ένα {@link TourStageAim} — «ποια διόπτευση είναι κάτω από αυτό το σημείο;». Η ΙΔΙΑ
 *   σκηνή, όχι αντίγραφο.
 */

import { type Dispatch, type ReactNode, type RefObject, useCallback, useEffect, useMemo, useRef } from 'react';
import { Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { degToRad } from '@/lib/geometry/angle';
import { viewBearing, yawForBearing } from '@/lib/spatial-tour/viewer/tour-viewer-bearing';
import type { TourViewerGraph, ViewerNeighbour } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import type { TourViewerAction, TourViewerState } from '@/lib/spatial-tour/viewer/tour-viewer-state';
import { viewAfterZoomStep } from '@/lib/spatial-tour/viewer/tour-viewer-view';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { TOUR_VIEWER_KEYS } from './tour-viewer-labels';
import { setCameraView, type TourCameraStore } from './tour-camera-store';
import type { TourPanoramaEngine } from './tour-panorama-engine';
import type { TourPanoramaSource } from './tour-panorama-source';
import { TourLinkButton } from './TourLinkButton';
import { useTourNavigation, type TourPanoramaStatus } from './useTourNavigation';
import { useTourPanoramaEngine } from './useTourPanoramaEngine';
import { useTourPanoramaInput } from './useTourPanoramaInput';
import { useNeighbourLabels } from './TourViewerNavigation';

/** Τα κουμπιά συνδέσμων κάθονται λίγο κάτω από τον ορίζοντα — «στο πάτωμα», όπως οι κύκλοι της Matterport. */
const LINK_PITCH = degToRad(-18);

/** «Ποια διόπτευση κόσμου είναι εκεί;» — ό,τι χρειάζονται τα εργαλεία βελακιών, χωρίς να δουν τη μηχανή. */
export interface TourStageAim {
  /** Κάτω από ένα σημείο της οθόνης — `null` έξω από την εικόνα ή πριν φορτώσει η μηχανή. */
  readonly bearingAtClient: (clientX: number, clientY: number) => number | null;
  /** Στο κέντρο της εικόνας — το στόχαστρο (η εναλλακτική ενός κλικ, WCAG 2.5.7). */
  readonly centerBearing: () => number | null;
}

export interface TourStageEditing {
  readonly onPlaceArrow: (toNodeId: string, bearingRad: number) => void;
  readonly renderTools: (aim: TourStageAim) => ReactNode;
}

export interface TourPanoramaStageProps {
  readonly graph: TourViewerGraph;
  readonly state: TourViewerState;
  readonly dispatch: Dispatch<TourViewerAction>;
  readonly camera: TourCameraStore;
  readonly source: TourPanoramaSource;
  readonly neighbours: readonly ViewerNeighbour[];
  /** Παρόν μόνο στην οθόνη τοποθέτησης του υπευθύνου. */
  readonly editing?: TourStageEditing;
}

function usePlaceLinkButtons(
  engine: TourPanoramaEngine | null,
  buttons: Map<string, HTMLButtonElement>,
  neighbours: readonly ViewerNeighbour[],
  headingRad: number,
): void {
  useEffect(() => {
    if (engine === null) return;
    const place = () => {
      for (const n of neighbours) {
        const el = buttons.get(n.nodeId);
        // Το βελάκι που σέρνεται ακολουθεί τον δείκτη — το καρέ δεν το ξαναβάζει πίσω.
        if (el === undefined || n.bearing === null || el.dataset.dragging === 'true') continue;
        const at = engine.project(yawForBearing(headingRad, n.bearing), LINK_PITCH);
        el.hidden = at === null;
        if (at !== null) el.style.transform = `translate(${at.x}px, ${at.y}px) translate(-50%, -50%)`;
      }
    };
    place();
    return engine.onFrame(place);
  }, [engine, buttons, neighbours, headingRad]);
}

function useStageAim(
  engine: TourPanoramaEngine | null,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  camera: TourCameraStore,
  headingRad: number,
): TourStageAim {
  return useMemo(() => ({
    bearingAtClient: (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (engine === null || rect === undefined) return null;
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
      return viewBearing(headingRad, engine.unproject(x, y).yaw);
    },
    centerBearing: () => (engine === null ? null : viewBearing(headingRad, camera.get().view.yaw)),
  }), [engine, canvasRef, camera, headingRad]);
}

function StageStatus({ status }: { readonly status: TourPanoramaStatus }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  if (status === 'ready') return null;
  return status === 'loading'
    ? <p role="status" className="absolute inset-x-0 top-3 mx-auto w-fit rounded-md bg-background/80 px-3 py-1 text-sm text-foreground">{t(TOUR_VIEWER_KEYS.loading)}</p>
    : <p role="alert" className="absolute inset-x-0 top-3 mx-auto w-fit rounded-md bg-background/90 px-3 py-1 text-sm text-destructive">{t(TOUR_VIEWER_KEYS.loadFailed)}</p>;
}

function EditingReticle() {
  return <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow ring-2 ring-ring" />;
}

function ZoomMenu({ camera }: { readonly camera: TourCameraStore }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const zoom = (direction: 'in' | 'out') => setCameraView(camera, viewAfterZoomStep(camera.get().view, direction));
  return (
    <menu className="absolute right-3 top-3 m-0 flex list-none flex-col gap-1 p-0">
      <li><Button type="button" size="icon-sm" variant="secondary" aria-label={t(TOUR_VIEWER_KEYS.zoomIn)} onClick={() => zoom('in')}><Plus aria-hidden className="h-4 w-4" /></Button></li>
      <li><Button type="button" size="icon-sm" variant="secondary" aria-label={t(TOUR_VIEWER_KEYS.zoomOut)} onClick={() => zoom('out')}><Minus aria-hidden className="h-4 w-4" /></Button></li>
    </menu>
  );
}

export function TourPanoramaStage({ graph, state, dispatch, camera, source, neighbours, editing }: TourPanoramaStageProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>()).current;
  const engine = useTourPanoramaEngine(canvasRef, camera);
  const ctx = useMemo(() => (engine === null ? null : { engine, camera, source }), [engine, camera, source]);
  const status = useTourNavigation(ctx, graph, state, dispatch);
  useTourPanoramaInput(canvasRef, camera);
  const current = state.nodeId === null ? undefined : graph.stops.get(state.nodeId);
  const headingRad = current?.stop.headingRad ?? 0;
  usePlaceLinkButtons(engine, buttons, neighbours, headingRad);
  const aim = useStageAim(engine, canvasRef, camera, headingRad);
  const labelsOf = useNeighbourLabels(graph.levels, current?.levelId ?? null);
  const register = useCallback((nodeId: string) => (el: HTMLButtonElement | null) => {
    if (el === null) buttons.delete(nodeId); else buttons.set(nodeId, el);
  }, [buttons]);
  const dropOf = (nodeId: string) => (editing === undefined ? undefined : (x: number, y: number) => {
    const bearing = aim.bearingAtClient(x, y);
    if (bearing !== null) editing.onPlaceArrow(nodeId, bearing);
  });

  return (
    <>
      <figure className="relative m-0 aspect-video w-full overflow-hidden rounded-lg bg-muted">
        <canvas ref={canvasRef} tabIndex={0} role="application" aria-label={t(TOUR_VIEWER_KEYS.panorama)}
          className="absolute inset-0 h-full w-full cursor-grab touch-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing" />
        {neighbours.filter((n) => n.bearing !== null).map((n) => (
          <TourLinkButton key={n.nodeId} label={labelsOf(n)} register={register(n.nodeId)}
            onGo={() => dispatch({ kind: 'go', nodeId: n.nodeId })} onDrop={dropOf(n.nodeId)} />
        ))}
        {editing !== undefined && <EditingReticle />}
        <StageStatus status={status} />
        <ZoomMenu camera={camera} />
      </figure>
      {editing?.renderTools(aim)}
    </>
  );
}
