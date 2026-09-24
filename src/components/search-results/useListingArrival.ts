'use client';

/**
 * @fileoverview **Η ΑΦΙΞΗ ΣΕ ΜΙΑ ΕΠΙΛΟΓΗ** — ο χάρτης που γεννιέται με επιλεγμένη αγγελία (ADR-777 §8.77).
 * @related lib/listings/listing-map-bounds.ts (`listingArrivalArea`) · results-map-contract.ts · ListingMapCanvas.tsx
 * @module components/search-results/useListingArrival
 *
 * 🔑 **«Ο σύνδεσμος ανοίγει τον χάρτη στο ακίνητο»** (`?selected=`, πρότυπο Google Maps «place link»):
 * το πρώτο κάδρο του χάρτη είναι η αγγελία (με την αβεβαιότητά της), **όχι** όλα τα δεδομένα. Μετά
 * την άφιξη ο χάρτης ανήκει στον άνθρωπο: κάθε επόμενο κάδρο δεδομένων ακολουθεί τον κανόνα του.
 *
 * ⚠️ **ΜΙΑ άφιξη ανά χάρτη, και ΜΟΝΟ για επιλογή που υπήρχε ΠΡΙΝ γεννηθεί.** Κλικ σε πινέζα αλλάζει
 * επίσης το `selected` (και το URL) — αλλά ο άνθρωπος **κοιτούσε** τον χάρτη: αν η κάμερα έτρεχε
 * εκεί, κάθε κλικ θα την τίναζε. Γι' αυτό η επιλογή διαβάζεται **μία φορά**, στη γέννηση.
 * ⚠️ **Το κάδρο του αποστολέα κερδίζει** (`?box=`, Redfin): με δηλωμένη περιοχή δεν υπάρχει άφιξη —
 * η φούσκα ανοίγει μέσα στο κάδρο που είδε εκείνος.
 * 🔑 **Χωρίς πτήση**: `fitMapToArea` = `cameraFraming('arrive', …)` — ο άνθρωπος δεν είδε ποτέ «από».
 */

import { useCallback, useEffect, useRef } from 'react';

import { listingArrivalArea, type ListingBounds } from '@/lib/listings/listing-map-bounds';
import type { ListingGeoJson } from '@/lib/listings/listings-geojson';
import type { GeoBoundingBox } from '@/types/geo/coordinates';

import { fitMapToArea, fitMapToBounds, type MapEventTarget } from './results-map-contract';

/** Κάδραρε τα δεδομένα — ή, την πρώτη φορά, την αγγελία με την οποία γεννήθηκε ο χάρτης. */
export type FrameListingData = (target: MapEventTarget, bounds: ListingBounds) => void;

export function useListingArrival(
  geojson: ListingGeoJson,
  selectedAtBirth: string | null,
  searchAreaAtBirth: GeoBoundingBox | null,
): FrameListingData {
  // `useRef(τιμή)` κρατά **μόνο** την πρώτη τιμή — ακριβώς η σημασιολογία «στη γέννηση».
  const arrivalRef = useRef<string | null>(searchAreaAtBirth === null ? selectedAtBirth : null);
  // ⚠️ Αναφορά, όχι εξάρτηση: ο καλών (`handleMapReady`) έχει κενό πίνακα εξαρτήσεων ως συμβόλαιο.
  const geojsonRef = useRef(geojson);
  useEffect(() => { geojsonRef.current = geojson; }, [geojson]);

  return useCallback((target: MapEventTarget, bounds: ListingBounds) => {
    const pending = arrivalRef.current;
    const area = pending === null ? null : listingArrivalArea(geojsonRef.current, pending);
    // Καταναλώνεται **με τα πρώτα δεδομένα**, είτε βρέθηκε είτε όχι: μια αγγελία που δεν
    // ζωγραφίζεται (αποσύρθηκε, λάθος id) δεν κρατά σε αναμονή ένα μελλοντικό τίναγμα.
    arrivalRef.current = null;
    if (area !== null) fitMapToArea(target, area);
    else fitMapToBounds(target, bounds);
  }, []);
}
