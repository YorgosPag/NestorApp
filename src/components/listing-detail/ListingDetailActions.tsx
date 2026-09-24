'use client';

/**
 * @fileoverview **ΟΙ ΔΥΟ ΠΡΑΞΕΙΣ ΤΟΥ ΑΝΘΡΩΠΟΥ ΠΟΥ ΕΝΔΙΑΦΕΡΕΤΑΙ** — «πλησίασε» και «κράτα» (ADR-777 §8.74.7).
 * @related components/contact/FirstContactAction.tsx · components/listings/SaveListingToggle.tsx ·
 *   services/contact/first-contact.client.ts (`isOwnTargetAnswer`)
 * @module components/listing-detail/ListingDetailActions
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ.** Μετρημένο σε browser (2026-09-24): ο κάτοχος έβλεπε «Αυτή είναι η αγγελία σας» και
 * **ακριβώς από κάτω** «Αποθήκευση αγγελίας» — που πατιόταν, έστελνε `PUT`, και γύριζε `409 own-listing`
 * με είδηση. Η σελίδα **ήξερε ήδη** την απάντηση και τη ρωτούσε ξανά μέσω κλικ.
 *
 * 🔑 **ΜΙΑ ετυμηγορία, ΚΑΝΕΝΑ δεύτερο αίτημα, ΚΑΝΕΝΑΣ δεύτερος κριτής.** Η ήσυχη ερώτηση της επαφής και η
 * άρνηση της αποθήκευσης βγαίνουν από τον **ίδιο** `mayAdminister` (CHECK 3.56). Εδώ απλώς **μοιράζεται**:
 * ο κάτοχος δεν βλέπει καρδιά, και το πλαίσιο της επαφής λέει ήδη **γιατί** (Zillow: ο ιδιοκτήτης βλέπει
 * dashboard, όχι «Save»). Άγνωστο / ανώνυμος ⇒ η καρδιά μένει (fail-open, όπως το κουμπί της επαφής).
 */

import React, { useState } from 'react';

import { FirstContactAction } from '@/components/contact/FirstContactAction';
import { SaveListingToggle } from '@/components/listings/SaveListingToggle';
import { SavedListingsProvider } from '@/components/listings/SavedListingsProvider';
import { isOwnTargetAnswer, type ContactAdmissionAnswer } from '@/services/contact/first-contact.client';

export interface ListingDetailActionsProps {
  readonly listingId: string;
}

export function ListingDetailActions({ listingId }: ListingDetailActionsProps): React.ReactElement {
  const [ownListing, setOwnListing] = useState(false);
  const report = (answer: ContactAdmissionAnswer | null): void => setOwnListing(isOwnTargetAnswer(answer));

  return (
    <>
      {/* ADR-843 ΠΕ1 — το κουμπί που γράφει (ADR-827 §9.8), αμέσως μετά την τιμή. */}
      <FirstContactAction target={{ kind: 'listing', listingId }} onAnswer={report} />
      {/* ❤️ ADR-777 §8.74 — «κράτα την», δίπλα στην επαφή· ποτέ για τον κάτοχο (§8.74.7). */}
      {!ownListing && (
        <SavedListingsProvider>
          <SaveListingToggle listingId={listingId} appearance="labeled" className="w-full" />
        </SavedListingsProvider>
      )}
    </>
  );
}
