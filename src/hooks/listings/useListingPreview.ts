'use client';

/**
 * @fileoverview **Η αγγελία όπως θα τη δει ο αγοραστής**, από τον server (ADR-898 Φ3β-3) — η βάση της ενότητας
 * «Αντικειμενική αξία» για ιδιώτη και γραφείο.
 * @related `lib/listings/listing-preview-request.ts` · `app/api/listings/preview/route.ts`
 * @module hooks/listings/useListingPreview
 *
 * 🔑 **Παλιό όσο έρχεται το νέο** (stale-while-revalidate): σε κάθε νέα `revision` του εγγράφου η βάση ξαναζητιέται,
 *   αλλά η οθόνη κρατά την προηγούμενη — ποτέ αναβόσβημα σε «φόρτωση» μετά από κάθε απάντηση.
 * 🔑 **Νικά η τελευταία ερώτηση**: απάντηση που φτάνει μετά από νεότερη αίτηση αγνοείται (αριθμός ακολουθίας).
 */

import { useEffect, useRef, useState } from 'react';

import { apiClient } from '@/lib/api/enterprise-api-client';
import { listingPreviewPath, type ListingPreviewResponse } from '@/lib/listings/listing-preview-request';
import { createModuleLogger } from '@/lib/telemetry';
import type { PublicListing } from '@/types/public-listing';

const logger = createModuleLogger('useListingPreview');

export type ListingPreviewState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly listing: PublicListing }
  | { readonly kind: 'failed' };

/**
 * @param propertyId — `ownp_*` ή `prop_*`
 * @param revision — αλλάζει όταν αλλάζει το έγγραφο (π.χ. `updatedAt` του listener) ⇒ νέα ανάγνωση
 */
export function useListingPreview(propertyId: string, revision: unknown): ListingPreviewState {
  const [state, setState] = useState<ListingPreviewState>({ kind: 'loading' });
  const sequence = useRef(0);

  useEffect(() => {
    const ticket = ++sequence.current;
    apiClient
      .get<ListingPreviewResponse>(listingPreviewPath(propertyId))
      .then((body) => {
        if (ticket === sequence.current) setState({ kind: 'ready', listing: body.listing });
      })
      .catch((cause: unknown) => {
        if (ticket !== sequence.current) return;
        logger.warn('Η προεπισκόπηση της αγγελίας δεν φορτώθηκε', {
          data: { propertyId },
          error: cause instanceof Error ? cause.message : String(cause),
        });
        // Μια βάση που ήδη υπάρχει μένει (απέτυχε μόνο η ανανέωση)· χωρίς βάση ⇒ αποτυχία.
        setState((previous) => (previous.kind === 'ready' ? previous : { kind: 'failed' }));
      });
  }, [propertyId, revision]);

  // Άλλη ταυτότητα ⇒ η παλιά βάση δεν ισχύει.
  useEffect(() => () => setState({ kind: 'loading' }), [propertyId]);

  return state;
}
