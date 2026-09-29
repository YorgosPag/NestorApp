'use client';

/**
 * @fileoverview **ΣΥΡΕ ΜΙΑ ΛΑΒΗ ΠΑΝΩ ΣΤΗΝ ΚΑΤΟΨΗ** — ζωντανή θέση σε μέτρα κάτοψης σε κάθε κίνηση, μία απόφαση στην απελευθέρωση
 * (ADR-884 Φ2στ-γ Γ3γ-2β · §12 Δ9.3 · πρότυπο Figma: σύρσιμο κορυφής).
 * @related `viewer/usePointerDragRelease.ts` (το ίδιο κατώφλι — εκεί για στοιχεία HTML που μετακινούνται με CSS) ·
 *   `viewer/usePlanZoomGestures.ts` (`PLAN_HANDLE_ATTR` — η λαβή δεν σέρνει τον χάρτη)
 * @module components/spatial-tour/editor/spaces/useSvgPointDrag
 *
 * 🔑 **Getter τη στιγμή του γεγονότος** (ADR-040): το `toPlan` διαβάζει τη θέαση (ζουμ/μετακίνηση) όπως είναι **τώρα** — ποτέ
 *   στιγμιότυπο από το render που θα έμενε πίσω μέσα σε ένα σύρσιμο.
 * 🔑 **Κάτω από {@link DRAG_THRESHOLD_PX} = κλικ** (επιλογή), πάνω = σύρσιμο· το κλικ που ακολουθεί ένα σύρσιμο **καταπίνεται**.
 * 🔑 **`setPointerCapture` στη λαβή**: το σύρσιμο συνεχίζει κι όταν ο δείκτης βγει από το μικρό κυκλάκι.
 */

import { type MouseEvent, type MutableRefObject, type PointerEvent, useMemo, useRef } from 'react';

import type { TourPlanXY } from '@/lib/spatial-tour/tour-graph-edit';

import { DRAG_THRESHOLD_PX } from '../../viewer/usePointerDragRelease';

export interface SvgPointDragCallbacks {
  /** Οθόνη ⇒ μέτρα κάτοψης, **τη στιγμή της κλήσης** — `null` όταν η κάτοψη δεν έχει ζωγραφιστεί. */
  readonly toPlan: (clientX: number, clientY: number, shiftKey: boolean) => TourPlanXY | null;
  readonly onMove: (point: TourPlanXY) => void;
  readonly onRelease: (point: TourPlanXY) => void;
}

export interface SvgPointDragHandlers {
  readonly onPointerDown: (e: PointerEvent<SVGElement>) => void;
  readonly onPointerMove: (e: PointerEvent<SVGElement>) => void;
  readonly onPointerUp: (e: PointerEvent<SVGElement>) => void;
  readonly onPointerCancel: (e: PointerEvent<SVGElement>) => void;
  readonly onClickCapture: (e: MouseEvent<SVGElement>) => void;
}

interface Gesture {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  dragging: boolean;
  last: TourPlanXY | null;
}

interface DragRefs {
  readonly gesture: MutableRefObject<Gesture | null>;
  readonly swallowClick: MutableRefObject<boolean>;
  readonly latest: MutableRefObject<SvgPointDragCallbacks>;
}

function moveHandler({ gesture, latest }: DragRefs) {
  return (e: PointerEvent<SVGElement>) => {
    const g = gesture.current;
    if (g === null || g.pointerId !== e.pointerId) return;
    if (!g.dragging && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < DRAG_THRESHOLD_PX) return;
    g.dragging = true;
    const point = latest.current.toPlan(e.clientX, e.clientY, e.shiftKey);
    if (point === null) return;
    g.last = point;
    latest.current.onMove(point);
  };
}

function handlersOf(refs: DragRefs): SvgPointDragHandlers {
  const { gesture, swallowClick, latest } = refs;
  return {
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      gesture.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, dragging: false, last: null };
    },
    onPointerMove: moveHandler(refs),
    onPointerUp: (e) => {
      const g = gesture.current;
      gesture.current = null;
      if (g === null || g.pointerId !== e.pointerId) return;
      swallowClick.current = g.dragging;
      if (g.dragging && g.last !== null) latest.current.onRelease(g.last);
    },
    onPointerCancel: () => {
      const g = gesture.current;
      gesture.current = null;
      // Ακύρωση (π.χ. το σύστημα πήρε τη χειρονομία) ⇒ ό,τι φάνηκε μένει ως πρόχειρο — ο καλών αποφασίζει με Enter/Esc.
      if (g?.dragging && g.last !== null) latest.current.onMove(g.last);
    },
    onClickCapture: (e) => {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}

/** Οι χειριστές μιας λαβής· `onRelease` καλείται **μόνο** για πραγματικό σύρσιμο (όχι για κλικ). */
export function useSvgPointDrag(callbacks: SvgPointDragCallbacks): SvgPointDragHandlers {
  const gesture = useRef<Gesture | null>(null);
  const swallowClick = useRef(false);
  const latest = useRef(callbacks);
  latest.current = callbacks;
  return useMemo(() => handlersOf({ gesture, swallowClick, latest }), []);
}
