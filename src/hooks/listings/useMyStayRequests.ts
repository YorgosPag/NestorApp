'use client';

/**
 * @fileoverview **Τα αιτήματά μου για αυτή την αγγελία** — και οι πράξεις μου πάνω τους (ADR-835 §23).
 * @related services/stay-calendar/stay-request.client.ts · components/listing-detail/ListingStayRequest.tsx
 * @module hooks/listings/useMyStayRequests
 *
 * ⚠️ Η παλιότερη απάντηση χάνει (φρουρός σειράς) — ίδιο ιδίωμα με το `usePublicStayNights`.
 * 🔑 **Καμία αισιόδοξη εγγραφή για το αίτημα**: η υπόσχεση («σε αναμονή ως 14:00») είναι **του
 * διακομιστή** — ένα αισιόδοξο «στάλθηκε» που μετά γίνεται «όχι» θα έλεγε ψέματα για κράτηση.
 * Η οθόνη δείχνει «αποστέλλεται…» και μετά **την ακριβή** έκβαση.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { StayGuestRequestView } from '@/lib/stay/stay-guest-request-view';
import type { StayCalendarSendOutcome } from '@/services/stay-calendar/stay-calendar.client';
import {
  fetchMyStayRequests,
  sendStayGuestCommand,
  type StayGuestCommand,
  type StayGuestRequestsLoad,
} from '@/services/stay-calendar/stay-request.client';

export type MyStayRequestsState = { readonly kind: 'idle' } | { readonly kind: 'loading' } | StayGuestRequestsLoad;

/**
 * **Τα αιτήματά μου που διαβάστηκαν** — κενό σε κάθε άλλη κατάσταση. Ένα σημείο για τους δύο
 * καταναλωτές (γραμμές αιτημάτων · σήμανση «το αίτημά σας» στο πλέγμα, ADR-835 §23.12 Ε3).
 */
export function readableStayRequestsOf(state: MyStayRequestsState): readonly StayGuestRequestView[] {
  return state.kind === 'loaded' && state.requests.kind === 'readable' ? state.requests.requests : [];
}

export interface MyStayRequests {
  readonly state: MyStayRequestsState;
  readonly busy: boolean;
  readonly lastOutcome: StayCalendarSendOutcome | null;
  readonly send: (command: StayGuestCommand) => Promise<StayCalendarSendOutcome>;
}

/** @param signedIn — χωρίς σύνδεση **δεν** ρωτά: «δεν έχεις αιτήματα» θα ήταν ψέμα, όχι απάντηση. */
export function useMyStayRequests(listingId: string, signedIn: boolean): MyStayRequests {
  const [state, setState] = useState<MyStayRequestsState>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<StayCalendarSendOutcome | null>(null);
  const sequence = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    const seq = ++sequence.current;
    if (!signedIn) {
      setState({ kind: 'idle' });
      return;
    }
    setState({ kind: 'loading' });
    const result = await fetchMyStayRequests(listingId);
    if (seq === sequence.current) setState(result);
  }, [listingId, signedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = useCallback(async (command: StayGuestCommand): Promise<StayCalendarSendOutcome> => {
    setBusy(true);
    const outcome = await sendStayGuestCommand(listingId, command);
    setLastOutcome(outcome);
    setBusy(false);
    // Κάθε έκβαση ξαναδιαβάζει: και η άρνηση λέει κάτι νέο (π.χ. «σε αναμονή ως …» από άλλον).
    await load();
    return outcome;
  }, [listingId, load]);

  return { state, busy, lastOutcome, send };
}
