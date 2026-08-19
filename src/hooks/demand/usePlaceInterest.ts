'use client';

/**
 * @fileoverview **«ΠΟΣΟΙ ΖΗΤΟΥΝ ΤΟ ΑΚΙΝΗΤΟ ΜΟΥ»** — από τον διακομιστή, ήδη λογοκριμένο.
 * @related ADR-777 §7 (Α9 · Α12 · Α14) · SPEC-777B §12.6 · app/api/demand/interest
 * @module hooks/demand/usePlaceInterest
 *
 * 🔑 **Κάτοπτρο του {@link useDemandCompetition}, και ο λόγος είναι ο ίδιος**: ο
 * κανόνας Firestore δίνει `read` στις ζητήσεις **μόνο** στον συγγραφέα τους, άρα ο
 * ιδιοκτήτης **δομικά δεν μπορεί** να δει ποιος τον ψάχνει. Η ερώτηση απαντιέται
 * αποκλειστικά στον διακομιστή, και ό,τι επιστρέφει είναι **ένας αριθμός ή τίποτα**.
 *
 * ⚠️ **Ζητά ταυτότητα ΑΚΙΝΗΤΟΥ, ποτέ κριτήρια.** Με κριτήρια, η διαδρομή θα ήταν
 * ελεύθερο ερωτητήριο πάνω στη ζήτηση όλης της χώρας — δηλαδή δωρεάν ανασύνθεση του
 * θερμοχάρτη που είναι το προϊόν **Ε2**.
 */

import { useEffect, useState } from 'react';

import { apiClient } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';
import type { PlaceInterest } from '@/lib/demand/demand-interest';

const logger = createModuleLogger('usePlaceInterest');

/**
 * ⚠️ **Το `unavailable` ΔΕΝ είναι «κανένας».** Μια αποτυχία δικτύου δεν είναι μέτρηση
 * της αγοράς, και μια οθόνη που δείχνει «κανείς δεν σε ψάχνει» επειδή έπεσε μια κλήση
 * **λέει ψέματα με σιγουριά** — το σχήμα «0 = κανείς δεν κοίταξε», στραμμένο στον
 * χρήστη. Εδώ βαραίνει διπλά: θα αποθάρρυνε τον άνθρωπο από το να ανεβάσει το ακίνητο.
 */
export type PlaceInterestState =
  | { readonly state: 'loading' }
  | { readonly state: 'ready'; readonly interest: PlaceInterest }
  | { readonly state: 'unavailable' };

interface InterestResponse {
  readonly interest: PlaceInterest;
}

/** **Ταυτότητα ακινήτου → πόσοι το ζητούν.** `null` όσο δεν ξέρουμε ταυτότητα. */
export function usePlaceInterest(propertyId: string | null): PlaceInterestState {
  const [state, setState] = useState<PlaceInterestState>({ state: 'loading' });

  useEffect(() => {
    if (propertyId === null || propertyId.trim() === '') {
      setState({ state: 'unavailable' });
      return;
    }

    let alive = true;
    setState({ state: 'loading' });

    apiClient
      .get<InterestResponse>(
        `/api/demand/interest?propertyId=${encodeURIComponent(propertyId)}`,
      )
      .then((payload) => {
        if (alive) setState({ state: 'ready', interest: payload.interest });
      })
      .catch((cause: unknown) => {
        logger.warn('Το ενδιαφέρον δεν φορτώθηκε', {
          data: { propertyId },
          error: cause instanceof Error ? cause.message : String(cause),
        });
        if (alive) setState({ state: 'unavailable' });
      });

    // Η σημαία ακυρώνει την **εγγραφή**, όχι την κλήση: μια απάντηση που φτάνει αφού
    // ο χρήστης έφυγε από την οθόνη θα έγραφε σε αποσυναρμολογημένο component.
    return () => {
      alive = false;
    };
  }, [propertyId]);

  return state;
}
