'use client';

/**
 * @fileoverview **`/listing/[id]/floorplan`** — η κάτοψη σε πλήρες παράθυρο, μία κάτω από την άλλη (ADR-884 Φ2στ · §4.12 Μέρος Δ).
 * @related `app/(light)/listing/[id]/floorplan/page.tsx` · `ListingMediaTabs.tsx` · `ListingFloorplans.tsx` (η κάρτα στη σελίδα ακινήτου)
 * @module components/listing-detail/media/ListingFloorplanPageContent
 *
 * 🔑 **Ίδιος φορτωτής με τη σελίδα αγγελίας** (`usePublicListing`) — δεν υπάρχει δεύτερο ερώτημα να αποκλίνει.
 * 🔑 **Καμία αρίθμηση, καμία ονομασμένη απουσία** — ίδιες αποφάσεις με το `ListingFloorplans.tsx` (η κάτοψη είναι
 * προαιρετική: η σελίδα αυτή είναι πάντα καρτέλα «γνωστή» μόνο όταν υπάρχει κάτι να δείξει).
 * ⛔ Σύνδεσμοι μόνο από `@/lib/workspace/navigation` (CHECK 3.61).
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE (ποτέ `import()`, ποτέ σε Server Component).
import routeSlice from '@/i18n/generated/routes/listing__id__floorplan.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
import { ListingFloorplanWithSpots } from '@/components/listing-detail/ListingFloorplanWithSpots';
import { floorplanSpotsByUrl, listingFloorplanSpots } from '@/lib/listings/listing-capture-spots';
import { LISTING_MATERIAL_KEYS } from '@/lib/listings/listing-authorship';
import { LISTING_FLOORPLAN_PROVENANCE_KEYS } from '@/lib/listings/listing-material';
import { listingGalleryImages } from '@/lib/listings/listing-images';
import { isPubliclyPresentable } from '@/lib/property/attribute-provenance';
import { useTourPresenceAvailable } from '@/lib/spatial-tour/useTourPresenceAvailable';
import type { ListingFloorplan, PublicListing } from '@/types/public-listing';

import { ListingMediaPageBody, MediaPageHeader } from './ListingMediaPageChrome';

registerRouteSlice(routeSlice);

/** Τα `sizes` μιας κάτοψης εδώ — μία στήλη πλήρους πλάτους (έως `max-w-4xl`), όχι πλέγμα όπως στην κάρτα. */
const FLOORPLAN_PAGE_SIZES = '(min-width: 1024px) 60vw, 100vw';

/** ⚠️ Η ρίζα του εξαγόμενου component ΕΙΝΑΙ η δήλωση `bleed` (CHECK 3.63) — βλ. `ListingPhotosPageContent`. */
export function ListingFloorplanPageContent({ listingId }: { readonly listingId: string }) {
  return (
    <main data-shell-surface="bleed" className="flex min-h-full flex-col bg-background">
      <ListingMediaPageBody listingId={listingId} render={(listing) => <FloorplanPageBody listing={listing} />} />
    </main>
  );
}

function FloorplanPageBody({ listing }: { readonly listing: PublicListing }) {
  const { t } = useTranslation(['search-results', 'listing-detail']);
  const shown = listing.floorplans.filter(isPubliclyPresentable);
  const tourAvailable = useTourPresenceAvailable(listing.id) ?? false;

  return (
    <>
      <MediaPageHeader
        listingId={listing.id}
        title={listing.title}
        current="floorplan"
        available={{ photos: listingGalleryImages(listing).length > 0, floorplan: true, tour: tourAvailable }}
      />
      <section
        aria-label={t('listing-detail:media.floorplanPage.heading', { count: shown.length })}
        className="p-4"
      >
        <FloorplanStack shown={shown} listing={listing} />
      </section>
    </>
  );
}

function FloorplanStack({
  shown,
  listing,
}: {
  readonly shown: readonly ListingFloorplan[];
  readonly listing: PublicListing;
}) {
  const { t } = useTranslation(['search-results', 'listing-detail']);
  // 📍 ADR-897 — τα σημεία λήψης, με τη σειρά που θα τα δει ο επισκέπτης στο lightbox.
  const images = listingGalleryImages(listing);
  const spotsByUrl = floorplanSpotsByUrl(listingFloorplanSpots(listing, images));

  if (shown.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('search-results:detail.media.absent')}</p>;
  }

  return (
    <ul className="mx-auto flex max-w-4xl flex-col gap-6">
      {shown.map((floorplan) => (
        <li key={floorplan.value.url} className="flex flex-col gap-1">
          <ListingFloorplanWithSpots listingId={listing.id} floorplan={floorplan}
            spots={spotsByUrl.get(floorplan.value.url) ?? null} total={images.length} sizes={FLOORPLAN_PAGE_SIZES} />
          <p className="text-xs text-muted-foreground">{t(LISTING_FLOORPLAN_PROVENANCE_KEYS[floorplan.provenance])}</p>
        </li>
      ))}
      <li className="text-xs text-muted-foreground">{t(LISTING_MATERIAL_KEYS[listing.authorship].floorplanNote)}</li>
    </ul>
  );
}
