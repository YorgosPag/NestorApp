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
 * ⚠️ **ΜΙΑ άφιξη ανά χάρτη, και ΜΟΝΟ για επιλογή που υπήρχε ΠΡΙΝ φτάσουν τα δεδομένα.** Κλικ σε
 * πινέζα αλλάζει επίσης το `selected` (και το URL) — αλλά ο άνθρωπος **κοιτούσε** τον χάρτη: αν η
 * κάμερα έτρεχε εκεί, κάθε κλικ θα την τίναζε. Γι' αυτό η επιλογή διαβάζεται **μία φορά**, με τα
 * **πρώτα δεδομένα** — πριν από αυτά δεν υπάρχει πινέζα να πατηθεί, άρα ό,τι είναι επιλεγμένο τότε
 * ήρθε από τον σύνδεσμο.
 * 🔴 **ΟΧΙ «στην πρώτη απόδοση» (ADR-777 §8.78, μετρημένο)**: στο `/search/results` ο χάρτης αποδίδεται
 * ήδη στο SSR/hydration, όπου το `useUrlListingFocus` δίνει το **server snapshot** (`selected = null`).
 * Ένα `useRef(selected)` πάγωνε αυτό το `null` ⇒ ο κοινοποιημένος σύνδεσμος άνοιγε τη φούσκα, αλλά ο
 * χάρτης έμενε σε όλη την Ελλάδα (ζ 5,6). Στο `/offers` δούλευε μόνο επειδή εκεί ο χάρτης γεννιέται αργότερα.
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
  selectedAtFirstData: string | null,
  searchAreaAtFirstData: GeoBoundingBox | null,
): FrameListingData {
  const consumedRef = useRef(false);
  // ⚠️ Αναφορές, όχι εξαρτήσεις: ο καλών (`handleMapReady`) έχει κενό πίνακα εξαρτήσεων ως συμβόλαιο.
  // Ενημερώνονται σε effect που δηλώνεται ΠΡΙΝ από το effect καδραρίσματος του καλούντος ⇒ τρέχει πρώτο.
  const latestRef = useRef({ geojson, selected: selectedAtFirstData, searchArea: searchAreaAtFirstData });
  useEffect(() => {
    latestRef.current = { geojson, selected: selectedAtFirstData, searchArea: searchAreaAtFirstData };
  }, [geojson, selectedAtFirstData, searchAreaAtFirstData]);

  return useCallback((target: MapEventTarget, bounds: ListingBounds) => {
    const { geojson: data, selected, searchArea } = latestRef.current;
    const pending = consumedRef.current || searchArea !== null ? null : selected;
    const area = pending === null ? null : listingArrivalArea(data, pending);
    // Καταναλώνεται **με τα πρώτα δεδομένα**, είτε βρέθηκε είτε όχι: μια αγγελία που δεν
    // ζωγραφίζεται (αποσύρθηκε, λάθος id) δεν κρατά σε αναμονή ένα μελλοντικό τίναγμα.
    consumedRef.current = true;
    if (area !== null) fitMapToArea(target, area);
    else fitMapToBounds(target, bounds);
  }, []);
}
