'use client';

/**
 * @fileoverview **Τι βλέπει ο αγοραστής, τώρα** (ADR-946 · ADR-842 Φ4) — τα ΙΔΙΑ components της δημόσιας αγγελίας, πάνω
 * στην ΙΔΙΑ προβολή του server, μέσα στο πλαϊνό της «Βελτίωσε την αγγελία σου».
 * @related `improve-surfaces.tsx` (η τεμπέλικη επιφάνεια που το φορτώνει, με τα κείμενά του) ·
 *   `OwnerListingImproveAside.tsx` (ο καλών) · `listing-detail/*` (τα components)
 * @module components/owner-property/improve/OwnerListingBuyerPreview
 *
 * 🔑 **Η προεπισκόπηση ΕΙΝΑΙ η αγγελία** (δόγμα του `ObjectiveValueVisibility`): καμία αναπαράσταση που θα μπορούσε
 *   να αποκλίνει από τη δημόσια σελίδα.
 * ⚡ **Μόνο μέσω `ImproveSurfaces`** — ποτέ στατική εισαγωγή: θα ξανάβαζε το `listing-detail` στο slice της διαδρομής.
 */

import React from 'react';

import { ListingEnergyCertificate } from '@/components/listing-detail/ListingEnergyCertificate';
import { ListingPriceBlock } from '@/components/listing-detail/ListingPriceBlock';
import type { ObjectiveValueReturn } from '@/lib/objective-value/objective-value-return';
import type { PublicListing } from '@/types/public-listing';

import { ObjectiveValueBuyerPreview } from './ObjectiveValueVisibility';
import type { ImproveZone } from './useObjectiveValueImprove';

export interface OwnerListingBuyerPreviewProps {
  readonly listing: PublicListing;
  readonly zone: ImproveZone;
  /** Ο δρόμος επιστροφής από τον υπολογιστή (ADR-947 Φ1β) — ο αγοραστής δεν τον έχει, ο ιδιοκτήτης εδώ ναι. */
  readonly back: ObjectiveValueReturn;
}

/** Η αντικειμενική του αγοραστή — μόνο όταν η μηχανή απάντησε και η θέση δίνει ζώνη. */
function BuyerObjectiveValue({ zone, back }: Pick<OwnerListingBuyerPreviewProps, 'zone' | 'back'>) {
  if (zone.kind !== 'answered' || zone.buyerView.kind === 'no-zone') return null;
  return <ObjectiveValueBuyerPreview buyerView={zone.buyerView} back={back} />;
}

export function OwnerListingBuyerPreview({ listing, zone, back }: OwnerListingBuyerPreviewProps) {
  return (
    <>
      <ListingPriceBlock listing={listing} />
      <ListingEnergyCertificate listing={listing} />
      <BuyerObjectiveValue zone={zone} back={back} />
    </>
  );
}
