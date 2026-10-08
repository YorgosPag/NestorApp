'use client';
/**
 * @fileoverview **Υπερχείλιση ενεργειών κατά προτεραιότητα** — πόσες ενέργειες χωρούν στη γραμμή, οι υπόλοιπες στο μενού.
 * @related ADR-777 §8.87.7 · `EntityHeaderActions.tsx` · `hooks/media/useElementSize.ts` (ο ΕΝΑΣ παρατηρητής μεγέθους)
 * @module core/entity-headers/action-overflow
 *
 * 🔑 **Η ερώτηση είναι «πόσο χώρο έχω», όχι «πόσο πλατιά είναι η οθόνη»**: η κεφαλίδα ζει δίπλα σε πλαϊνό μενού και μέσα
 *   σε στενή στήλη, άρα κανένα σημείο θραύσης οθόνης δεν απαντά σωστά (μετρημένο: ADR-777 §8.87.2 · §8.87.6γ).
 * 🔑 **Η σειρά ΕΙΝΑΙ η προτεραιότητα**: μένουν οι πρώτες, φεύγουν οι τελευταίες (Salesforce highlights panel ·
 *   Polaris action rollup). Ο καλών δεν δηλώνει τίποτα καινούργιο — η σειρά του πίνακα το έλεγε ήδη.
 */
import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';

import { useSizeObserver } from '@/hooks/media/useElementSize';

/** Σημάδι πάνω σε κάθε κουμπί ενέργειας — αυτά μετρά ο παρατηρητής. */
export const ENTITY_ACTION_ATTR = 'data-entity-action';
/** Σημάδι πάνω στο κουμπί «Περισσότερες ενέργειες». */
export const ENTITY_ACTION_MORE_ATTR = 'data-entity-action-more';

/** Πλάτος του κουμπιού «Περισσότερα» **πριν** ζωγραφιστεί (`h-8` εικονίδιο)· μόλις υπάρχει, μετριέται το αληθινό. */
const MORE_BUTTON_FALLBACK_PX = 36;
/** Ανοχή υποδιαίρεσης pixel (zoom 80% ⇒ κλασματικά πλάτη). */
const SUBPIXEL_TOLERANCE_PX = 0.5;

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * **Πόσες ενέργειες μένουν ορατές.** Όλες, αν χωρούν· αλλιώς όσες χωρούν **μαζί με** το κουμπί «Περισσότερα».
 *
 * ⚠️ `available <= 0` = «δεν μετρήθηκε» (SSR · jsdom · πριν το πρώτο βάψιμο) ⇒ **όλες**: άγνωστος χώρος δεν κρύβει
 *   τίποτα. Το `0` δεν είναι ποτέ απάντηση του τύπου «δεν χωρά καμία».
 */
export function countFittingActions(
  widths: readonly number[],
  available: number,
  gap: number,
  moreWidth: number,
): number {
  const count = widths.length;
  if (count === 0 || !(available > 0)) return count;

  const limit = available + SUBPIXEL_TOLERANCE_PX;
  if (sum(widths) + gap * (count - 1) <= limit) return count;

  let used = 0;
  let visible = 0;
  for (const width of widths) {
    // Κάθε ορατή ενέργεια ακολουθείται από ένα κενό: πριν από την επόμενη, ή πριν από το «Περισσότερα».
    const next = used + width + gap;
    if (next + moreWidth > limit) break;
    used = next;
    visible += 1;
  }
  return visible;
}

function widthOf(element: Element): number {
  return element.getBoundingClientRect().width;
}

/** Μετρά τα κουμπιά του δοχείου και απαντά πόσα μένουν ορατά μέσα σε `available` px. */
function measureVisibleCount(container: HTMLElement, available: number): number {
  const actions = Array.from(container.querySelectorAll(`[${ENTITY_ACTION_ATTR}]`));
  const more = container.querySelector(`[${ENTITY_ACTION_MORE_ATTR}]`);
  const gap = Number.parseFloat(getComputedStyle(container).columnGap) || 0;
  return countFittingActions(
    actions.map(widthOf),
    available,
    gap,
    more ? widthOf(more) : MORE_BUTTON_FALLBACK_PX,
  );
}

export interface ActionOverflow {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  /** Πόσες από τις `count` ενέργειες μένουν στη γραμμή (οι πρώτες). */
  readonly visibleCount: number;
}

/**
 * Το δοχείο πρέπει να έχει πλάτος **ανεξάρτητο από το πόσες ενέργειες κρύβονται** (οι κρυμμένες μένουν στη ροή,
 * αόρατες) — αλλιώς, μόλις κρυφτεί μία, το δοχείο στενεύει και ο χώρος που ξαναβρέθηκε δεν φαίνεται ποτέ.
 */
export function useActionOverflow(count: number): ActionOverflow {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const availableRef = useRef(0);
  const [visibleCount, setVisibleCount] = useState(count);

  const sync = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const next = measureVisibleCount(container, availableRef.current);
    setVisibleCount((prev) => (prev === next ? prev : next));
  }, []);

  const onSize = useCallback((width: number) => {
    availableRef.current = width;
    sync();
  }, [sync]);
  useSizeObserver(containerRef, onSize, 'content-box');

  // Μια ετικέτα που αλλάζει («Αποθήκευση» → «Αποθήκευση...») αλλάζει πλάτος κουμπιού **χωρίς** να αλλάξει το δοχείο:
  // ο παρατηρητής δεν θα το μάθαινε. Η μέτρηση ξαναγίνεται μετά από κάθε render· κατάσταση αλλάζει μόνο αν αλλάξει ο αριθμός.
  useLayoutEffect(sync);

  return { containerRef, visibleCount: Math.min(visibleCount, count) };
}
