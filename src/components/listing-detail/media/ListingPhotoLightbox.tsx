'use client';

/**
 * @fileoverview **Το lightbox της δημόσιας συλλογής** — λεπτός προσαρμογέας της αγγελίας πάνω στο κοινό
 * `shared/media/PhotoLightbox` (ADR-897 Φ4 · ADR-899 §8).
 * @related ListingPhotosPageContent.tsx (ο κάτοχος) · hooks/listings/useListingPhotoParam · lib/listings/listing-capture-spots
 * @module components/listing-detail/media/ListingPhotoLightbox
 *
 * 🔑 Εδώ μένει **μόνο** ό,τι είναι της αγγελίας: `ListingImage` → `LightboxPhoto` (`srcset` από το manifest του ραφιού,
 *   `alt` από το `altKey`) και `ListingFloorplanSpots` → `FloorplanSpotsEntry`. Πλοήγηση, σάρωση, πάνελ ζουν στο κοινό.
 */

import { useMemo } from 'react';

import { useListingFloorplanAlt } from '@/components/listing-detail/ListingFloorplanFigure';
import { PhotoLightbox, type LightboxPhoto } from '@/components/shared/media/PhotoLightbox';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { toFloorplanSpotsEntry, type ListingFloorplanSpots } from '@/lib/listings/listing-capture-spots';
import { listingImageSrcSet } from '@/lib/listings/listing-images';
import type { ListingImage } from '@/types/public-listing';

export interface ListingPhotoLightboxProps {
  readonly images: readonly ListingImage[];
  readonly floorplans: readonly ListingFloorplanSpots[];
  readonly openIndex: number | null;
  readonly onNavigate: (index: number | null) => void;
}

export function ListingPhotoLightbox({ images, floorplans, openIndex, onNavigate }: ListingPhotoLightboxProps) {
  const { t } = useTranslation(['search-results', 'listing-detail']);
  const altOf = useListingFloorplanAlt();
  const total = images.length;
  const photos = useMemo<readonly LightboxPhoto[]>(() => images.map((image, index) => ({
    key: image.url,
    src: image.url,
    srcSet: listingImageSrcSet(image),
    alt: t(image.altKey, { index: index + 1, total }),
    width: image.width,
    height: image.height,
  })), [images, t, total]);
  const entries = useMemo(
    () => floorplans.map((entry) => toFloorplanSpotsEntry(entry, altOf(entry.floorplan))),
    [floorplans, altOf],
  );

  return <PhotoLightbox photos={photos} floorplans={entries} openIndex={openIndex} onNavigate={onNavigate} />;
}
