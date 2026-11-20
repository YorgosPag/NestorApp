'use client';

/**
 * @fileoverview **«Βελτίωσε την αγγελία σου»** (ADR-898 Φ3β-2 · ADR-842 Φ4) — η οθόνη που ρωτά, **μετά** τη
 * δημοσίευση, ό,τι η αγγελία δεν μπορεί να ξέρει μόνη της. Διάταξη λίστα ενοτήτων → ενότητα → πλαϊνό (ADR-946):
 * μία ενότητα του καταχωρητή τη φορά, με σύνοψη ανά ενότητα και την αγγελία του αγοραστή πάντα δίπλα.
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

import React from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import { SectionListDetail } from '@/core/layouts/SectionListDetail';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { nowISO } from '@/lib/date-local';
import {
  ownerListingVisibility,
  placeKnowledgeFromOwnerProperty,
  projectableFromOwnerProperty,
} from '@/lib/owner-property/owner-property-projection';
import { offerDetailHref } from '@/lib/owner-property/owner-property-routes';
import { Link } from '@/lib/workspace/navigation';
import { projectListingShape } from '@/services/listings/public-listing-projection';
import { useMyOwnerProperty } from '@/services/realtime/hooks/useMyOwnerProperties';
import { usePublicListing } from '@/services/realtime/hooks/usePublicListings';
import type { OwnerProperty } from '@/types/owner-property';
import type { PublicListing } from '@/types/public-listing';

import { useImproveSectionEntries } from './improve-section-entries';
import {
  applicableImproveSections,
  IMPROVE_SECTIONS,
  type ImproveContext,
  type ImproveSectionId,
  type ImproveSubjects,
} from './improve-sections';
import { OwnerListingImproveAside } from './OwnerListingImproveAside';
import { useOwnerImproveSubjects } from './owner-improve-subject';
import { useObjectiveValueImprove } from './useObjectiveValueImprove';

// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE (ποτέ `import()`, ποτέ σε Server Component).
import routeSlice from '@/i18n/generated/routes/offers__offerId__improve.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

const NS = 'objective-value';
const I = `${NS}:improve`;

/**
 * Το περιεχόμενο της ενεργής ενότητας. Ο τίτλος (`<h2>`) είναι του `SectionListDetail`.
 * 📏 **Η φόρμα μένει στενή** (48rem): στη βαθμίδα `pane-wide` η στήλη της ενότητας είναι `1fr` (~1450px σε 2400px) —
 *   ερώτηση και πεδίο τόσο μακριά διαβάζονται κακά (μονή στήλη, NN/g · Baymard). Το όριο είναι της **φόρμας**, όχι
 *   της σελίδας: πλάτος σελίδας και διάδρομος μένουν του κελύφους (CHECK 3.63).
 */
function SectionBody({ context, id }: { readonly context: ImproveContext; readonly id: ImproveSectionId }) {
  return <div className="flex w-full max-w-3xl flex-col gap-4">{IMPROVE_SECTIONS[id].render(context)}</div>;
}

interface WorkspaceProps {
  readonly property: OwnerProperty;
  readonly subjects: ImproveSubjects;
  /** Η προβολή του browser: κρίνει ποιες ενότητες ισχύουν και τρέφει τον δείκτη πληρότητας. */
  readonly listing: PublicListing;
}

/**
 * **Λίστα ενοτήτων → ενότητα → πλαϊνό** (ADR-946, δεύτερος καταναλωτής του `SectionListDetail`, όπως η σελίδα του
 * ακινήτου από όπου έρχεται ο άνθρωπος). Η κατάσταση που μοιράζονται λίστα, ενότητα και πλαϊνό κρατιέται **εδώ, μία
 * φορά**: η αντικειμενική (μία βάση από τον server, μία ζώνη) και η ζωντανή δημόσια αγγελία (το τοπογραφικό).
 */
function ImproveWorkspace({ property, subjects, listing }: WorkspaceProps) {
  const { t } = useTranslation([NS]);
  const ids = applicableImproveSections(listing);
  const objectiveValue = useObjectiveValueImprove(subjects.objectiveValue, { zoneEnabled: ids.includes('objectiveValue') });
  // Κενή ταυτότητα ⇒ καμία ανάγνωση (το `usePublicListing` απαντά «absent» χωρίς listener).
  const publicListing = usePublicListing(ids.includes('terrain') ? subjects.terrain.listingId : '');
  // Χωρίς `useMemo`: η κατάσταση της αντικειμενικής είναι νέο αντικείμενο σε κάθε απόδοση, άρα η απομνημόνευση δεν θα κρατούσε.
  const context: ImproveContext = { subjects, objectiveValue, publicListing };
  const entries = useImproveSectionEntries(ids, context);
  return (
    <SectionListDetail
      sections={entries}
      navLabel={t(`${I}.nav.label`)}
      backLabel={t(`${I}.nav.back`)}
      asideLabel={t(`${I}.aside.label`)}
      aside={<OwnerListingImproveAside ownerPropertyId={property.id} completionListing={listing} objectiveValue={objectiveValue} />}
    >
      {(activeId) => {
        const id = ids.find((candidate) => candidate === activeId);
        return id === undefined ? null : <SectionBody context={context} id={id} />;
      }}
    </SectionListDetail>
  );
}

function ImproveBody({ property }: { readonly property: OwnerProperty }) {
  const { t } = useTranslation([NS]);
  const subjects = useOwnerImproveSubjects(property);
  const atISO = nowISO();
  const published = ownerListingVisibility(property, atISO) === 'published';
  if (!published) return <p className="m-0 text-foreground">{t(`${I}.notPublished`)}</p>;
  // Η ίδια προβολή που διαβάζει ο αγοραστής κρίνει ποιες ενότητες έχουν νόημα (εφήμερη, δεν γράφεται πουθενά).
  const listing = projectListingShape(
    projectableFromOwnerProperty(property, atISO),
    placeKnowledgeFromOwnerProperty(property, atISO),
    atISO,
  );
  return <ImproveWorkspace property={property} subjects={subjects} listing={listing} />;
}

export function OwnerListingImproveContent({ ownerPropertyId }: { readonly ownerPropertyId: string }) {
  const { t } = useTranslation([NS]);
  const { user } = useAuth();
  const lookup = useMyOwnerProperty(ownerPropertyId, user?.uid ?? null);
  return (
    // 🧭 ADR-946 — `data-shell-span="full"`: λίστα · φόρμα · προεπισκόπηση δεν είναι πρόζα ⇒ όλο το πλάτος της
    //    επιφάνειας, με τον διάδρομο του κελύφους (ίδιο σχήμα με το `OwnerPropertyDetailContent`). ⚠️ ΚΑΝΕΝΑ
    //    `mx-auto max-w-* p-*` εδώ (CHECK 3.63) — οι στήλες ζουν στο πλέγμα του `SectionListDetail`.
    <main data-shell-span="full" className="flex w-full flex-col gap-6">
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
