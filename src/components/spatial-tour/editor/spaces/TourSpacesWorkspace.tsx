'use client';

/**
 * @fileoverview **Ο ΧΩΡΟΣ ΕΡΓΑΣΙΑΣ «ΧΩΡΟΙ»** — πλήρης οθόνη ανά όροφο: κάτοψη με προτάσεις/χώρους/λαβές, εργαλεία, λίστα, πάνελ
 * (ADR-884 Φ2στ-γ Γ3γ-2β · §4.14 σημείο 4 · §12 Δ8 · Δ9.1 · πρότυπα Revit προβολή κάτοψης · Matterport Workshop · Figma).
 * @related `TourSpacesLauncher.tsx` (το φορτώνει πίσω από `next/dynamic`) · `TourSpacesMap.tsx` · `TourSpacePanel.tsx` ·
 *   `TourSpaceList.tsx` · `TourSpacesToolbar.tsx` · `useSpaceProposals.ts` · `useShapeEdit.ts` · `useSpacePen.ts`
 * @module components/spatial-tour/editor/spaces/TourSpacesWorkspace
 *
 * 🔑 **Κατάσταση ΑΝΑ άνοιγμα**: store επεξεργαστή + θέαση (ζουμ) ζουν όσο είναι ανοιχτό· κλείνεις ⇒ οι μη εγκεκριμένες προτάσεις
 *   ξεχνιούνται (είναι προτάσεις, όχι δεδομένα — Δ8.1), ανοίγεις ⇒ ξαναπροτείνονται.
 * 🔑 **Κλικ στην κάτοψη**: μέσα σε εγκεκριμένο χώρο ⇒ επιλογή του · μέσα σε πρόταση ⇒ επιλογή της · αλλού ⇒ νέα πρόταση εκεί
 *   (ArchiCAD «Inner Edge» / Revit Room: «κλικ μέσα στο δωμάτιο»).
 * 🔑 **Esc δεν κλείνει ό,τι είναι μισό**: με πένα ή πρόχειρες γωνίες, το Esc ακυρώνει **αυτά** — όχι όλη την οθόνη (ένας
 *   ιδιοκτήτης, το `onEscapeKeyDown` — βλ. `useWorkspaceKeys`).
 */

import { type KeyboardEvent, useCallback, useMemo, useRef, useState } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useElementSize } from '@/hooks/media/useElementSize';
import { useDecodedImageUrl } from '@/hooks/media/useDecodedImageUrl';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { pointInPolygon } from '@/lib/geometry/planar-polygon';
import { spaceAt, spaceCoverage } from '@/lib/spatial-tour/viewer/tour-space-view';
import { graphLevelsOfViewer, type TourViewerGraph, type TourViewerLevel, type ViewerLevelEntry } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import { imagePlanFrame, placedStops } from '@/lib/spatial-tour/viewer/tour-viewer-plan';
import { PLAN_FALLBACK_SURFACE_PX } from '@/lib/spatial-tour/viewer/tour-plan-zoom';
import type { TourLevelKey, TourNode } from '@/types/spatial-tour';

import { SPATIAL_TOUR_NS } from '../../spatial-tour-namespace';
import type { TourPanoramaSource } from '../../viewer/tour-panorama-source';
import { createTourPlanZoomStore, usePlanView } from '../../viewer/tour-plan-zoom-store';
import { TourPlanZoomBar } from '../../viewer/TourPlanZoomBar';
import type { TourEditorActions } from '../useTourEditorActions';
import { useSpaceDetector } from '../useSpaceDetector';
import { createSpaceEditorStore, selectTarget, updateSpaceEditor } from './space-editor-store';
import { SPACE_VERTEX_HINT_ID } from './TourSpaceHandles';
import { TOUR_SPACE_EDITOR_KEYS } from './tour-space-editor-labels';
import { TourSpaceList } from './TourSpaceList';
import { TourSpacePanel, type SpacePanelContext } from './TourSpacePanel';
import { TourSpacesMap } from './TourSpacesMap';
import { TourSpacesToolbar } from './TourSpacesToolbar';
import type { ShapeEditContext } from './useShapeEdit';
import { useSpaceMapReader } from './useSpaceMapReader';
import { useSpacePen } from './useSpacePen';
import { useSpaceProposals } from './useSpaceProposals';

/** Σκαλοπάτι μέτρησης της επιφάνειας (px) — ίδιο με την κάρτα του θεατή. */
const SIZE_STEP_PX = 4;
/** Κλικ τόσο κοντά σε σημείο λήψης (m) ⇒ η πρόταση «ανήκει» στο σημείο (κλειδί ανά σημείο, όχι ανά κλικ). */
const SEED_ON_STOP_M = 0.5;

export interface TourSpacesWorkspaceProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly graph: TourViewerGraph;
  readonly levelId: string;
  readonly levelKey: TourLevelKey;
  /** Τα δεδομένα του επεξεργαστή (για τον κριτή του προελέγχου — ο γράφος **με** σχήματα χώρων). */
  readonly nodes: readonly TourNode[];
  readonly levels: readonly TourViewerLevel[];
  readonly source: TourPanoramaSource;
  readonly actions: TourEditorActions;
  readonly nameOf: (nodeId: string) => string;
}

function useWorkspace(props: TourSpacesWorkspaceProps, level: ViewerLevelEntry) {
  const { source, actions, levelKey, nodes, levels, graph } = props;
  const plan = level.plan;
  const [store] = useState(createSpaceEditorStore);
  const [zoomStore] = useState(createTourPlanZoomStore);
  const stops = useMemo(() => placedStops(graph, level), [graph, level]);
  const placed = useMemo(() => stops.map((s) => ({ nodeId: s.entry.node.id, point: s.point })), [stops]);
  const frame = useMemo(() => imagePlanFrame(plan?.image ?? { width: 1, height: 1 }, plan?.metresPerPixel ?? null), [plan]);
  const planSize = useMemo(() => ({ width: frame.width, height: frame.height }), [frame]);
  const judgeGraph = useMemo(() => ({ nodes, levels: graphLevelsOfViewer(levels) }), [nodes, levels]);
  const reader = useSpaceMapReader(frame, zoomStore, level.id);
  const detector = useSpaceDetector(source, plan);
  const latest = useRef({ placed, level });
  latest.current = { placed, level };
  const proposals = useSpaceProposals(detector, store, {
    placed: () => latest.current.placed,
    missing: () => {
      const { placed: all, level: l } = latest.current;
      const missing = new Set(spaceCoverage(l.spaces, all).missing);
      return all.filter((p) => missing.has(p.nodeId));
    },
    separations: () => latest.current.level.separations.map(({ a, b }) => ({ a, b })),
    mintId: actions.newSpaceId,
  });
  const shape: ShapeEditContext = { store, levelKey, spaces: level.spaces, graph: judgeGraph, reader, planSize, actions };
  const pen = useSpacePen({ store, reader, spaces: level.spaces, planSize, mintId: actions.newSpaceId });
  const panel: SpacePanelContext = {
    store, levelKey, spaces: level.spaces, separations: level.separations, stops, nameOf: props.nameOf, graph: judgeGraph, actions, proposals,
  };
  return { store, zoomStore, stops, frame, reader, proposals, shape, pen, panel };
}

type Workspace = ReturnType<typeof useWorkspace>;

/** Κλικ με το εργαλείο «Επιλογή»: χώρος ⇒ επιλογή · πρόταση ⇒ επιλογή · αλλού ⇒ νέα πρόταση (στο σημείο λήψης, αν είναι εκεί). */
function useMapClick(ws: Workspace, level: ViewerLevelEntry) {
  return useCallback((clientX: number, clientY: number) => {
    const reading = ws.reader.read(clientX, clientY);
    if (reading === null) return;
    const at = reading.point;
    const space = spaceAt(level.spaces, at);
    const proposal = ws.store.get().proposals.find((p) => pointInPolygon(at, p.outline));
    if (space !== null || proposal !== undefined) {
      const target = space !== null ? { kind: 'space' as const, id: space.id } : { kind: 'proposal' as const, key: proposal?.key ?? '' };
      updateSpaceEditor(ws.store, (s) => selectTarget(s, target));
      return;
    }
    const stop = ws.stops.find((s) => Math.hypot(s.point.x - at.x, s.point.y - at.y) <= SEED_ON_STOP_M);
    void ws.proposals.detectAt(stop === undefined ? at : { x: stop.point.x, y: stop.point.y }, stop?.entry.node.id ?? null);
  }, [ws, level.spaces]);
}

function SpacesSurface({ ws, level, source, nameOf }: {
  readonly ws: Workspace; readonly level: ViewerLevelEntry; readonly source: TourPanoramaSource; readonly nameOf: (id: string) => string;
}) {
  const box = useRef<HTMLElement | null>(null);
  const surface = useElementSize(box, SIZE_STEP_PX);
  const view = usePlanView(ws.zoomStore, level.id);
  const wanted = level.plan === null ? null : source.planImageUrl(level.plan, (surface.width || PLAN_FALLBACK_SURFACE_PX) * view.zoom);
  const imageUrl = useDecodedImageUrl(wanted);
  const onMapClick = useMapClick(ws, level);
  return (
    <figure ref={box} className="m-0 min-h-[50vh] overflow-hidden rounded-md border border-border bg-muted lg:min-h-0">
      {imageUrl !== null && (
        <TourSpacesMap level={level} stops={ws.stops} imageUrl={imageUrl} frame={ws.frame} surface={surface} zoomStore={ws.zoomStore}
          store={ws.store} reader={ws.reader} shape={ws.shape} pen={ws.pen} nameOf={nameOf} onMapClick={onMapClick} />
      )}
    </figure>
  );
}

/**
 * **Το Esc έχει ΕΝΑΝ ιδιοκτήτη: το `onEscapeKeyDown` του διαλόγου.** Ο listener του Radix είναι στη φάση **capture** του
 * document — τρέχει ΠΡΙΝ από κάθε χειριστή του React, άρα ένα `stopPropagation` σε λαβή ή στην πένα δεν τον σταματά ποτέ
 * (μετρήθηκε: Esc με άδεια πένα έκλεινε όλη την οθόνη). Σειρά: πένα (γωνίες ⇒ άδειασμα · άδεια ⇒ έξοδος από την πένα) ⇒
 * πρόχειρες γωνίες εγκεκριμένου χώρου (ακύρωση) ⇒ μόνο τότε κλείσιμο. Enter/Backspace της πένας: στο `onKeyDown`.
 */
function useWorkspaceKeys(ws: Workspace) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (ws.store.get().tool !== 'pen' || event.target instanceof HTMLInputElement) return;
    if (ws.pen.key(event.key)) event.preventDefault();
  };
  const onEscapeKeyDown = (event: globalThis.KeyboardEvent) => {
    const state = ws.store.get();
    if (state.tool === 'pen') {
      event.preventDefault();
      ws.pen.cancel();
    } else if (state.edit !== null) {
      event.preventDefault();
      updateSpaceEditor(ws.store, (s) => ({ ...s, edit: null }));
    }
  };
  return { onKeyDown, onEscapeKeyDown };
}

function WorkspaceBody({ props, level }: { readonly props: TourSpacesWorkspaceProps; readonly level: ViewerLevelEntry }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const ws = useWorkspace(props, level);
  const keys = useWorkspaceKeys(ws);
  return (
    <DialogContent size="fullscreen" className="flex flex-col gap-3 p-4" onKeyDown={keys.onKeyDown} onEscapeKeyDown={keys.onEscapeKeyDown}>
      <header className="space-y-1">
        <DialogTitle className="m-0 text-base">{t(TOUR_SPACE_EDITOR_KEYS.title)}</DialogTitle>
        <DialogDescription className="m-0 text-sm">{t(TOUR_SPACE_EDITOR_KEYS.description)}</DialogDescription>
      </header>
      <TourSpacesToolbar store={ws.store} onDoorChange={() => void ws.proposals.redetectSelected()} />
      <section className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="flex min-h-0 flex-col gap-1">
          <SpacesSurface ws={ws} level={level} source={props.source} nameOf={props.nameOf} />
          <TourPlanZoomBar levelId={level.id} frame={ws.frame} store={ws.zoomStore} />
        </section>
        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <TourSpaceList store={ws.store} spaces={level.spaces} stops={ws.stops} nameOf={props.nameOf} />
          <TourSpacePanel ctx={ws.panel} />
        </aside>
      </section>
      <p id={SPACE_VERTEX_HINT_ID} className="sr-only">{t(TOUR_SPACE_EDITOR_KEYS.vertexHint)}</p>
    </DialogContent>
  );
}

/** Φορτώνεται **μόνο** πίσω από `next/dynamic` (`TourSpacesLauncher`) — ο Worker και τα εργαλεία δεν μπαίνουν στο αρχικό πακέτο. */
export function TourSpacesWorkspace(props: TourSpacesWorkspaceProps) {
  const level = props.graph.levels.find((l) => l.id === props.levelId);
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open && level !== undefined && level.plan !== null && <WorkspaceBody props={props} level={level} />}
    </Dialog>
  );
}
