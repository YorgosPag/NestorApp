'use client';

/**
 * @fileoverview **ΔΕΙΚΤΗΣ, ΔΑΧΤΥΛΟ ΚΑΙ ΠΛΗΚΤΡΟΛΟΓΙΟ ΠΑΝΩ ΣΤΗΝ ΚΑΤΟΨΗ** — μετατρέπει συμβάντα του SVG σε ερωτήσεις προς το store της
 *   επιθεώρησης (ADR-920 §14.10 Ε1 · Ε3).
 * @related ./terrain-inspect-store (ο ΜΟΝΟΣ αποδέκτης) · `@/hooks/gestures/useLongPress` (το πάτημα-κράτημα της αφής)
 * @module components/listing-detail/terrain/useTerrainMapPointer
 *
 * 🖱️ **Ποντίκι / γραφίδα**: η κίνηση δείχνει (μία εγγραφή ανά καρέ, `requestAnimationFrame`) · το κλικ καρφιτσώνει.
 * 👆 **Αφή**: δεν υπάρχει hover — το **πάτημα-κράτημα** καρφιτσώνει (CalTopo · Google Maps). Ένα απλό άγγιγμα ή σύρσιμο μένει
 *   κύλιση της σελίδας: ο χάρτης δεν «κλέβει» ποτέ το δάχτυλο. Το κριτήριο είναι το `pointerType` **του συμβάντος**, όχι μια
 *   ερώτηση media: ένα laptop με οθόνη αφής έχει και τα δύο.
 * 📏 **Εργαλείο προφίλ**: πάτημα = Α, σύρσιμο = Β (με σύλληψη του δείκτη)· εδώ ο χάρτης κρατά και την αφή (`touch-none`).
 * ⌨️ **Πληκτρολόγιο** (WCAG 2.1.1): βέλη = σταυρόνημα 1 m (Shift: 10 m) · Enter = καρφίτσωμα · Esc = καθάρισμα
 *   (`terrain-inspect-escape.ts` — το ΕΝΑ σημείο, δύο στάδια).
 * 📐 Οθόνη → χάρτης με το `getScreenCTM()` του ίδιου του SVG (1 μονάδα = 1 m, y προς τα κάτω ⇒ βορράς = −y).
 */

import { useCallback, useEffect, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

import { useLongPress } from '@/hooks/gestures/useLongPress';
import type { PlanarPoint } from '@/lib/geometry/planar-polygon';

import { useTerrainInspectStore } from './TerrainInspectContext';
import { clearInspectOnEscape } from './terrain-inspect-escape';
import { activeReading, type TerrainInspectStore } from './terrain-inspect-store';

/** Βήμα του σταυρονήματος στο πληκτρολόγιο, μέτρα (Shift ⇒ ×10). */
const TERRAIN_KEYBOARD_STEP_M = 1;
const KEYBOARD_FAST_FACTOR = 10;

const ARROWS: Readonly<Record<string, PlanarPoint>> = {
  ArrowUp: { x: 0, y: 1 }, ArrowDown: { x: 0, y: -1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
};

/** Σημείο οθόνης → πλαίσιο snapshot (μέτρα ανατολικά / βόρεια του κέντρου), ή `null` χωρίς μετασχηματισμό. */
function svgClientToSnapshot(svg: SVGSVGElement, clientX: number, clientY: number): PlanarPoint | null {
  const matrix = svg.getScreenCTM();
  if (matrix === null) return null;
  const p = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  return { x: p.x, y: -p.y };
}

/** Μία εγγραφή ανά καρέ: κρατά το ΤΕΛΕΥΤΑΙΟ αίτημα του καρέ και το εκτελεί στο επόμενο `requestAnimationFrame`. */
function useFrameThrottle() {
  const pending = useRef<(() => void) | null>(null);
  const frame = useRef<number | null>(null);
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  return useCallback((job: () => void) => {
    pending.current = job;
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const run = pending.current;
      pending.current = null;
      run?.();
    });
  }, []);
}

function keyboardStep(store: TerrainInspectStore, e: KeyboardEvent<SVGSVGElement>): boolean {
  if (clearInspectOnEscape(store, e)) return true;
  const current = activeReading(store.get());
  if (e.key === 'Enter' || e.key === ' ') { if (current) store.pinAt(current.x, current.y); return current !== null; }
  const arrow = ARROWS[e.key];
  if (!arrow) return false;
  const step = TERRAIN_KEYBOARD_STEP_M * (e.shiftKey ? KEYBOARD_FAST_FACTOR : 1);
  const from = current ?? { x: 0, y: 0 };
  store.probeAt(from.x + arrow.x * step, from.y + arrow.y * step);
  return true;
}

interface TerrainMapPointerHandlers {
  readonly onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => void;
  readonly onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => void;
  readonly onPointerUp: (e: ReactPointerEvent<SVGSVGElement>) => void;
  readonly onPointerCancel: () => void;
  readonly onPointerLeave: (e: ReactPointerEvent<SVGSVGElement>) => void;
  readonly onKeyDown: (e: KeyboardEvent<SVGSVGElement>) => void;
}

/** Οι χειριστές του SVG της κάτοψης. Χωρίς πάροχο επιθεώρησης δεν κάνουν τίποτα. */
export function useTerrainMapPointer(svgRef: RefObject<SVGSVGElement | null>): TerrainMapPointerHandlers {
  const store = useTerrainInspectStore();
  const throttle = useFrameThrottle();
  const anchor = useRef<PlanarPoint | null>(null);
  const at = useCallback((x: number, y: number) => (svgRef.current ? svgClientToSnapshot(svgRef.current, x, y) : null), [svgRef]);
  const longPress = useLongPress({
    onLongPress: (client) => { const p = at(client.x, client.y); if (p && store) store.pinAt(p.x, p.y); },
  });

  const onPointerDown = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (!store) return;
    if (store.get().tool === 'profile') {
      anchor.current = at(e.clientX, e.clientY);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (e.pointerType === 'touch') longPress.onPointerDown(e);
  }, [store, at, longPress]);

  const onPointerMove = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (!store) return;
    const { clientX, clientY, pointerType } = e;
    if (pointerType === 'touch') longPress.onPointerMove(e);
    const a = anchor.current;
    if (a !== null) { throttle(() => { const b = at(clientX, clientY); if (b) store.setProfileLine(a, b); }); return; }
    if (pointerType !== 'touch' && store.get().tool === 'inspect') {
      throttle(() => { const p = at(clientX, clientY); if (p) store.probeAt(p.x, p.y); });
    }
  }, [store, at, throttle, longPress]);

  const onPointerUp = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    longPress.onPointerUp();
    if (!store) return;
    if (anchor.current !== null) { anchor.current = null; return; }
    if (e.pointerType !== 'touch' && store.get().tool === 'inspect') {
      const p = at(e.clientX, e.clientY);
      if (p) store.pinAt(p.x, p.y);
    }
  }, [store, at, longPress]);

  const onPointerCancel = useCallback(() => { anchor.current = null; longPress.onPointerCancel(); }, [longPress]);
  const onPointerLeave = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== 'touch' && anchor.current === null) throttle(() => store?.clearProbe());
  }, [store, throttle]);
  const onKeyDown = useCallback((e: KeyboardEvent<SVGSVGElement>) => {
    if (store && keyboardStep(store, e)) e.preventDefault();
  }, [store]);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave, onKeyDown };
}
