'use client';

/**
 * @fileoverview **Η ΠΡΑΞΗ ΣΕΙΡΑΣ ΤΟΥ ΓΡΑΦΕΙΟΥ** — «να μπει πρώτη», με συμφιλίωση.
 * @related ADR-841 §7 (Α14.7) · services/listings/agency-media-publication · lib/ordering/declared-order
 * @module hooks/listings/useListingMediaOrder
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΟΘΟΝΗ ΔΕΙΧΝΕΙ **ΑΚΡΙΒΩΣ Ο,ΤΙ ΦΕΥΓΕΙ** — και όχι κάτι που του μοιάζει
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κατάλογος παράγεται από το **ίδιο** {@link orderedPublishableAgencyMedia} που καλεί
 * ο γραφέας του διακομιστή: ίδιοι δύο φρουροί, ίδια σειρά, **ίδιο όριο**. Ένα δεύτερο
 * `filter` εδώ θα ήταν η βλάβη που το `owner-media-publication` ονομάζει αυτολεξεί —
 * *«η οθόνη θα έλεγε “δημοσιεύονται 30” ενώ ο κόσμος θα έβλεπε 24, και ο άνθρωπος δεν θα
 * είχε κανέναν τρόπο να καταλάβει ποια έξι έλειπαν»*.
 *
 * ⚠️ Άρα **αρχείο εκτός ορίου δεν εμφανίζεται καθόλου**: δεν είναι παράλειψη της οθόνης,
 * είναι η αλήθεια — δεν φεύγει.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { updateProperty } from '@/services/properties.service';
import { createModuleLogger } from '@/lib/telemetry';
import { withDeclaredFirst } from '@/lib/ordering/declared-order';
import {
  declaredMediaOrder,
  orderedPublishableAgencyMedia,
  type AgencyMediaCandidate,
  type AgencyMediaOrderDeclaration,
} from '@/services/listings/agency-media-publication';

const logger = createModuleLogger('useListingMediaOrder');

/** Ίδιες ταυτότητες, ίδια σειρά. Ιδιωτικό: **δεν** είναι γενικός κανόνας ισότητας. */
function sameDeclaration(
  a: AgencyMediaOrderDeclaration,
  b: AgencyMediaOrderDeclaration,
): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export interface ListingMediaOrderState<T extends AgencyMediaCandidate> {
  /** Τα αρχεία **που φεύγουν**, στη σειρά που θα τα δει ο κόσμος. */
  readonly items: readonly T[];
  /** Η δήλωση όπως τη βλέπει **αυτή τη στιγμή** ο άνθρωπος (αισιόδοξη ή αποθηκευμένη). */
  readonly declared: AgencyMediaOrderDeclaration;
  /** Γράφεται τώρα — η πράξη κλειδώνει ώστε δύο κλικ να μη γίνουν δύο αγώνες. */
  readonly saving: boolean;
  /** Η τελευταία προσπάθεια απέτυχε **και η οθόνη γύρισε πίσω**. */
  readonly failed: boolean;
  readonly makeFirst: (fileId: string) => Promise<void>;
}

/**
 * **«Να μπει πρώτη» για τη δημόσια αγγελία ενός ακινήτου του γραφείου.**
 *
 * 🔑 **ΑΙΣΙΟΔΟΞΗ ΓΡΑΦΗ ΜΕ ΣΥΜΦΙΛΙΩΣΗ, ΟΧΙ ΜΕ ΛΗΞΗ ΧΡΟΝΟΥ** (N.7.2 #1): η τοπική δήλωση
 * υπερισχύει **μέχρι το αποθηκευμένο έγγραφο να πει το ίδιο πράγμα**, και τότε
 * αποσύρεται. Ένα σκέτο `setState` που δεν αποσύρεται ποτέ θα **έκρυβε** μια μελλοντική
 * αλλαγή από άλλη καρτέλα ή άλλον συνάδελφο· ένα `setTimeout` θα μάντευε πότε έφτασε το
 * `onSnapshot`. Η συμφιλίωση **ρωτά**, δεν μαντεύει.
 *
 * ⚠️ **Αποτυχία ⇒ ΕΠΑΝΑΦΟΡΑ, όχι σιωπή** (`failed`). Μια σειρά που φαίνεται αλλαγμένη
 * ενώ ο διακομιστής την απέρριψε είναι χειρότερη από σφάλμα: ο άνθρωπος φεύγει
 * πιστεύοντας ότι η αγγελία του άλλαξε.
 *
 * ⚠️ **`saving` κλειδώνει την πράξη** (N.7.2 #2): δύο γρήγορα κλικ θα ήταν δύο PATCH στο
 * **ίδιο** έγγραφο, και ποιο γράφεται τελευταίο δεν το αποφασίζει κανείς εδώ. Με το
 * κλείδωμα, οι πράξεις **συνθέτονται** — κάθε επόμενη ξεκινά από το αποτέλεσμα της
 * προηγούμενης.
 */
export function useListingMediaOrder<T extends AgencyMediaCandidate>(
  propertyId: string,
  files: readonly T[],
  storedOrder: unknown,
): ListingMediaOrderState<T> {
  const stored = useMemo(() => declaredMediaOrder(storedOrder), [storedOrder]);
  const [optimistic, setOptimistic] = useState<AgencyMediaOrderDeclaration | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  // 🔑 Η **συμφιλίωση**: μόλις το αποθηκευμένο συμφωνήσει με το αισιόδοξο, το αισιόδοξο
  //    δεν έχει πια δουλειά — και πρέπει να φύγει, αλλιώς σκιάζει κάθε επόμενη αλλαγή.
  useEffect(() => {
    if (optimistic !== null && sameDeclaration(stored, optimistic)) setOptimistic(null);
  }, [stored, optimistic]);

  const declared = optimistic ?? stored;

  const items = useMemo(
    () => orderedPublishableAgencyMedia(files, declared),
    [files, declared],
  );

  const makeFirst = useCallback(
    async (fileId: string): Promise<void> => {
      if (saving) return;

      const next = withDeclaredFirst(declared, fileId);
      setOptimistic(next);
      setSaving(true);
      setFailed(false);

      try {
        // 🔑 **Ο ΥΠΑΡΧΩΝ γραφέας**, ποτέ δεύτερη διαδρομή γραφής: το `updateProperty`
        //    περνά από το PATCH `/api/properties/[id]`, που **ήδη** ξαναδημοσιεύει την
        //    αγγελία (`republishPublicProjection`). Η σειρά φτάνει στον κόσμο από την
        //    ίδια πόρτα με κάθε άλλη αλλαγή του ακινήτου.
        await updateProperty(propertyId, { publishedMediaOrder: next });
      } catch (error) {
        setOptimistic(null);
        setFailed(true);
        logger.warn('Η σειρά των φωτογραφιών δεν αποθηκεύτηκε', {
          propertyId,
          fileId,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setSaving(false);
      }
    },
    [declared, propertyId, saving],
  );

  return { items, declared, saving, failed, makeFirst };
}
