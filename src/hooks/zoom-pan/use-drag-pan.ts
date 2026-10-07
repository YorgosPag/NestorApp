/**
 * @fileoverview **Σύρση και pinch** — τα κανάλια ποντικιού/αφής του `useZoomPan` (ADR-187 · ADR-899 §9 θέμα 3).
 * @module hooks/zoom-pan/use-drag-pan
 *
 * - Η σύρση με ποντίκι **συνεχίζει έξω από το κουτί** (listeners στο `window` όσο κρατιέται το κουμπί) — πριν σταματούσε
 *   στο `mouseleave`, ενώ τα χειρόγραφα αντίγραφα του πάνελ/modal το έκαναν σωστά.
 * - Το pinch μεγεθύνει γύρω από το **μέσο των δαχτύλων** και ακολουθεί τη μετακίνησή του (Apple/Google Photos) — πριν
 *   γύρω από το κέντρο.
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';

import { clampZoom, midpoint, pointDistance, scaleAbout, type Vec2, type ZoomLimits } from '@/lib/geometry/zoom-pan-math';

import { pointerFromCenter } from './use-wheel-zoom';
import type { ViewCommit, ViewGetter, ZoomPanView } from './zoom-pan-view';

interface Pinch {
  readonly distance: number;
  readonly mid: Vec2;
  readonly anchor: Vec2;
  readonly view: ZoomPanView;
}

export interface DragPanHandlers {
  onMouseDown: (e: ReactMouseEvent) => void;
  onTouchStart: (e: ReactTouchEvent) => void;
  onTouchMove: (e: ReactTouchEvent) => void;
  onTouchEnd: (e: ReactTouchEvent) => void;
  /** Η αφή που **πήρε ο browser** (π.χ. για κύλιση σελίδας) τελειώνει εδώ, όχι στο `touchend` — αλλιώς το «σύρεται» κολλά. */
  onTouchCancel: (e: ReactTouchEvent) => void;
}

interface DragPanDeps {
  readonly container: HTMLElement | null;
  readonly getView: ViewGetter;
  readonly commit: ViewCommit;
  readonly limits: ZoomLimits;
  readonly setPanning: (panning: boolean) => void;
}

function clientOf(t: { clientX: number; clientY: number }): Vec2 {
  return { x: t.clientX, y: t.clientY };
}

/** Μετατόπιση = αρχική + διαδρομή του δείκτη από την αρχή της σύρσης. */
function draggedPan(origin: { start: Vec2; pan: Vec2 }, now: Vec2): Vec2 {
  return { x: origin.pan.x + (now.x - origin.start.x), y: origin.pan.y + (now.y - origin.start.y) };
}

/** Η όψη του pinch: zoom ∝ λόγος αποστάσεων, γύρω από την άγκυρα, συν τη μετακίνηση του μέσου. */
function pinchedView(pinch: Pinch, a: Vec2, b: Vec2, limits: ZoomLimits): ZoomPanView {
  const zoom = clampZoom(pinch.view.zoom * (pointDistance(a, b) / pinch.distance), limits);
  const scaled = scaleAbout(pinch.view.pan, pinch.anchor, zoom / pinch.view.zoom);
  const mid = midpoint(a, b);
  return { ...pinch.view, zoom, pan: { x: scaled.x + mid.x - pinch.mid.x, y: scaled.y + mid.y - pinch.mid.y } };
}

/** Σύρση με ποντίκι: έναρξη στο κουτί, συνέχεια/τέλος στο `window`. */
function useMouseDrag({ getView, commit, setPanning }: DragPanDeps): DragPanHandlers['onMouseDown'] {
  const detachRef = useRef<(() => void) | null>(null);
  useEffect(() => () => detachRef.current?.(), []);

  return useCallback((e: ReactMouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const origin = { start: clientOf(e), pan: getView().pan };
    const onMove = (ev: MouseEvent) => commit({ ...getView(), pan: draggedPan(origin, clientOf(ev)) });
    const detach = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', detach);
      detachRef.current = null;
      setPanning(false);
    };
    detachRef.current?.();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', detach);
    detachRef.current = detach;
    setPanning(true);
  }, [getView, commit, setPanning]);
}

/** Αφή: ένα δάχτυλο = σύρση, δύο = pinch. */
function useTouchGestures(deps: DragPanDeps): Omit<DragPanHandlers, 'onMouseDown'> {
  const { container, getView, commit, limits, setPanning } = deps;
  const pinchRef = useRef<Pinch | null>(null);
  const dragRef = useRef<{ start: Vec2; pan: Vec2 } | null>(null);

  const onTouchStart = useCallback((e: ReactTouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [clientOf(e.touches[0]), clientOf(e.touches[1])];
      const mid = midpoint(a, b);
      const anchor = container ? pointerFromCenter(container, mid.x, mid.y) : { x: 0, y: 0 };
      pinchRef.current = { distance: pointDistance(a, b), mid, anchor, view: getView() };
      dragRef.current = null;
      setPanning(false);
    } else if (e.touches.length === 1) {
      dragRef.current = { start: clientOf(e.touches[0]), pan: getView().pan };
      setPanning(true);
    }
  }, [container, getView, setPanning]);

  const onTouchMove = useCallback((e: ReactTouchEvent) => {
    const pinch = pinchRef.current;
    if (e.touches.length === 2 && pinch && pinch.distance > 0) {
      commit(pinchedView(pinch, clientOf(e.touches[0]), clientOf(e.touches[1]), limits));
    } else if (e.touches.length === 1 && dragRef.current) {
      commit({ ...getView(), pan: draggedPan(dragRef.current, clientOf(e.touches[0])) });
    }
  }, [getView, commit, limits]);

  const onTouchEnd = useCallback((e: ReactTouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null;
    if (e.touches.length === 0) {
      dragRef.current = null;
      setPanning(false);
    }
  }, [setPanning]);

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd };
}

export function useDragPan(deps: DragPanDeps): DragPanHandlers {
  const onMouseDown = useMouseDrag(deps);
  return { onMouseDown, ...useTouchGestures(deps) };
}
