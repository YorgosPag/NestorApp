'use client';

/**
 * **Οι χειρονομίες του προβολέα PDF** (ADR-928 §5.25.2) — ό,τι κάνει το χέρι, όπως στο Chrome PDF · pdf.js · Acrobat · Figma.
 *
 * 🔑 Η **σκέτη ροδέλα ΚΥΛΑ** (native — με την ορμή και την προσβασιμότητα του browser)· ζουμ **μόνο** με Ctrl/⌘ + ροδέλα
 *    και με pinch (trackpad: φτάνει ως `wheel` με `ctrlKey` · οθόνη αφής: δύο δάχτυλα). Μέχρι την 2026-11-07 η σκέτη
 *    ροδέλα έκανε ζουμ ×1,1 ⇒ ο άνθρωπος που ήθελε να κατέβει στη σελίδα την **σμίκρυνε** (200 % → 182 %, μετρημένο live).
 * 🔑 Ζουμ γύρω από τον δείκτη / το μέσο των δαχτύλων — η άγκυρα ζει στο `usePdfViewport`.
 * 🔑 Ένα ζουμ ανά **καρέ** (`requestAnimationFrame`): δεκάδες γεγονότα του trackpad ενώνονται σε μία αλλαγή, και κάθε
 *    επόμενο γεγονός συνεχίζει από τον **στόχο** που περιμένει, όχι από το παλιό ζουμ (αλλιώς χάνονταν βήματα).
 * 🔑 Σύρσιμο με το ποντίκι = «χέρι» πάνω στην **κύλιση** (όχι μετασχηματισμός): οι γραμμές κύλισης λένε πάντα την αλήθεια.
 *    Στην αφή, η κύλιση με ένα δάχτυλο είναι του browser (`touch-action: pan-x pan-y`).
 */

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

import { midpoint, pointDistance, WHEEL_ZOOM_SENSITIVITY, wheelDeltaPx, wheelZoom, type Vec2, type ZoomLimits } from '@/lib/geometry/zoom-pan-math';

export interface ZoomGestureSink {
  /** Το ζουμ από το οποίο συνεχίζει η επόμενη κίνηση (ο στόχος που περιμένει, αλλιώς το τρέχον). */
  readonly from: () => number;
  /** Ζητά ζουμ γύρω από σημείο της οθόνης· εφαρμόζεται στο επόμενο καρέ. */
  readonly request: (scale: number, point: Vec2) => void;
}

/** Ενώνει τα αιτήματα ζουμ ενός καρέ σε **ένα** `apply`. */
export function useFrameCoalescedZoom(current: () => number, apply: (scale: number, point: Vec2) => void): ZoomGestureSink {
  const pending = useRef<{ scale: number; point: Vec2 } | null>(null);
  const frame = useRef(0);
  const latest = useRef({ current, apply });
  useLayoutEffect(() => { latest.current = { current, apply }; });
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const sink = useRef<ZoomGestureSink>({
    from: () => pending.current?.scale ?? latest.current.current(),
    request: (scale, point) => {
      pending.current = { scale, point };
      if (frame.current !== 0) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        const next = pending.current;
        pending.current = null;
        if (next) latest.current.apply(next.scale, next.point);
      });
    },
  });
  return sink.current;
}

/** Ctrl/⌘ + ροδέλα (και pinch του trackpad) ⇒ ζουμ· η σκέτη ροδέλα δεν αγγίζεται ⇒ κύλιση του browser. */
export function useCtrlWheelZoom(containerRef: RefObject<HTMLElement>, sink: ZoomGestureSink, limits: ZoomLimits): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const scale = wheelZoom(sink.from(), wheelDeltaPx(event), WHEEL_ZOOM_SENSITIVITY, limits);
      sink.request(scale, { x: event.clientX, y: event.clientY });
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [containerRef, sink, limits]);
}

function touchPoints(event: TouchEvent): readonly [Vec2, Vec2] | null {
  if (event.touches.length !== 2) return null;
  const [a, b] = [event.touches[0], event.touches[1]];
  return [{ x: a.clientX, y: a.clientY }, { x: b.clientX, y: b.clientY }];
}

/** Δύο δάχτυλα ⇒ ζουμ γύρω από το μέσο τους (Apple/Google Photos)· ένα δάχτυλο μένει κύλιση του browser. */
export function useTouchPinchZoom(containerRef: RefObject<HTMLElement>, sink: ZoomGestureSink): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let start: { distance: number; scale: number } | null = null;
    const onStart = (event: TouchEvent) => {
      const points = touchPoints(event);
      start = points ? { distance: pointDistance(points[0], points[1]), scale: sink.from() } : null;
    };
    const onMove = (event: TouchEvent) => {
      const points = touchPoints(event);
      if (!start || !points || start.distance <= 0) return;
      event.preventDefault();
      sink.request(start.scale * (pointDistance(points[0], points[1]) / start.distance), midpoint(points[0], points[1]));
    };
    const onEnd = (event: TouchEvent) => { if (event.touches.length < 2) start = null; };
    container.addEventListener('touchstart', onStart, { passive: true });
    container.addEventListener('touchmove', onMove, { passive: false });
    container.addEventListener('touchend', onEnd);
    container.addEventListener('touchcancel', onEnd);
    return () => {
      container.removeEventListener('touchstart', onStart);
      container.removeEventListener('touchmove', onMove);
      container.removeEventListener('touchend', onEnd);
      container.removeEventListener('touchcancel', onEnd);
    };
  }, [containerRef, sink]);
}

/**
 * ADR-923 §5.5.2 Β8 — **χειριστήριο πάνω στη σελίδα** (π.χ. πλαίσιο αναθεώρησης): το κλικ του είναι επιλογή, όχι «χέρι».
 * Όποιο επίπεδο του `pageOverlay` ζωγραφίζει κάτι που πατιέται το δηλώνει με αυτό το χαρακτηριστικό — ποτέ ωμό string.
 * ⚠️ Μετρημένο live 2026-11-10: χωρίς αυτό το `setPointerCapture` έστελνε το `click` στο δοχείο ⇒ το πλαίσιο εστιαζόταν
 *    αλλά **δεν επιλεγόταν ποτέ** με το ποντίκι (μόνο Enter/Space). Το jsdom δεν έχει pointer capture: κανένα jest δεν το βλέπει.
 */
export const PDF_PAGE_CONTROL_ATTRIBUTE = 'data-pdf-page-control';

/**
 * ADR-923 §5.15.2 (Θ.2α-2) — στόχοι που **ανήκουν σε άλλη χειρονομία**: σύρσιμο πάνω σε κείμενο = επιλογή, κλικ σε σύνδεσμο
 * = σύνδεσμος, κλικ σε χειριστήριο της σελίδας = επιλογή (Acrobat · Chrome PDF: στο κενό της σελίδας «χέρι»).
 * Αλλιώς το `setPointerCapture` θα έκλεβε και τα τρία.
 */
const PAN_EXEMPT_TARGETS = `[data-pdf-text-layer] span, [data-pdf-link], [${PDF_PAGE_CONTROL_ATTRIBUTE}]`;

function isPanExempt(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(PAN_EXEMPT_TARGETS) !== null;
}

/** Σύρσιμο με το αριστερό του ποντικιού ⇒ κύλιση («χέρι» του Acrobat)· αφή και γραφίδα μένουν στον browser. */
export function useMouseDragPan(containerRef: RefObject<HTMLElement>): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let drag: { x: number; y: number; left: number; top: number } | null = null;
    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || isPanExempt(event.target)) return;
      drag = { x: event.clientX, y: event.clientY, left: container.scrollLeft, top: container.scrollTop };
      container.setPointerCapture(event.pointerId);
      container.style.cursor = 'grabbing';
    };
    const onMove = (event: PointerEvent) => {
      if (!drag) return;
      container.scrollLeft = drag.left - (event.clientX - drag.x);
      container.scrollTop = drag.top - (event.clientY - drag.y);
    };
    const onUp = (event: PointerEvent) => {
      if (!drag) return;
      drag = null;
      if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
      container.style.cursor = 'grab';
    };
    container.style.cursor = 'grab';
    container.addEventListener('pointerdown', onDown);
    container.addEventListener('pointermove', onMove);
    container.addEventListener('pointerup', onUp);
    container.addEventListener('pointercancel', onUp);
    return () => {
      container.removeEventListener('pointerdown', onDown);
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerup', onUp);
      container.removeEventListener('pointercancel', onUp);
    };
  }, [containerRef]);
}
