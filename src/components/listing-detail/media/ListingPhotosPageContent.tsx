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

import { useMemo } from 'react';
import dynamic from 'next/dynamic';

import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE (ποτέ `import()`, ποτέ σε Server Component).
import routeSlice from '@/i18n/generated/routes/listing__id__photos.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
import { listingGalleryImages, listingImageSrcSet } from '@/lib/listings/listing-images';
import { isPubliclyPresentable } from '@/lib/property/attribute-provenance';
import { hasListedTour } from '@/lib/listings/listing-spatial-media';
import { useListingPhotoParam } from '@/hooks/listings/useListingPhotoParam';
import { listingFloorplanSpots } from '@/lib/listings/listing-capture-spots';
import { isDocumentCaption, readPhotoCaption } from '@/lib/listings/photo-caption';
// 🏷️ Τεμπέλικη επιφάνεια (ADR-744 §27): κώδικας + ετικέτες είδους έρχονται ΜΟΝΟ όταν υπάρχει δηλωμένη λεζάντα.
import { LazyPhotoCaptionLine } from '@/components/shared/media/photo-caption-surfaces';
import type { ListingImage, PublicListing } from '@/types/public-listing';

import { ListingMediaPageBody, MediaPageHeader } from './ListingMediaPageChrome';

registerRouteSlice(routeSlice);

/**
 * 🔴 **ΟΡΙΟ `next/dynamic` (CHECK 3.34 Κ2, ADR-744)** — ADR-897 Φ4: το lightbox (πλοήγηση + πάνελ «πού τραβήχτηκε»)
 * ανοίγει **μόνο** με κλικ ή με `?photo=N`, άρα τα κλειδιά του δεν ταξιδεύουν στο slice της διαδρομής. Μετρημένο: χωρίς
 * το όριο η διαδρομή πήγαινε 1.015 bytes > ταβάνι 521. Ίδιο σχήμα με το `PhotoFocalPointDialog`.
 */
const ListingPhotoLightbox = dynamic(() => import('./ListingPhotoLightbox').then((m) => m.ListingPhotoLightbox), { ssr: false });

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
  const images = useMemo(() => listingGalleryImages(listing), [listing]);
  const floorplanAvailable = listing.floorplans.some(isPubliclyPresentable);
  const tourAvailable = hasListedTour(listing);
  // 📍 ADR-897 — η ανοιχτή φωτογραφία ζει στη διεύθυνση (`?photo=N`)· τα σημεία λήψης, ανά κάτοψη, με τη σειρά των εικόνων.
  const [openIndex, setOpenIndex] = useListingPhotoParam(images.length);
  const floorplanSpots = useMemo(() => listingFloorplanSpots(listing, images), [listing, images]);

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
      {openIndex !== null && (
        <ListingPhotoLightbox images={images} floorplans={floorplanSpots} openIndex={openIndex} onNavigate={setOpenIndex} />
      )}
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

  // 🏷️ **Ο χωρισμός κρατά τη ΘΕΣΗ κάθε εικόνας στη συλλογή**: το `?photo=N` και το lightbox μετρούν πάνω στη σειρά του
  //    ανθρώπου, άρα μια ομάδα είναι μόνο **πού ζωγραφίζεται** η μικρογραφία — ποτέ δεύτερη αρίθμηση.
  const entries = images.map((image, index) => ({ image, index, document: isDocumentCaption(readPhotoCaption(image.caption)) }));
  const documents = entries.filter((entry) => entry.document);
  const photos = entries.filter((entry) => !entry.document);

  // Μία ομάδα ⇒ καμία επικεφαλίδα: «Σχέδια και χάρτες» πάνω από **όλη** τη συλλογή δεν χωρίζει τίποτα.
  if (documents.length === 0 || photos.length === 0) {
    return <PhotoList entries={entries} total={images.length} onOpen={onOpen} />;
  }

  return (
    <>
      <PhotoList entries={photos} total={images.length} onOpen={onOpen} />
      <section aria-labelledby={DOCUMENTS_HEADING_ID} className="mt-6">
        <h2 id={DOCUMENTS_HEADING_ID} className="mb-2 text-sm font-medium text-foreground">
          {t('listing-detail:media.photosPage.documentsHeading')}
        </h2>
        <PhotoList entries={documents} total={images.length} onOpen={onOpen} />
      </section>
    </>
  );
}

const DOCUMENTS_HEADING_ID = 'listing-photos-documents-heading';

interface PhotoListProps {
  /** Κάθε εικόνα **με τη θέση της στη συλλογή** — η ομάδα δεν ξαναριθμεί. */
  readonly entries: readonly { readonly image: ListingImage; readonly index: number }[];
  readonly total: number;
  readonly onOpen: (index: number) => void;
}

function PhotoList({ entries, total, onOpen }: PhotoListProps) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {entries.map(({ image, index }) => (
        <GridPhoto key={image.url} image={image} index={index} total={total} onOpen={onOpen} />
      ))}
    </ul>
  );
}

interface GridPhotoProps {
  readonly image: ListingImage;
  readonly index: number;
  readonly total: number;
  readonly onOpen: (index: number) => void;
}

/** Μία φωτογραφία του πλέγματος — `<figure>`, ώστε η λεζάντα (όταν δηλώθηκε) να είναι **δική της** `<figcaption>`. */
function GridPhoto({ image, index, total, onOpen }: GridPhotoProps) {
  const { t } = useTranslation(['search-results', 'listing-detail']);
  const caption = readPhotoCaption(image.caption);

  return (
    <li>
      <figure className="m-0">
        <button
          type="button"
          onClick={() => onOpen(index)}
          aria-label={t('listing-detail:media.photosPage.openLabel', { index: index + 1, total })}
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
            alt={t(image.altKey, { index: index + 1, total })}
            loading={index === 0 ? 'eager' : 'lazy'}
            decoding="async"
            className="aspect-[4/3] w-full object-cover"
          />
        </button>
        {caption !== null && <LazyPhotoCaptionLine caption={caption} />}
      </figure>
    </li>
  );
}
