'use client';

/**
 * 🗄️🗑️ useRetiredPropertyRecord — το ΕΝΑ αποσυρμένο ακίνητο που ζητά ένας σύνδεσμος.
 *
 * Ο ζωντανός κατάλογος (`SharedPropertiesProvider`) αφήνει έξω ό,τι αποσύρθηκε — σωστά, αλλά έτσι το
 * `/properties/[id]` ενός ακινήτου του αρχείου ή του κάδου απαντούσε «δεν βρέθηκε»: το «Άνοιγμα σε
 * σελίδα» του κλειδωμένου πλαισίου και κάθε σύνδεσμος του ιστορικού οδηγούσαν σε αδιέξοδο (ADR-329 §3.9).
 *
 * 🔑 **ΔΕΝ είναι δεύτερος αναγνώστης του ζωντανού ακινήτου.** Ρωτά μόνο όταν ο κατάλογος απάντησε
 * **χωρίς** το id (`enabled`), και κρατά **μόνο** ό,τι είναι αποσυρμένο (`isRetired`). Ένα ζωντανό
 * έγγραφο από αυτή την πόρτα απορρίπτεται — το ζωντανό ακίνητο έχει έναν αναγνώστη.
 *
 * 🔑 **Το σχήμα είναι το ίδιο με τις γραμμές του αρχείου και του κάδου**, κατασκευαστικά: ο
 * διακομιστής παράγει και τις δύο απαντήσεις από το `entityRowOf` (`lib/firestore/lifecycle-list`).
 * Άρα το πλαίσιο της λίστας και η σελίδα δείχνουν την ίδια εγγραφή, με τις ίδιες σφραγίδες.
 *
 * ⚠️ **Τρεις απαντήσεις, όχι δύο.** 403/404 ⇒ `absent` (ίδιο συμβόλαιο με το `lookupOwnedPlace`: δεν
 * ξεχωρίζουμε «ξένο» από «ανύπαρκτο»). Οτιδήποτε άλλο ⇒ `failed`: «δεν μπόρεσα να ρωτήσω» δεν είναι
 * «δεν βρέθηκε».
 *
 * @module hooks/useRetiredPropertyRecord
 * @enterprise ADR-281 — SSOT Soft-Delete System · ADR-329 §3.9 · ADR-842 §7.6.13 (δηλωμένη πόρτα)
 */

import { useCallback, useEffect, useState } from 'react';

import { API_ROUTES } from '@/config/domain-constants';
import { ApiClientError } from '@/lib/api/api-client-types';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { isRetired } from '@/lib/firestore/trashed-status';
import type { Property } from '@/types/property-viewer';

/** Ό,τι μπορεί να πει ο αναγνώστης. `idle` = δεν ρωτήθηκε (ο κατάλογος δεν τον χρειάστηκε). */
export type RetiredPropertyLookup =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'retired'; readonly property: Property }
  | { readonly kind: 'absent' }
  | { readonly kind: 'failed' };

type SettledLookup = Exclude<RetiredPropertyLookup, { kind: 'idle' | 'loading' }>;

export interface RetiredPropertyRecord {
  readonly lookup: RetiredPropertyLookup;
  /** Ξαναρωτά — για το `failed`. */
  readonly retry: () => void;
}

const IDLE: RetiredPropertyLookup = { kind: 'idle' };
const LOADING: RetiredPropertyLookup = { kind: 'loading' };

/** Άρνηση του διακομιστή (4xx) = «όχι δικό σου ή δεν υπάρχει». Όλα τα άλλα = δεν ρωτήθηκε πραγματικά. */
function lookupOfFailure(error: unknown): SettledLookup {
  const refused = ApiClientError.isApiClientError(error) && (error.statusCode === 403 || error.statusCode === 404);
  return refused ? { kind: 'absent' } : { kind: 'failed' };
}

export function useRetiredPropertyRecord(propertyId: string, enabled: boolean): RetiredPropertyRecord {
  // Η απάντηση κουβαλά το ερώτημά της: απάντηση για άλλο id ή για παλιότερη προσπάθεια δεν δείχνεται ποτέ.
  const [answer, setAnswer] = useState<{ id: string; attempt: number; lookup: SettledLookup } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      // Ο κατάλογος ανέλαβε: το στιγμιότυπο πετιέται, ώστε μια νέα απόσυρση να ξαναρωτήσει.
      setAnswer(null);
      return undefined;
    }

    let current = true;
    const settle = (lookup: SettledLookup): void => {
      if (current) setAnswer({ id: propertyId, attempt, lookup });
    };

    apiClient
      .get<Property>(API_ROUTES.PROPERTIES.BY_ID(propertyId))
      .then((property) => settle(isRetired(property) ? { kind: 'retired', property } : { kind: 'absent' }))
      .catch((error: unknown) => settle(lookupOfFailure(error)));

    return () => { current = false; };
  }, [enabled, propertyId, attempt]);

  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);

  if (!enabled) return { lookup: IDLE, retry };
  const settled = answer !== null && answer.id === propertyId && answer.attempt === attempt;
  return { lookup: settled ? answer.lookup : LOADING, retry };
}
