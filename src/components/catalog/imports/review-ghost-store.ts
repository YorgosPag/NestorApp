'use client';

/**
 * @fileoverview **Το φάντασμα της αναθεώρησης** (ADR-923 §5.5.2 Β8 βήμα Γ): όσο ο δείκτης ή η εστίαση είναι σε «Κράτα «…»», ένα
 *   διακεκομμένο πλαίσιο δείχνει στο PDF **από ποιο κελί** έρχεται αυτή η τιμή — βλέπεις την πηγή **πριν** διαλέξεις (Git/Figma
 *   «Accept incoming» δείχνουν μόνο το κείμενο· εδώ δείχνεται και η θέση του στο χαρτί).
 * @module components/catalog/imports/review-ghost-store
 *
 * 🔑 **Εξωτερικό store** πάνω στο `createExternalStore` (όπως `review-hover-store`): μια κίνηση του ποντικιού πάνω σε κουμπί
 *    ξαναζωγραφίζει **μόνο** τη στρώση της σελίδας του φαντάσματος — ποτέ τη λίστα ή τα πλαίσια.
 * 🔑 **Ένας κάτοχος ανά φορά** (`owner`): το «σβήσε» ενός κουμπιού σβήνει **μόνο** το δικό του φάντασμα — η μετάβαση από το ένα «Κράτα»
 *    στο άλλο δεν τρεμοπαίζει, όποια σειρά κι αν έχουν τα συμβάντα.
 * 🔑 Κουμπί που φεύγει από τη σελίδα **ενώ** δείχνει (το πάτημα κλείνει το popover· η διόρθωση ξαναχτίζει την κάρτα) σβήνει το
 *    φάντασμά του στο unmount — αλλιώς θα έμενε στο χαρτί χωρίς κανέναν από πάνω (`mouseleave` δεν έρχεται ποτέ σε ό,τι χάθηκε).
 * 🔑 Άγκυρα κελιού αρχείου ή καμία άγκυρα ⇒ κανένα φάντασμα (δεν υπάρχει χαρτί να δείξει)· ποτέ σφάλμα. Χωρίς πάροχο ⇒ τίποτα.
 */

import { createContext, useCallback, useContext, useEffect, useId, useSyncExternalStore } from 'react';

import { createExternalStore } from '@/lib/state/createExternalStore';
import type { PageRegion, SourceAnchor } from '@/subapps/catalog/types/catalog-import';

export interface ReviewGhost {
  readonly owner: string;
  readonly page: number;
  readonly regions: readonly PageRegion[];
}

export interface ReviewGhostStore {
  readonly get: () => ReviewGhost | null;
  readonly subscribe: (listener: () => void) => () => void;
  readonly show: (ghost: ReviewGhost) => void;
  /** Σβήνει **μόνο** αν το φάντασμα είναι ακόμη αυτού του κατόχου. */
  readonly hide: (owner: string) => void;
}

export function createReviewGhostStore(): ReviewGhostStore {
  const store = createExternalStore<ReviewGhost | null>(null);
  return {
    get: store.get,
    subscribe: store.subscribe,
    show: store.set,
    hide: (owner) => { if (store.get()?.owner === owner) store.set(null); },
  };
}

export const ReviewGhostContext = createContext<ReviewGhostStore | null>(null);

const noSubscribe = () => () => undefined;

/** Τα πλαίσια του φαντάσματος **αυτής** της σελίδας — για τη στρώση του PDF. Ίδια αναφορά όσο δεν αλλάζει ⇒ καμία άσκοπη ζωγραφιά. */
export function useReviewGhostRegions(page: number): readonly PageRegion[] | null {
  const store = useContext(ReviewGhostContext);
  const snapshot = useCallback(() => {
    const ghost = store?.get() ?? null;
    return ghost !== null && ghost.page === page ? ghost.regions : null;
  }, [store, page]);
  return useSyncExternalStore(store?.subscribe ?? noSubscribe, snapshot, () => null);
}

/** Μόνο σημείο σε σελίδα έχει χαρτί να δείξει. */
const ghostOf = (owner: string, anchor: SourceAnchor | null): ReviewGhost | null =>
  anchor?.kind === 'page' && anchor.regions.length > 0 ? { owner, page: anchor.page, regions: anchor.regions } : null;

/** Τα χειριστήρια ενός κουμπιού που δείχνει την πηγή του: ποντίκι **και** εστίαση πληκτρολογίου, με καθαρισμό στο unmount. */
export function useReviewGhostHandlers(anchor: SourceAnchor | null) {
  const store = useContext(ReviewGhostContext);
  const owner = useId();
  const show = useCallback(() => {
    const ghost = ghostOf(owner, anchor);
    if (store && ghost) store.show(ghost);
  }, [store, owner, anchor]);
  const hide = useCallback(() => store?.hide(owner), [store, owner]);
  useEffect(() => hide, [hide]);
  return { onMouseEnter: show, onMouseLeave: hide, onFocus: show, onBlur: hide };
}
