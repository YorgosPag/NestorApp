'use client';

/**
 * @fileoverview **Το hover της αναθεώρησης, λίστα ↔ PDF** (ADR-923 §5.5.2 Β8): δείχνεις ένα πεδίο στη λίστα και ανάβει το πλαίσιό
 *   του στο PDF· δείχνεις ένα πλαίσιο και ανάβει η γραμμή του στη λίστα (Rossum · Figma «highlight layers on hover»).
 * @module components/catalog/imports/review-hover-store
 *
 * 🔑 **Εξωτερικό store, όχι React state** (το σχήμα των leaf subscribers του ADR-040): κάθε γραμμή και κάθε πλαίσιο ρωτούν
 *    `useSyncExternalStore` με επιλογέα **boolean**, άρα μια κίνηση του ποντικιού ξαναζωγραφίζει **μόνο** όποιον άλλαξε από
 *    «φωτισμένο» σε «όχι» — ποτέ ολόκληρη τη λίστα των δεκάδων πεδίων.
 * 🔑 Η τιμή είναι **σύνολο** κλειδιών: ένα πλαίσιο που τροφοδοτεί 4 πεδία φωτίζει και τα 4.
 * 🔑 Χωρίς πάροχο (π.χ. η `ProposalReview` σε test) τα hooks δεν κάνουν τίποτα — ποτέ σφάλμα.
 */

import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';

import { createExternalStore } from '@/lib/state/createExternalStore';

const NOTHING: ReadonlySet<string> = new Set();

interface ReviewHoverStore {
  readonly get: () => ReadonlySet<string>;
  readonly set: (keys: readonly string[]) => void;
  readonly subscribe: (listener: () => void) => () => void;
}

/** Πάνω στο κεντρικό `createExternalStore` (SSoT του pub/sub)· «τίποτα → τίποτα» δεν ειδοποιεί κανέναν. */
export function createReviewHoverStore(): ReviewHoverStore {
  const store = createExternalStore<ReadonlySet<string>>(NOTHING, { equals: (a, b) => a.size === 0 && b.size === 0 });
  return {
    get: store.get,
    set: (keys) => store.set(keys.length === 0 ? NOTHING : new Set(keys)),
    subscribe: store.subscribe,
  };
}

export const ReviewHoverContext = createContext<ReviewHoverStore | null>(null);

const noSubscribe = () => () => undefined;

/** Φωτίζεται ένα από αυτά τα κλειδιά; Boolean ⇒ ξαναζωγραφίζει μόνο όταν αλλάξει η απάντηση. */
export function useReviewHovered(keys: readonly string[]): boolean {
  const store = useContext(ReviewHoverContext);
  const joined = keys.join('\u0001');
  const snapshot = useCallback(() => {
    if (!store) return false;
    const hovered = store.get();
    return hovered.size > 0 && joined.split('\u0001').some((key) => hovered.has(key));
  }, [store, joined]);
  return useSyncExternalStore(store?.subscribe ?? noSubscribe, snapshot, () => false);
}

/** Τα χειριστήρια hover ενός στοιχείου (ποντίκι **και** εστίαση πληκτρολογίου). */
export function useReviewHoverHandlers(keys: readonly string[]) {
  const store = useContext(ReviewHoverContext);
  const joined = keys.join('\u0001');
  const enter = useCallback(() => store?.set(joined === '' ? [] : joined.split('\u0001')), [store, joined]);
  const leave = useCallback(() => store?.set([]), [store]);
  return { onMouseEnter: enter, onMouseLeave: leave, onFocus: enter, onBlur: leave };
}
