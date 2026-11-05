'use client';

/**
 * **Το έγγραφο ως σελίδα, με ζουμ «προσαρμογή στο πλάτος»** (ADR-928 §5.23) — όπως το Word, το Ironclad και κάθε
 * προβολέας PDF, όχι ως κείμενο που απλώνει.
 *
 * 🔑 Φαρδύτερη στήλη **δεν** σημαίνει μακρύτερες γραμμές: πάνω από ~90 χαρακτήρες το μάτι χάνει τη γραμμή, και το
 *    τυπωμένο έγγραφο έχει πλάτος Α4. Άρα η σελίδα κρατά πλάτος Α4 και **μεγεθύνεται** (CSS `zoom`, που αλλάζει και τη
 *    διάταξη — όχι `transform`, που αφήνει λάθος ύψος και κύλιση).
 * 🔑 Στενότερη στήλη από Α4 ⇒ καμία σμίκρυνση: το κείμενο ρέει όπως πριν (ζουμ κάτω του 1 = δυσανάγνωστα γράμματα).
 * 🔑 Ταβάνι ×2, το ίδιο με τον προβολέα PDF της εφαρμογής (`PdfCanvasViewer`): πάνω από αυτό δεν διαβάζεις καλύτερα.
 * ⚠️ Το πλάτος/ζουμ γράφεται **προστακτικά** στο στοιχείο (όπως η `react-resizable-panels` γράφει `flex-grow`), όχι ως
 *    `style` στο JSX: αλλάζει σε κάθε pixel συρσίματος και δεν πρέπει να περνά από render (ADR-040).
 */

import { useLayoutEffect, useRef, type RefObject } from 'react';

/** Πλάτος Α4 (210 mm) σε CSS px, στα 96 dpi του CSS. */
export const PAPER_A4_WIDTH_PX = 794;
export const PAPER_MAX_ZOOM = 2;

export interface PaperFit {
  /** `null` ⇒ ρευστό πλάτος (στήλη στενότερη από τη σελίδα). */
  readonly widthPx: number | null;
  readonly zoom: number;
}

/** Καθαρή: πόσο πλάτος και ζουμ παίρνει η σελίδα σε στήλη `availablePx`. Δύο δεκαδικά — όχι αναδιάταξη ανά pixel. */
export function paperFitOf(availablePx: number): PaperFit {
  if (!Number.isFinite(availablePx) || availablePx <= PAPER_A4_WIDTH_PX) return { widthPx: null, zoom: 1 };
  const zoom = Math.min(availablePx / PAPER_A4_WIDTH_PX, PAPER_MAX_ZOOM);
  return { widthPx: PAPER_A4_WIDTH_PX, zoom: Math.floor(zoom * 100) / 100 };
}

function applyFit(page: HTMLElement, fit: PaperFit) {
  page.style.width = fit.widthPx === null ? '' : `${fit.widthPx}px`;
  page.style.setProperty('zoom', fit.zoom === 1 ? '' : String(fit.zoom));
}

/**
 * Η σελίδα (`pageRef`) προσαρμόζεται στο πλάτος του πλαισίου της (`frameRef`) — σε κάθε αλλαγή μεγέθους του πλαισίου
 * (σύρσιμο διαχωριστικού, «Μόνο έγγραφο», παράθυρο). Χωρίς `ResizeObserver` (jsdom) ⇒ ρευστό, όπως πριν.
 */
export function usePaperFit(enabled: boolean): { readonly frameRef: RefObject<HTMLDivElement | null>; readonly pageRef: RefObject<HTMLElement | null> } {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const page = pageRef.current;
    if (!enabled || !frame || !page || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => applyFit(page, paperFitOf(frame.clientWidth)));
    observer.observe(frame);
    return () => {
      observer.disconnect();
      applyFit(page, { widthPx: null, zoom: 1 });
    };
  }, [enabled]);
  return { frameRef, pageRef };
}
