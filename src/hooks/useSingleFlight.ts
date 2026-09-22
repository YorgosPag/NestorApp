'use client';

/**
 * @fileoverview **SSoT: μία εκτέλεση τη φορά — ο πυρήνας κάτω από κάθε υποβολή και κάθε ενέργεια.**
 * @module hooks/useSingleFlight
 * @related ADR-598 «(θ) κύμα 2α» · `useFormSubmission` · `useInFlightAction` · `chart-card/editor/use-entry-submit`
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μετρημένο 2026-09-22: ο ίδιος μηχανισμός (φραγμός `ref` + `pending` state + `finally` +
 * προστασία unmount) ήταν γραμμένος **τρεις** φορές ως «SSoT» — `useFormSubmission` (φόρμες),
 * `useInFlightAction` (κουμπιά ενέργειας), `useEntrySubmit` (chart cards). Τρεις αρχές για
 * μία ερώτηση, με δύο δικά τους mounted refs. Εδώ ζει **μία φορά**· εκείνα είναι **όψεις**.
 *
 * Πρότυπο: Remix/React Router `useFetcher` — ΕΝΑ primitive, δύο όψεις (`<fetcher.Form>` δηλωτικά,
 * `fetcher.submit()` προστακτικά), ίδια κατάσταση.
 *
 * ⚠️ **ΓΙΑΤΙ ΑΠΟΡΡΙΨΗ ΚΑΙ ΟΧΙ ΟΥΡΑ**: το React 19 `useActionState` και το TanStack Query
 * (`scope`) βάζουν τη δεύτερη εκτέλεση σε **ουρά**. Για μη-ιδεμποτική εγγραφή («Καταχώριση
 * πληρωμής») η ουρά είναι ακριβώς η διπλή εγγραφή. Εδώ η δεύτερη **απορρίπτεται σύγχρονα** —
 * το `pending` του render είναι ήδη παλιό τη στιγμή του δεύτερου κλικ, ο `ref` όχι.
 */

import { useCallback, useRef, useState } from 'react';

import { useMountedRef } from '@/hooks/useMountedRef';

/** Έκβαση μιας κλήσης: `ran:false` = απορρίφθηκε γιατί έτρεχε ήδη άλλη. */
export type SingleFlightOutcome<R> =
  | { readonly ran: false }
  | { readonly ran: true; readonly value: R };

export interface SingleFlightRunOptions {
  /**
   * Η επιτυχία οδηγεί σε **πλοήγηση**: ο φραγμός ΔΕΝ ανοίγει μετά από αυτήν (Remix
   * `navigation.state`, RHF `isSubmitSuccessful`). Σε αποτυχία ανοίγει πάντα.
   */
  readonly holdOnSuccess?: boolean;
}

export interface SingleFlight {
  /** `true` όσο τρέχει εκτέλεση — δέσε το σε `disabled` **και** `aria-busy`. */
  readonly pending: boolean;
  /** Τρέχει την εργασία εκτός αν ήδη τρέχει άλλη. Ξαναπετά ό,τι πετάξει εκείνη. */
  readonly run: <R>(task: () => Promise<R>, options?: SingleFlightRunOptions) => Promise<SingleFlightOutcome<R>>;
}

const SKIPPED: SingleFlightOutcome<never> = { ran: false };

export function useSingleFlight(): SingleFlight {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const mounted = useMountedRef();

  const run = useCallback(async <R,>(
    task: () => Promise<R>,
    options?: SingleFlightRunOptions,
  ): Promise<SingleFlightOutcome<R>> => {
    if (inFlight.current) return SKIPPED;

    inFlight.current = true;
    setPending(true);
    let release = true;
    try {
      const value = await task();
      release = !options?.holdOnSuccess;
      return { ran: true, value };
    } finally {
      if (release) {
        inFlight.current = false;
        if (mounted.current) setPending(false);
      }
    }
  }, [mounted]);

  return { pending, run };
}
