'use client';

/**
 * @fileoverview **ΟΙ ΧΕΙΡΟΝΟΜΙΕΣ ΤΟΥ ΠΙΝΕΛΟΥ ΘΟΛΩΜΑΤΟΣ** — σύρσιμο = νέος κύκλος (κέντρο + ακτίνα) · σύρσιμο πάνω σε κύκλο =
 * μετακίνηση · λαβή = μέγεθος · Space/μεσαίο κουμπί = κοίταγμα · ροδέλα = ζουμ (ADR-884 Φ2ζ ζ3 · §4.15).
 * @related `TourRedactionOverlay.tsx` (η επιφάνεια + οι λαβές που δένουν αυτά) · `lib/spatial-tour/tour-redaction-draft.ts`
 *   (`redactionAt` · reducer) · `tileset/tour-redaction-mask.ts` (`angularDistance` — η ΜΙΑ γεωμετρία) ·
 *   `viewer/usePointerDragRelease.ts` (`DRAG_THRESHOLD_PX` — το ΙΔΙΟ κατώφλι κλικ/συρσίματος)
 * @module components/spatial-tour/editor/redaction/useRedactionBrush
 *
 * 🔑 **Pointer Events + `setPointerCapture` στο ίδιο στοιχείο** (όπως τα συρόμενα βελάκια): ο καμβάς δεν λαμβάνει ποτέ το
 *   σύρσιμο του πινέλου ⇒ καμία σύγκρουση με το σύρσιμο ματιάς· ποντίκι, αφή, γραφίδα από ένα μονοπάτι.
 * 🔑 **Γεωμετρία στη σφαίρα, όχι στην οθόνη**: κέντρο και ακτίνα μετρώνται ως κατευθύνσεις πανοράματος (`panoramaAtClient` —
 *   η ΜΙΑ προβολή της σκηνής) ⇒ ο κύκλος είναι ο ίδιος σε κάθε ζουμ και ό,τι ψήνεται είναι ό,τι σχεδιάστηκε.
 * 🔑 **Κοίταγμα χωρίς έξοδο από το πινέλο** (σύμβαση Figma/Photoshop): Space + σύρσιμο ή μεσαίο κουμπί. Η κατάσταση διαβάζεται
 *   τη στιγμή του συμβάντος (getter, ADR-040) — νέο πρόχειρο δεν ξαναδένει τίποτα.
 */

import { type PointerEvent, type RefObject, useEffect, useMemo, useRef } from 'react';

import { TOUR_REDACTION_MIN_RADIUS_RAD } from '@/constants/spatial-tour-vocabulary';
import { angularDistance } from '@/lib/spatial-tour/tileset/tour-redaction-mask';
import { redactionAt, type TourRedactionDraft, type TourRedactionDraftAction } from '@/lib/spatial-tour/tour-redaction-draft';
import { viewAfterDrag, viewAfterWheel } from '@/lib/spatial-tour/viewer/tour-viewer-view';

import { setCameraView } from '../../viewer/tour-camera-store';
import type { PanoramaDirection, TourStageScene } from '../../viewer/TourPanoramaStage';
import { DRAG_THRESHOLD_PX } from '../../viewer/usePointerDragRelease';

/** Τι ξεκινά ένα πάτημα: η επιφάνεια (σχεδίαση/μετακίνηση/επιλογή) ή μια λαβή. */
export type BrushTarget = 'surface' | 'move' | 'resize';

type Gesture =
  | { readonly kind: 'pending'; readonly x: number; readonly y: number; readonly at: PanoramaDirection; readonly hit: string | null }
  | { readonly kind: 'draw' | 'resize'; readonly id: string; readonly center: PanoramaDirection }
  | { readonly kind: 'move'; readonly id: string; readonly grab: PanoramaDirection; readonly origin: PanoramaDirection }
  | { readonly kind: 'look'; lastX: number; lastY: number };

interface Pressed {
  readonly pointerId: number;
  gesture: Gesture;
}

export interface BrushInput {
  readonly scene: TourStageScene;
  readonly getDraft: () => TourRedactionDraft;
  readonly dispatch: (action: TourRedactionDraftAction) => void;
  readonly newId: () => string;
}

export interface BrushHandlers {
  readonly onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  readonly onPointerMove: (e: PointerEvent<HTMLElement>) => void;
  readonly onPointerUp: (e: PointerEvent<HTMLElement>) => void;
  readonly onPointerCancel: (e: PointerEvent<HTMLElement>) => void;
}

const distance = (a: PanoramaDirection, b: PanoramaDirection) => angularDistance(a.yaw, a.pitch, b.yaw, b.pitch);

/** Το σημείο που πάτησε ο άνθρωπος πάνω σε μια λαβή ⇒ ο κύκλος που την κατέχει. */
function startOnHandle(target: Exclude<BrushTarget, 'surface'>, input: BrushInput, at: PanoramaDirection): Gesture | null {
  const draft = input.getDraft();
  const item = draft.working.find((r) => r.id === draft.selectedId);
  if (item === undefined) return null;
  const center = { yaw: item.yawRad, pitch: item.pitchRad };
  return target === 'resize' ? { kind: 'resize', id: item.id, center } : { kind: 'move', id: item.id, grab: at, origin: center };
}

/** Από «πατημένο» σε πραγματική χειρονομία, μόλις ο δείκτης περάσει το κατώφλι. */
function promote(pending: Extract<Gesture, { kind: 'pending' }>, input: BrushInput, at: PanoramaDirection): Gesture {
  if (pending.hit !== null) {
    const item = input.getDraft().working.find((r) => r.id === pending.hit);
    if (item !== undefined) {
      input.dispatch({ kind: 'select', id: item.id });
      return { kind: 'move', id: item.id, grab: pending.at, origin: { yaw: item.yawRad, pitch: item.pitchRad } };
    }
  }
  const id = input.newId();
  const radiusRad = Math.max(TOUR_REDACTION_MIN_RADIUS_RAD, distance(pending.at, at));
  input.dispatch({ kind: 'add', id, region: { yawRad: pending.at.yaw, pitchRad: pending.at.pitch, radiusRad } });
  return { kind: 'draw', id, center: pending.at };
}

/** Ένα βήμα της χειρονομίας στο `at`. */
function step(gesture: Gesture, input: BrushInput, at: PanoramaDirection): void {
  if (gesture.kind === 'draw' || gesture.kind === 'resize') {
    input.dispatch({ kind: 'resize', id: gesture.id, radiusRad: distance(gesture.center, at) });
  } else if (gesture.kind === 'move') {
    const yawRad = gesture.origin.yaw + (at.yaw - gesture.grab.yaw);
    const pitchRad = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, gesture.origin.pitch + (at.pitch - gesture.grab.pitch)));
    input.dispatch({ kind: 'move', id: gesture.id, yawRad, pitchRad });
  }
}

/** Τι ξεκινά ένα πάτημα — `null` ⇒ δεν ανήκει στο πινέλο (άλλο κουμπί · έξω από την εικόνα). */
function startGesture(target: BrushTarget, e: PointerEvent<HTMLElement>, input: BrushInput, spaceHeld: boolean): Gesture | null {
  const lookAround = target === 'surface' && (e.button === 1 || spaceHeld);
  if (lookAround) return { kind: 'look', lastX: e.clientX, lastY: e.clientY };
  if (e.button !== 0) return null;
  const at = input.scene.panoramaAtClient(e.clientX, e.clientY);
  if (at === null) return null;
  if (target !== 'surface') return startOnHandle(target, input, at);
  return { kind: 'pending', x: e.clientX, y: e.clientY, at, hit: redactionAt(input.getDraft().working, at.yaw, at.pitch) };
}

function look(gesture: Extract<Gesture, { kind: 'look' }>, input: BrushInput, x: number, y: number): void {
  const { camera } = input.scene;
  setCameraView(camera, viewAfterDrag(camera.get().view, x - gesture.lastX, y - gesture.lastY, input.scene.height()));
  gesture.lastX = x;
  gesture.lastY = y;
}

/** Space κρατημένο; — διαβάζεται τη στιγμή του πατήματος. */
function useSpaceHeld(active: boolean): RefObject<boolean> {
  const held = useRef(false);
  useEffect(() => {
    if (!active) return;
    const down = (e: KeyboardEvent) => { if (e.code === 'Space') held.current = true; };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') held.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); held.current = false; };
  }, [active]);
  return held;
}

/** Ροδέλα πάνω στην επιφάνεια = ζουμ (όπως στον καμβά) — `passive: false`, αλλιώς ο browser κυλά τη σελίδα. */
function useWheelZoom(surfaceRef: RefObject<HTMLElement | null>, scene: TourStageScene, active: boolean): void {
  useEffect(() => {
    const el = surfaceRef.current;
    if (!active || el === null) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      setCameraView(scene.camera, viewAfterWheel(scene.camera.get().view, e.deltaY));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [surfaceRef, scene, active]);
}

/** Οι χειριστές ενός στοιχείου του πινέλου (`surface` · λαβή `move` · λαβή `resize`). */
export function useRedactionBrush(input: BrushInput, surfaceRef: RefObject<HTMLElement | null>, active: boolean) {
  const pressed = useRef<Pressed | null>(null);
  const latest = useRef(input);
  latest.current = input;
  const space = useSpaceHeld(active);
  useWheelZoom(surfaceRef, input.scene, active);

  return useMemo(() => (target: BrushTarget): BrushHandlers => ({
    onPointerDown: (e) => {
      const gesture = startGesture(target, e, latest.current, space.current === true);
      if (gesture === null) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      pressed.current = { pointerId: e.pointerId, gesture };
    },
    onPointerMove: (e) => {
      const p = pressed.current;
      if (p === null || p.pointerId !== e.pointerId) return;
      if (p.gesture.kind === 'look') { look(p.gesture, latest.current, e.clientX, e.clientY); return; }
      const at = latest.current.scene.panoramaAtClient(e.clientX, e.clientY);
      if (at === null) return;
      if (p.gesture.kind === 'pending') {
        if (Math.hypot(e.clientX - p.gesture.x, e.clientY - p.gesture.y) < DRAG_THRESHOLD_PX) return;
        p.gesture = promote(p.gesture, latest.current, at);
      }
      step(p.gesture, latest.current, at);
    },
    onPointerUp: (e) => {
      const p = pressed.current;
      if (p === null || p.pointerId !== e.pointerId) return;
      pressed.current = null;
      // Κλικ χωρίς σύρσιμο: πάνω σε κύκλο ⇒ επιλογή, στο κενό ⇒ αποεπιλογή (Figma).
      if (p.gesture.kind === 'pending') latest.current.dispatch({ kind: 'select', id: p.gesture.hit });
    },
    onPointerCancel: () => { pressed.current = null; },
  }), [space]);
}
