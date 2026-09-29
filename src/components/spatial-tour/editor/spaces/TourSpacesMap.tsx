'use client';

/**
 * @fileoverview **Ο ΧΑΡΤΗΣ ΤΩΝ ΧΩΡΩΝ** — η κάτοψη του ορόφου με εγκεκριμένους χώρους, προτάσεις, νοητές γραμμές, σημεία, λαβές
 * και πένα (ADR-884 Φ2στ-γ Γ3γ-2β · §4.14 · §12 Δ8 · Δ9).
 * @related `viewer/TourPlanSpaces.tsx` (οι εγκεκριμένοι χώροι — ο ΙΔΙΟΣ κώδικας με τον θεατή, WYSIWYG) · `viewer/TourPlanMap.tsx`
 *   (ίδιο πλαίσιο σε μέτρα, ίδιο ζουμ) · `TourSpaceHandles.tsx` · `useShapeEdit.ts` · `useSpacePen.ts` · `tour-plan-overlay-palette.ts`
 * @module components/spatial-tour/editor/spaces/TourSpacesMap
 *
 * 🔑 **Σε μέτρα κάτοψης, όχι σε pixel εικόνας** (αντίθετα με τον χάρτη τοποθέτησης): ίδιο πλαίσιο με τον θεατή ⇒ ό,τι εγκρίνεις
 *   είναι ακριβώς ό,τι θα δει ο επισκέπτης, και το ζουμ/μετακίνηση είναι το ΙΔΙΟ SSoT (`tour-plan-zoom`, `usePlanZoomGestures`).
 * 🔑 **Φύλλα που διαβάζουν το store** (ADR-040): προτάσεις, επιλογή, πένα και λαβές συνδρομούν μόνες τους — το σύρσιμο μιας γωνίας
 *   δεν ξαναζωγραφίζει την εικόνα ή τους υπόλοιπους χώρους.
 * 🔑 **Μεγέθη σε px × μέτρα ανά px** (Γ2): γραμμές, τελείες, λαβές ίδιες σε κάθε ζουμ.
 */

import { type MouseEvent, type PointerEvent, useCallback } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { TourViewerSeparation } from '@/lib/spatial-tour/viewer/tour-viewer-shapes';
import type { ViewerLevelEntry } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import { toPlanSvg, type PlacedStop, type PlanFrame } from '@/lib/spatial-tour/viewer/tour-viewer-plan';
import { planMetresPerPixel, planViewBox } from '@/lib/spatial-tour/viewer/tour-plan-zoom';
import type { ElementSize } from '@/hooks/media/useElementSize';

import { SPATIAL_TOUR_NS } from '../../spatial-tour-namespace';
import {
  PLAN_DOT_CLASS,
  SPACE_EDITOR_TONE_CLASS,
  SPACE_PEN_CLASS,
  SPACE_PROPOSAL_CLASS,
  SPACE_SELECTED_CLASS,
  SPACE_SEPARATION_CLASS,
  SPACE_SEPARATION_SUGGESTED_CLASS,
} from '../../viewer/tour-plan-overlay-palette';
import { TourPlanSpaces, ringPath } from '../../viewer/TourPlanSpaces';
import { usePlanView, type TourPlanZoomStore } from '../../viewer/tour-plan-zoom-store';
import { usePlanZoomGestures } from '../../viewer/usePlanZoomGestures';
import { selectTarget, updateSpaceEditor, useSpaceEditor, type SpaceEditorState, type SpaceEditorStore } from './space-editor-store';
import { TourSpaceHandles } from './TourSpaceHandles';
import { TOUR_SPACE_EDITOR_KEYS } from './tour-space-editor-labels';
import { useShapeEdit, type ShapeEditContext } from './useShapeEdit';
import type { SpacePen } from './useSpacePen';
import type { SpaceMapReader } from './useSpaceMapReader';

const OUTLINE_PX = 2;
const PROPOSAL_DASH_PX = 6;
const LINE_PX = 2;
/** Πάχος του αόρατου «στόχου» μιας γραμμής — ένα 2 px νήμα δεν πατιέται (WCAG 2.5.8: στόχος ≥ 24 px). */
const LINE_HIT_PX = 24;
const DOT_RADIUS_PX = 5;
const DOT_STROKE_PX = 1.5;
/** Η πρώτη γωνία της πένας είναι μεγαλύτερη — εκεί κλείνει το σχήμα. */
const PEN_FIRST_PX = 5;
const PEN_VERTEX_PX = 3.5;

export interface TourSpacesMapProps {
  readonly level: ViewerLevelEntry;
  readonly stops: readonly PlacedStop[];
  readonly imageUrl: string;
  readonly frame: PlanFrame;
  readonly surface: ElementSize;
  readonly zoomStore: TourPlanZoomStore;
  readonly store: SpaceEditorStore;
  readonly reader: SpaceMapReader;
  readonly shape: ShapeEditContext;
  readonly pen: SpacePen;
  readonly nameOf: (nodeId: string) => string;
  /** Κλικ σε ελεύθερο σημείο με το εργαλείο «Επιλογή» — ο κάτοχος αποφασίζει (επιλογή χώρου ή νέα πρόταση). */
  readonly onMapClick: (clientX: number, clientY: number) => void;
}

const readSelection = (s: SpaceEditorState) => s.selection;
const readProposals = (s: SpaceEditorState) => s.proposals;
const readTool = (s: SpaceEditorState) => s.tool;
const readPen = (s: SpaceEditorState) => s.pen;
const readPenHover = (s: SpaceEditorState) => s.penHover;
const readEditId = (s: SpaceEditorState) => (s.selection?.kind === 'space' ? s.selection.id : null);

/** Με την πένα, γραμμές και προτάσεις **δεν** πιάνουν κλικ — αλλιώς μια γωνία πάνω τους θα γινόταν «επιλογή» αντί για γωνία. */
const interactiveClass = (tool: SpaceEditorState['tool']) => (tool === 'select' ? 'cursor-pointer' : 'pointer-events-none');

function Separations({ separations, store, scale }: { readonly separations: readonly TourViewerSeparation[]; readonly store: SpaceEditorStore; readonly scale: number }) {
  const selection = useSpaceEditor(store, readSelection);
  const tool = useSpaceEditor(store, readTool);
  return separations.map((line) => {
    const a = toPlanSvg(line.a);
    const b = toPlanSvg(line.b);
    const selected = selection?.kind === 'separation' && selection.id === line.id;
    const pick = (e: MouseEvent) => { e.stopPropagation(); updateSpaceEditor(store, (s) => selectTarget(s, { kind: 'separation', id: line.id })); };
    return (
      <g key={line.id} onClick={pick} className={interactiveClass(tool)}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={LINE_HIT_PX * scale} className="stroke-transparent" />
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={(selected ? 2 : 1) * LINE_PX * scale}
          className={selected ? 'stroke-chart-1' : SPACE_SEPARATION_CLASS} />
      </g>
    );
  });
}

function Proposals({ store, scale }: { readonly store: SpaceEditorStore; readonly scale: number }) {
  const proposals = useSpaceEditor(store, readProposals);
  const selection = useSpaceEditor(store, readSelection);
  const tool = useSpaceEditor(store, readTool);
  const selectedKey = selection?.kind === 'proposal' ? selection.key : null;
  const suggested = proposals.find((p) => p.key === selectedKey)?.separation ?? null;
  const dash = `${PROPOSAL_DASH_PX * scale} ${PROPOSAL_DASH_PX * scale / 2}`;
  return (
    <g strokeWidth={OUTLINE_PX * scale} strokeLinejoin="round">
      {proposals.filter((p) => p.key !== selectedKey).map((p) => (
        <path key={p.key} d={ringPath(p.outline)} strokeDasharray={dash} className={cn(interactiveClass(tool), SPACE_PROPOSAL_CLASS)}
          onClick={(e) => { e.stopPropagation(); updateSpaceEditor(store, (s) => selectTarget(s, { kind: 'proposal', key: p.key })); }} />
      ))}
      {suggested !== null && (() => {
        const a = toPlanSvg(suggested.segment.a);
        const b = toPlanSvg(suggested.segment.b);
        return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={LINE_PX * 1.5 * scale} strokeDasharray={dash} className={SPACE_SEPARATION_SUGGESTED_CLASS} aria-hidden />;
      })()}
    </g>
  );
}

function SelectedShape({ shape, scale }: { readonly shape: ShapeEditContext; readonly scale: number }) {
  const ctl = useShapeEdit(shape);
  const tool = useSpaceEditor(shape.store, readTool);
  if (ctl === null) return null;
  return (
    <g>
      <path d={ringPath(ctl.points)} strokeWidth={OUTLINE_PX * scale} strokeLinejoin="round" className={cn('pointer-events-none', SPACE_SELECTED_CLASS)} aria-hidden />
      {tool === 'select' && <TourSpaceHandles ctl={ctl} scale={scale} />}
    </g>
  );
}

function PenLayer({ store, scale }: { readonly store: SpaceEditorStore; readonly scale: number }) {
  const pen = useSpaceEditor(store, readPen);
  const hover = useSpaceEditor(store, readPenHover);
  const points = hover === null ? pen : [...pen, hover];
  if (points.length === 0) return null;
  const svg = points.map((p) => toPlanSvg(p));
  return (
    <g className="pointer-events-none" aria-hidden>
      <polyline points={svg.map((p) => `${p.x},${p.y}`).join(' ')} strokeWidth={OUTLINE_PX * scale} strokeLinejoin="round" className={SPACE_PEN_CLASS} />
      {pen.map((p, i) => {
        const at = toPlanSvg(p);
        // eslint-disable-next-line react/no-array-index-key -- οι γωνίες της πένας δεν έχουν ταυτότητα πέρα από τη σειρά τους
        return <circle key={i} cx={at.x} cy={at.y} r={(i === 0 ? PEN_FIRST_PX : PEN_VERTEX_PX) * scale} className="fill-white stroke-chart-1" strokeWidth={DOT_STROKE_PX * scale} />;
      })}
    </g>
  );
}

function Stops({ stops, nameOf, scale }: { readonly stops: readonly PlacedStop[]; readonly nameOf: (id: string) => string; readonly scale: number }) {
  return (
    <g className="pointer-events-none">
      {stops.map(({ entry, point }) => {
        const at = toPlanSvg(point);
        return (
          <circle key={entry.node.id} cx={at.x} cy={at.y} r={DOT_RADIUS_PX * scale} strokeWidth={DOT_STROKE_PX * scale} className={PLAN_DOT_CLASS.other}>
            <title>{nameOf(entry.node.id)}</title>
          </circle>
        );
      })}
    </g>
  );
}

export function TourSpacesMap(props: TourSpacesMapProps) {
  const { level, stops, imageUrl, frame, surface, zoomStore, store, reader, shape, pen, nameOf, onMapClick } = props;
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const view = usePlanView(zoomStore, level.id);
  const gestures = usePlanZoomGestures({ store: zoomStore, levelId: level.id, frame, wheelMode: 'always' });
  const tool = useSpaceEditor(store, readTool);
  const editingId = useSpaceEditor(store, readEditId);
  const box = planViewBox(frame, view);
  const scale = planMetresPerPixel(box, surface);
  const bind = useCallback((node: SVGSVGElement | null) => { gestures(node); reader.bind(node); }, [gestures, reader]);
  const click = (e: MouseEvent<SVGSVGElement>) => (tool === 'pen' ? pen.click(e.clientX, e.clientY, e.shiftKey) : onMapClick(e.clientX, e.clientY));
  const move = (e: PointerEvent<SVGSVGElement>) => { if (tool === 'pen') pen.hover(e.clientX, e.clientY, e.shiftKey); };
  return (
    <svg ref={bind} viewBox={`${box.minX} ${box.minY} ${box.width} ${box.height}`} role="group" aria-label={t(TOUR_SPACE_EDITOR_KEYS.map)}
      onClick={click} onPointerMove={move} onPointerLeave={pen.leave}
      className={cn('h-full w-full select-none touch-none', tool === 'pen' ? 'cursor-crosshair' : 'cursor-pointer data-[panning=true]:cursor-grabbing')}>
      <image href={imageUrl} x={frame.minX} y={frame.minY} width={frame.width} height={frame.height} preserveAspectRatio="none" aria-hidden />
      <TourPlanSpaces level={level} stops={stops} currentNodeId={null} nameOf={nameOf} areas="shown" scale={scale}
        toneClass={SPACE_EDITOR_TONE_CLASS} hiddenSpaceId={editingId} />
      <Separations separations={level.separations} store={store} scale={scale} />
      <Proposals store={store} scale={scale} />
      <Stops stops={stops} nameOf={nameOf} scale={scale} />
      <SelectedShape shape={shape} scale={scale} />
      {tool === 'pen' && <PenLayer store={store} scale={scale} />}
    </svg>
  );
}
