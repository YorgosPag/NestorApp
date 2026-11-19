'use client';

/**
 * @fileoverview ADR-945 §7.6 — **«Ζήτησε προσφορά» στη σελίδα προφίλ** (`/pro/<ψευδώνυμο>`), όταν ο ιδιώτης ήρθε από
 *   ακίνητο (το πλαίσιο ταξιδεύει από την κάρτα με το `agencyProfileRoute`).
 * @related agency-issuance-quote-context.tsx · issuance-quote-surfaces.tsx (το ΙΔΙΟ κουμπί με την κάρτα)
 * @module components/mandate/AgencyProfileQuoteSlot
 *
 * 🔑 **Στατική εισαγωγή, χωρίς κανένα κείμενο**: ο πάροχος δεν φέρνει namespace· το κουμπί είναι **επιφάνεια** του
 *    εργοστασίου (κώδικας + κείμενα ένα αίτημα, εκτός route slice — CHECK 3.34 · ADR-744 §27).
 * 🔑 Όριο `<Suspense>` **εδώ**: ο πάροχος διαβάζει `useSearchParams`, και χωρίς όριο όλη η σελίδα θα έβγαινε από την
 *    προαπόδοση για ένα κουμπί (CHECK 3.55).
 */

import React, { Suspense } from 'react';

import type { PublicShowcase } from '@/types/agency-profile';
import { AgencyIssuanceQuoteProvider } from './agency-issuance-quote-context';
import { IssuanceQuoteSurfaces } from './issuance-quote-surfaces';

export function AgencyProfileQuoteSlot({ showcase }: { readonly showcase: PublicShowcase }): React.ReactElement {
  return (
    <Suspense fallback={null}>
      <AgencyIssuanceQuoteProvider>
        <IssuanceQuoteSurfaces.AgencyIssuanceQuote slot="request-button" showcase={showcase} />
      </AgencyIssuanceQuoteProvider>
    </Suspense>
  );
}
