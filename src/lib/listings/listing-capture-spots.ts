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

import type { FloorplanFigureSource, FloorplanSpotsEntry } from '@/lib/media/photo-floorplan-spots';

import { readListingNorthRad } from './floorplan-north';
import { listingImageSrcSet } from './listing-images';
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

/**
 * **Δημόσια κάτοψη → ουδέτερη πηγή εικόνας** (ADR-899 §4). Οι διαστάσεις είναι **γνωστές** από το manifest του
 * ραφιού (ADR-841 Α2.2), άρα καμία μέτρηση· το `alt` το δίνει ο καλών (μεταφρασμένο).
 */
export function listingFloorplanSource(floorplan: ListingFloorplan, alt: string): FloorplanFigureSource {
  const image = floorplan.value;
  return {
    src: image.url,
    srcSet: listingImageSrcSet(image),
    alt,
    width: image.width,
    height: image.height,
    northRad: readListingNorthRad(image.northRad),
  };
}

/** **`ListingFloorplanSpots` → ουδέτερη γραμμή του πάνελ** — ο ΕΝΑΣ προσαρμογέας της αγγελίας. */
export function toFloorplanSpotsEntry(entry: ListingFloorplanSpots, alt: string): FloorplanSpotsEntry {
  return {
    key: String(entry.floorplanIndex),
    ordinal: entry.ordinal,
    figure: listingFloorplanSource(entry.floorplan, alt),
    photos: entry.photos,
  };
}
