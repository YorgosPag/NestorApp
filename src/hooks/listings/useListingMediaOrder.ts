'use client';

/**
 * @fileoverview **Η ΠΡΑΞΗ ΣΕΙΡΑΣ ΤΟΥ ΓΡΑΦΕΙΟΥ** — «να μπει πρώτη», με συμφιλίωση.
 * @related ADR-841 §7 (Α14.7 · Α17.7) · hooks/listings/useDeclaredFileIds · lib/ordering/declared-order
 * @module hooks/listings/useListingMediaOrder
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΟΘΟΝΗ ΔΕΙΧΝΕΙ **ΑΚΡΙΒΩΣ Ο,ΤΙ ΦΕΥΓΕΙ** — και όχι κάτι που του μοιάζει
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κατάλογος παράγεται από το **ίδιο** {@link orderedPublishableAgencyMedia} που καλεί
 * ο γραφέας του διακομιστή: ίδιοι φρουροί, ίδια σειρά, **ίδιο όριο**. Ένα δεύτερο
 * `filter` εδώ θα ήταν η βλάβη που το `owner-media-publication` ονομάζει αυτολεξεί —
 * *«η οθόνη θα έλεγε “δημοσιεύονται 30” ενώ ο κόσμος θα έβλεπε 24, και ο άνθρωπος δεν θα
 * είχε κανέναν τρόπο να καταλάβει ποια έξι έλειπαν»*.
 *
 * ⚠️ Άρα **αρχείο εκτός ορίου δεν εμφανίζεται καθόλου**: δεν είναι παράλειψη της οθόνης,
 * είναι η αλήθεια — δεν φεύγει.
 *
 * 🔑 **Ο κύκλος ζωής της δήλωσης είναι ΚΟΙΝΟΣ** *(`useDeclaredFileIds`)*: το **CHECK 3.28**
 * μέτρησε ότι ήταν δίδυμο με την αδελφή πράξη *(«7 γραμμές / 56 tokens»)* και είχε δίκιο.
 * Ό,τι μένει εδώ είναι **η απόφαση**: τι σημαίνει «ίδια δήλωση» *(σειρά, όχι σύνολο)*, και
 * τι σημαίνει «να μπει πρώτη».
 */

import { useCallback, useMemo } from 'react';

import { withDeclaredFirst } from '@/lib/ordering/declared-order';
import {
  sameSequence,
  useDeclaredFileIds,
  type DeclaredFileIdsState,
} from '@/hooks/listings/useDeclaredFileIds';
import type { DeclaredFileIds } from '@/lib/listings/declared-file-ids';
import { type AgencyMediaCandidate } from '@/services/listings/agency-media-publication';
import { orderedPublishableAgencyMedia } from '@/services/listings/agency-media-selection';

export interface ListingMediaOrderState<T extends AgencyMediaCandidate>
  extends Pick<DeclaredFileIdsState, 'declared' | 'saving' | 'failed'> {
  /** Τα αρχεία **που φεύγουν**, στη σειρά που θα τα δει ο κόσμος. */
  readonly items: readonly T[];
  readonly makeFirst: (fileId: string) => Promise<void>;
}

/**
 * **«Να μπει πρώτη» για τη δημόσια αγγελία ενός ακινήτου του γραφείου.**
 *
 * ⚠️ **`sameSequence` και όχι `sameSet`**: εδώ η σειρά **είναι** το περιεχόμενο της
 * δήλωσης. Μια σύγκριση συνόλου θα θεωρούσε συμφιλιωμένη μια αναδιάταξη που ο
 * διακομιστής **δεν** έγραψε ποτέ.
 *
 * 🔑 **Η δήλωση κατόψεων ταξιδεύει ΑΥΤΟΥΣΙΑ** (Α17.7): η οθόνη της σειράς δεν την
 * αποφασίζει, αλλά **οφείλει** να τη σεβαστεί — αλλιώς θα έδειχνε κατάλογο χωρίς τις
 * κατόψεις που ο κόσμος **βλέπει**, δηλαδή θα ξανάνοιγε το κενό «οθόνη ⇄ ράφι».
 */
export function useListingMediaOrder<T extends AgencyMediaCandidate>(
  propertyId: string,
  files: readonly T[],
  storedOrder: unknown,
  floorplans: DeclaredFileIds,
): ListingMediaOrderState<T> {
  const { declared, saving, failed, commit } = useDeclaredFileIds(
    propertyId,
    'publishedMediaOrder',
    storedOrder,
    sameSequence,
  );

  const items = useMemo(
    () => orderedPublishableAgencyMedia(files, { order: declared, floorplans }),
    [files, declared, floorplans],
  );

  const makeFirst = useCallback(
    (fileId: string): Promise<void> => commit(withDeclaredFirst(declared, fileId)),
    [declared, commit],
  );

  return { items, declared, saving, failed, makeFirst };
}
