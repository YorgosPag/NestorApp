'use client';

/**
 * @fileoverview **Το πλαϊνό της «Βελτίωσε την αγγελία σου»** (ADR-946 · ADR-842 Φ4) — πόσο πλήρης είναι η αγγελία, και
 * **τι βλέπει ο αγοραστής τώρα**, δίπλα στη φόρμα που το αλλάζει (το πάνελ ιδιοτήτων του Figma/Revit).
 * @related `OwnerListingImproveContent.tsx` (ο κάτοχος) · `core/layouts/SectionListDetail.tsx` (η θέση του) ·
 *   `OwnerListingCompletion.tsx` (η πληρότητα) · `improve-surfaces.tsx` → `OwnerListingBuyerPreview.tsx` (ο αγοραστής)
 * @module components/owner-property/improve/OwnerListingImproveAside
 *
 * 🔑 **Μία ανάγνωση, όχι δεύτερη**: η αγγελία του αγοραστή είναι η βάση του server που ήδη κρατά η κατάσταση της
 *   αντικειμενικής (`useListingPreview`, stale-while-revalidate) — κάθε αποθηκευμένη απάντηση φαίνεται εδώ χωρίς ανανέωση.
 * 🔑 **Ένα αντίτυπο**: η ενότητα «Αντικειμενική αξία» δείχνει μόνο τον διακόπτη (`preview: false`)· η προεπισκόπηση,
 *   με τον δρόμο επιστροφής από τον υπολογιστή (ADR-947 Φ1β), ζει μόνο εδώ.
 * ⛔ **Καμία δεύτερη μηχανή πληρότητας** (ADR-842 Α5): το `OwnerListingCompletion`, χωρίς σύνδεσμο προς τον εαυτό της.
 */

import React, { useId } from 'react';

import { Card } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { listingDetailHref } from '@/lib/listings/listing-routes';
import { objectiveValueReturnOf } from '@/lib/objective-value/objective-value-return';
import { Link } from '@/lib/workspace/navigation';
import type { PublicListing } from '@/types/public-listing';

import { OwnerListingCompletion } from '../OwnerListingCompletion';
import { BuyerPreviewPending, ImproveSurfaces } from './improve-surfaces';
import type { ObjectiveValueImproveState } from './useObjectiveValueImprove';

const NS = 'objective-value';
const A = `${NS}:improve.aside`;

interface AsideProps {
  readonly ownerPropertyId: string;
  /** Η προβολή του browser — η ίδια είσοδος πληρότητας με τη σελίδα του ακινήτου (`OwnerPropertyAside`). */
  readonly completionListing: PublicListing;
  readonly objectiveValue: ObjectiveValueImproveState;
}

function BuyerPreviewBody({ ownerPropertyId, objectiveValue }: Omit<AsideProps, 'completionListing'>) {
  const { t } = useTranslation([NS]);
  const { buyerListing, previewKind, zone } = objectiveValue;
  if (buyerListing === null) {
    return previewKind === 'failed'
      ? <p role="status" className="m-0 text-sm text-muted-foreground">{t(`${A}.failed`)}</p>
      : <BuyerPreviewPending />;
  }
  // ⚡ Τεμπέλικη επιφάνεια (ADR-744 §27.4): κώδικας + `listing-detail` έρχονται μαζί, μόνο εδώ — δες `improve-surfaces.tsx`.
  return (
    <ImproveSurfaces.OwnerListingBuyerPreview
      listing={buyerListing}
      zone={zone}
      back={objectiveValueReturnOf(ownerPropertyId)}
    />
  );
}

export function OwnerListingImproveAside({ ownerPropertyId, completionListing, objectiveValue }: AsideProps) {
  const { t } = useTranslation([NS]);
  const headingId = useId();
  return (
    <>
      <OwnerListingCompletion listing={completionListing} improveOfferId={null} />
      <Card asChild className="flex flex-col gap-3 p-4">
        <section aria-labelledby={headingId}>
          <header className="flex flex-col gap-1">
            <h2 id={headingId} className="m-0 text-sm font-semibold text-foreground">{t(`${A}.buyerTitle`)}</h2>
            <p className="m-0 text-xs text-muted-foreground">{t(`${A}.buyerLead`)}</p>
          </header>
          <BuyerPreviewBody ownerPropertyId={ownerPropertyId} objectiveValue={objectiveValue} />
          <Link href={listingDetailHref(ownerPropertyId)} className="self-start text-sm underline">
            {t(`${A}.openListing`)}
          </Link>
        </section>
      </Card>
    </>
  );
}
