'use client';

/**
 * @fileoverview **ΤΑ ΧΕΡΙΑ ΠΑΝΩ ΣΤΗΝ ΚΑΤΟΨΗ** — τροχός, σύρσιμο, pinch (ADR-884 Φ2στ-γ Γ2 · §4.14 σημείο 5).
 * @related `lib/spatial-tour/viewer/tour-plan-zoom.ts` (όλη η γεωμετρία) · `tour-plan-zoom-store.ts` (ο ΕΝΑΣ κάτοχος) ·
 *   `usePointerDragRelease.ts` (`DRAG_THRESHOLD_PX` — ίδιο κατώφλι κλικ/σύρσης σε όλο τον θεατή)
 * @module components/spatial-tour/viewer/usePlanZoomGestures
 *
 * 🏆 **Τροχός όπως η ενσωματωμένη Google Maps** (`gestureHandling: 'cooperative'`): στη **στήλη** ο σκέτος τροχός
 *   **κυλά τη στήλη** — αλλιώς ο επισκέπτης που κατεβαίνει στους ορόφους θα «σκαλωνε» σε κάθε κάτοψη· μεγέθυνση με
 *   **Ctrl/⌘ + τροχό**. Στην **ανάπτυξη** (↗) η κάτοψη είναι όλη η οθόνη ⇒ ο σκέτος τροχός μεγεθύνει.
 *   ℹ️ Το pinch της επιφάνειας αφής (trackpad) φτάνει στον browser ως `wheel` με `ctrlKey` ⇒ δουλεύει **και** στη στήλη.
 * 🔑 **Κλικ ≠ σύρσιμο**: κάτω από `DRAG_THRESHOLD_PX` είναι κλικ (η τελεία πηγαίνει στο σημείο)· πάνω, είναι σύρσιμο και
 *   το κλικ που ακολουθεί **καταπίνεται**. Το `setPointerCapture` γίνεται **μόνο** όταν αρχίσει το σύρσιμο: νωρίτερα θα
 *   έστελνε το `click` στο `<svg>` αντί για την τελεία.
 * 🔑 **Ανάγνωση τη στιγμή του συμβάντος** (πνεύμα ADR-040): το κάδρο και η θέαση διαβάζονται από `ref`/store — οι χειριστές
 *   δεν ξαναδένονται σε κάθε καρέ.
 */

import { useEffect, useRef, useState } from 'react';

import { pointDistance, wheelZoom, type Vec2 } from '@/lib/geometry/zoom-pan-math';
import {
  PLAN_WHEEL_SENSITIVITY, PLAN_ZOOM_LIMITS, clientToPlan, panPlanBy, planUnitsPerPixel, planViewBox, zoomPlanAt,
} from '@/lib/spatial-tour/viewer/tour-plan-zoom';
import type { PlanFrame } from '@/lib/spatial-tour/viewer/tour-viewer-plan';

import { getPlanView, setPlanView, type TourPlanZoomStore } from './tour-plan-zoom-store';
import { DRAG_THRESHOLD_PX } from './usePointerDragRelease';

/** `modifier` = στήλη (Ctrl/⌘ + τροχός) · `always` = ανάπτυξη (σκέτος τροχός). */
export type PlanWheelMode = 'modifier' | 'always';

/** Γραμμές → px (Firefox στέλνει `deltaMode = 1`). */
const WHEEL_LINE_PX = 16;

interface GestureTarget {
  readonly store: TourPlanZoomStore;
  readonly levelId: string;
  readonly frame: PlanFrame;
  readonly wheelMode: PlanWheelMode;
}

interface GestureState {
  readonly pointers: Map<number, Vec2>;
  start: Vec2 | null;
  dragging: boolean;
  pinch: { readonly distance: number; readonly zoom: number } | null;
  swallowClick: boolean;
}

function clientPoint(e: PointerEvent | WheelEvent): Vec2 {
  return { x: e.clientX, y: e.clientY };
}

function onWheel(svg: SVGSVGElement, t: GestureTarget, e: WheelEvent): void {
  if (t.wheelMode === 'modifier' && !e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  const view = getPlanView(t.store, t.levelId);
  const anchor = clientToPlan(planViewBox(t.frame, view), svg.getBoundingClientRect(), e.clientX, e.clientY);
  const delta = e.deltaMode === 1 ? e.deltaY * WHEEL_LINE_PX : e.deltaY;
  setPlanView(t.store, t.levelId, zoomPlanAt(t.frame, view, wheelZoom(view.zoom, delta, PLAN_WHEEL_SENSITIVITY, PLAN_ZOOM_LIMITS), anchor));
}

function pinchMove(svg: SVGSVGElement, t: GestureTarget, g: GestureState): void {
  const [a, b] = [...g.pointers.values()];
  if (g.pinch === null || a === undefined || b === undefined) return;
  const view = getPlanView(t.store, t.levelId);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const anchor = clientToPlan(planViewBox(t.frame, view), svg.getBoundingClientRect(), mid.x, mid.y);
  setPlanView(t.store, t.levelId, zoomPlanAt(t.frame, view, g.pinch.zoom * (pointDistance(a, b) / g.pinch.distance), anchor));
}

function panMove(svg: SVGSVGElement, t: GestureTarget, g: GestureState, e: PointerEvent, prev: Vec2): void {
  const view = getPlanView(t.store, t.levelId);
  if (view.zoom <= PLAN_ZOOM_LIMITS.min || g.start === null) return;
  if (!g.dragging && pointDistance(clientPoint(e), g.start) < DRAG_THRESHOLD_PX) return;
  if (!g.dragging) {
    g.dragging = true;
    svg.setPointerCapture(e.pointerId);
    svg.dataset.panning = 'true';
  }
  const unit = planUnitsPerPixel(planViewBox(t.frame, view), svg.getBoundingClientRect());
  setPlanView(t.store, t.levelId, panPlanBy(t.frame, view, { x: (e.clientX - prev.x) * unit, y: (e.clientY - prev.y) * unit }));
}

/**
 * **Στοιχεία που σέρνονται ΜΟΝΑ τους** (λαβές κορυφών του επεξεργαστή χώρων, ADR-884 Γ3γ-2β): το πάτημα πάνω τους **δεν** ξεκινά
 * μετακίνηση της κάτοψης — αλλιώς, σε μεγέθυνση, το σύρσιμο μιας γωνίας θα έσερνε και τον χάρτη από κάτω (πρότυπο MapLibre
 * «interactive layers»). Ο native listener του `<svg>` τρέχει πριν από το React, άρα ένα `stopPropagation` εκεί δεν αρκεί.
 */
export const PLAN_HANDLE_ATTR = 'data-plan-handle';

function isHandle(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(`[${PLAN_HANDLE_ATTR}]`) !== null;
}

function onPointerDown(t: GestureTarget, g: GestureState, e: PointerEvent): void {
  if (e.button !== 0 || isHandle(e.target)) return;
  g.pointers.set(e.pointerId, clientPoint(e));
  if (g.pointers.size === 2) {
    const [a, b] = [...g.pointers.values()];
    g.pinch = { distance: Math.max(1, pointDistance(a, b)), zoom: getPlanView(t.store, t.levelId).zoom };
    g.dragging = true;
  } else if (g.pointers.size === 1) {
    g.start = clientPoint(e);
    g.dragging = false;
  }
}

function onPointerEnd(svg: SVGSVGElement, g: GestureState, e: PointerEvent): void {
  if (!g.pointers.delete(e.pointerId)) return;
  if (g.pointers.size < 2) g.pinch = null;
  if (g.pointers.size > 0) return;
  g.swallowClick = g.dragging;
  g.dragging = false;
  g.start = null;
  delete svg.dataset.panning;
}

function bindGestures(svg: SVGSVGElement, target: () => GestureTarget): () => void {
  const g: GestureState = { pointers: new Map(), start: null, dragging: false, pinch: null, swallowClick: false };
  const wheel = (e: WheelEvent) => onWheel(svg, target(), e);
  const down = (e: PointerEvent) => onPointerDown(target(), g, e);
  const move = (e: PointerEvent) => {
    const prev = g.pointers.get(e.pointerId);
    if (prev === undefined) return;
    g.pointers.set(e.pointerId, clientPoint(e));
    if (g.pointers.size >= 2) pinchMove(svg, target(), g);
    else panMove(svg, target(), g, e, prev);
  };
  const end = (e: PointerEvent) => onPointerEnd(svg, g, e);
  const click = (e: MouseEvent) => {
    if (!g.swallowClick) return;
    g.swallowClick = false;
    e.preventDefault();
    e.stopPropagation();
  };
  svg.addEventListener('wheel', wheel, { passive: false });
  svg.addEventListener('pointerdown', down);
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('click', click, { capture: true });
  return () => {
    svg.removeEventListener('wheel', wheel);
    svg.removeEventListener('pointerdown', down);
    svg.removeEventListener('pointermove', move);
    svg.removeEventListener('pointerup', end);
    svg.removeEventListener('pointercancel', end);
    svg.removeEventListener('click', click, { capture: true });
  };
}

/** Callback ref για το `<svg>` της κάτοψης: τροχός + σύρσιμο + pinch πάνω στη θέαση του ορόφου. */
export function usePlanZoomGestures(target: GestureTarget): (node: SVGSVGElement | null) => void {
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);
  const latest = useRef(target);
  latest.current = target;
  useEffect(() => (svg === null ? undefined : bindGestures(svg, () => latest.current)), [svg]);
  return setSvg;
}
