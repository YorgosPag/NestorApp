'use client';

/**
 * Ο χάρτης της οθόνης 2 — **δανεισμένος**, όχι νέος (ADR-777 Α4 βήμα 1).
 *
 * 🔑 Ο μηχανισμός είναι **αποδεδειγμένος σε παραγωγή**: ο `AddressMap` ήδη εισάγει τον
 * ίδιο `InteractiveMap` του Geo-Canvas και του δίνει κενό `transformState` (τα control
 * points είναι λεπτομέρεια του DXF, όχι του χάρτη). Δεν χτίζεται δεύτερος χάρτης, και
 * **δεν μετακομίζει κώδικας** — «*μετακινούμε ΚΑΤΑΝΑΛΩΤΕΣ, όχι ΑΡΧΕΙΑ*» (κανόνας 19).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΧΡΩΜΑ ΔΕΝ ΕΙΝΑΙ ΤΟ ΚΑΝΑΛΙ — ΕΙΝΑΙ ΤΟ ΣΧΗΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Και τα πέντε ορατά σχήματα βάφονται με **το ίδιο** χρώμα. Αυτό δεν είναι παράλειψη:
 * είναι η **CHECK 3.41** (WCAG 1.4.1) εφαρμοσμένη σωστά — αν η ακρίβεια ξεχώριζε με
 * απόχρωση, θα ήταν αδιάκριτη για όποιον δεν τη διακρίνει, και θα εξαφανιζόταν σε
 * ασπρόμαυρη εκτύπωση ή σε φωτεινό ήλιο. Ξεχωρίζουν σε **μέγεθος, δακτύλιο και
 * γέμισμα** — κανάλια που δεν εξαρτώνται από την όραση χρώματος.
 *
 * Το χρώμα διαβάζεται από το `--chart-1`, δηλαδή από την **επικυρωμένη** κατηγορική
 * παλέτα (CHECK 3.32: ζώνη φωτεινότητας, κορεσμός, CVD ΔE≥8 κατά Machado 2009,
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 **ΛΕΠΤΟ ΠΕΡΙΤΥΛΙΓΜΑ** *(ADR-777 §8.71)*
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο πυρήνας (πηγές, καδράρισμα, κλικ/δείκτης, μέγεθος) ζει στον `ListingMapCanvas`, που τον
 * μοιράζεται με τον χάρτη χαρτοφυλακίου του κατόχου. Εδώ μένει **μόνο** ό,τι ξέρει για
 * `PublicListing`: η μετατροπή σε GeoJSON, οι πινακίδες τιμής και η φούσκα. Το εξωτερικό API
 * είναι **ίδιο** — οι δύο καταναλωτές (οθόνη 2, οθόνη 3) δεν άλλαξαν.
 */

import React, { useCallback, useMemo } from 'react';
import { listingsToGeoJson } from '@/lib/listings/listings-geojson';
import { listingPriceMarkers } from '@/lib/listings/listing-price-markers';
import { NO_LISTING_FOCUS } from '@/lib/listings/listing-focus';
import { publicListingEntry, type ListingMapEntry } from '@/lib/listings/listing-map-entry';
import { ListingMapPopup } from './ListingMapPopup';
import { ListingPriceMarkers } from './ListingPriceMarkers';
import { RADIUS } from './ResultsMapLayers';
import { ListingMapCanvas, type ListingMapCanvasProps } from './ListingMapCanvas';
import { AdminBoundaryLayer } from './AdminBoundaryLayer';
import type { PublicListing } from '@/types/public-listing';

interface ResultsMapProps extends Omit<ListingMapCanvasProps, 'geojson' | 'children' | 'describeListing'> {
  readonly listings: readonly PublicListing[];
  /**
   * Τα ενεργά φίλτρα ως ερώτημα — **ταξιδεύουν και από το popup**.
   *
   * 🔑 Χωρίς αυτό, ο σύνδεσμος του popup θα ήταν η **μία** διαδρομή προς την οθόνη 3
   * που **χάνει** την αναζήτηση, ενώ η κάρτα δίπλα του την κρατά. Δύο σύνδεσμοι προς
   * το ίδιο ακίνητο με διαφορετική συμπεριφορά επιστροφής είναι ακριβώς η απώλεια που
   * η Α3 μέτρησε στο **75%**.
   */
  readonly filterQuery?: string;
  /**
   * **Το όριο της διοικητικής περιοχής που ζητήθηκε** *(ADR-883)* — ή `null`. Το πλαισίωμα
   * γίνεται από το `searchArea` (το ορθογώνιό του)· εδώ έρχεται μόνο το **σχήμα**.
   */
  readonly boundary?: GeoJSON.MultiPolygon | null;
}

export function ResultsMap({
  listings,
  focus = NO_LISTING_FOCUS,
  filterQuery = '',
  onPeek,
  onSelect,
  onClear,
  onAreaChange,
  searchArea = null,
  boundary = null,
}: ResultsMapProps) {
  /** Αγγελίες → GeoJSON, από τον **έναν** ζωγράφο· ο πυρήνας δέχεται μόνο το αποτέλεσμα. */
  const data = useMemo(() => listingsToGeoJson(listings), [listings]);

  /**
   * 🏆 **ΟΙ ΤΙΜΕΣ ΠΑΝΩ ΣΤΟΝ ΧΑΡΤΗ — ΤΙΜΕΣ *ΚΑΙ* ΚΟΥΚΙΔΕΣ, ΠΟΤΕ ΤΙΜΕΣ *ΑΝΤΙ ΓΙΑ*** (Ε2).
   *
   * Τα επτά επίπεδα από κάτω μένουν **ανέπαφα**: κάθε αγγελία με θέση εξακολουθεί να
   * έχει το σχήμα της, όσες κι αν είναι. Η πινακίδα είναι **προσθήκη σε υποσύνολο** —
   * ποιο, το κρίνει ο `listingPriceMarkers` και **μόνο** αυτός (τρεις κανόνες: ξέρουμε
   * ΠΟΥ, ξέρουμε ΠΟΣΟ, και μέσα στο φραγμένο πλήθος).
   *
   * 🔑 **Τρέφεται από το `data`, όχι από τα `listings`.** Η θέση της πινακίδας πρέπει να
   * είναι **η ίδια συντεταγμένη** με το σχήμα, όχι μια δεύτερη μετατροπή σε `[lng, lat]`
   * που «πρέπει» να συμφωνεί — δες την κεφαλίδα του `listings-geojson.ts`.
   */
  const priceMarkers = useMemo(() => listingPriceMarkers(listings.map(publicListingEntry), data), [listings, data]);

  const byId = useMemo(() => new Map(listings.map((l) => [l.id, l])), [listings]);

  /** Μία γραμμή για τη λίστα διαλέγματος (§8.76) — τίτλος + τιμή **όπως τη βλέπει ο κόσμος**. */
  const describeListing = useCallback((id: string): ListingMapEntry | null => {
    const listing = byId.get(id);
    return listing === undefined ? null : publicListingEntry(listing);
  }, [byId]);

  const selectedListing = useMemo(
    () => (focus.selected === null ? null : (byId.get(focus.selected) ?? null)),
    [byId, focus.selected]
  );

  return (
    <ListingMapCanvas
      geojson={data}
      focus={focus}
      onPeek={onPeek}
      onSelect={onSelect}
      onClear={onClear}
      onAreaChange={onAreaChange}
      searchArea={searchArea}
      describeListing={describeListing}
    >
      {/* ADR-883 — πρώτο παιδί: το όριο ζωγραφίζεται ΚΑΤΩ από πινακίδες και φούσκα (`beforeId`). */}
      {boundary !== null && <AdminBoundaryLayer geometry={boundary} />}

      {/*
        Οι πινακίδες τιμής — **μετά** την πηγή, ώστε να κάθονται πάνω από τα σχήματα,
        και **πριν** τη φούσκα, που πρέπει να μένει πάνω από όλα.

        ⚠️ Το `RADIUS.pin` δίνεται ως prop: η ακτίνα της πινέζας έχει **μία** αυθεντία,
        και το κενό της πινακίδας παράγεται από αυτήν αντί να το μαντέψει δεύτερος.
      */}
      <ListingPriceMarkers
        markers={priceMarkers}
        focus={focus}
        pinRadiusPx={RADIUS.pin}
        onPeek={onPeek}
        onSelect={onSelect}
      />

      {/*
        🏆 **Η ΑΠΑΝΤΗΣΗ ΕΚΕΙ ΠΟΥ ΚΟΙΤΑΖΕΙ** — πρότυπο Zillow/Redfin/Airbnb.

        ⚠️ **Δεμένο στο `selected`, ΠΟΤΕ στο `peeked`.** Ένα popup που ανοίγει με το
        πέρασμα του δείκτη αναβοσβήνει σε κάθε διαδρομή του ποντικιού και **σκεπάζει τις
        γειτονικές πινέζες** — κρύβει ακριβώς αυτό που ο άνθρωπος πήγαινε να δει. Δες
        την κεφαλίδα του `ListingMapPopup`.
      */}
      {selectedListing !== null && onClear && (
        <ListingMapPopup listing={selectedListing} filterQuery={filterQuery} onClose={onClear} />
      )}
    </ListingMapCanvas>
  );
}
