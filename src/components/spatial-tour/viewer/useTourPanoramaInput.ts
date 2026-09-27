'use client';

/**
 * @fileoverview **Η ΕΙΣΟΔΟΣ ΤΟΥ ΘΕΑΤΗ** — σύρσιμο (ποντίκι · δάχτυλο · γραφίδα), τσίμπημα, ροδέλα, πλήκτρα → θέαση
 * (ADR-884 Φ1 · §4.8).
 * @related `lib/spatial-tour/viewer/tour-viewer-view.ts` (όλη η αριθμητική — εδώ μόνο συμβάντα) · `tour-camera-store.ts`
 * @module components/spatial-tour/viewer/useTourPanoramaInput
 *
 * 🔑 **Pointer Events, ένα μονοπάτι** για ποντίκι/αφή/γραφίδα (όχι χωριστά mouse/touch handlers)· `setPointerCapture`
 *   ώστε το σύρσιμο να μη χάνεται όταν ο δείκτης βγει από τον καμβά.
 * 🔑 **Ροδέλα με `passive: false`** — αλλιώς ο browser κυλά τη σελίδα αντί να μεγεθύνει (το React δεν το επιτρέπει στο
 *   `onWheel`, γι' αυτό ο ακροατής μπαίνει με το χέρι).
 * 🔑 **Πλήκτρο που δεν αφορά τη θέαση δεν καταναλώνεται** (`Tab` μένει στον browser — κανένα κλείσιμο εστίασης).
 */

import { type RefObject, useEffect } from 'react';

import { viewAfterDrag, viewAfterKey, viewAfterPinch, viewAfterWheel } from '@/lib/spatial-tour/viewer/tour-viewer-view';

import { setCameraView, type TourCameraStore } from './tour-camera-store';

interface Pinch {
  readonly startDistance: number;
  readonly startFov: number;
}

function distance(points: ReadonlyMap<number, { x: number; y: number }>): number {
  const [a, b] = [...points.values()];
  return a !== undefined && b !== undefined ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
}

function bindPointers(canvas: HTMLCanvasElement, camera: TourCameraStore): () => void {
  const points = new Map<number, { x: number; y: number }>();
  let pinch: Pinch | null = null;
  const down = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId);
    points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinch = points.size === 2 ? { startDistance: distance(points), startFov: camera.get().view.fov } : null;
  };
  const move = (e: PointerEvent) => {
    const last = points.get(e.pointerId);
    if (last === undefined) return;
    points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const view = camera.get().view;
    if (pinch !== null) setCameraView(camera, viewAfterPinch(view, pinch.startFov, pinch.startDistance, distance(points)));
    else setCameraView(camera, viewAfterDrag(view, e.clientX - last.x, e.clientY - last.y, canvas.clientHeight));
  };
  const up = (e: PointerEvent) => {
    points.delete(e.pointerId);
    pinch = null;
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  return () => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
  };
}

function bindWheelAndKeys(canvas: HTMLCanvasElement, camera: TourCameraStore): () => void {
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    setCameraView(camera, viewAfterWheel(camera.get().view, e.deltaY));
  };
  const key = (e: KeyboardEvent) => {
    const next = viewAfterKey(camera.get().view, e.key);
    if (next === null) return;
    e.preventDefault();
    setCameraView(camera, next);
  };
  canvas.addEventListener('wheel', wheel, { passive: false });
  canvas.addEventListener('keydown', key);
  return () => {
    canvas.removeEventListener('wheel', wheel);
    canvas.removeEventListener('keydown', key);
  };
}

export function useTourPanoramaInput(canvasRef: RefObject<HTMLCanvasElement | null>, camera: TourCameraStore): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const unbindPointers = bindPointers(canvas, camera);
    const unbindRest = bindWheelAndKeys(canvas, camera);
    return () => { unbindPointers(); unbindRest(); };
  }, [canvasRef, camera]);
}
