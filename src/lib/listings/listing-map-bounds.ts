/**
 * @fileoverview **ΤΟ ΟΡΘΟΓΩΝΙΟ ΠΟΥ ΠΕΡΙΚΛΕΙΕΙ Ο,ΤΙ ΖΩΓΡΑΦΙΖΕΤΑΙ** — μία απάντηση.
 * @related ADR-777 §8.60 · lib/listings/listings-geojson.ts
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

import type { ListingGeoJson } from './listings-geojson';
import { areaBoundingBox } from '@/lib/geo/geo-area';
import type { GeoBoundingBox } from '@/types/geo/coordinates';

/** `[[δυτικά, νότια], [ανατολικά, βόρεια]]` — η μορφή που δέχεται το `fitBounds`. */
export type ListingBounds = [[number, number], [number, number]];

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
 * **Το κάδρο της ΑΦΙΞΗΣ σε ΜΙΑ αγγελία** — ο σύνδεσμος `?selected=` (ADR-777 §8.77).
 *
 * 🔑 **Το κάδρο περικλείει ό,τι ΙΣΧΥΡΙΖΕΤΑΙ το σχήμα, όχι μόνο το κέντρο του.** Μια αγγελία
 * «κάπου στην πόλη» έχει σημείο **και** κύκλο αβεβαιότητας 10 χλμ· ένα κάδρο στο σημείο θα
 * ζουμάριζε σε επίπεδο δρόμου, δηλαδή θα έδειχνε με βεβαιότητα **ένα οικόπεδο που δεν ξέρουμε**
 * (Α5). Εδώ το κάδρο είναι ο **περιγεγραμμένος** κύκλος (`areaBoundingBox`, το σφαιρικό φράγμα)·
 * για ακριβή πινέζα (αβεβαιότητα 0) είναι ένα σημείο, και το ταβάνι `suggested` του
 * `fitMapToArea` ορίζει το ζουμ — το **ίδιο** ταβάνι με το ζουμ ομάδας, άρα η αγγελία
 * ζωγραφίζεται **χωριστά** από τις γειτονικές.
 * Περίγραμμα (`outline`) ⇒ το ορθογώνιο του περιγράμματος, από τον **ίδιο** υπολογισμό.
 *
 * @returns `null` όταν η αγγελία **δεν ζωγραφίζεται** (αποσύρθηκε, δεν έχει θέση, λάθος id) —
 *          ο καλών τότε καδράρει τα δεδομένα όπως πάντα: ο σύνδεσμος ζητά, η σελίδα αποφασίζει.
 */
export function listingArrivalArea(data: ListingGeoJson, id: string): GeoBoundingBox | null {
  const feature = data.features.find((candidate) => candidate.properties.id === id);
  if (feature === undefined) return null;

  if (feature.geometry.type !== 'Point') {
    const bounds = listingBounds({ ...data, features: [feature] });
    return bounds === null ? null : { west: bounds[0][0], south: bounds[0][1], east: bounds[1][0], north: bounds[1][1] };
  }

  const [lng, lat] = feature.geometry.coordinates;
  const radiusKm = feature.properties.uncertaintyM / 1000;
  return radiusKm > 0
    ? areaBoundingBox({ center: { lat, lng }, radiusKm })
    : { west: lng, south: lat, east: lng, north: lat };
}
