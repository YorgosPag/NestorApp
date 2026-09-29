/**
 * @fileoverview **ΤΟ ΟΡΘΟΓΩΝΙΟ ΠΟΥ ΠΕΡΙΚΛΕΙΕΙ Ο,ΤΙ ΖΩΓΡΑΦΙΖΕΤΑΙ** — μία απάντηση.
 * @related ADR-777 §8.60 · §8.70.7 · ADR-847 §9.6 · lib/listings/listings-geojson.ts
 * @module lib/listings/listing-map-bounds
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΕΞΗΧΘΗ ΑΠΟ ΤΟΝ `ResultsMap` (2026-09-06, ADR-777 §8.60)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ήταν ιδιωτική συνάρτηση του ζωγράφου. Η αφορμή της εξαγωγής ήταν το **όριο των 500
 * γραμμών** (N.7.1) — αλλά η **δικαιολογία** είναι ότι το ερώτημα *«πού είναι όλα;»*
 * **δεν ανήκει στον ζωγράφο**: δεν αφορά χρώμα, σχήμα ή επίπεδα, μόνο γεωμετρία πάνω σε
 * ένα `FeatureCollection`. Η εξαγωγή είναι **μετακίνηση**, όχι αντιγραφή: ο ζωγράφος
 * δεν κράτησε αντίγραφο.
 */

import type { ListingFeature, ListingGeoJson } from './listings-geojson';
import { areaBoundingBox } from '@/lib/geo/geo-area';
import type { ExtentBounds } from '@/lib/maps/extent-bounds';
import type { GeoBoundingBox } from '@/types/geo/coordinates';

/** `[[δυτικά, νότια], [ανατολικά, βόρεια]]` — η μορφή που δέχεται το `fitBounds` (η ΜΙΑ, `lib/maps/extent-bounds`). */
export type ListingBounds = ExtentBounds;

/**
 * Το ορθογώνιο που περικλείει **ό,τι ζωγραφίζεται** — ή `null` αν δεν ζωγραφίζεται τίποτα.
 *
 * 🔴 **Χωρίς αυτό ο χάρτης δείχνει την προεπιλογή του, δηλαδή ΑΛΛΟ ΜΕΡΟΣ.** Βρέθηκε
 * ζωντανά (στιγμιότυπο 2026-08-10): έξι σωστά σχήματα στη Θεσσαλονίκη, με τον χάρτη
 * καρφωμένο στην κεντρική Ελλάδα ⇒ **οθόνη που φαίνεται άδεια ενώ έχει αποτελέσματα**.
 * Είναι η ίδια οικογένεια σφάλματος με τη σιωπηλή εξαφάνιση της Α5: το να μην τα δείχνεις
 * και το να μην πας εκεί που είναι, καταλήγουν στην ίδια εντύπωση.
 */
export function listingBounds(
  data: ListingGeoJson,
): ListingBounds | null {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;

  for (const feature of data.features) {
    const coords: Array<[number, number]> = feature.geometry.type === 'Point'
      ? [feature.geometry.coordinates as [number, number]]
      : (feature.geometry.coordinates[0] as Array<[number, number]>);
    for (const [lng, lat] of coords) {
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
  }

  return Number.isFinite(west) ? [[west, south], [east, north]] : null;
}

/**
 * **Η ΕΚΤΑΣΗ ΜΙΑΣ ΑΓΓΕΛΙΑΣ** — ό,τι **ισχυρίζεται** το σχήμα της, όχι μόνο το κέντρο του.
 *
 * 🔑 **Η ΜΙΑ απάντηση για ΔΥΟ κάδρα** (ADR-847 §9.6): την άφιξη του δημόσιου χάρτη σε μία αγγελία
 * ({@link listingArrivalArea}) και τη μικρογραφία της κάρτας (ADR-777 §8.70.7). Μέχρι 2026-09-29 η
 * μικρογραφία την **ξανάγραφε** (δικό της bbox περιγράμματος, δική της διάμετρος από τον
 * `LISTING_UNCERTAINTY_KM`) ⇒ το ίδιο ακίνητο φαινόταν αλλιώς στην κάρτα και αλλιώς στον χάρτη.
 *
 * 🔑 **Γιατί παίρνει FEATURE και όχι σημάδι**: ο κοινός παρονομαστής των δύο καλούντων είναι το
 * feature του **ενός** ζωγράφου (`listingFeature`) — ο χάρτης έχει μόνο features, η μικρογραφία
 * χτίζει ήδη το feature που ζωγραφίζει. Έτσι το κάδρο βγαίνει από **αυτό που ζωγραφίστηκε**, και η
 * αβεβαιότητα διαβάζεται από το `uncertaintyM` του feature, όχι ξανά από τον πίνακα.
 *
 * - **περίγραμμα** ⇒ το ορθογώνιο του περιγράμματος (ο **ίδιος** υπολογισμός με το {@link listingBounds})·
 * - **περιοχή** (δακτύλιος · συνοικία · πόλη) ⇒ ο **περιγεγραμμένος** κύκλος αβεβαιότητας
 *   (`areaBoundingBox`, σφαιρικό φράγμα) — ένα κάδρο στο σημείο θα έδειχνε με βεβαιότητα **ένα
 *   οικόπεδο που δεν ξέρουμε** (Α5)·
 * - **ακριβής πινέζα** (αβεβαιότητα 0) ⇒ ένα σημείο· το ζουμ το ορίζει τότε το **ταβάνι** του καλούντα.
 *
 * @returns `null` μόνο για περίγραμμα **χωρίς κορυφές** — ποτέ σιωπηλή προεπιλογή (ένα `[0,0]` θα
 *          έστελνε τον χάρτη στον κόλπο της Γουινέας χωρίς να το πει κανείς).
 */
export function listingFeatureExtent(feature: ListingFeature): GeoBoundingBox | null {
  if (feature.geometry.type !== 'Point') {
    const bounds = listingBounds({ type: 'FeatureCollection', features: [feature] });
    return bounds === null ? null : { west: bounds[0][0], south: bounds[0][1], east: bounds[1][0], north: bounds[1][1] };
  }

  const [lng, lat] = feature.geometry.coordinates;
  const radiusKm = feature.properties.uncertaintyM / 1000;
  return radiusKm > 0
    ? areaBoundingBox({ center: { lat, lng }, radiusKm })
    : { west: lng, south: lat, east: lng, north: lat };
}

/**
 * **Το κάδρο της ΑΦΙΞΗΣ σε ΜΙΑ αγγελία** — ο σύνδεσμος `?selected=` (ADR-777 §8.77).
 *
 * Η έκταση είναι το {@link listingFeatureExtent}· το ταβάνι `suggested` του `fitMapToArea` ορίζει το
 * ζουμ της ακριβούς πινέζας — το **ίδιο** ταβάνι με το ζουμ ομάδας, άρα η αγγελία ζωγραφίζεται
 * **χωριστά** από τις γειτονικές.
 *
 * @returns `null` όταν η αγγελία **δεν ζωγραφίζεται** (αποσύρθηκε, δεν έχει θέση, λάθος id) —
 *          ο καλών τότε καδράρει τα δεδομένα όπως πάντα: ο σύνδεσμος ζητά, η σελίδα αποφασίζει.
 */
export function listingArrivalArea(data: ListingGeoJson, id: string): GeoBoundingBox | null {
  const feature = data.features.find((candidate) => candidate.properties.id === id);
  return feature === undefined ? null : listingFeatureExtent(feature);
}
