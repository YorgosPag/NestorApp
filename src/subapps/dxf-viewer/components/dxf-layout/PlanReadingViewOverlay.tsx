'use client';

/**
 * ⚠️  ADR-040 preview-performance contract — READ BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-929 Φ5.3β — **η όψη που θα διαβαστεί, πάνω στην εικόνα**, επεξεργάσιμη: crop με 8 λαβές· περιοχές απόκρυψης με
 * σύρσιμο, αλλαγή μεγέθους, προσθήκη και σβήσιμο. Έξω από το crop η εικόνα σκιάζεται («δεν στέλνεται»)· μια περιοχή
 * απόκρυψης είναι λευκή με διαγράμμιση, όπως θα φύγει. Crop και απόκρυψη διακρίνονται **χωρίς χρώμα** (περίγραμμα ·
 * γέμισμα με διαγράμμιση). Κάθε ορθογώνιο της όψης είναι τετράπλευρο που ακολουθεί την ευθυγράμμιση της εικόνας.
 *
 * ADR-040: standalone leaf. Ο εξωτερικός ακούει μόνο τα (σπάνια) stores αναγνώρισης/υποβάθρου και επιστρέφει `null`
 * χωρίς όψη υπό έλεγχο· ο εσωτερικός κάνει το transform. Η χειρονομία ζει τοπικά (φάντασμα)· **μία** εγγραφή στο άφημα.
 * `pointer-events` μόνο στις λαβές, στο περίγραμμα του crop και στις περιοχές: το pan/zoom κάτω από την όψη μένει άθικτο.
 * Σε «Προσθήκη περιοχής» η επιφάνεια ανήκει στη χειρονομία (πρότυπο `BasemapPlacementLeaf`).
 */

import React, { useCallback, useId, useRef, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { useTransformValue } from '../../systems/cursor/ImmediateTransformStore';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { useEscapeHandler } from '../../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../../systems/escape-bus/escape-priority';
import { useFloorplanBackgroundStore } from '../../floorplan-background/stores/floorplanBackgroundStore';
import type { FloorplanBackground } from '../../floorplan-background/providers/types';
import { usePlanRecognitionState, type PlanReadingReview, type PlanRecognitionRun } from '../../systems/plan-recognition/plan-recognition-store';
import { planRecognitionSession } from '../../systems/plan-recognition/plan-recognition-session';
import { alignedPointToScene, alignedRectToSceneQuad, rectHandlePoint } from '../../systems/plan-recognition/plan-reading-view-geometry';
import { previewView, type ViewTarget } from '../../systems/plan-recognition/plan-reading-view-gesture';
import { RECT_HANDLES, removeRedaction, type RectHandle } from '../../bim/plan-recognition/reading/plan-reading-view-edit';
import type { AlignedRectPx } from '../../bim/plan-recognition/alignment/plan-alignment-types';
import type { PlanReadingView } from '../../bim/plan-recognition/reading/plan-reading-view';
import { usePlanReadingViewGesture, type PlanReadingGesture } from './use-plan-reading-view-gesture';

interface Props {
  readonly viewport: Viewport;
}

const INK = PANEL_LAYOUT.CAD_COLORS.CONSTRUCTION_LINE;
const HALO = PANEL_LAYOUT.CAD_COLORS.DRAWING_BLACK;
const PAPER = PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE;
const HANDLE_PX = 8;
const DELETE_OFFSET_PX = 14;
const OUTSIDE_SHADE_OPACITY = 0.45;
/** Πλάτος της αόρατης «λωρίδας» πάνω στο περίγραμμα του crop που πιάνει το σύρσιμο. */
const CROP_GRAB_STROKE_PX = 10;

const HANDLE_CURSOR: Readonly<Record<RectHandle, string>> = {
  nw: 'cursor-nwse-resize', se: 'cursor-nwse-resize', ne: 'cursor-nesw-resize', sw: 'cursor-nesw-resize',
  n: 'cursor-ns-resize', s: 'cursor-ns-resize', e: 'cursor-ew-resize', w: 'cursor-ew-resize',
};

type Project = (r: AlignedRectPx) => readonly Point2D[];

const polygonPoints = (quad: readonly Point2D[]): string => quad.map((p) => `${p.x},${p.y}`).join(' ');

export function PlanReadingViewOverlay({ viewport }: Props): React.ReactElement | null {
  const { run, review } = usePlanRecognitionState();
  const floorId = run?.floorId ?? null;
  const background = useFloorplanBackgroundStore((s) => (floorId ? s.floors[floorId]?.background ?? null : null));
  if (!run || !review || !background) return null;
  return <PlanReadingViewLayer run={run} review={review} background={background} viewport={viewport} />;
}

function PlanReadingViewLayer({ run, review, background, viewport }: {
  readonly run: PlanRecognitionRun;
  readonly review: PlanReadingReview;
  readonly background: FloorplanBackground;
  readonly viewport: Viewport;
}): React.ReactElement {
  const transform = useTransformValue();
  const svgRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const size = run.alignment.image;
  const onCommit = useCallback((next: PlanReadingView) => planRecognitionSession.review.edit(next), []);
  const gesture = usePlanReadingViewGesture({
    svgRef, view: review.view, alignment: run.alignment, placement: background, size, transform, viewport, onCommit,
  });
  const adding = review.tool === 'add-redaction';
  useReviewEscape(adding, selected, setSelected);
  const shown = previewView(review.view, gesture.gesture);
  const project: Project = (r) => projectQuad(r, run, background, transform, viewport);
  const locked = review.send.status === 'sending';
  const live = selected !== null && selected < shown.redacted.length ? selected : null;
  return (
    <svg ref={svgRef} className="absolute inset-0 size-full pointer-events-none z-20" xmlns="http://www.w3.org/2000/svg"
      data-testid="plan-reading-view-overlay">
      <CropShade crop={project(shown.crop)} viewport={viewport} />
      {shown.redacted.map((r, i) => (
        <RedactionShape key={i} quad={project(r)} locked={locked || adding}
          onGrab={(e) => { setSelected(i); gesture.beginMove({ kind: 'redaction', index: i }, e); }} />
      ))}
      <CropOutline quad={project(shown.crop)} locked={locked || adding} onGrab={(e) => gesture.beginMove({ kind: 'crop' }, e)} />
      {locked || adding ? null : (
        <>
          <Handles rect={shown.crop} target={{ kind: 'crop' }} toScreen={(p) => projectPoint(p, run, background, transform, viewport)} gesture={gesture} />
          {live === null ? null : (
            <SelectedRedaction index={live} rect={shown.redacted[live]} gesture={gesture}
              toScreen={(p) => projectPoint(p, run, background, transform, viewport)}
              onDelete={() => { setSelected(null); planRecognitionSession.review.edit(removeRedaction(review.view, live)); }} />
          )}
        </>
      )}
      {adding && !locked ? <DrawSurface viewport={viewport} onDown={gesture.beginDraw} /> : null}
    </svg>
  );
}

function projectPoint(p: { x: number; y: number }, run: PlanRecognitionRun, bg: FloorplanBackground, t: ViewTransform, vp: Viewport): Point2D {
  return CoordinateTransforms.worldToScreen(alignedPointToScene(p, run.alignment, bg), t, vp);
}

function projectQuad(r: AlignedRectPx, run: PlanRecognitionRun, bg: FloorplanBackground, t: ViewTransform, vp: Viewport): readonly Point2D[] {
  return alignedRectToSceneQuad(r, run.alignment, bg).map((p) => CoordinateTransforms.worldToScreen(p, t, vp));
}

/** Esc: πρώτα έξοδος από την προσθήκη, μετά αποεπιλογή. Αλλιώς δεν το διεκδικεί (inert). */
function useReviewEscape(adding: boolean, selected: number | null, setSelected: (next: number | null) => void): void {
  useEscapeHandler({
    id: 'plan-reading-view-review',
    priority: ESC_PRIORITY.CROP_TOOL,
    canHandle: () => adding || selected !== null,
    handle: () => {
      if (adding) planRecognitionSession.review.setTool('select');
      else setSelected(null);
      return true;
    },
  });
}

/** Ό,τι είναι έξω από το crop σκιάζεται: δεν θα φύγει. */
function CropShade({ crop, viewport }: { readonly crop: readonly Point2D[]; readonly viewport: Viewport }): React.ReactElement {
  const outer = `M0,0 H${viewport.width} V${viewport.height} H0 Z`;
  const inner = `M${polygonPoints(crop).replace(/ /g, ' L')} Z`;
  return <path d={`${outer} ${inner}`} fillRule="evenodd" fill={HALO} opacity={OUTSIDE_SHADE_OPACITY} />;
}

function CropOutline({ quad, locked, onGrab }: {
  readonly quad: readonly Point2D[];
  readonly locked: boolean;
  readonly onGrab: (e: React.PointerEvent) => void;
}): React.ReactElement {
  const points = polygonPoints(quad);
  return (
    <g data-testid="plan-reading-crop">
      <polygon points={points} fill="none" stroke={HALO} strokeWidth={4} opacity={0.45} />
      <polygon points={points} fill="none" stroke={INK} strokeWidth={2} />
      {locked ? null : (
        <polygon points={points} fill="none" stroke={PAPER} strokeOpacity={0} strokeWidth={CROP_GRAB_STROKE_PX}
          pointerEvents="stroke" className="cursor-move" onPointerDown={onGrab} />
      )}
    </g>
  );
}

/** Περιοχή απόκρυψης: λευκή (όπως θα φύγει) με διαγράμμιση — διακρίνεται από το crop χωρίς χρώμα. */
function RedactionShape({ quad, locked, onGrab }: {
  readonly quad: readonly Point2D[];
  readonly locked: boolean;
  readonly onGrab: (e: React.PointerEvent) => void;
}): React.ReactElement {
  const hatchId = useId();
  const points = polygonPoints(quad);
  return (
    <g data-testid="plan-reading-redaction">
      <defs>
        <pattern id={hatchId} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={8} stroke={HALO} strokeWidth={1.5} opacity={0.6} />
        </pattern>
      </defs>
      <polygon points={points} fill={PAPER} />
      <polygon points={points} fill={`url(#${hatchId})`} stroke={HALO} strokeWidth={1.5} strokeDasharray="4 3"
        className={locked ? undefined : 'pointer-events-auto cursor-move'} onPointerDown={locked ? undefined : onGrab} />
    </g>
  );
}

function Handles({ rect, target, toScreen, gesture }: {
  readonly rect: AlignedRectPx;
  readonly target: ViewTarget;
  readonly toScreen: (p: { x: number; y: number }) => Point2D;
  readonly gesture: PlanReadingGesture;
}): React.ReactElement {
  return (
    <g>
      {RECT_HANDLES.map((handle) => {
        const p = toScreen(rectHandlePoint(rect, handle));
        return (
          <rect key={handle} x={p.x - HANDLE_PX / 2} y={p.y - HANDLE_PX / 2} width={HANDLE_PX} height={HANDLE_PX}
            fill={PAPER} stroke={HALO} strokeWidth={1.5} data-handle={handle}
            className={`pointer-events-auto ${HANDLE_CURSOR[handle]}`}
            onPointerDown={(e) => gesture.beginResize(target, handle, e)} />
        );
      })}
    </g>
  );
}

function SelectedRedaction({ index, rect, toScreen, gesture, onDelete }: {
  readonly index: number;
  readonly rect: AlignedRectPx;
  readonly toScreen: (p: { x: number; y: number }) => Point2D;
  readonly gesture: PlanReadingGesture;
  readonly onDelete: () => void;
}): React.ReactElement {
  const { t } = useTranslation(['dxf-viewer-shell']);
  const corner = toScreen(rectHandlePoint(rect, 'ne'));
  const x = corner.x + DELETE_OFFSET_PX;
  const y = corner.y - DELETE_OFFSET_PX;
  const remove = (e: React.SyntheticEvent): void => { e.stopPropagation(); onDelete(); };
  return (
    <g>
      <Handles rect={rect} target={{ kind: 'redaction', index }} toScreen={toScreen} gesture={gesture} />
      <g role="button" tabIndex={0} aria-label={t('modelFromDrawing.image.reading.deleteRegion')}
        className="pointer-events-auto cursor-pointer" data-testid="plan-reading-redaction-delete"
        onPointerDown={remove} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') remove(e); }}>
        <circle cx={x} cy={y} r={8} fill={PAPER} stroke={HALO} strokeWidth={1.5} />
        <line x1={x - 3.5} y1={y - 3.5} x2={x + 3.5} y2={y + 3.5} stroke={HALO} strokeWidth={1.5} />
        <line x1={x + 3.5} y1={y - 3.5} x2={x - 3.5} y2={y + 3.5} stroke={HALO} strokeWidth={1.5} />
      </g>
    </g>
  );
}

/** Σε «Προσθήκη περιοχής» η επιφάνεια ανήκει στη χειρονομία: το επόμενο σύρσιμο σχεδιάζει νέα περιοχή. */
function DrawSurface({ viewport, onDown }: { readonly viewport: Viewport; readonly onDown: (e: React.PointerEvent) => void }): React.ReactElement {
  return (
    <rect x={0} y={0} width={viewport.width} height={viewport.height} fill={PAPER} fillOpacity={0}
      className="pointer-events-auto cursor-crosshair" data-testid="plan-reading-draw-surface" onPointerDown={onDown} />
  );
}
