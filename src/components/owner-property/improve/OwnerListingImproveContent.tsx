'use client';

/**
 * @fileoverview **«Βελτίωσε την αγγελία σου»** (ADR-898 Φ3β-2 · ADR-842 Φ4) — η οθόνη που ρωτά, **μετά** τη
 * δημοσίευση, ό,τι η αγγελία δεν μπορεί να ξέρει μόνη της. Μία `<section>` ανά ενότητα του καταχωρητή.
 * @related `improve-sections.ts` (ο καταχωρητής) · `app/(me)/offers/[offerId]/improve/page.tsx` ·
 *   πρότυπο `components/spatial-tour/OfferTourContent.tsx` (slice διαδρομής, σύνδεσμος πίσω)
 * @module components/owner-property/improve/OwnerListingImproveContent
 *
 * 🔑 **Πρώτα δημοσίευση, μετά βελτίωση** (Airbnb · ADR-842 Α2): μη δημοσιευμένη αγγελία ⇒ εξήγηση και σύνδεσμος πίσω,
 *   ποτέ ερωτήσεις. Η `/offers/new` μένει **8 πεδία**.
 * 🔑 **Ο listener είναι η πηγή αλήθειας** (`useMyOwnerProperty`)· η ουρά κάθε ενότητας απλώνει μόνο ό,τι δεν
 *   επιβεβαιώθηκε ακόμη.
 * ⛔ Σύνδεσμοι μόνο από `@/lib/workspace/navigation` (CHECK 3.61).
 */

import React, { useId } from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { nowISO } from '@/lib/date-local';
import {
  ownerListingVisibility,
  placeKnowledgeFromOwnerProperty,
  projectableFromOwnerProperty,
} from '@/lib/owner-property/owner-property-projection';
import type { ObjectiveValueImproveSubject } from '@/lib/objective-value/objective-value-improve-subject';
import { offerDetailHref } from '@/lib/owner-property/owner-property-routes';
import { Link } from '@/lib/workspace/navigation';
import { projectListingShape } from '@/services/listings/public-listing-projection';
import { useMyOwnerProperty } from '@/services/realtime/hooks/useMyOwnerProperties';
import type { OwnerProperty } from '@/types/owner-property';

import { applicableImproveSections, IMPROVE_SECTIONS, type ImproveSectionId } from './improve-sections';
import { useOwnerImproveSubject } from './owner-improve-subject';

// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE (ποτέ `import()`, ποτέ σε Server Component).
import routeSlice from '@/i18n/generated/routes/offers__offerId__improve.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

const NS = 'objective-value';
const I = `${NS}:improve`;

function ImproveSection({ id, subject }: { readonly id: ImproveSectionId; readonly subject: ObjectiveValueImproveSubject }) {
  const { t } = useTranslation([NS]);
  const headingId = useId();
  const { Component } = IMPROVE_SECTIONS[id];
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId} className="m-0 text-lg font-semibold text-foreground">{t(`${I}.sections.${id}.title`)}</h2>
      <Component subject={subject} />
    </section>
  );
}

function ImproveBody({ property }: { readonly property: OwnerProperty }) {
  const { t } = useTranslation([NS]);
  const subject = useOwnerImproveSubject(property);
  const atISO = nowISO();
  const published = ownerListingVisibility(property, atISO) === 'published';
  if (!published) return <p className="m-0 text-foreground">{t(`${I}.notPublished`)}</p>;
  // Η ίδια προβολή που διαβάζει ο αγοραστής κρίνει ποιες ενότητες έχουν νόημα (εφήμερη, δεν γράφεται πουθενά).
  const listing = projectListingShape(
    projectableFromOwnerProperty(property, atISO),
    placeKnowledgeFromOwnerProperty(property, atISO),
    atISO,
  );
  return (
    <>
      {applicableImproveSections(listing).map((id) => (
        <ImproveSection key={id} id={id} subject={subject} />
      ))}
    </>
  );
}

export function OwnerListingImproveContent({ ownerPropertyId }: { readonly ownerPropertyId: string }) {
  const { t } = useTranslation([NS]);
  const { user } = useAuth();
  const lookup = useMyOwnerProperty(ownerPropertyId, user?.uid ?? null);
  return (
    <main className="flex w-full flex-col gap-6">
      <nav>
        <Link href={offerDetailHref(ownerPropertyId)} className="text-sm underline">{t(`${I}.back`)}</Link>
      </nav>
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-semibold text-foreground">{t(`${I}.pageTitle`)}</h1>
        <p className="m-0 text-sm text-muted-foreground">{t(`${I}.intro`)}</p>
      </header>
      {lookup.state === 'loading' && <p className="m-0 text-muted-foreground">{t(`${I}.loading`)}</p>}
      {lookup.state === 'anonymous' && <p className="m-0 text-foreground">{t(`${I}.signInNeeded`)}</p>}
      {lookup.state === 'absent' && <p className="m-0 text-foreground">{t(`${I}.absent`)}</p>}
      {lookup.state === 'error' && <p className="m-0 text-foreground">{t(`${I}.error`)}</p>}
      {lookup.state === 'found' && <ImproveBody property={lookup.property} />}
    </main>
  );
}
