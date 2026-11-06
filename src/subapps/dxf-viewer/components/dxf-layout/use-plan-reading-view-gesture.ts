'use client';

/**
 * ADR-929 Φ5.3β — οι χειρονομίες του φύλλου `PlanReadingViewOverlay`: δείκτης (px οθόνης) → σκηνή → aligned px, και
 * από εκεί οι καθαρές πράξεις του `plan-reading-view-gesture.ts`.
 *
 * ADR-040: η χειρονομία ζει σε `ref` + τοπικό state του φύλλου (φάντασμα). Στο store γράφεται **μία** `edit` στο άφημα.
 * Τα `pointermove`/`pointerup` ακούγονται στο `window` (πρότυπο `DimRowHandleOverlay`), ώστε ένα σύρσιμο που βγαίνει από
 * τη λαβή ή από τον καμβά να μη «χάνει» το άφημα.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { PlanePoint } from '@/lib/geometry/homography';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { PlanReadingView } from '../../bim/plan-recognition/reading/plan-reading-view';
import type { AlignedImageSize, RectHandle } from '../../bim/plan-recognition/reading/plan-reading-view-edit';
import type { RasterPlacement } from '../../floorplan-background/geometry/raster-scene-mapping';
import { sceneToAlignedPoint, type ViewGeometryAlignment } from '../../systems/plan-recognition/plan-reading-view-geometry';
import {
  advanceGesture,
  commitGesture,
  targetRect,
  type ViewGesture,
  type ViewTarget,
} from '../../systems/plan-recognition/plan-reading-view-gesture';

export interface PlanReadingGestureInput {
  readonly svgRef: React.RefObject<SVGSVGElement | null>;
  readonly view: PlanReadingView;
  readonly alignment: ViewGeometryAlignment;
  readonly placement: RasterPlacement;
  readonly size: AlignedImageSize;
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
  /** Η **μία** εγγραφή του αφήματος (ο ελεγκτής). */
  readonly onCommit: (next: PlanReadingView) => void;
}

export interface PlanReadingGesture {
  readonly gesture: ViewGesture | null;
  readonly beginMove: (target: ViewTarget, event: React.PointerEvent) => void;
  readonly beginResize: (target: ViewTarget, handle: RectHandle, event: React.PointerEvent) => void;
  readonly beginDraw: (event: React.PointerEvent) => void;
}

export function usePlanReadingViewGesture(input: PlanReadingGestureInput): PlanReadingGesture {
  const { svgRef, view, alignment, placement, size, transform, viewport, onCommit } = input;
  const gestureRef = useRef<ViewGesture | null>(null);
  const [gesture, setGesture] = useState<ViewGesture | null>(null);

  const toAligned = useCallback((clientX: number, clientY: number): PlanePoint | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const box = svg.getBoundingClientRect();
    const local: Point2D = { x: clientX - box.left, y: clientY - box.top };
    return sceneToAlignedPoint(CoordinateTransforms.screenToWorld(local, transform, viewport), alignment, placement);
  }, [svgRef, transform, viewport, alignment, placement]);

  const start = useCallback((event: React.PointerEvent, make: (p: PlanePoint) => ViewGesture | null): void => {
    if (event.button !== 0) return;
    const p = toAligned(event.clientX, event.clientY);
    const next = p ? make(p) : null;
    if (!next) return;
    event.preventDefault();
    event.stopPropagation(); // ο καμβάς από κάτω δεν βλέπει ούτε επιλογή ούτε pan
    gestureRef.current = next;
    setGesture(next);
  }, [toAligned]);

  const beginMove = useCallback((target: ViewTarget, event: React.PointerEvent) => start(event, (p) => {
    const origin = targetRect(view, target);
    return origin ? { mode: 'move', target, start: p, origin, current: origin } : null;
  }), [start, view]);

  const beginResize = useCallback((target: ViewTarget, handle: RectHandle, event: React.PointerEvent) => start(event, () => {
    const origin = targetRect(view, target);
    return origin ? { mode: 'resize', target, handle, origin, current: origin } : null;
  }), [start, view]);

  const beginDraw = useCallback((event: React.PointerEvent) => start(event, (p) =>
    ({ mode: 'draw', start: p, current: { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y } })), [start]);

  const active = gesture !== null;
  useEffect(() => {
    if (!active) return;
    const move = (ev: PointerEvent): void => {
      const current = gestureRef.current;
      const p = current ? toAligned(ev.clientX, ev.clientY) : null;
      if (!current || !p) return;
      const next = advanceGesture(current, p, view, size);
      gestureRef.current = next;
      setGesture(next);
    };
    const up = (): void => {
      const done = gestureRef.current;
      gestureRef.current = null;
      setGesture(null);
      const next = done ? commitGesture(view, done, size) : null;
      if (next) onCommit(next);
    };
    // Ακύρωση από το σύστημα (αφή, απώλεια εστίασης): η όψη μένει όπως ήταν, κανένα μισό σύρσιμο δεν γράφεται.
    const cancel = (): void => {
      gestureRef.current = null;
      setGesture(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [active, toAligned, view, size, onCommit]);

  return { gesture, beginMove, beginResize, beginDraw };
}
