'use client';

/**
 * @fileoverview ADR-945 §7.6 — **το αίτημα προσφορών ενός (ακινήτου, είδους)**, για τον ιδιώτη: φόρτωση μετά την
 *   ταυτότητα, και ανανέωση **στο παρασκήνιο** μετά από πράξη.
 * @related usePropertyUpkeep.ts (το ΙΔΙΟ ιδίωμα stale-while-revalidate) · useIssuanceRequestAction.ts (η αποστολή) ·
 *   services/document-registry/document-registry.client.ts (`fetchIssuanceRequest`)
 * @module hooks/document-registry/useIssuanceRequest
 *
 * 🔑 **Κανένας υπολογισμός**: στάδια, «μπορώ να πράξω;» (`canAct`) και κύκλος έρχονται κριμένα από τον διακομιστή· οι
 *    παραγόμενες απαντήσεις (φάση · CAS · «κι άλλον;») ζουν στο καθαρό `issuance-request-view-model.ts`.
 * 🔑 **Ανανέωση χωρίς «φορτώνει»**: η νεότερη απάντηση είναι **δεμένη** στη φόρτωση πάνω στην οποία ήρθε — αλλαγή
 *    ακινήτου ή είδους ⇒ ποτέ τα στοιχεία του προηγούμενου.
 */

import { useCallback, useState } from 'react';

import type { DocumentKind } from '@/config/document-validity/document-validity';
import { useIdentityGatedResource } from '@/hooks/useIdentityGatedResource';
import type { IssuanceBiddingResponse } from '@/lib/document-validity/issuance-bidding-request';
import { fetchIssuanceRequest, type IssuanceBiddingLoad } from '@/services/document-registry/document-registry.client';

/** Λύθηκε η ταυτότητα και δεν υπάρχει κανείς ⇒ καμία ενότητα (το αίτημα είναι πάντα κάποιου). */
const NOBODY: IssuanceBiddingLoad = { kind: 'unavailable' };

export type IssuanceRequestState =
  | { readonly state: 'loading' }
  | { readonly state: 'unavailable' }
  | { readonly state: 'failed' }
  | { readonly state: 'ready'; readonly response: IssuanceBiddingResponse };

export interface IssuanceRequestApi {
  readonly view: IssuanceRequestState;
  /** Ξαναδιάβασμα στο παρασκήνιο — το δίνει η ενότητα στο `useIssuanceRequestAction`. */
  readonly revalidate: () => Promise<void>;
}

interface Fresher {
  readonly base: IssuanceBiddingLoad;
  readonly response: IssuanceBiddingResponse;
}

function responseOf(load: Extract<IssuanceBiddingLoad, { kind: 'ready' }>): IssuanceBiddingResponse {
  return { request: load.request, bids: load.bids, canAct: load.canAct };
}

function stateOf(loaded: IssuanceBiddingLoad | null, fresher: Fresher | null): IssuanceRequestState {
  if (loaded === null) return { state: 'loading' };
  if (loaded.kind !== 'ready') return { state: loaded.kind };
  return { state: 'ready', response: fresher !== null && fresher.base === loaded ? fresher.response : responseOf(loaded) };
}

export function useIssuanceRequest(propertyId: string, documentKind: DocumentKind): IssuanceRequestApi {
  const fetcher = useCallback(() => fetchIssuanceRequest(propertyId, documentKind), [propertyId, documentKind]);
  const { value: loaded } = useIdentityGatedResource<IssuanceBiddingLoad>(fetcher, NOBODY);
  const [fresher, setFresher] = useState<Fresher | null>(null);

  const revalidate = useCallback(async (): Promise<void> => {
    if (loaded === null || loaded.kind !== 'ready') return;
    const next = await fetcher();
    // Αποτυχημένη ανανέωση ⇒ κρατά τα προηγούμενα (ποτέ κενή ενότητα από βλάβη δικτύου).
    if (next.kind === 'ready') setFresher({ base: loaded, response: responseOf(next) });
  }, [fetcher, loaded]);

  return { view: stateOf(loaded, fresher), revalidate };
}
