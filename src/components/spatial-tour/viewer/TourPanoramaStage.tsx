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
 * 🏆 **Πάτωμα** (Φ2στ-γ · §4.14, πρότυπο Zillow 3D Home): βελάκια **ξαπλωμένα** στο πάτωμα, κουκκίδα κέρσορα, πάτημα στο
 *   πάτωμα ⇒ η πλησιέστερη συνδεδεμένη στάση (`useTourFloorOverlay.ts`). Κουκκίδα και πάτημα **μόνο** στη θέαση — στην οθόνη
 *   τοποθέτησης ο καμβάς ανήκει στα εργαλεία του υπευθύνου.
 * 🧩 **Ροή πλακιδίων** (Φ2ε · §4.11): η σκηνή κατέχει τον streamer (`useTourTileStreamer`) και τον δίνει στην πλοήγηση·
 *   πρόθεση στο βελάκι (hover/focus) ⇒ προφόρτωση των πλακιδίων της **θέασης άφιξης** (`arrivalFrameOf`).
 */

import { type Dispatch, type ReactNode, type RefObject, useCallback, useMemo, useRef } from 'react';
import { Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { viewBearing } from '@/lib/spatial-tour/viewer/tour-viewer-bearing';
import type { TourViewerGraph, ViewerNeighbour } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import type { TourViewerAction, TourViewerState } from '@/lib/spatial-tour/viewer/tour-viewer-state';
import { viewAfterZoomStep } from '@/lib/spatial-tour/viewer/tour-viewer-view';
import { redactionCellRad, type PackedRedactionPreview } from '@/lib/spatial-tour/viewer/tour-redaction-preview';
import type { TourManifestStop } from '@/lib/spatial-tour/tour-manifest-stop';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { TOUR_VIEWER_KEYS } from './tour-viewer-labels';
import { setCameraView, type TourCameraStore } from './tour-camera-store';
import type { ScreenPoint, TourPanoramaEngine } from './tour-panorama-engine';
import type { TourPanoramaSource } from './tour-panorama-source';
import { TourFloorCursor } from './TourFloorCursor';
import { TourLinkButton } from './TourLinkButton';
import { floorCandidates, useFloorArrows, useFloorCursor, useFloorTap } from './useTourFloorOverlay';
import { useTourNavigation, type TourPanoramaStatus } from './useTourNavigation';
import { tourStopKey } from './tour-tile-streamer';
import { useArrivalPrefetch, usePrefetchNeighbourBases, useTourTileStreamer } from './useTourTileStreamer';
import { useTourPanoramaEngine } from './useTourPanoramaEngine';
import { useTourPanoramaInput } from './useTourPanoramaInput';
import { useNeighbourLabels } from './TourViewerNavigation';

/** «Ποια διόπτευση κόσμου είναι εκεί;» — ό,τι χρειάζονται τα εργαλεία βελακιών, χωρίς να δουν τη μηχανή. */
export interface TourStageAim {
  /** Κάτω από ένα σημείο της οθόνης — `null` έξω από την εικόνα ή πριν φορτώσει η μηχανή. */
  readonly bearingAtClient: (clientX: number, clientY: number) => number | null;
  /** Στο κέντρο της εικόνας — το στόχαστρο (η εναλλακτική ενός κλικ, WCAG 2.5.7). */
  readonly centerBearing: () => number | null;
}

/** Κατεύθυνση σε συντεταγμένες **πανοράματος** (yaw 0 = κέντρο της εικόνας, ανεξάρτητο από το heading — Φ2ζ). */
export interface PanoramaDirection {
  readonly yaw: number;
  readonly pitch: number;
}

/**
 * **Η σκηνή για τα εργαλεία που ζωγραφίζουν ΠΑΝΩ στη φωτογραφία** (Φ2ζ ζ3 — πινέλο θολώματος): προβολή και στις δύο κατευθύνσεις
 * σε συντεταγμένες πανοράματος, καρέ, προεπισκόπηση. Τα εργαλεία δεν βλέπουν τη μηχανή.
 */
export interface TourStageScene {
  /** Η στάση που δείχνει η σκηνή — `null` πριν φορτώσει. */
  readonly stop: { readonly captureId: string; readonly faceSize: number } | null;
  readonly camera: TourCameraStore;
  /** Κάτω από ένα σημείο της οθόνης — `null` έξω από την εικόνα ή πριν φορτώσει η μηχανή. */
  readonly panoramaAtClient: (clientX: number, clientY: number) => PanoramaDirection | null;
  readonly centerPanorama: () => PanoramaDirection | null;
  /** Θέση μέσα στη σκηνή (CSS px) — `null` πίσω από τον θεατή ή εκτός κάδρου. */
  readonly project: (direction: PanoramaDirection) => ScreenPoint;
  /** Ύψος της σκηνής (CSS px) — η κλίμακα του συρσίματος ματιάς. */
  readonly height: () => number;
  readonly onFrame: (listener: () => void) => () => void;
  readonly setRedactionPreview: (preview: PackedRedactionPreview) => void;
}

export interface TourStageEditing {
  readonly onPlaceArrow: (toNodeId: string, bearingRad: number) => void;
  readonly renderTools: (aim: TourStageAim, scene: TourStageScene) => ReactNode;
  /** Ό,τι ζει **μέσα** στο κάδρο, πάνω από τον καμβά (επιφάνεια πινέλου, λαβές). */
  readonly renderOverlay?: (scene: TourStageScene) => ReactNode;
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
  /** Η σκηνή γεμίζει τον γονέα της (θεατής σε πλήρες παράθυρο, Φ2στ) — αλλιώς κουτί 16:9 (επεξεργαστής). */
  readonly fill?: boolean;
}

/** **Η ΜΙΑ προβολή οθόνη → πανόραμα** — σε αυτήν χτίζονται και η διόπτευση των βελακιών και το πινέλο θολώματος. */
function panoramaAtClientOf(engine: TourPanoramaEngine | null, canvas: HTMLCanvasElement | null, clientX: number, clientY: number): PanoramaDirection | null {
  const rect = canvas?.getBoundingClientRect();
  if (engine === null || rect === undefined) return null;
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
  return engine.unproject(x, y);
}

function useStageAim(
  engine: TourPanoramaEngine | null,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  camera: TourCameraStore,
  headingRad: number,
): TourStageAim {
  return useMemo(() => ({
    bearingAtClient: (clientX: number, clientY: number) => {
      const at = panoramaAtClientOf(engine, canvasRef.current, clientX, clientY);
      return at === null ? null : viewBearing(headingRad, at.yaw);
    },
    centerBearing: () => (engine === null ? null : viewBearing(headingRad, camera.get().view.yaw)),
  }), [engine, canvasRef, camera, headingRad]);
}

const NO_UNSUBSCRIBE = () => undefined;

function useStageScene(
  engine: TourPanoramaEngine | null,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  camera: TourCameraStore,
  stop: TourManifestStop | undefined,
): TourStageScene {
  return useMemo(() => {
    const view = () => camera.get().view;
    return {
      stop: stop === undefined ? null : { captureId: stop.captureId, faceSize: stop.faceSize },
      camera,
      panoramaAtClient: (clientX: number, clientY: number) => panoramaAtClientOf(engine, canvasRef.current, clientX, clientY),
      centerPanorama: () => (engine === null ? null : { yaw: view().yaw, pitch: view().pitch }),
      project: (d: PanoramaDirection) => (engine === null ? null : engine.project(d.yaw, d.pitch)),
      height: () => canvasRef.current?.clientHeight ?? 0,
      onFrame: (listener: () => void) => (engine === null ? NO_UNSUBSCRIBE : engine.onFrame(listener)),
      setRedactionPreview: (preview: PackedRedactionPreview) => {
        if (engine !== null && stop !== undefined) engine.setRedactionPreview(tourStopKey(stop), preview, redactionCellRad(stop.faceSize));
      },
    };
  }, [engine, canvasRef, camera, stop]);
}

function StageStatus({ status }: { readonly status: TourPanoramaStatus }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  if (status === 'ready') return null;
  return status === 'loading'
    ? <p role="status" className="absolute inset-x-0 top-14 mx-auto w-fit rounded-md bg-background/80 px-3 py-1 text-sm text-foreground">{t(TOUR_VIEWER_KEYS.loading)}</p>
    : <p role="alert" className="absolute inset-x-0 top-14 mx-auto w-fit rounded-md bg-background/90 px-3 py-1 text-sm text-destructive">{t(TOUR_VIEWER_KEYS.loadFailed)}</p>;
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

/** Πάτωμα της σκηνής: βελάκια πάντα· κουκκίδα + πάτημα μόνο στη θέαση (όχι στην οθόνη τοποθέτησης). */
function useStageFloor(
  scene: { readonly engine: TourPanoramaEngine | null; readonly camera: TourCameraStore; readonly canvasRef: RefObject<HTMLCanvasElement | null> },
  parts: { readonly buttons: Map<string, HTMLButtonElement>; readonly cursorRef: RefObject<HTMLSpanElement | null> },
  stage: { readonly neighbours: readonly ViewerNeighbour[]; readonly headingRad: number; readonly moving: boolean; readonly viewing: boolean },
  actions: { readonly go: (nodeId: string) => void; readonly intentOf: (nodeId: string) => () => void },
) {
  const { neighbours, headingRad, moving, viewing } = stage;
  useFloorArrows(scene, parts.buttons, neighbours, headingRad, moving);
  const candidates = useMemo(() => floorCandidates(neighbours, headingRad), [neighbours, headingRad]);
  useFloorCursor({ engine: scene.engine, canvasRef: scene.canvasRef, cursorRef: parts.cursorRef, candidates, intentOf: actions.intentOf, enabled: viewing && !moving });
  const tap = useFloorTap(scene.engine, scene.canvasRef, candidates, actions.go);
  return viewing ? tap : undefined;
}

/** Τα κουμπιά συνδέσμων: καταχώριση για τη θέση τους ανά καρέ · άφεση βελακιού (μόνο στην οθόνη τοποθέτησης). */
function useLinkButtonWiring(buttons: Map<string, HTMLButtonElement>, aim: TourStageAim, editing: TourStageEditing | undefined) {
  const register = useCallback((nodeId: string) => (el: HTMLButtonElement | null) => {
    if (el === null) buttons.delete(nodeId); else buttons.set(nodeId, el);
  }, [buttons]);
  const dropOf = (nodeId: string) => (editing === undefined ? undefined : (x: number, y: number) => {
    const bearing = aim.bearingAtClient(x, y);
    if (bearing !== null) editing.onPlaceArrow(nodeId, bearing);
  });
  return { register, dropOf };
}

export function TourPanoramaStage({ graph, state, dispatch, camera, source, neighbours, editing, fill = false }: TourPanoramaStageProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorRef = useRef<HTMLSpanElement | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>()).current;
  const engine = useTourPanoramaEngine(canvasRef, camera);
  const { streamer, ctx } = useTourTileStreamer(engine, camera, source);
  const status = useTourNavigation(ctx, graph, state, dispatch);
  const current = state.nodeId === null ? undefined : graph.stops.get(state.nodeId);
  const moving = state.targetNodeId !== null;
  usePrefetchNeighbourBases(streamer, graph, neighbours, status === 'ready' && !moving);
  const intentOf = useArrivalPrefetch(streamer, graph, current, camera);
  const headingRad = current?.stop.headingRad ?? 0;
  const go = useCallback((nodeId: string) => dispatch({ kind: 'go', nodeId }), [dispatch]);
  const tap = useStageFloor({ engine, camera, canvasRef }, { buttons, cursorRef }, { neighbours, headingRad, moving, viewing: editing === undefined }, { go, intentOf });
  useTourPanoramaInput(canvasRef, camera, tap);
  const aim = useStageAim(engine, canvasRef, camera, headingRad);
  const scene = useStageScene(engine, canvasRef, camera, current?.stop);
  const labelsOf = useNeighbourLabels(graph, current?.levelId ?? null);
  const { register, dropOf } = useLinkButtonWiring(buttons, aim, editing);

  return (
    <>
      <figure className={fill ? 'absolute inset-0 m-0 overflow-hidden bg-muted' : 'relative m-0 aspect-video w-full overflow-hidden rounded-lg bg-muted'}>
        <canvas ref={canvasRef} tabIndex={0} role="application" aria-label={t(TOUR_VIEWER_KEYS.panorama)}
          className="absolute inset-0 h-full w-full cursor-grab touch-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing" />
        <TourFloorCursor cursorRef={cursorRef} />
        {neighbours.filter((n) => n.bearing !== null).map((n) => (
          <TourLinkButton key={n.nodeId} label={labelsOf(n)} register={register(n.nodeId)}
            onGo={() => go(n.nodeId)} onDrop={dropOf(n.nodeId)} onIntent={intentOf(n.nodeId)} />
        ))}
        {editing !== undefined && <EditingReticle />}
        {editing?.renderOverlay?.(scene)}
        <StageStatus status={status} />
        <ZoomMenu camera={camera} />
      </figure>
      {editing?.renderTools(aim, scene)}
    </>
  );
}
