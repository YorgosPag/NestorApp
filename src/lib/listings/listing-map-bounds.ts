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

import type { ListingFeatureProperties } from './listings-geojson';

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
  data: GeoJSON.FeatureCollection<GeoJSON.Point | GeoJSON.Polygon, ListingFeatureProperties>,
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
