'use client';

/**
 * @fileoverview **ΤΟ ΠΑΤΩΜΑ ΤΗΣ ΣΚΗΝΗΣ** — ανά καρέ: τα βελάκια ξαπλωμένα στο πάτωμα, η κουκκίδα κέρσορα, και «κλικ στο
 * πάτωμα ⇒ πήγαινε εκεί» (ADR-884 Φ2στ-γ · §4.14 σημεία 1–2, πρότυπο Zillow 3D Home).
 * @related `lib/spatial-tour/viewer/tour-floor-geometry.ts` (όλη η αριθμητική) · `TourLinkButton.tsx` (`floorArrowParts`) ·
 *   `TourFloorCursor.tsx` · `TourPanoramaStage.tsx` (κάτοχος)
 * @module components/spatial-tour/viewer/useTourFloorOverlay
 *
 * 🔑 **Imperative ανά καρέ** (`engine.onFrame`), κανένα React state (ADR-040): η σκηνή δεν ξαναζωγραφίζεται για να κουνηθεί
 *   ένα βελάκι. Ό,τι γράφεται είναι `style.transform` + η μεταβλητή `--tour-arrow-turn`.
 * 🔑 **Σε μετάβαση** (`moving`) βελάκια και κουκκίδα κρύβονται: ανήκουν στη στάση που **φεύγει** — δεν «κολυμπούν» στη στροφή.
 * 🔑 **Κουκκίδα μόνο με ποντίκι/γραφίδα** — η αφή δεν έχει «αιώρηση»· το πάτημα (κάθε δείκτη) μένει «πήγαινε εκεί».
 */

import { type RefObject, useCallback, useEffect } from 'react';

import { radToDeg } from '@/lib/geometry/angle';
import {
  FLOOR_PILL_PITCH, floorSpotAngles, floorSpotAt, floorSquareFarEdge, floorSquareMatrix, pickFloorTarget, placeFloorArrows,
  type FloorPickCandidate, type FloorSpot,
} from '@/lib/spatial-tour/viewer/tour-floor-geometry';
import { yawForBearing } from '@/lib/spatial-tour/viewer/tour-viewer-bearing';
import type { ViewerNeighbour } from '@/lib/spatial-tour/viewer/tour-viewer-graph';

import type { TourCameraStore } from './tour-camera-store';
import type { TourPanoramaEngine } from './tour-panorama-engine';
import { FLOOR_CURSOR_RADIUS_M } from './TourFloorCursor';
import { FLOOR_DISC_PX, floorArrowParts } from './TourLinkButton';

/** Πόσο πάνω από τον δίσκο κάθεται η ετικέτα (px). */
const LABEL_GAP_PX = 6;

interface FloorScene {
  readonly engine: TourPanoramaEngine;
  readonly camera: TourCameraStore;
  readonly canvas: HTMLCanvasElement;
}

function placeLabel(label: HTMLElement, spot: FloorSpot, radiusM: number, scene: FloorScene): boolean {
  const { yaw, pitch } = floorSpotAngles(floorSquareFarEdge(spot, radiusM));
  const at = scene.engine.projectUnclipped(yaw, pitch);
  if (at === null) return false;
  label.style.transform = `translate(${at.x}px, ${at.y}px) translate(-50%, calc(-100% - ${LABEL_GAP_PX}px))`;
  return true;
}

/** Το συρόμενο «χάπι» του επεξεργαστή: στη **δική** του διόπτευση, ποτέ καρφωμένο σε άκρη (η θέση του ΕΙΝΑΙ η απάντηση). */
function placePill(el: HTMLButtonElement, yaw: number, engine: TourPanoramaEngine): void {
  if (el.dataset.dragging === 'true') return;
  const at = engine.project(yaw, FLOOR_PILL_PITCH);
  el.hidden = at === null;
  if (at !== null) el.style.transform = `translate(${at.x}px, ${at.y}px) translate(-50%, -50%)`;
}

function placeArrows(scene: FloorScene, buttons: ReadonlyMap<string, HTMLButtonElement>, neighbours: readonly ViewerNeighbour[], headingRad: number): void {
  const { view, aspect } = scene.camera.get();
  const shown = neighbours.flatMap((n) => (n.bearing === null ? [] : [{ id: n.nodeId, yaw: yawForBearing(headingRad, n.bearing) }]));
  const placements = placeFloorArrows(shown, { view, aspect, heightPx: scene.canvas.clientHeight });
  for (const { id, yaw } of shown) {
    const el = buttons.get(id);
    if (el === undefined) continue;
    const parts = floorArrowParts(el);
    if (parts === null) { placePill(el, yaw, scene.engine); continue; }
    const p = placements.get(id);
    const matrix = p === undefined ? null : floorSquareMatrix(p.spot, p.radiusM, FLOOR_DISC_PX, scene.engine.projectUnclipped.bind(scene.engine));
    el.hidden = p === undefined || matrix === null || !placeLabel(parts.label, p.spot, p.radiusM, scene);
    if (el.hidden || p === undefined || matrix === null) continue;
    parts.disc.style.transform = matrix;
    el.style.setProperty('--tour-arrow-turn', `${radToDeg(p.turn)}deg`);
  }
}

/** Τα βελάκια του πατώματος, ανά καρέ· όλα κρυμμένα όσο ο επισκέπτης μεταβαίνει. */
export function useFloorArrows(
  scene: { readonly engine: TourPanoramaEngine | null; readonly camera: TourCameraStore; readonly canvasRef: RefObject<HTMLCanvasElement | null> },
  buttons: ReadonlyMap<string, HTMLButtonElement>,
  neighbours: readonly ViewerNeighbour[],
  headingRad: number,
  moving: boolean,
): void {
  const { engine, camera, canvasRef } = scene;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (engine === null || canvas === null) return;
    const place = () => {
      if (moving) { buttons.forEach((el) => { el.hidden = true; }); return; }
      placeArrows({ engine, camera, canvas }, buttons, neighbours, headingRad);
    };
    place();
    return engine.onFrame(place);
  }, [engine, camera, canvasRef, buttons, neighbours, headingRad, moving]);
}

/** Οι στάσεις που μπορεί να «πιάσει» ένα κλικ στο πάτωμα — μόνο οι **συνδεδεμένες**, με κατεύθυνση. */
export function floorCandidates(neighbours: readonly ViewerNeighbour[], headingRad: number): FloorPickCandidate[] {
  return neighbours.flatMap((n) => (n.bearing === null ? [] : [{ nodeId: n.nodeId, yaw: yawForBearing(headingRad, n.bearing), distance: n.distance }]));
}

/** Σημείο του πελάτη → σημείο του πατώματος κάτω από αυτό (`null` έξω από τον καμβά ή πάνω από τον ορίζοντα). */
export function floorSpotAtClient(engine: TourPanoramaEngine, canvas: HTMLCanvasElement, clientX: number, clientY: number): FloorSpot | null {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
  const { yaw, pitch } = engine.unproject(x, y);
  return floorSpotAt(yaw, pitch);
}

interface FloorCursorBinding {
  readonly engine: TourPanoramaEngine | null;
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly cursorRef: RefObject<HTMLElement | null>;
  readonly candidates: readonly FloorPickCandidate[];
  /** Ο επισκέπτης **μάλλον** θα πάει εκεί — προφόρτωση (ίδια με την αιώρηση πάνω σε βελάκι). */
  readonly intentOf: (nodeId: string) => () => void;
  readonly enabled: boolean;
}

function showCursor(cursor: HTMLElement, engine: TourPanoramaEngine, spot: FloorSpot | null, target: string | null): void {
  const matrix = spot === null ? null : floorSquareMatrix(spot, FLOOR_CURSOR_RADIUS_M, FLOOR_DISC_PX, engine.projectUnclipped.bind(engine));
  cursor.hidden = matrix === null;
  if (matrix === null) return;
  cursor.style.transform = matrix;
  cursor.dataset.target = target === null ? 'none' : 'node';
}

/**
 * **Η κουκκίδα κέρσορα**: ακολουθεί το ποντίκι πάνω στο πάτωμα (ακτίνα ∩ πάτωμα)· ξαναμπαίνει σε κάθε καρέ ώστε να μένει
 * στο ίδιο σημείο του πατώματος όταν η θέαση αλλάζει με πλήκτρα. Κρυφή σε σύρσιμο, έξω από τον καμβά, σε μετάβαση.
 */
export function useFloorCursor({ engine, canvasRef, cursorRef, candidates, intentOf, enabled }: FloorCursorBinding): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    const cursor = cursorRef.current;
    if (engine === null || canvas === null || cursor === null) return;
    let pointer: { x: number; y: number } | null = null;
    let intended: string | null = null;
    const update = () => {
      const spot = enabled && pointer !== null ? floorSpotAtClient(engine, canvas, pointer.x, pointer.y) : null;
      const target = spot === null ? null : pickFloorTarget(spot, candidates);
      showCursor(cursor, engine, spot, target);
      if (target !== null && target !== intended) intentOf(target)();
      intended = target;
    };
    const move = (e: PointerEvent) => {
      pointer = e.pointerType === 'touch' || e.buttons !== 0 ? null : { x: e.clientX, y: e.clientY };
      update();
    };
    const leave = () => { pointer = null; update(); };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('pointerdown', leave);
    update();
    const unsubscribe = engine.onFrame(update);
    return () => {
      unsubscribe();
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('pointerdown', leave);
    };
  }, [engine, canvasRef, cursorRef, candidates, intentOf, enabled]);
}

/** Πάτημα (όχι σύρσιμο) στο πάτωμα ⇒ η πλησιέστερη συνδεδεμένη στάση προς τα εκεί· καμία ⇒ τίποτα. */
export function useFloorTap(
  engine: TourPanoramaEngine | null,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  candidates: readonly FloorPickCandidate[],
  go: (nodeId: string) => void,
): (clientX: number, clientY: number) => void {
  return useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (engine === null || canvas === null) return;
    const spot = floorSpotAtClient(engine, canvas, clientX, clientY);
    const target = spot === null ? null : pickFloorTarget(spot, candidates);
    if (target !== null) go(target);
  }, [engine, canvasRef, candidates, go]);
}
