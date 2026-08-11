/**
 * @fileoverview **ΤΟ ΣΥΝΟΡΟ ΕΞΟΔΟΥ ΠΡΟΣ GeoJSON** — το μόνο σημείο που αντιστρέφεται το ζεύγος.
 * @related ADR-777 · types/geo/coordinates.ts
 * @module lib/geo/geo-geojson
 *
 * 🔴 **Το `coordinates.ts` ονομάζει αυτό το αρχείο πριν καν γραφτεί**: *«Η μετατροπή
 * προς GeoJSON γίνεται στο **σύνορο εξόδου**, όπου τη ζητά ο χάρτης.»* Και εξηγεί
 * γιατί δεν είναι κοσμητική λεπτομέρεια: το GeoJSON γράφει **`[lng, lat]`** — δηλαδή
 * **αντίστροφα** από την ανθρώπινη ανάγνωση — και *«είναι ακριβώς ο τύπος όπου ένα
 * μπερδεμένο ζεύγος τοποθετεί το κτίριο σε άλλη ήπειρο χωρίς να το πει κανείς»*.
 *
 * 🔑 **Μία μετατροπή, ένα σημείο να κοιτάξεις.** Κάθε φορά που ένας χάρτης θα
 * χρειαστεί σχήμα, η αντιστροφή γίνεται **εδώ** — όχι inline μέσα σε ένα `Source`,
 * όπου θα ξαναγραφόταν στον επόμενο χάρτη και θα διέφερε.
 *
 * ⚠️ **Εδώ ΕΠΑΝΑΛΑΜΒΑΝΕΤΑΙ η πρώτη κορυφή**, και είναι σωστό: το GeoJSON απαιτεί
 * **κλειστό** δακτύλιο, ενώ ο {@link GeoOutline} ορίζει ρητά ότι *«δεν επαναλαμβάνεται
 * η πρώτη κορυφή — το κλείσιμο είναι ιδιότητα του **τύπου**»*. Οι δύο συμβάσεις
 * συναντιούνται **μόνο** εδώ.
 *
 * **Layering**: leaf — καθαρή συνάρτηση.
 */

import type { GeoOutline, GeoPoint } from '@/types/geo/coordinates';

/** Δακτύλιος → πολύγωνο GeoJSON, έτοιμο για `Source type="geojson"`. */
export function outlineToGeoJson(outline: GeoOutline): GeoJSON.Feature<GeoJSON.Polygon> {
  const ring: [number, number][] = outline.map((vertex) => [vertex.lng, vertex.lat]);
  // Κλείσιμο **μόνο** αν υπάρχει τι να κλείσει: ένας δακτύλιος με μία κορυφή δεν
  // γίνεται πολύγωνο επειδή του προσθέσαμε αντίγραφό της.
  if (ring.length >= 3) ring.push(ring[0]);

  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
}

/** Κορυφές → σημεία GeoJSON, για την **υπό σχεδίαση** γραμμή. */
export function pointsToGeoJson(points: readonly GeoPoint[]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: points.map((point) => [point.lng, point.lat]),
    },
  };
}
