'use client';

/**
 * @fileoverview **ΣΥΡΕ ΚΑΙ ΑΦΗΣΕ** — ένα στοιχείο ακολουθεί τον δείκτη και, όταν αφεθεί, λέει **πού** (ADR-884 Φ2δ · §4.10).
 * @related `TourPanoramaStage.tsx` (βελάκι που σέρνεται) · `editor/TourArrowTools.tsx` (τσιπ προορισμού — πρότυπο Kuula
 *   «Fast Hotspot»)
 * @module components/spatial-tour/viewer/usePointerDragRelease
 *
 * 🔑 **Pointer Events με `setPointerCapture` στο ΙΔΙΟ το στοιχείο**: ο καμβάς δεν λαμβάνει ποτέ το σύρσιμο ⇒ καμία
 *   σύγκρουση με το σύρσιμο ματιάς (`useTourPanoramaInput`). Ποντίκι, αφή και γραφίδα από ένα μονοπάτι — όχι HTML5 DnD,
 *   που δεν δουλεύει με το δάχτυλο.
 * 🔑 **Κατώφλι**: κάτω από {@link DRAG_THRESHOLD_PX} είναι **κλικ** (το βελάκι πηγαίνει στο σημείο)· πάνω, είναι
 *   σύρσιμο και το κλικ που ακολουθεί **καταπίνεται**.
 * 🔑 **Μετατόπιση με την ιδιότητα CSS `translate`**, όχι `transform`: το `transform` το γράφει ανά καρέ η σκηνή για να
 *   κρατά το βελάκι πάνω στη φωτογραφία — οι δύο ιδιότητες συντίθενται, καμία δεν σβήνει την άλλη.
 * ♿ Το σύρσιμο έχει **πάντα** εναλλακτική ενός κλικ δίπλα του (WCAG 2.2 · 2.5.7) — εδώ είναι μόνο η βελτίωση.
 */

import { type MouseEvent, type PointerEvent, useMemo, useRef } from 'react';

/** Πόσα px πρέπει να κινηθεί ο δείκτης ώστε να μην είναι κλικ (ίδιο τάγμα με το `dragDistance` των βιβλιοθηκών). */
export const DRAG_THRESHOLD_PX = 4;

export interface PointerDragReleaseHandlers {
  readonly onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  readonly onPointerMove: (e: PointerEvent<HTMLElement>) => void;
  readonly onPointerUp: (e: PointerEvent<HTMLElement>) => void;
  readonly onPointerCancel: (e: PointerEvent<HTMLElement>) => void;
  readonly onClickCapture: (e: MouseEvent<HTMLElement>) => void;
}

interface Gesture {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  dragging: boolean;
}

function settle(el: HTMLElement): void {
  el.style.translate = '';
  delete el.dataset.dragging;
}

/** Οι χειριστές ενός στοιχείου που σέρνεται· `onRelease` καλείται **μόνο** για πραγματικό σύρσιμο. */
export function usePointerDragRelease(onRelease: (clientX: number, clientY: number) => void): PointerDragReleaseHandlers {
  const gesture = useRef<Gesture | null>(null);
  const swallowClick = useRef(false);
  const release = useRef(onRelease);
  release.current = onRelease;

  return useMemo<PointerDragReleaseHandlers>(() => ({
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      gesture.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, dragging: false };
    },
    onPointerMove: (e) => {
      const g = gesture.current;
      if (g === null || g.pointerId !== e.pointerId) return;
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (!g.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      g.dragging = true;
      e.currentTarget.dataset.dragging = 'true';
      e.currentTarget.style.translate = `${dx}px ${dy}px`;
    },
    onPointerUp: (e) => {
      const g = gesture.current;
      gesture.current = null;
      if (g === null || g.pointerId !== e.pointerId) return;
      settle(e.currentTarget);
      swallowClick.current = g.dragging;
      if (g.dragging) release.current(e.clientX, e.clientY);
    },
    onPointerCancel: (e) => {
      gesture.current = null;
      settle(e.currentTarget);
    },
    onClickCapture: (e) => {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  }), []);
}
