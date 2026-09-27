'use client';

/**
 * @fileoverview **Η ΣΕΛΙΔΑ ΘΕΑΣΗΣ ΜΙΑΣ ΑΓΓΕΛΙΑΣ** — `/listing/[id]/tour` (ADR-884 Κ3β).
 * @related `app/(light)/listing/[id]/tour/page.tsx` · `TourViewSurface.tsx` · `lib/spatial-tour/tour-subject-of-listing.ts`
 * @module components/spatial-tour/TourViewPageContent
 *
 * 🔑 **Ίδια διεύθυνση για όλους** (επισκέπτης · εγκεκριμένος · υπεύθυνος): η ρίζα βγαίνει από την ταυτότητα της
 * αγγελίας, η πύλη του διακομιστή λέει τι βλέπει ο καθένας. Εδώ φτάνει και το email «εγκρίθηκε».
 * ⛔ Σύνδεσμοι μόνο από `@/lib/workspace/navigation` (CHECK 3.61).
 */

import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { ListingMediaTabs } from '@/components/listing-detail/media/ListingMediaTabs';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { listingGalleryImages } from '@/lib/listings/listing-images';
import { listingDetailHref } from '@/lib/listings/listing-routes';
import { isPubliclyPresentable } from '@/lib/property/attribute-provenance';
import { tourSubjectOfListing } from '@/lib/spatial-tour/tour-subject-of-listing';
import { tourViewHref } from '@/lib/spatial-tour/tour-routes';
import { Link } from '@/lib/workspace/navigation';
import { usePublicListing } from '@/services/realtime/hooks/usePublicListings';

// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE (ποτέ `import()`, ποτέ σε Server Component).
import routeSlice from '@/i18n/generated/routes/listing__id__tour.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

import { SPATIAL_TOUR_NS } from './spatial-tour-namespace';
import { VIEWER_KEYS } from './tour-access-labels';
import { TourViewRefusal } from './TourViewRefusal';
import { TourViewSurface } from './TourViewSurface';

registerRouteSlice(routeSlice);

/**
 * ADR-884 Φ2στ · §4.12 Μέρος Δ — «Πίσω» + οι τρεις καρτέλες. Χωριστό component, ώστε το ερώτημα «ποια αγγελία
 * φορτώνω για τη διαθεσιμότητα φωτογραφιών/κάτοψης;» να μην ανακατεύεται με την κρίση `subject === null`.
 */
function TourViewLead({ listingId, back }: { readonly listingId: string; readonly back: ReactNode }) {
  // Ίδιος φορτωτής με τη σελίδα ακινήτου (`usePublicListing`) — δεν υπάρχει δεύτερο ερώτημα να αποκλίνει.
  const lookup = usePublicListing(listingId);
  const photosAvailable = lookup.state === 'found' && listingGalleryImages(lookup.listing).length > 0;
  const floorplanAvailable = lookup.state === 'found' && lookup.listing.floorplans.some(isPubliclyPresentable);
  return (
    <>
      {back}
      <ListingMediaTabs
        listingId={listingId}
        current="tour"
        available={{ photos: photosAvailable, floorplan: floorplanAvailable, tour: true }}
      />
    </>
  );
}

export function TourViewPageContent({ listingId }: { readonly listingId: string }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const subject = useMemo(() => tourSubjectOfListing(listingId), [listingId]);
  const back = (
    <nav>
      <Link href={listingDetailHref(listingId)} className="text-sm underline">{t(VIEWER_KEYS.backToListing)}</Link>
    </nav>
  );
  return (
    <main
      /*
        🖼️ ΕΠΙΦΑΝΕΙΑ-ΚΑΜΒΑΣ ΣΕ ΠΛΗΡΕΣ ΠΑΡΑΘΥΡΟ (ADR-884 Φ2στ · ADR-797 Φάσεις Β+Γ) — πρότυπο Zillow 3D Home.
        `bleed` = μηδέν διάδρομος· `data-shell-viewport` = το κάδρο κλειδώνει στο παράθυρο. Μετρημένο ζωντανά 2026-09-27
        ΧΩΡΙΣ αυτά: σκηνή 2336×1314 σε παράθυρο ύψους 1121 ⇒ τα βελάκια του πατώματος ΚΑΤΩ από το ορατό μέρος.
        ⚠️ ΑΜΕΣΟ ΠΑΙΔΙ του διαδρόμου (κανόνας Υ5 του CHECK 3.63) — το `Suspense` της σελίδας δεν προσθέτει κόμβο.
        Η δήλωση ζει με λόγο (και εξαίρεση WCAG 1.4.10) στο `.shell-surface.json`.
      */
      data-shell-surface="bleed"
      data-shell-viewport
      className="flex min-h-0 flex-1 flex-col bg-background"
    >
      {subject === null
        ? <section className="space-y-3 p-4">{back}<p className="text-sm text-destructive" role="alert">{t(VIEWER_KEYS.notViewable)}</p></section>
        : <TourViewSurface subject={subject} shareId={null} lead={<TourViewLead listingId={listingId} back={back} />}
            renderRefusal={(reason) => <TourViewRefusal reason={reason} listingId={listingId} returnPath={tourViewHref(listingId)} />} />}
    </main>
  );
}
