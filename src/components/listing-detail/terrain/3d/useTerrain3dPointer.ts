'use client';

/**
 * @fileoverview **ΔΕΙΚΤΗΣ ΚΑΙ ΔΑΧΤΥΛΟ ΠΑΝΩ ΣΤΟ 3Δ** — δείχνω, καρφιτσώνω, ορίζω τομή, χωρίς να «κλέψω» την τροχιά (ADR-920 §14.10 Ε2).
 * @related `../terrain-inspect-store` (ο ΜΟΝΟΣ αποδέκτης) · `terrain-3d-engine.ts` (`pick`) · `@/hooks/gestures/useLongPress`
 * @module components/listing-detail/terrain/3d/useTerrain3dPointer
 *
 * 🔑 **Η τροχιά έχει προτεραιότητα** (Sketchfab · Google Earth): όσο κρατιέται κουμπί, ο δείκτης περιστρέφει τη σκηνή — δεν
 *   δείχνει. Κλικ = πάτημα και άφημα **χωρίς** μετακίνηση (≤ {@link CLICK_TOLERANCE_PX})· αλλιώς ήταν σύρσιμο τροχιάς.
 * 👆 **Αφή**: πάτημα-κράτημα = καρφίτσωμα (το ένα δάχτυλο αλλιώς περιστρέφει).
 * 📏 **Προφίλ στο 3Δ**: κλικ = Α, κίνηση = λάστιχο προς τον δείκτη, δεύτερο κλικ = Β (η τροχιά μένει ελεύθερη ανάμεσα).
 * 📐 Ο δείκτης γίνεται θέση σε κάτοψη μέσω `pick`· το υψόμετρο το διαβάζει ο πυρήνας — ποτέ η υπερβολή της σκηνής.
 */

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';

import { useLongPress } from '@/hooks/gestures/useLongPress';
import type { PlanarPoint } from '@/lib/geometry/planar-polygon';

import type { TerrainInspectStore } from '../terrain-inspect-store';
import type { Terrain3dEngine } from './terrain-3d-engine';

/** Πάτημα και άφημα μέσα σε τόσα css px = κλικ, όχι σύρσιμο τροχιάς. */
const CLICK_TOLERANCE_PX = 4;

/** Η τεταρτημόριο της οθόνης όπου βρίσκεται ο δείκτης — η κάρτα κάθεται αλλού. */
export type Terrain3dPointerQuadrant = 'top-left' | 'elsewhere';

interface Pointer3dDeps {
  readonly getEngine: () => Terrain3dEngine | null;
  readonly store: TerrainInspectStore | null;
}

/** Μία ερώτηση ανά καρέ: το τελευταίο σημείο του καρέ ρωτιέται στο επόμενο `requestAnimationFrame`. */
function useFramePick({ getEngine, store }: Pointer3dDeps) {
  const pending = useRef<PlanarPoint | null>(null);
  const frame = useRef(0);
  const profileAnchor = useRef<PlanarPoint | null>(null);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const run = useCallback(() => {
    frame.current = 0;
    const client = pending.current;
    const at = client && getEngine()?.pick(client.x, client.y);
    if (!store) return;
    const anchor = profileAnchor.current;
    if (anchor && at) store.setProfileLine(anchor, at);
    else if (at) store.probeAt(at.x, at.y);
    else store.clearProbe();
  }, [getEngine, store]);
  const schedule = useCallback((client: PlanarPoint) => {
    pending.current = client;
    if (frame.current === 0) frame.current = requestAnimationFrame(run);
  }, [run]);
  return { schedule, profileAnchor };
}

/** Κλικ στο σημείο: καρφίτσωμα, ή άκρο τομής στο εργαλείο προφίλ. */
function clickAt(deps: Pointer3dDeps, anchor: { current: PlanarPoint | null }, clientX: number, clientY: number): void {
  const at = deps.getEngine()?.pick(clientX, clientY);
  if (!at || !deps.store) return;
  if (deps.store.get().tool !== 'profile') { deps.store.pinAt(at.x, at.y); return; }
  if (anchor.current === null) { anchor.current = at; deps.store.setProfileLine(at, at); return; }
  deps.store.setProfileLine(anchor.current, at);
  anchor.current = null;
}

export interface Terrain3dPointerApi {
  readonly handlers: {
    readonly onPointerDown: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
    readonly onPointerMove: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
    readonly onPointerUp: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
    readonly onPointerCancel: () => void;
    readonly onPointerLeave: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
  };
  /** Getter (κανόνας ADR-040: τη στιγμή της απόδοσης, όχι στιγμιότυπο) — πού είναι ο δείκτης. */
  readonly quadrant: () => Terrain3dPointerQuadrant;
}

export function useTerrain3dPointer(deps: Pointer3dDeps): Terrain3dPointerApi {
  const { schedule, profileAnchor } = useFramePick(deps);
  const down = useRef<PlanarPoint | null>(null);
  const quadrant = useRef<Terrain3dPointerQuadrant>('elsewhere');
  // Στην αφή το πάτημα-κράτημα ΠΑΝΤΑ καρφιτσώνει — και στο εργαλείο προφίλ, όπου η τομή ορίζεται στην κάτοψη.
  const longPress = useLongPress({
    onLongPress: (client) => {
      const at = deps.getEngine()?.pick(client.x, client.y);
      if (at) deps.store?.pinAt(at.x, at.y);
    },
  });

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    down.current = { x: e.clientX, y: e.clientY };
    if (e.pointerType === 'touch') longPress.onPointerDown(e);
  }, [longPress]);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const left = e.clientX - rect.left < rect.width / 2;
    const top = e.clientY - rect.top < rect.height / 2;
    quadrant.current = left && top ? 'top-left' : 'elsewhere';
    if (e.pointerType === 'touch') { longPress.onPointerMove(e); return; }
    if (e.buttons !== 0) { deps.store?.clearProbe(); return; }
    schedule({ x: e.clientX, y: e.clientY });
  }, [deps.store, longPress, schedule]);

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    longPress.onPointerUp();
    const start = down.current;
    down.current = null;
    if (e.pointerType === 'touch' || start === null) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) <= CLICK_TOLERANCE_PX) clickAt(deps, profileAnchor, e.clientX, e.clientY);
  }, [deps, longPress, profileAnchor]);

  const onPointerCancel = useCallback(() => { down.current = null; longPress.onPointerCancel(); }, [longPress]);
  const onPointerLeave = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType !== 'touch' && profileAnchor.current === null) deps.store?.clearProbe();
  }, [deps.store, profileAnchor]);

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave },
    quadrant: () => quadrant.current,
  };
}
