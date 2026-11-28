'use client';

/**
 * @fileoverview **Η ΜΙΑ ΑΓΓΕΛΙΑ** — θέαση, επεξεργασία, απόσυρση, και **ο δρόμος προς τον κόσμο**.
 * @related ADR-777 §7 (Α5 · Α14 · Α22) · §8.16 · ADR-946 (διάταξη list-detail) · lib/listings/listing-routes.ts
 * @module components/owner-property/OwnerPropertyDetailContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΡΙΤΗΡΙΟ ΟΛΟΚΛΗΡΩΣΗΣ ΤΗΣ Α14 ΚΛΕΙΝΕΙ **ΕΔΩ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * > *«Αν ένας ιδιώτης δεν μπορεί να ανεβάσει το διαμέρισμά του και **να το δει να
 * > εμφανίζεται στα αποτελέσματα**, δεν έχει τελειώσει.»*
 *
 * Ο σύνδεσμος προς τη **δημόσια** αγγελία (`listingDetailHref`, στο πλαϊνό πάνελ) είναι το σημείο όπου ο κύκλος κλείνει
 * και γίνεται **επαληθεύσιμος από τον ίδιο τον άνθρωπο**. Εμφανίζεται **μόνο** όταν η αγγελία είναι πραγματικά
 * δημοσιευμένη — ένας σύνδεσμος προς κενή σελίδα είναι χειρότερος από κανέναν.
 *
 * 🧭 **ADR-946 — LIST-DETAIL, ΟΧΙ ΜΙΑ ΣΤΗΛΗ ΔΕΚΑΤΕΣΣΑΡΩΝ ΜΠΛΟΚ.** Η σελίδα ήταν 80ch (μέτρο πρόζας) και ~14 μπλοκ σε
 * σειρά, με τις ενέργειες στη μέση. Τώρα: λίστα ενοτήτων με ζωντανή σύνοψη · η ενότητα · πλαϊνό πάνελ με ενέργειες και
 * «τι λείπει». Τα μπλοκ **δεν άλλαξαν** — μόνο η θέση τους (`OwnerPropertySections`).
 */

import React from 'react';
import { useRouter } from '@/lib/workspace/navigation';
import { useAuth } from '@/auth/hooks/useAuth';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { SectionListDetail } from '@/core/layouts';
import { nowISO } from '@/lib/date-local';
import {
  ownerListingVisibility,
  placeKnowledgeFromOwnerProperty,
  projectableFromOwnerProperty,
} from '@/lib/owner-property/owner-property-projection';
import { isOffered, projectListingShape } from '@/services/listings/public-listing-projection';
import { ownerCompletionSubject } from '@/lib/owner-property/owner-completion-subject';
import { ownerPropertyFormFrom } from '@/lib/owner-property/owner-property-form-values';
import { MY_OFFERS_ROUTE } from '@/lib/owner-property/owner-property-routes';
import { useMyOwnerProperty } from '@/services/realtime/hooks/useMyOwnerProperties';
import { usePublicListing } from '@/services/realtime/hooks/usePublicListings';
import type { OwnerProperty } from '@/types/owner-property';
import { ownerMandateViews } from '@/lib/mandate/owner-mandate-view';
import { usePlaceInterest } from '@/hooks/demand/usePlaceInterest';
import { listingStatsStateOf, useOwnerPortfolioStats } from '@/hooks/owner-property/useOwnerPortfolioStats';
import { OwnerPropertyFormContent } from './OwnerPropertyFormContent';
import { OwnerPropertyAside } from './OwnerPropertyAside';
import { OwnerPropertySectionContent, type OwnerSectionData } from './OwnerPropertySections';
import { useOwnerPropertySectionEntries } from './owner-property-sections';

// 🧩 ADR-744 §15 (Φ4) — PER-ROUTE SLICE ΤΗΣ `/offers/[offerId]` (ADR-777 §8.39).
//
// Το `property-market` έπαψε να ταξιδεύει ΟΛΟΚΛΗΡΟ σε 141 διαδρομές (§8.38). Χωρίς
// αυτή τη γραμμή, αυτή η οθόνη θα έβαφε **ωμά κλειδιά στο πρώτο καρέ** — η μία κλάση
// ελαττώματος ανταλλαγμένη με άλλη, που το ADR-744 §8 απαγορεύει ρητά.
//
// 🔴 **ΕΔΩ, ΚΑΙ ΟΧΙ ΣΤΟ `page.tsx`**: εκείνο είναι Server Component, και τα Server/Client
// δέντρα έχουν **ΞΕΧΩΡΙΣΤΟΥΣ γράφους module** — εγγραφή από εκεί θα έγραφε σε **άλλο**
// στιγμιότυπο i18next: πράσινη κλήση που δεν κάνει τίποτα.
//
// ⚠️ **Στατική εισαγωγή, εμβέλεια MODULE** — με `import()` το ωμό κλειδί απλώς
// μετακομίζει σε «ένα καρέ» και κρύβεται από το CHECK 3.51.
import routeSlice from '@/i18n/generated/routes/offers__offerId.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

const NS = 'property-market';
const K = `${NS}:offer`;

/**
 * Ό,τι χρειάζονται ενότητες **και** πλαϊνό, υπολογισμένο **μία** φορά.
 *
 * ⚠️ **ΕΝΑ ρολόι για ΟΛΗ την όψη**, διαβασμένο μία φορά: με δύο κλήσεις, ο κριτής δημοσίευσης και ο ταξινομητής της
 *    εντολής μπορούν να πέσουν σε **διαφορετική μέρα** — και η οθόνη θα έλεγε «στον χάρτη» για εντολή που μόλις έληξε.
 * 🔴 **Ο ΕΝΑΣ κριτής, ο ίδιος με την κάρτα**: *«**έφτασε**;»*, όχι *«**δικαιούται**;»* (`ownerListingVisibility`).
 * 📊 ADR-777 §8.72 — **ΕΝΑ** fetch στατιστικών για κάρτα, πίνακα **και** τη σύνοψη της λίστας.
 * 🏆 ADR-842 Φ5 — `projectListingShape` (όχι `buildPublicListing`): το σχήμα **χωρίς την πύλη**, ώστε ο δείκτης
 *    πληρότητας να υπάρχει **και πριν** τη δημοσίευση. ⛔ Εφήμερο — δεν γράφεται πουθενά.
 * 🖼️ ADR-842 §7.7 — τα **μέσα** του δείκτη έρχονται από τη **δημοσιευμένη** αγγελία: η προβολή γράφει `gallery: []`
 *    με σημασία «το ράφι δεν ρωτήθηκε», όχι «δεν έχει». Ένας ακροατής, **μόνο** όταν η αγγελία είναι στον χάρτη
 *    (κενή ταυτότητα ⇒ καμία ανάγνωση). Η ταυτότητα είναι της καταχώρησης (`listingDetailHref(property.id)`).
 * ⚠️ Οι hooks στην **κορυφή**, ποτέ μέσα σε JSX υπό όρους.
 */
function useOwnerPropertyViewData(property: OwnerProperty, onEdit: () => void) {
  const atISO = nowISO();
  const visibility = ownerListingVisibility(property, atISO);
  const interest = usePlaceInterest(property.id);
  const stats = listingStatsStateOf(useOwnerPortfolioStats(), property.id);
  const projectable = projectableFromOwnerProperty(property, atISO);
  const data: OwnerSectionData = {
    property,
    onMap: visibility === 'published',
    unpublished: visibility === 'failed',
    offered: isOffered(projectable),
    mandateViews: ownerMandateViews(property, atISO),
    interest,
    stats,
    onEdit,
  };
  const published = usePublicListing(visibility === 'published' ? property.id : '');
  const projectedListing = projectListingShape(projectable, placeKnowledgeFromOwnerProperty(property, atISO), atISO);
  return { data, completionSubject: ownerCompletionSubject(projectedListing, published) };
}

/**
 * Η σελίδα του ακινήτου — λίστα ενοτήτων · ενότητα · πλαϊνό. 🔑 **Η επεξεργασία ανοίγει στη θέση της ενότητας**: λίστα
 * και πλαϊνό μένουν ορατά (πριν, η φόρμα αντικαθιστούσε ολόκληρη τη σελίδα). Επιλογή άλλης ενότητας κλείνει τη φόρμα —
 * το πρόχειρο το κρατά η μνήμη της φόρμας (`RestoredDraftNotice`).
 */
function OwnerPropertyView({ property }: { property: OwnerProperty }): React.ReactElement {
  const { t } = useTranslation([NS]);
  const [editing, setEditing] = React.useState(false);
  const { data, completionSubject } = useOwnerPropertyViewData(property, () => setEditing(true));
  const sections = useOwnerPropertySectionEntries({ mandateViews: data.mandateViews, stats: data.stats });

  return (
    <SectionListDetail
      sections={sections}
      navLabel={t(`${K}.sections.navLabel`)}
      backLabel={t(`${K}.sections.back`)}
      asideLabel={t(`${K}.sections.asideLabel`)}
      onSelect={() => setEditing(false)}
      aside={(
        <OwnerPropertyAside
          property={property}
          onMap={data.onMap}
          completionSubject={completionSubject}
          editing={editing}
          onEdit={() => setEditing(true)}
        />
      )}
    >
      {(sectionId) => (editing ? (
        // 🔑 ADR-866 Φ1.3β — ο φάκελος **της αποθηκευμένης αγγελίας**, ποτέ νέος· παλιά αγγελία ⇒ `null`.
        <OwnerPropertyFormContent
          initialValues={ownerPropertyFormFrom(property)}
          editingId={property.id}
          previousOffers={property.offers}
          existingDossierId={property.dossierId ?? null}
          // ADR-953 — η έκδοση περιεχομένου που βλέπει ο άνθρωπος όταν ανοίγει τη φόρμα.
          baseContentAt={property.contentEdit?.at ?? null}
          onClose={() => setEditing(false)}
        />
      ) : (
        <OwnerPropertySectionContent sectionId={sectionId} data={data} />
      ))}
    </SectionListDetail>
  );
}

export function OwnerPropertyDetailContent({
  ownerPropertyId,
}: {
  ownerPropertyId: string;
}): React.ReactElement {
  const { t } = useTranslation([NS]);
  const router = useRouter();
  const { user } = useAuth();
  const lookup = useMyOwnerProperty(ownerPropertyId, user?.uid ?? null);

  return (
    // 🧭 ADR-946 — `data-shell-span="full"`: η σελίδα είναι πίνακας ελέγχου, όχι πρόζα ⇒ όλο το πλάτος της επιφάνειας,
    //    με τον διάδρομο του κελύφους (ADR-797, `shell-surface.css` · ίδιο σχήμα με `NetworkThreadScreen`). ⚠️ ΚΑΝΕΝΑ
    //    `mx-auto max-w-* p-*` εδώ (CHECK 3.63) — οι στήλες ζουν στο πλέγμα του `SectionListDetail`.
    <main data-shell-span="full" className="flex w-full flex-col gap-6">
      <nav>
        <button
          type="button"
          onClick={() => router.push(MY_OFFERS_ROUTE)}
          className="text-sm font-medium text-foreground underline"
        >
          {t(`${K}.detail.back`)}
        </button>
      </nav>

      {lookup.state === 'loading' && <p className="text-muted-foreground">{t(`${K}.detail.loading`)}</p>}
      {lookup.state === 'anonymous' && <p className="text-foreground">{t(`${NS}:demand.space.signInNeeded`)}</p>}
      {lookup.state === 'absent' && <p className="text-foreground">{t(`${K}.detail.absent`)}</p>}
      {lookup.state === 'error' && <p className="text-foreground">{t(`${K}.detail.error`)}</p>}
      {lookup.state === 'found' && <OwnerPropertyView property={lookup.property} />}
    </main>
  );
}
