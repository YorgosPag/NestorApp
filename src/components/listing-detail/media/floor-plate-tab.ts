'use client';

/**
 * @fileoverview 🔗 **Η ΚΑΡΤΕΛΑ ΤΗΣ ΚΑΤΟΨΗΣ ΟΡΟΦΟΥ ΩΣ ΠΡΟΟΡΙΣΜΟΣ** — η ταυτότητά της, και ο σύνδεσμος προς γείτονα που την
 * κρατά ανοιχτή (ADR-907 §11.14).
 * @related ./ListingMediaViewer (η καρτέλα) · ./ListingFloorPlateStage · ./FloorPlateUnitLayer (οι δύο σύνδεσμοι γείτονα) ·
 *   components/shared/media/viewer/useMediaTabParam (`?mediaTab=`) · lib/listings/listing-routes (`listingDetailHref`)
 * @module components/listing-detail/media/floor-plate-tab
 *
 * 🔴 **Μετρημένο στην παραγωγή (2026-10-12, 320 / 390 / 1440)**: πάτημα πάνω σε γείτονα άνοιγε τη σωστή αγγελία στις
 *   «Φωτογραφίες» — ο επισκέπτης που περπατούσε τον όροφο έχανε την κάτοψη σε κάθε βήμα, και μαζί την αναζήτηση από την
 *   οποία ήρθε (ο σύνδεσμος δεν κουβαλούσε ερώτημα, άρα το «Πίσω στα αποτελέσματα» του γείτονα έδειχνε άλλη λίστα).
 * 🔑 **Ο γείτονας ανοίγει στην ΙΔΙΑ όψη, με την ΙΔΙΑ αναζήτηση**: φίλτρα κανονικοποιημένα (ό,τι αναγνωρίζει το
 *   `parseListingFilters` — ίδιος κανόνας με τον σύνδεσμο επιστροφής του `ListingDetailContent`) + `mediaTab=floorPlate`.
 *   Ό,τι ανήκει σε ΑΥΤΗ την αγγελία (`?photo=`) δεν ταξιδεύει: δεν είναι φίλτρο, και ο κανόνας το αφήνει πίσω.
 * 🔑 **Ένας τόπος για δύο συνδέσμους** (σχήμα και γραμμή): δύο κατασκευές θα μπορούσαν να διαφωνήσουν για τον ίδιο προορισμό.
 */

import { useMemo } from 'react';

import { MEDIA_TAB_PARAM } from '@/components/shared/media/viewer/useMediaTabParam';
import { useUrlQuery } from '@/hooks/useUrlQuery';
import { parseListingFilters, serializeListingFilters } from '@/lib/listings/listing-filters';
import { listingDetailHref } from '@/lib/listings/listing-routes';

/** Η κάτοψη **ορόφου** — άλλη καρτέλα από την `floorplan` (η κάτοψη της μονάδας)· η τιμή ζει στη διεύθυνση (`?mediaTab=`). */
export const LISTING_FLOOR_PLATE_TAB = 'floorPlate';

/** Το ερώτημα με το οποίο ανοίγει ένας γείτονας: η αναζήτηση του επισκέπτη + η καρτέλα της κάτοψης ορόφου. */
export function floorPlateNeighbourQuery(urlQuery: string): string {
  const params = serializeListingFilters(parseListingFilters(new URLSearchParams(urlQuery)));
  params.set(MEDIA_TAB_PARAM, LISTING_FLOOR_PLATE_TAB);
  return params.toString();
}

export type FloorPlateNeighbourHref = (listingId: string) => ReturnType<typeof listingDetailHref>;

/** Ο σύνδεσμος προς την αγγελία ενός γείτονα — ζωντανά πάνω στη διεύθυνση (`useUrlQuery`, όχι `useSearchParams`). */
export function useFloorPlateNeighbourHref(): FloorPlateNeighbourHref {
  const urlQuery = useUrlQuery();
  return useMemo(() => {
    const query = floorPlateNeighbourQuery(urlQuery);
    return (listingId: string) => listingDetailHref(listingId, query);
  }, [urlQuery]);
}
