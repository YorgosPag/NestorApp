'use client';
/**
 * @fileoverview **Υπερχείλιση κατά προτεραιότητα** — πόσα στοιχεία μιας γραμμής χωρούν· τα υπόλοιπα τα αναλαμβάνει ΕΝΑ
 *   στοιχείο «περισσότερα» (μενού ενεργειών, σήμα «+N»).
 * @related ADR-777 §8.87.7 (γραμμή ενεργειών, η πρώτη χρήση) · ADR-777 §8.87.9γ2 + ADR-912 §11 (γραμμή σημάτων κάρτας) ·
 *   `useElementSize.ts` (ο ΕΝΑΣ παρατηρητής μεγέθους)
 * @module hooks/media/usePriorityOverflow
 *
 * 🔑 **Η ερώτηση είναι «πόσο χώρο έχω», όχι «πόσο πλατιά είναι η οθόνη»**: η γραμμή ζει δίπλα σε πλαϊνό μενού, μέσα σε
 *   στενή στήλη ή σε φύλλο κινητού, άρα κανένα σημείο θραύσης οθόνης δεν απαντά σωστά (μετρημένο: ADR-777 §8.87.2 · §8.87.6γ).
 * 🔑 **Η σειρά ΕΙΝΑΙ η προτεραιότητα**: μένουν τα πρώτα, φεύγουν τα τελευταία (Fluent `Overflow` · Polaris action rollup ·
 *   MUI `limitTags`). Ο καλών δεν δηλώνει τίποτα καινούργιο — η σειρά του πίνακα το έλεγε ήδη.
 * 🔑 **Ό,τι κρύβεται μένει στη ροή, αόρατο** (ευθύνη του καλούντα): έτσι το πλάτος του μετριέται ακόμη, και ο χώρος που
 *   ξαναβρίσκεται **φαίνεται**. Το δοχείο οφείλει να έχει πλάτος **ανεξάρτητο** από το πόσα κρύφτηκαν.
 */
import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';

import { useSizeObserver } from '@/hooks/media/useElementSize';

/** Ανοχή υποδιαίρεσης pixel (zoom 80% ⇒ κλασματικά πλάτη). */
const SUBPIXEL_TOLERANCE_PX = 0.5;

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * **Πόσα στοιχεία μένουν ορατά.** Όλα, αν χωρούν· αλλιώς όσα χωρούν **μαζί με** το στοιχείο «περισσότερα».
 *
 * ⚠️ `available <= 0` = «δεν μετρήθηκε» (SSR · jsdom · πριν το πρώτο βάψιμο) ⇒ **όλα**: άγνωστος χώρος δεν κρύβει
 *   τίποτα. Το `0` δεν είναι ποτέ απάντηση του τύπου «δεν χωρά κανένα».
 *
 * @param moreAlways Το «περισσότερα» αποδίδεται **ούτως ή άλλως** (ο καλών έχει ήδη κρυμμένα για άλλο λόγο, π.χ. όριο
 *   πλήθους) ⇒ ο χώρος του κρατιέται ακόμη κι όταν τα στοιχεία χωρούν όλα.
 */
export function countFittingItems(
  widths: readonly number[],
  available: number,
  gap: number,
  moreWidth: number,
  moreAlways = false,
): number {
  const count = widths.length;
  if (count === 0 || !(available > 0)) return count;

  const limit = available + SUBPIXEL_TOLERANCE_PX;
  if (!moreAlways && sum(widths) + gap * (count - 1) <= limit) return count;

  let used = 0;
  let visible = 0;
  for (const width of widths) {
    // Κάθε ορατό στοιχείο ακολουθείται από ένα κενό: πριν από το επόμενο, ή πριν από το «περισσότερα».
    const next = used + width + gap;
    if (next + moreWidth > limit) break;
    used = next;
    visible += 1;
  }
  return visible;
}

/** Πώς αναγνωρίζει ο παρατηρητής τα παιδιά του δοχείου, και τι ισχύει πριν μετρηθούν. */
export interface PriorityOverflowSpec {
  /** Ιδιότητα-σημάδι πάνω σε **κάθε** στοιχείο της γραμμής (ορατό ή κρυμμένο) — αυτά μετρά ο παρατηρητής. */
  readonly itemAttr: string;
  /** Ιδιότητα-σημάδι πάνω στο στοιχείο «περισσότερα». */
  readonly moreAttr: string;
  /** Πλάτος του «περισσότερα» **πριν** ζωγραφιστεί· μόλις υπάρχει, μετριέται το αληθινό. */
  readonly moreFallbackPx: number;
  /**
   * Πόσα μένουν ορατά ακόμη κι αν **δεν** χωρούν (προεπιλογή `0`). `1` = η γραμμή δεν καταρρέει ποτέ σε σκέτο «+N»:
   * ένα σήμα που κόβεται λέει περισσότερα από κανένα (Fluent `Overflow` `minimumVisible`).
   */
  readonly minVisible?: number;
}

function widthOf(element: Element): number {
  return element.getBoundingClientRect().width;
}

/** Μετρά τα στοιχεία του δοχείου και απαντά πόσα μένουν ορατά μέσα σε `available` px. */
function measureVisibleCount(
  container: HTMLElement,
  available: number,
  spec: PriorityOverflowSpec,
  moreAlways: boolean,
): number {
  const items = Array.from(container.querySelectorAll(`[${spec.itemAttr}]`));
  const more = container.querySelector(`[${spec.moreAttr}]`);
  const gap = Number.parseFloat(getComputedStyle(container).columnGap) || 0;
  const fitting = countFittingItems(
    items.map(widthOf),
    available,
    gap,
    more ? widthOf(more) : spec.moreFallbackPx,
    moreAlways,
  );
  return Math.max(fitting, Math.min(spec.minVisible ?? 0, items.length));
}

export interface PriorityOverflow<E extends HTMLElement> {
  readonly containerRef: RefObject<E | null>;
  /** Πόσα από τα `count` στοιχεία μένουν στη γραμμή (τα πρώτα). */
  readonly visibleCount: number;
}

/**
 * @param count Πόσα στοιχεία διεκδικούν τη γραμμή.
 * @param spec Σταθερό αντικείμενο (σταθερά module) — τα σημάδια του καλούντα.
 * @param moreAlways Βλ. {@link countFittingItems}.
 */
export function usePriorityOverflow<E extends HTMLElement = HTMLDivElement>(
  count: number,
  spec: PriorityOverflowSpec,
  moreAlways = false,
): PriorityOverflow<E> {
  const containerRef = useRef<E | null>(null);
  const availableRef = useRef(0);
  const [visibleCount, setVisibleCount] = useState(count);

  const sync = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    // Αμέτρητος χώρος ⇒ η απάντηση είναι «όλα» **χωρίς να ρωτηθεί το DOM**: ό,τι δεν μετρήθηκε δεν κρύβει τίποτα, ακόμη
    // κι αν τα παιδιά δεν φέρουν (ακόμη) τα σημάδια τους.
    const available = availableRef.current;
    const next = available > 0 ? measureVisibleCount(container, available, spec, moreAlways) : count;
    setVisibleCount((prev) => (prev === next ? prev : next));
  }, [count, spec, moreAlways]);

  const onSize = useCallback((width: number) => {
    availableRef.current = width;
    sync();
  }, [sync]);
  useSizeObserver(containerRef, onSize, 'content-box');

  // Μια ετικέτα που αλλάζει («Αποθήκευση» → «Αποθήκευση...») αλλάζει πλάτος στοιχείου **χωρίς** να αλλάξει το δοχείο:
  // ο παρατηρητής δεν θα το μάθαινε. Η μέτρηση ξαναγίνεται μετά από κάθε render· κατάσταση αλλάζει μόνο αν αλλάξει ο αριθμός.
  useLayoutEffect(sync);

  return { containerRef, visibleCount: Math.min(visibleCount, count) };
}
