'use client';

/**
 * @fileoverview **ΟΙ ΔΥΟ ΧΩΡΟΙ ΕΡΓΑΣΙΑΣ** — ένα σημείο της περιήγησης με τα βελάκια του, ή ένα πανόραμα των εισερχομένων
 * πριν αποφασιστεί πού πάει (ADR-884 Φ2δ · §4.10).
 * @related `viewer/TourPanoramaStage.tsx` (η ΙΔΙΑ σκηνή με τον θεατή) · `TourArrowTools.tsx` · `TourPlacementForm.tsx`
 * @module components/spatial-tour/editor/TourEditorWorkspaces
 *
 * 🔑 **Κάθε χώρος έχει δικό του reducer και δική του κάμερα**: η προεπισκόπηση δεν είναι σημείο του γράφου — μια
 *   «μετάβαση» από εκεί σε σημείο θα έδειχνε κίνηση που δεν υπάρχει στην περιήγηση.
 * 🔑 **Επιλογή από τη στήλη = `go`**, **βελάκι μέσα στη φωτογραφία = `go`**: ένας δρόμος, και η στήλη ακολουθεί
 *   (`onArrive`) — ποτέ δύο πηγές για το «πού είμαι».
 */

import { type ReactNode, useEffect, useMemo, useReducer, useState } from 'react';

import type { TourPlacementTarget } from '@/lib/spatial-tour/tour-graph-edit';
import { neighboursOf, type TourViewerGraph, type TourViewerLevel } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import { initialViewerState, tourViewerReducer } from '@/lib/spatial-tour/viewer/tour-viewer-state';

import { createTourCameraStore } from '../viewer/tour-camera-store';
import type { TourPanoramaSource } from '../viewer/tour-panorama-source';
import { TourPanoramaStage, type TourStageAim } from '../viewer/TourPanoramaStage';
import { TourArrowTools } from './TourArrowTools';
import { TourPlacementForm } from './TourPlacementForm';

interface PointWorkspaceProps {
  readonly graph: TourViewerGraph;
  readonly source: TourPanoramaSource;
  readonly requestedNodeId: string;
  readonly onArrive: (nodeId: string) => void;
  readonly onPlaceArrow: (fromNodeId: string, toNodeId: string, bearingRad: number) => void;
  readonly onUnlink: (a: string, b: string) => void;
  /** Τα εργαλεία του σημείου κάτω από τα βελάκια (αφαίρεση πανοράματος). */
  readonly footer: (nodeId: string) => ReactNode;
}

export function TourPointWorkspace(props: PointWorkspaceProps) {
  const { graph, source, requestedNodeId, onArrive, onPlaceArrow, onUnlink, footer } = props;
  const [state, dispatch] = useReducer(tourViewerReducer, requestedNodeId, initialViewerState);
  const [camera] = useState(createTourCameraStore);
  useEffect(() => {
    if (requestedNodeId !== state.nodeId && requestedNodeId !== state.targetNodeId) dispatch({ kind: 'go', nodeId: requestedNodeId });
  }, [requestedNodeId, state.nodeId, state.targetNodeId]);
  useEffect(() => { if (state.nodeId !== null) onArrive(state.nodeId); }, [state.nodeId, onArrive]);
  const nodeId = state.nodeId;
  const neighbours = useMemo(() => (nodeId === null ? [] : neighboursOf(graph, nodeId)), [graph, nodeId]);
  const editing = useMemo(() => (nodeId === null ? undefined : {
    onPlaceArrow: (to: string, bearing: number) => onPlaceArrow(nodeId, to, bearing),
    renderTools: (aim: TourStageAim) => (
      <section className="space-y-3">
        <TourArrowTools aim={aim} graph={graph} nodeId={nodeId} onPlaceArrow={(to, bearing) => onPlaceArrow(nodeId, to, bearing)}
          onUnlink={(to) => onUnlink(nodeId, to)} />
        {footer(nodeId)}
      </section>
    ),
  }), [nodeId, graph, onPlaceArrow, onUnlink, footer]);
  return <TourPanoramaStage graph={graph} state={state} dispatch={dispatch} camera={camera} source={source} neighbours={neighbours} editing={editing} />;
}

interface PreviewWorkspaceProps {
  readonly preview: { readonly graph: TourViewerGraph; readonly nodeId: string };
  readonly source: TourPanoramaSource;
  readonly captureId: string;
  readonly levels: readonly TourViewerLevel[];
  /** Ο γράφος της περιήγησης — από εκεί διαλέγονται «δίπλα σε…» / «ίδιο σημείο με…». */
  readonly tourGraph: TourViewerGraph;
  readonly busy: boolean;
  readonly onPlace: (target: TourPlacementTarget) => void;
}

export function TourPreviewWorkspace({ preview, source, captureId, levels, tourGraph, busy, onPlace }: PreviewWorkspaceProps) {
  const [state, dispatch] = useReducer(tourViewerReducer, preview.nodeId, initialViewerState);
  const [camera] = useState(createTourCameraStore);
  return (
    <>
      <TourPanoramaStage graph={preview.graph} state={state} dispatch={dispatch} camera={camera} source={source} neighbours={[]} />
      <TourPlacementForm captureId={captureId} levels={levels} graph={tourGraph} busy={busy} onPlace={onPlace} />
    </>
  );
}
