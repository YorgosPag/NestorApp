/**
 * @fileoverview **Πού πάει η λωρίδα όταν πατηθεί ◀ ή ▶;** — καθαρή κρίση του `ScrollRail`.
 * @related ADR-896 §7Α.5 · ui/scroll-rail · lib/a11y/reveal-in-scroll (InlineSpan/InlineView)
 * @module components/ui/scroll-rail-geometry
 *
 * 🔑 **ΠΟΤΕ ΜΙΣΟ ΤΣΙΠ, ΠΟΤΕ ΠΡΟΣΠΕΡΑΣΜΕΝΟ ΤΣΙΠ.** Η συνήθης «σελίδα» (`scrollBy(±80% του πλάτους)`)
 * σταματά όπου τύχει: κόβει τσιπ στη μέση, και αν το βήμα είναι μεγαλύτερο από το κομμένο, το
 * προσπερνά χωρίς να φανεί ποτέ ολόκληρο. Εδώ το βήμα **διαλέγει στοιχείο**:
 * • ▶ — το τσιπ που κόβεται (ή κρύβεται) στη δεξιά άκρη γίνεται το **πρώτο** ορατό.
 * • ◀ — το τσιπ που κόβεται στην αριστερή άκρη γίνεται ολόκληρο ορατό, και η λωρίδα ξεκινά
 *   σε **αρχή τσιπ** — δηλαδή σε σημείο snap, ώστε το `scroll-snap` να μη μετακινήσει ξανά τον στόχο.
 * Το 80% μένει μόνο ως δίχτυ: ένα τσιπ φαρδύτερο από το κάδρο δεν «χωρά» πουθενά.
 *
 * 📐 `inset` = η ζώνη σβησίματος (`scroll-padding-inline`, CSS): τσιπ κάτω από τη μάσκα δεν φαίνεται.
 */

import {
  clampInlineScroll,
  inlineSpanWithin,
  type InlineSpan,
  type InlineView,
} from '@/lib/a11y/reveal-in-scroll';

export type RailDirection = 'prev' | 'next';

/** Υποπίξελ διαφορές (zoom, DPR) δεν είναι «κομμένο». */
const EPSILON = 1;

/** Το βήμα όταν κανένα στοιχείο δεν δίνει στόχο (τσιπ φαρδύτερο από το κάδρο). */
const FALLBACK_PAGE_RATIO = 0.8;

function fallbackTarget(direction: RailDirection, view: InlineView): number {
  const step = view.clientWidth * FALLBACK_PAGE_RATIO;
  return clampInlineScroll(view.scrollLeft + (direction === 'next' ? step : -step), view);
}

function nextTarget(view: InlineView, spans: readonly InlineSpan[], inset: number): number | null {
  const visibleEnd = view.scrollLeft + view.clientWidth - inset;
  const cut = spans.find((span) => span.end > visibleEnd + EPSILON);
  return cut === undefined ? null : cut.start - inset;
}

function prevTarget(view: InlineView, spans: readonly InlineSpan[], inset: number): number | null {
  const visibleStart = view.scrollLeft + inset;
  const cut = [...spans].reverse().find((span) => span.start < visibleStart - EPSILON);
  if (cut === undefined) return null;
  // Το ελάχιστο scroll που δείχνει ολόκληρο το κομμένο, στρογγυλεμένο **προς τα πάνω** σε αρχή τσιπ.
  const minimal = cut.end + inset - view.clientWidth;
  const aligned = spans.find((span) => span.start - inset >= minimal - EPSILON);
  return aligned === undefined ? minimal : aligned.start - inset;
}

/**
 * @returns το `scrollLeft` στόχου, ήδη μέσα στα όρια. Ίσο με το τρέχον ⇒ δεν υπάρχει τίποτα πέρα.
 */
export function pageTargetOf(
  direction: RailDirection,
  view: InlineView,
  spans: readonly InlineSpan[],
  inset = 0,
): number {
  const raw = direction === 'next' ? nextTarget(view, spans, inset) : prevTarget(view, spans, inset);
  if (raw === null) return fallbackTarget(direction, view);
  const target = clampInlineScroll(raw, view);
  const advances = direction === 'next' ? target > view.scrollLeft + EPSILON : target < view.scrollLeft - EPSILON;
  return advances ? target : fallbackTarget(direction, view);
}

/** Τα παιδιά της λωρίδας ως θέσεις στον άξονά της (σειρά DOM = σειρά οθόνης). */
export function railSpansOf(scroller: Element): InlineSpan[] {
  return Array.from(scroller.children, (child) => inlineSpanWithin(scroller, child));
}

/**
 * Η ζώνη σβησίματος **όπως τη δηλώνει το CSS** (`scroll-padding-inline-start`) — ένας αριθμός, μία πηγή.
 * jsdom/άγνωστο ⇒ 0.
 */
export function railInsetOf(scroller: Element): number {
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return 0;
  const value = Number.parseFloat(window.getComputedStyle(scroller).scrollPaddingInlineStart);
  return Number.isFinite(value) ? value : 0;
}
