'use client';

/**
 * @fileoverview **ΟΙ ΛΑΒΕΣ ΕΝΟΣ ΣΧΗΜΑΤΟΣ** — γωνίες που σέρνονται, μέσα ακμών που προσθέτουν γωνία (ADR-884 Φ2στ-γ Γ3γ-2β ·
 * §12 Δ9.3 · πρότυπο Figma «vector edit» / Revit sketch).
 * @related `useSvgPointDrag.ts` (η χειρονομία) · `lib/geometry/ring-edit.ts` (οι πράξεις — στον κάτοχο) ·
 *   `viewer/tour-plan-overlay-palette.ts` (χρώματα) · `viewer/usePlanZoomGestures.ts` (`PLAN_HANDLE_ATTR`)
 * @module components/spatial-tour/editor/spaces/TourSpaceHandles
 *
 * 🔑 **Μεγέθη σε px** (πρότυπο Γ2): η λαβή είναι ίδια σε κάθε ζουμ — σε μέτρα θα χανόταν στο 1× και θα σκέπαζε το δωμάτιο στο 5×.
 * 🔑 **Σύρσιμο μέσου ακμής = νέα γωνία που ήδη σέρνεται** (Figma): η γωνία μπαίνει στην πρώτη κίνηση, όχι στο πάτημα.
 * ♿ **Και χωρίς ποντίκι** (WCAG 2.1.1 · 2.5.7): Tab σε κάθε γωνία · βελάκια 10 cm, Shift 1 m · Delete αφαιρεί · στο μέσο
 *   ακμής Enter προσθέτει. Το Esc (ακύρωση προχείρου) το κατέχει ο χώρος εργασίας — βλ. `TourSpacesWorkspace`. Εστίαση = γέμισμα της λαβής (ποτέ δακτύλιος του browser — θα μετριόταν σε μέτρα).
 */

import { type KeyboardEvent, type MouseEvent, useRef } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ringEdgeMidpoint } from '@/lib/geometry/ring-edit';
import type { TourPlanXY } from '@/lib/spatial-tour/tour-graph-edit';
import { toPlanSvg } from '@/lib/spatial-tour/viewer/tour-viewer-plan';

import { SPATIAL_TOUR_NS } from '../../spatial-tour-namespace';
import { SPACE_HANDLE_CLASS, SPACE_MIDPOINT_CLASS } from '../../viewer/tour-plan-overlay-palette';
import { PLAN_HANDLE_ATTR } from '../../viewer/usePlanZoomGestures';
import { TOUR_SPACE_EDITOR_KEYS } from './tour-space-editor-labels';
import { useSvgPointDrag } from './useSvgPointDrag';

/** Το id της κρυφής οδηγίας πληκτρολογίου — την αποδίδει ο χώρος εργασίας, μία φορά. */
export const SPACE_VERTEX_HINT_ID = 'tour-space-vertex-hint';

const VERTEX_RADIUS_PX = 5.5;
const MIDPOINT_RADIUS_PX = 3.5;
const HANDLE_STROKE_PX = 1.5;
/** Βήμα πληκτρολογίου σε μέτρα: λεπτό · με Shift (ίδιο με τον χάρτη τοποθέτησης). */
const NUDGE_M = 0.1;
const NUDGE_FAST_M = 1;

const ARROWS: Readonly<Record<string, TourPlanXY>> = {
  ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: 1 }, ArrowDown: { x: 0, y: -1 },
};

/** Ό,τι κάνει ο κάτοχος με τις λαβές — οι πράξεις ζουν εκεί (πρόταση = τοπικά · εγκεκριμένος χώρος = μία εγγραφή). */
export interface ShapeEditController {
  readonly points: readonly TourPlanXY[];
  /**
   * Οθόνη ⇒ θέση γωνίας (έλξη/Shift/μέσα στην κάτοψη), τη στιγμή του γεγονότος. `anchorIndex` = η γωνία ως προς την οποία το
   * Shift κάνει την ακμή οριζόντια/κάθετη (η **προηγούμενη** — ο τοίχος που «έρχεται» στη γωνία).
   */
  readonly resolve: (anchorIndex: number | null, clientX: number, clientY: number, shiftKey: boolean) => TourPlanXY | null;
  readonly move: (index: number, point: TourPlanXY) => void;
  readonly insert: (edgeIndex: number, point: TourPlanXY) => void;
  readonly remove: (index: number) => void;
  /** Τέλος χειρονομίας/Enter — ο εγκεκριμένος χώρος αποθηκεύεται εδώ. */
  readonly commit: () => void;
}

/** Το κλικ σε λαβή δεν είναι κλικ στην κάτοψη (που θα ξεκινούσε ανίχνευση ή θα άλλαζε επιλογή). */
const stop = (event: MouseEvent) => event.stopPropagation();

function nudgeOf(event: KeyboardEvent): TourPlanXY | null {
  const arrow = ARROWS[event.key];
  if (arrow === undefined) return null;
  const step = event.shiftKey ? NUDGE_FAST_M : NUDGE_M;
  return { x: arrow.x * step, y: arrow.y * step };
}

function VertexHandle({ ctl, index, scale }: { readonly ctl: ShapeEditController; readonly index: number; readonly scale: number }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const drag = useSvgPointDrag({
    toPlan: (x, y, shift) => ctl.resolve((index - 1 + ctl.points.length) % ctl.points.length, x, y, shift),
    onMove: (point) => ctl.move(index, point),
    onRelease: () => ctl.commit(),
  });
  const point = ctl.points[index];
  const onKeyDown = (event: KeyboardEvent<SVGCircleElement>) => {
    const nudge = nudgeOf(event);
    if (nudge !== null) {
      event.preventDefault();
      ctl.move(index, { x: point.x + nudge.x, y: point.y + nudge.y });
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      ctl.remove(index);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      ctl.commit();
    }
  };
  const at = toPlanSvg(point);
  return (
    <circle {...{ [PLAN_HANDLE_ATTR]: '' }} cx={at.x} cy={at.y} r={VERTEX_RADIUS_PX * scale} strokeWidth={HANDLE_STROKE_PX * scale}
      role="button" tabIndex={0} aria-describedby={SPACE_VERTEX_HINT_ID}
      aria-label={t(TOUR_SPACE_EDITOR_KEYS.vertex, { index: index + 1, total: ctl.points.length })}
      className={`touch-none ${SPACE_HANDLE_CLASS}`} onKeyDown={onKeyDown} onClick={stop} {...drag} />
  );
}

function MidpointHandle({ ctl, edge, scale }: { readonly ctl: ShapeEditController; readonly edge: number; readonly scale: number }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const inserted = useRef(false);
  const mid = ringEdgeMidpoint(ctl.points, edge);
  const drag = useSvgPointDrag({
    toPlan: (x, y, shift) => ctl.resolve(edge, x, y, shift),
    onMove: (point) => {
      if (inserted.current) ctl.move(edge + 1, point);
      else { inserted.current = true; ctl.insert(edge, point); }
    },
    onRelease: () => { inserted.current = false; ctl.commit(); },
  });
  const add = (event?: MouseEvent) => { event?.stopPropagation(); ctl.insert(edge, mid); ctl.commit(); };
  const onKeyDown = (event: KeyboardEvent<SVGCircleElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    add();
  };
  const at = toPlanSvg(mid);
  return (
    <circle {...{ [PLAN_HANDLE_ATTR]: '' }} cx={at.x} cy={at.y} r={MIDPOINT_RADIUS_PX * scale} strokeWidth={HANDLE_STROKE_PX * scale}
      role="button" tabIndex={0} aria-label={t(TOUR_SPACE_EDITOR_KEYS.addVertex, { index: edge + 1 })}
      className={`touch-none ${SPACE_MIDPOINT_CLASS}`} onKeyDown={onKeyDown} onClick={add} {...drag} />
  );
}

export function TourSpaceHandles({ ctl, scale }: { readonly ctl: ShapeEditController; readonly scale: number }) {
  return (
    <g data-space-handles="">
      {/* eslint-disable react/no-array-index-key -- οι γωνίες δεν έχουν ταυτότητα: η θέση στον δακτύλιο ΕΙΝΑΙ η ταυτότητα */}
      {ctl.points.map((_, edge) => <MidpointHandle key={`m${edge}`} ctl={ctl} edge={edge} scale={scale} />)}
      {ctl.points.map((_, index) => <VertexHandle key={`v${index}`} ctl={ctl} index={index} scale={scale} />)}
      {/* eslint-enable react/no-array-index-key */}
    </g>
  );
}
