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

/**
 * **GeoJSON → ΔΑΚΤΥΛΙΟΙ** — η αντίστροφη κατεύθυνση του {@link outlineToGeoJson}, και
 * ζει **εδώ** για τον ίδιο ακριβώς λόγο που ζει εκείνη: *«μία μετατροπή, ένα σημείο να
 * κοιτάξεις»*. Το σχόλιο κεφαλίδας υπόσχεται ότι **αυτό** το αρχείο είναι το μόνο που
 * αντιστρέφει το ζεύγος `[lng, lat]` — μια υπόσχεση που θα έσπαγε τη στιγμή που ένας
 * γεννήτορας (ADR-846 Φ2.5) έγραφε τον δικό του αναγνώστη «επειδή τρέχει σε Node».
 *
 * 🔑 **Επιστρέφει ΠΙΝΑΚΑ δακτυλίων, ισοπεδωμένο.** Το GeoJSON κωδικοποιεί την ιεραρχία
 * *«πρώτος δακτύλιος = εξωτερικός, οι υπόλοιποι = τρύπες»* μέσα στη **θέση** τους, και
 * το `MultiPolygon` προσθέτει τρίτο επίπεδο για τα μέρη. Οι καταναλωτές αυτού του έργου
 * ({@link geoRingsBoundingCircle}, {@link geoRingsInscribedRadius}) κρίνουν με
 * **even–odd** — δηλαδή *«σε πόσους δακτυλίους είμαι μέσα;»* — και **δεν χρειάζονται**
 * την ιεραρχία. Το να τη μεταφέραμε θα ήταν να ταξιδέψει δομή που κανείς δεν διαβάζει,
 * και που ο επόμενος θα υπέθετε ότι κάποιος συντηρεί.
 *
 * ⚠️ **Αφαιρείται η επαναλαμβανόμενη τελευταία κορυφή.** Το GeoJSON **απαιτεί** κλειστό
 * δακτύλιο· ο {@link GeoOutline} **απαγορεύει** την επανάληψη *(«το κλείσιμο είναι
 * ιδιότητα του τύπου»)*. Χωρίς αυτή τη γραμμή, κάθε δακτύλιος θα κουβαλούσε ένα
 * μηδενικού μήκους τμήμα και μια διπλή κορυφή — αόρατα σε κάθε έλεγχο πλήθους, και
 * ακριβώς ο τύπος σκουπιδιού που εμφανίζεται πολύ αργότερα ως παράξενο εμβαδόν.
 *
 * ⚠️ **Απορρίπτονται σιωπηλά οι δακτύλιοι με < 3 κορυφές** μετά την αφαίρεση: δεν
 * περικλείουν εμβαδόν, άρα δεν είναι σχήμα — και ο {@link isPointInGeoOutline} ήδη τους
 * απαντά `false`. Η απόρριψη εδώ κρατά το «τίποτα» έξω από τους μετρητές αντί να το
 * αφήσει να μοιάζει με δεδομένο.
 */
export function geoJsonRings(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
): readonly GeoOutline[] {
  const polygons: GeoJSON.Position[][][] =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

  const rings: GeoOutline[] = [];
  for (const polygon of polygons) {
    for (const ring of polygon) {
      const outline = openRing(ring).map((position) => ({ lng: position[0], lat: position[1] }));
      if (outline.length >= 3) rings.push(outline);
    }
  }

  return rings;
}

/** Κόβει την επαναλαμβανόμενη τελευταία κορυφή του GeoJSON, αν υπάρχει. */
function openRing(ring: readonly GeoJSON.Position[]): readonly GeoJSON.Position[] {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (ring.length >= 2 && first[0] === last[0] && first[1] === last[1]) return ring.slice(0, -1);
  return ring;
}
