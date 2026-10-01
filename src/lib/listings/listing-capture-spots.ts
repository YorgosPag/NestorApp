/**
 * @fileoverview 📍 **ΤΑ ΣΗΜΕΙΑ ΛΗΨΗΣ ΤΗΣ ΑΓΓΕΛΙΑΣ, ΑΝΑ ΚΑΤΟΨΗ** — η μία ανάγνωση της πλευράς του επισκέπτη (ADR-897 Φ4).
 * @related lib/listings/photo-capture-spot (`readListingCaptureSpot`) · lib/listings/listing-images (η σειρά των εικόνων)
 * @module lib/listings/listing-capture-spots
 *
 * 🔑 **Δεμένο στη σειρά που ΒΛΕΠΕΙ ο επισκέπτης** (`listingGalleryImages`): ο δείκτης κάθε σημείου είναι η θέση της
 *   φωτογραφίας στο lightbox — ποτέ η θέση της στο `gallery`, που διαφέρει όταν υπάρχει ξεχωριστό εξώφυλλο.
 * 🔑 **Μόνο κατόψεις που παρουσιάζονται** (`isPubliclyPresentable`): σημείο σε κάτοψη που η σελίδα δεν δείχνει θα ήταν
 *   κουμπί που οδηγεί στο πουθενά.
 * ⚠️ **Καθαρό module** — κανένα React.
 */

import { isPubliclyPresentable } from '@/lib/property/attribute-provenance';
import type { ListingFloorplan, ListingImage, PublicListing } from '@/types/public-listing';

import { readListingCaptureSpot, type ListingCaptureSpot } from './photo-capture-spot';

/** Μια φωτογραφία πάνω σε κάτοψη — με τη θέση της στη σειρά του επισκέπτη. */
export interface PlacedListingPhoto {
  readonly imageIndex: number;
  readonly spot: ListingCaptureSpot;
}

/** Μια κάτοψη που έχει **τουλάχιστον ένα** σημείο λήψης. */
export interface ListingFloorplanSpots {
  /** Ο δείκτης στο `listing.floorplans` — η ταυτότητα της κάτοψης μέσα στο έγγραφο. */
  readonly floorplanIndex: number;
  /**
   * Η θέση της ανάμεσα στις κατόψεις που **παρουσιάζονται** (1-based) — ο ίδιος αριθμός «Κάτοψη N» σε κάρτα, σελίδα
   * κατόψεων και lightbox, ακόμη κι αν κάποια κάτοψη ενδιάμεσα δεν έχει σημεία.
   */
  readonly ordinal: number;
  readonly floorplan: ListingFloorplan;
  readonly photos: readonly PlacedListingPhoto[];
}

/**
 * Οι κατόψεις **με σημεία**, με τη σειρά του `floorplans` — κάθε μία με τις φωτογραφίες της, με τη σειρά του επισκέπτη.
 * Κενός πίνακας ⇒ η αγγελία δεν έχει σημεία λήψης, και η σελίδα μένει **ακριβώς όπως πριν** (κανένα κενό πάνελ).
 */
export function listingFloorplanSpots(
  listing: Pick<PublicListing, 'floorplans'>,
  images: readonly ListingImage[],
): readonly ListingFloorplanSpots[] {
  const byFloorplan = new Map<number, PlacedListingPhoto[]>();
  images.forEach((image, imageIndex) => {
    const spot = readListingCaptureSpot(image.captureSpot, listing.floorplans.length);
    if (spot === null) return;
    const placed = byFloorplan.get(spot.floorplanIndex) ?? [];
    placed.push({ imageIndex, spot });
    byFloorplan.set(spot.floorplanIndex, placed);
  });

  let ordinal = 0;
  return listing.floorplans.flatMap((floorplan, floorplanIndex) => {
    if (!isPubliclyPresentable(floorplan)) return [];
    ordinal += 1;
    const photos = byFloorplan.get(floorplanIndex);
    return photos === undefined ? [] : [{ floorplanIndex, ordinal, floorplan, photos }];
  });
}

/** Τα σημεία ανά κάτοψη, με κλειδί το URL της κάτοψης — για όποιον αποδίδει **όλες** τις κατόψεις (κάρτα, σελίδα). */
export function floorplanSpotsByUrl(entries: readonly ListingFloorplanSpots[]): ReadonlyMap<string, ListingFloorplanSpots> {
  return new Map(entries.map((entry) => [entry.floorplan.value.url, entry]));
}

/** Σε ποια από τις κατόψεις-με-σημεία βρίσκεται η φωτογραφία `imageIndex` — `null` αν δεν έχει σημείο. */
export function floorplanSpotsOf(
  floorplans: readonly ListingFloorplanSpots[],
  imageIndex: number,
): ListingFloorplanSpots | null {
  return floorplans.find((entry) => entry.photos.some((photo) => photo.imageIndex === imageIndex)) ?? null;
}
