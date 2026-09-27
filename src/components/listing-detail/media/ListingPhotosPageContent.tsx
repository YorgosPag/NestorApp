'use client';

/**
 * @fileoverview **`/listing/[id]/photos`** — όλες οι φωτογραφίες της αγγελίας, πλήρες παράθυρο (ADR-884 Φ2στ · §4.12 Μέρος Δ).
 * @related `app/(light)/listing/[id]/photos/page.tsx` · `ListingMediaTabs.tsx` · `ListingGallery.tsx` (η κάρτα στη σελίδα ακινήτου)
 * @module components/listing-detail/media/ListingPhotosPageContent
 *
 * 🔑 **Ίδιος φορτωτής με τη σελίδα αγγελίας** (`usePublicListing`) — δεν υπάρχει δεύτερο ερώτημα να αποκλίνει.
 * 🔑 **Ίδιο πλέγμα εικόνων με το `ListingGallery`** (`listingGalleryImages` · `listingImageSrcSet`) — η σειρά
 * (εξώφυλλο πρώτο) και η απόφαση «ποιες είναι οι υπόλοιπες» ζουν **ήδη** στο `lib/listings/listing-images`.
 * ⛔ Σύνδεσμοι μόνο από `@/lib/workspace/navigation` (CHECK 3.61).
 */

import { useState } from 'react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE (ποτέ `import()`, ποτέ σε Server Component).
import routeSlice from '@/i18n/generated/routes/listing__id__photos.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
import { listingGalleryImages, listingImageSrcSet } from '@/lib/listings/listing-images';
import { isPubliclyPresentable } from '@/lib/property/attribute-provenance';
import { useTourPresenceAvailable } from '@/lib/spatial-tour/useTourPresenceAvailable';
import type { ListingImage, PublicListing } from '@/types/public-listing';

import { ListingMediaPageBody, MediaPageHeader } from './ListingMediaPageChrome';

registerRouteSlice(routeSlice);

const GRID_SIZES = '(min-width: 1024px) 23vw, 45vw';

/**
 * ⚠️ Το `<main data-shell-surface="bleed">` είναι η **ρίζα του εξαγόμενου component** (CHECK 3.63 κρίνει τη ρίζα κατά
 * εξαγωγή — φωλιασμένο πιο μέσα δεν μετρά ως δήλωση ⇒ «ορφανή» γραμμή στο `.shell-surface.json`, μετρημένο 2026-09-27).
 */
export function ListingPhotosPageContent({ listingId }: { readonly listingId: string }) {
  return (
    <main data-shell-surface="bleed" className="flex min-h-full flex-col bg-background">
      <ListingMediaPageBody listingId={listingId} render={(listing) => <PhotosPageBody listing={listing} />} />
    </main>
  );
}

function PhotosPageBody({ listing }: { readonly listing: PublicListing }) {
  const { t } = useTranslation(['search-results', 'listing-detail']);
  const images = listingGalleryImages(listing);
  const floorplanAvailable = listing.floorplans.some(isPubliclyPresentable);
  const tourAvailable = useTourPresenceAvailable(listing.id) ?? false;
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      <MediaPageHeader
        listingId={listing.id}
        title={listing.title}
        current="photos"
        available={{ photos: true, floorplan: floorplanAvailable, tour: tourAvailable }}
      />
      <section aria-label={t('listing-detail:media.photosPage.heading')} className="p-4">
        <PhotosGrid images={images} onOpen={setOpenIndex} />
      </section>
      <PhotoLightbox images={images} openIndex={openIndex} onClose={() => setOpenIndex(null)} />
    </>
  );
}

function PhotosGrid({
  images,
  onOpen,
}: {
  readonly images: readonly ListingImage[];
  readonly onOpen: (index: number) => void;
}) {
  const { t } = useTranslation(['search-results', 'listing-detail']);

  if (images.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('search-results:detail.media.absent')}</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {images.map((image, index) => (
        <li key={image.url}>
          <button
            type="button"
            onClick={() => onOpen(index)}
            aria-label={t('listing-detail:media.photosPage.openLabel', { index: index + 1, total: images.length })}
            className="block w-full overflow-hidden rounded-lg border border-border"
          >
            {/*
              eslint-disable-next-line @next/next/no-img-element -- η πηγή είναι το δημόσιο
              ράφι (content-addressed, εκτός optimizer)· βλ. ADR-777 §8.11 και ADR-841 Α12.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              srcSet={listingImageSrcSet(image)}
              sizes={GRID_SIZES}
              width={image.width}
              height={image.height}
              alt={t(image.altKey, { index: index + 1, total: images.length })}
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className="aspect-[4/3] w-full object-cover"
            />
          </button>
        </li>
      ))}
    </ul>
  );
}

function PhotoLightbox({
  images,
  openIndex,
  onClose,
}: {
  readonly images: readonly ListingImage[];
  readonly openIndex: number | null;
  readonly onClose: () => void;
}) {
  const { t } = useTranslation(['listing-detail']);
  const image = openIndex !== null ? images[openIndex] : undefined;

  return (
    <Dialog open={image !== undefined} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="fullscreen" className="flex items-center justify-center bg-background/95 p-0">
        <DialogTitle className="sr-only">
          {t('listing-detail:media.photosPage.imageTitle', { index: (openIndex ?? 0) + 1, total: images.length })}
        </DialogTitle>
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            srcSet={listingImageSrcSet(image)}
            sizes="95vw"
            width={image.width}
            height={image.height}
            alt={t(image.altKey, { index: (openIndex ?? 0) + 1, total: images.length })}
            className="max-h-full max-w-full object-contain"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
