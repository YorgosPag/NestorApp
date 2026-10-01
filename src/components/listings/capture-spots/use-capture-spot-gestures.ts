'use client';

/**
 * @fileoverview **Οι κινήσεις πάνω στην κάτοψη** — κλικ = θέση, σύρσιμο λαβών = κατεύθυνση/πεδίο, πληκτρολόγιο (ADR-897 Φ3).
 * @related CaptureSpotEditSurface.tsx · lib/listings/photo-capture-spot-edit (οι καθαρές πράξεις)
 * @module components/listings/capture-spots/use-capture-spot-gestures
 *
 * 📏 **Σε pixel της εικόνας μέσω του αντίστροφου πίνακα οθόνης του SVG** (ιδίωμα `TourPlanEditMap`): καμία δική μας
 *   αριθμητική κλίμακας/μετατόπισης που θα μπορούσε να αποκλίνει από ό,τι ζωγράφισε ο browser.
 * 🖱️ **Pointer Events + `setPointerCapture`** (μοτίβο `usePointerDragRelease`): δουλεύει με ποντίκι, αφή και γραφίδα, και
 *   το σύρσιμο δεν «χάνεται» όταν ο δείκτης βγει από τη λαβή.
 * ⌨️ **WCAG 2.1.1 · 2.5.7** — κάθε κίνηση έχει εναλλακτική **χωρίς σύρσιμο**: βέλη (θέση), `[` `]` (κατεύθυνση),
 *   `-` `+` (πεδίο), Delete (αφαίρεση). Και ο ρυθμιστής του επιθεωρητή δίπλα.
 */

import { type KeyboardEvent, type PointerEvent, type RefObject, useRef } from 'react';

import { degToRad } from '@/lib/geometry/angle';
import type { PhotoCaptureSpot } from '@/lib/listings/photo-capture-spot';
import {
  aimSpot,
  nudgeSpot,
  placeSpot,
  resizeSpotFov,
  rotateSpot,
  widenSpot,
  type ImageSize,
  type UnitPoint,
} from '@/lib/listings/photo-capture-spot-edit';

type DragKind = 'position' | 'aim' | 'fov';

const NUDGE = 0.01;
const NUDGE_FAST = 0.05;
const ROTATE = degToRad(1);
const ROTATE_FAST = degToRad(15);
const FOV_STEP = degToRad(1);
const FOV_STEP_FAST = degToRad(5);

const ARROWS: Readonly<Record<string, UnitPoint>> = {
  ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
};

export interface CaptureSpotGestureInput {
  readonly svgRef: RefObject<SVGSVGElement | null>;
  readonly image: ImageSize;
  readonly floorplanId: string;
  /** `false` ⇒ καμία φωτογραφία επιλεγμένη: κλικ και πλήκτρα δεν κάνουν τίποτα. */
  readonly hasSelection: boolean;
  readonly selected: PhotoCaptureSpot | null;
  /** Το πεδίο που παίρνει μια **νέα** τοποθέτηση (από το EXIF όταν είναι γνωστό). */
  readonly initialFovRad?: number;
  readonly onChange: (next: PhotoCaptureSpot | null) => void;
}

/** Το σημείο του δείκτη σε κλάσματα της εικόνας — `null` όταν ο browser δεν δίνει πίνακα (δεν ζωγραφίστηκε ακόμη). */
function toUnit(svg: SVGSVGElement | null, event: PointerEvent, image: ImageSize): UnitPoint | null {
  const matrix = svg?.getScreenCTM() ?? null;
  if (matrix === null) return null;
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return { x: point.x / image.width, y: point.y / image.height };
}

/** Τι κάνει ένα πλήκτρο στο επιλεγμένο σημείο — `undefined` ⇒ το πλήκτρο δεν είναι δικό μας. */
function keyEdit(spot: PhotoCaptureSpot, event: KeyboardEvent): PhotoCaptureSpot | null | undefined {
  const fast = event.shiftKey;
  const arrow = ARROWS[event.key];
  if (arrow !== undefined) return nudgeSpot(spot, arrow.x * (fast ? NUDGE_FAST : NUDGE), arrow.y * (fast ? NUDGE_FAST : NUDGE));
  switch (event.key) {
    case '[': case '{': return rotateSpot(spot, -(fast ? ROTATE_FAST : ROTATE));
    case ']': case '}': return rotateSpot(spot, fast ? ROTATE_FAST : ROTATE);
    case '-': case '_': return resizeSpotFov(spot, -(fast ? FOV_STEP_FAST : FOV_STEP));
    case '+': case '=': return resizeSpotFov(spot, fast ? FOV_STEP_FAST : FOV_STEP);
    case 'Delete': case 'Backspace': return null;
    default: return undefined;
  }
}

export function useCaptureSpotGestures(input: CaptureSpotGestureInput) {
  const drag = useRef<DragKind | null>(null);

  const apply = (kind: DragKind, at: UnitPoint) => {
    const { selected, floorplanId, image, initialFovRad, onChange } = input;
    if (kind === 'position') onChange(placeSpot(selected, floorplanId, at, initialFovRad));
    else if (selected !== null) onChange(kind === 'aim' ? aimSpot(selected, at, image) : widenSpot(selected, at, image));
  };

  const begin = (kind: DragKind) => (event: PointerEvent<SVGElement>) => {
    if (!input.hasSelection || event.button !== 0) return;
    event.stopPropagation();
    drag.current = kind;
    input.svgRef.current?.setPointerCapture(event.pointerId);
    const at = toUnit(input.svgRef.current, event, input.image);
    if (at !== null && kind === 'position') apply(kind, at);
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (drag.current === null) return;
    const at = toUnit(input.svgRef.current, event, input.image);
    if (at !== null) apply(drag.current, at);
  };

  const end = (event: PointerEvent<SVGSVGElement>) => {
    if (drag.current === null) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (input.selected === null) return;
    const next = keyEdit(input.selected, event);
    if (next === undefined) return;
    event.preventDefault();
    input.onChange(next);
  };

  return {
    /** Η επιφάνεια: πάτημα ⇒ η επιλεγμένη φωτογραφία πάει εκεί, και συνεχίζει να σύρεται. */
    onSurfacePointerDown: begin('position'),
    onHandlePointerDown: begin,
    onPointerMove,
    onPointerUp: end,
    onPointerCancel: end,
    onKeyDown,
  };
}
