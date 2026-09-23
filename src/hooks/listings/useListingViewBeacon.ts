'use client';

/**
 * @fileoverview **«Κάποιος είδε αυτή την αγγελία»** — ο beacon της προβολής (ADR-777 §8.72).
 * @related app/api/public-listings/[listingId]/view/route.ts · services/listings/listing-view-recorder.ts
 * @module hooks/listings/useListingViewBeacon
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΙΣΧΥΡΟΤΕΡΟ ΦΙΛΤΡΟ BOT ΕΙΝΑΙ ΟΤΙ ΑΥΤΟ ΤΡΕΧΕΙ ΣΕ JAVASCRIPT
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι ανιχνευτές που δεν εκτελούν JS δεν φτάνουν ποτέ εδώ. Και για όσους εκτελούν:
 * - **Μόνο όταν η σελίδα ΦΑΙΝΕΤΑΙ** (`visibilityState === 'visible'`). Καρτέλα ανοιγμένη στο παρασκήνιο
 *   (Ctrl+κλικ σε δέκα αγγελίες) μετρά **όταν** ο άνθρωπος τη δει — όχι όταν τη φόρτωσε.
 * - **Ποτέ σε προ-απόδοση** (`document.prerendering`, Speculation Rules): ο φυλλομετρητής μάντεψε ότι
 *   ίσως πατήσεις — δεν πάτησες.
 *
 * 🔑 **`sendBeacon`, όχι `apiClient`**: ο beacon (α) επιβιώνει του κλεισίματος της σελίδας, (β) στέλνει
 * το cookie `__session` του ίδιου origin ⇒ ο διακομιστής **αναγνωρίζει τον κάτοχο** και τον αφαιρεί,
 * χωρίς ο πελάτης να ζητήσει token (ο `apiClient` είτε θα έπεφτε σε 401 για τον ανώνυμο είτε, με
 * `PUBLIC_REQUEST`, θα έκρυβε τον κάτοχο). Εφεδρεία: `fetch` με `keepalive`.
 *
 * ⚠️ Μία φορά **ανά mount ανά αγγελία**. Ο αποδυπλασιασμός «μία φορά την ημέρα» ζει στον διακομιστή·
 * εδώ απλώς δεν στέλνουμε θόρυβο.
 */

import { useEffect, useRef } from 'react';

import { listingViewPath } from '@/lib/listings/listing-stats';

/** `document.prerendering` — Speculation Rules API· ακόμη όχι στους τύπους του lib.dom. */
interface PrerenderingDocument {
  readonly prerendering?: boolean;
}

function isPrerendering(): boolean {
  return (document as Document & PrerenderingDocument).prerendering === true;
}

function sendViewBeacon(listingId: string): void {
  const url = listingViewPath(listingId);
  if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(url)) return;
  void fetch(url, { method: 'POST', keepalive: true, credentials: 'same-origin' }).catch(() => undefined);
}

/**
 * Στείλε **μία** προβολή για την `listingId` μόλις η σελίδα φανεί στον άνθρωπο.
 * @param listingId — `null` όσο η αγγελία δεν έχει φορτωθεί (δεν μετράμε σελίδα «δεν βρέθηκε»).
 */
export function useListingViewBeacon(listingId: string | null): void {
  const sentFor = useRef<string | null>(null);

  useEffect(() => {
    if (listingId === null || sentFor.current === listingId) return undefined;

    const trySend = (): void => {
      if (sentFor.current === listingId || isPrerendering() || document.visibilityState !== 'visible') return;
      sentFor.current = listingId;
      sendViewBeacon(listingId);
    };

    trySend();
    document.addEventListener('visibilitychange', trySend);
    document.addEventListener('prerenderingchange', trySend);
    return () => {
      document.removeEventListener('visibilitychange', trySend);
      document.removeEventListener('prerenderingchange', trySend);
    };
  }, [listingId]);
}
