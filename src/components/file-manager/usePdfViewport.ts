'use client';

/**
 * **Η όψη του προβολέα PDF** (ADR-928 §5.25.2) — ο ΕΝΑΣ κάτοχος του ζουμ, της προσαρμογής και της κύλισης.
 *
 * 🏆 Chrome PDF · pdf.js · Acrobat: ο χώρος της σελίδας είναι **πλαίσιο κύλισης**· σελίδα που χωρά ⇒ στο κέντρο, σελίδα
 *    που δεν χωρά ⇒ από την **κορυφή** (αυτόματα περιθώρια στο flex — «safe centering» χωρίς εξάρτηση από το `safe`).
 *    Ως την 2026-11-07 ο χώρος ήταν `overflow-hidden` + `items-center` ⇒ σελίδα Α4 στην «Προσαρμογή» έκρυβε **476 px
 *    πάνω και 476 px κάτω**, χωρίς καμία κύλιση (μετρημένο live).
 * 🔑 Το ζουμ **παράγεται**: σε τρόπο προσαρμογής = συνάρτηση (σελίδα, χώρος) ⇒ ακολουθεί κάθε αλλαγή πλάτους πάνελ, στροφή
 *    και σελίδα, χωρίς αλυσίδα effects· στο χειροκίνητο = η τιμή του ανθρώπου.
 * 🔑 Το μέγεθος της σελίδας γράφεται **σύγχρονα** (`useLayoutEffect`) πριν ζωγραφίσει ο browser, και αμέσως μετά επανέρχεται
 *    η άγκυρα (`zoom-anchor`, ο κανόνας της σελίδας εγγράφου): ό,τι κοίταζες μένει εκεί. Το bitmap του canvas
 *    ξαναζωγραφίζεται μετά (pdf.js: πρώτα τεντώνει, μετά καθαρίζει) — το ζουμ δεν περιμένει το pdf.js.
 * 🔑 `scrollbar-gutter: stable` στον χώρο: η γραμμή κύλισης που εμφανίζεται στο ζουμ δεν στενεύει το πλάτος ⇒ η
 *    «Προσαρμογή στο πλάτος» δεν ταλαντεύεται ανάμεσα σε δύο ζουμ.
 */

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';

import { captureZoomAnchor, readingPointOf, restoreZoomAnchor, type ZoomAnchor } from '@/components/shared/media/viewer/zoom-anchor';
import { clampZoom, ladderZoom, type Extent, type Vec2, type ZoomLimits } from '@/lib/geometry/zoom-pan-math';

import { otherFitMode, pdfFitScaleOf, type PdfFitMode } from './pdf-viewport-fit';
import { useCtrlWheelZoom, useFrameCoalescedZoom, useMouseDragPan, useTouchPinchZoom } from './pdf-viewport-gestures';

export interface PdfViewport {
  readonly containerRef: RefObject<HTMLDivElement>;
  /** Το ζουμ που ισχύει (και στην προσαρμογή — το υπολογισμένο). */
  readonly scale: number;
  readonly fit: PdfFitMode | null;
  /** Ξέρουμε σελίδα **και** χώρο — πριν από αυτό ο θεατής δεν ζωγραφίζει (καμία ζωγραφιά σε λάθος ζουμ). */
  readonly ready: boolean;
  readonly step: (direction: 1 | -1) => void;
  readonly zoomTo: (scale: number) => void;
  readonly fitTo: (mode: PdfFitMode) => void;
  readonly toggleFit: () => void;
}

export interface PdfViewportOptions {
  /** Η τρέχουσα σελίδα σε κλίμακα 1, **ήδη** στραμμένη· `null` πριν φορτώσει. */
  readonly page: Extent | null;
  /** Αλλάζει σε κάθε αλλαγή σελίδας ⇒ η νέα σελίδα ξεκινά από την κορυφή (Acrobat, μονοσέλιδη προβολή). */
  readonly pageKey: number;
  readonly limits: ZoomLimits;
  readonly canvasRef: RefObject<HTMLCanvasElement>;
}

interface ZoomChoice {
  readonly fit: PdfFitMode | null;
  readonly manualScale: number;
}

/** Η άγκυρα μιας αλλαγής, δεμένη στο ζουμ για το οποίο πάρθηκε — αλλαγή που δεν άλλαξε τίποτα δεν αφήνει «μπαγιάτικη» άγκυρα. */
interface PendingAnchor {
  readonly anchor: ZoomAnchor;
  readonly forScale: number;
}

function innerBoxOf(element: HTMLElement): Extent {
  const style = window.getComputedStyle(element);
  return {
    width: element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
    height: element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
  };
}

/** Ο χώρος της σελίδας, μετρημένος πριν το πρώτο καρέ και σε κάθε αλλαγή μεγέθους. */
function useInnerBox(containerRef: RefObject<HTMLElement>): Extent | null {
  const [box, setBox] = useState<Extent | null>(null);
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const next = innerBoxOf(container);
      setBox((prev) => (prev && prev.width === next.width && prev.height === next.height ? prev : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);
  return box;
}

function scaleOf(choice: ZoomChoice, page: Extent | null, box: Extent | null, limits: ZoomLimits): number {
  if (choice.fit !== null && page && box) return pdfFitScaleOf(choice.fit, page, box, limits);
  return clampZoom(choice.manualScale, limits);
}

/** Μέγεθος σελίδας → αμέσως η άγκυρα (αν ανήκει σε αυτό το ζουμ)· νέα σελίδα → κορυφή. */
function useApplyPageSize(
  { canvasRef, containerRef, page, pageKey, scale, pending }:
  { canvasRef: RefObject<HTMLCanvasElement>; containerRef: RefObject<HTMLElement>; page: Extent | null; pageKey: number; scale: number; pending: { current: PendingAnchor | null } },
): void {
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !page) return;
    canvas.style.width = `${page.width * scale}px`;
    canvas.style.height = `${page.height * scale}px`;
    const anchor = pending.current;
    pending.current = null;
    if (anchor && anchor.forScale === scale) restoreZoomAnchor(anchor.anchor);
  }, [canvasRef, page, scale, pending]);
  useLayoutEffect(() => {
    containerRef.current?.scrollTo({ top: 0 });
  }, [containerRef, pageKey]);
}

export function usePdfViewport({ page, pageKey, limits, canvasRef }: PdfViewportOptions): PdfViewport {
  const containerRef = useRef<HTMLDivElement>(null);
  const box = useInnerBox(containerRef);
  const [choice, setChoice] = useState<ZoomChoice>({ fit: 'width', manualScale: 1 });
  const scale = scaleOf(choice, page, box, limits);
  const pending = useRef<PendingAnchor | null>(null);
  const live = useRef({ choice, page, box, scale });
  useLayoutEffect(() => { live.current = { choice, page, box, scale }; });

  /** Η μία πόρτα κάθε αλλαγής από τον άνθρωπο: άγκυρα (σημείο ή παράγραφος ανάγνωσης) → νέα επιλογή. */
  const choose = useCallback((next: ZoomChoice, point: Vec2 | null) => {
    const { page: p, box: b } = live.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (canvas && container) {
      // Ο χώρος είναι ΚΑΙ ο κάθετος κυλιστής: σελίδα που χωρά ⇒ καμία κύλιση — ποτέ της εφαρμογής από κάτω.
      const anchor = captureZoomAnchor(canvas, container, point ?? readingPointOf(canvas, container, container), container);
      pending.current = { anchor, forScale: scaleOf(next, p, b, limits) };
    }
    setChoice(next);
  }, [canvasRef, limits]);

  useApplyPageSize({ canvasRef, containerRef, page, pageKey, scale, pending });

  const sink = useFrameCoalescedZoom(() => live.current.scale, (next, point) => choose({ fit: null, manualScale: clampZoom(next, limits) }, point));
  useCtrlWheelZoom(containerRef, sink, limits);
  useTouchPinchZoom(containerRef, sink);
  useMouseDragPan(containerRef);

  // Η προσαρμογή κρατά ως `manualScale` το ζουμ που φαίνεται: το πρώτο χειροκίνητο βήμα ξεκινά από εκεί (σκάλα Chrome).
  const step = useCallback((direction: 1 | -1) => {
    choose({ fit: null, manualScale: ladderZoom(live.current.scale, limits, direction) }, null);
  }, [choose, limits]);
  const zoomTo = useCallback((next: number) => choose({ fit: null, manualScale: clampZoom(next, limits) }, null), [choose, limits]);
  const fitTo = useCallback((mode: PdfFitMode) => choose({ fit: mode, manualScale: live.current.scale }, null), [choose]);
  const toggleFit = useCallback(() => fitTo(otherFitMode(live.current.choice.fit)), [fitTo]);

  return { containerRef, scale, fit: choice.fit, ready: page !== null && box !== null, step, zoomTo, fitTo, toggleFit };
}
