/**
 * @fileoverview Αγγελίες → **μία** `FeatureCollection`, όπου η ΓΕΩΜΕΤΡΙΑ κουβαλά το νόημα.
 * @related ADR-777 §7 (Α0 · Α5 κανόνας 27) · CHECK 3.41 · lib/listings/listing-map-shape.ts
 * @module lib/listings/listings-geojson
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΓΙΑΤΙ **ΜΙΑ** ΠΗΓΗ ΚΑΙ ΟΧΙ N ΔΕΙΚΤΕΣ DOM — μετρημένη σύσταση, όχι γούστο
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο σημερινός `AddressMap` ζωγραφίζει με `<Marker>` του react-map-gl, δηλαδή **ένα
 * στοιχείο DOM ανά ακίνητο**. Δουλεύει για μια διεύθυνση· **δεν** κλιμακώνεται σε
 * κατάλογο. Η τεκμηρίωση του MapLibre είναι ρητή για την εναλλακτική: *«adding 100.000
 * points to a GeoJSON source doesn't meaningfully change rendering time — the GPU
 * shaders process each frame in under 16ms»*, και η συνιστώμενη μορφή είναι **GeoJSON
 * source + circle/symbol/fill layer**.
 *
 * Η **Α0** δεσμεύει «*μοντέλο για την τελική κλίμακα, οθόνη σταδιακά*». Άρα η **πηγή
 * δεδομένων** γεννιέται στη σωστή μορφή από την πρώτη μέρα, ακόμη κι αν σήμερα
 * ζωγραφίζει έξι σχήματα: η μετάβαση από 6 σε 60.000 δεν θα είναι ξαναγράψιμο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΣΧΗΜΑ ΕΙΝΑΙ ΙΔΙΟΤΗΤΑ ΤΟΥ FEATURE, ΟΧΙ ΑΠΟΦΑΣΗ ΤΟΥ ΖΩΓΡΑΦΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Κάθε feature κουβαλά `shape`, παραγμένο από το **ίδιο** `listingMapShape` που
 * μετρά και η λογιστική. Ο χάρτης **δεν αποφασίζει** τι σχήμα να δώσει — το διαβάζει.
 *
 * Είναι το μάθημα της **CHECK 3.41** (WCAG 1.4.1) στη σωστή του μορφή: ο ζωγράφος
 * διαβάζει **το ίδιο πεδίο** που κρίνει ο κριτής. Ένα ξεχωριστό «μεταδεδομένο
 * καναλιού» θα μπορούσε να ψευτίσει· εδώ δεν υπάρχει δεύτερο πεδίο να ψευτίσει.
 */

import type { PublicListing } from '@/types/public-listing';
import { listingMapShape, isMappedShape, type ListingMapShape } from './listing-map-shape';

/** Ό,τι χρειάζεται ο ζωγράφος από κάθε αγγελία — και τίποτα άλλο. */
export interface ListingFeatureProperties {
  readonly id: string;
  /** Το σχήμα, **παραγμένο**. Ο ζωγράφος το διαβάζει· δεν το επιλέγει. */
  readonly shape: ListingMapShape;
  readonly title: string;
}

export type ListingFeature = GeoJSON.Feature<GeoJSON.Point | GeoJSON.Polygon, ListingFeatureProperties>;

/**
 * Αγγελίες → GeoJSON.
 *
 * ⚠️ **Οι αγγελίες χωρίς σχήμα ΔΕΝ μπαίνουν** — δεν έχουν γεωμετρία να μπουν. Δεν
 * εξαφανίζονται όμως: τις δείχνει η **συμπτυγμένη γραμμή** (Α5 §4.1) και τις μετρά η
 * **λογιστική**. Το ότι λείπουν από τον χάρτη είναι **ειπωμένο**, όχι σιωπηλό.
 */
export function listingsToGeoJson(
  listings: readonly PublicListing[]
): GeoJSON.FeatureCollection<GeoJSON.Point | GeoJSON.Polygon, ListingFeatureProperties> {
  const features: ListingFeature[] = [];

  for (const listing of listings) {
    const shape = listingMapShape(listing.position);
    if (!isMappedShape(shape)) continue;
    if (listing.position.kind !== 'known') continue;

    features.push({
      type: 'Feature',
      id: listing.id,
      geometry: geometryOf(listing, shape),
      properties: { id: listing.id, shape, title: listing.title },
    });
  }

  return { type: 'FeatureCollection', features };
}

/**
 * Η γεωμετρία που αντιστοιχεί στο σχήμα.
 *
 * 🔑 **`[lng, lat]` — η ΑΝΤΙΣΤΡΟΦΗ σειρά από την ανθρώπινη ανάγνωση.** Είναι το
 * σύνορο εξόδου προς GeoJSON, και το `types/geo/coordinates.ts` δηλώνει ρητά γιατί ο
 * εσωτερικός τύπος **δεν** είναι GeoJSON: ένα μπερδεμένο ζεύγος τοποθετεί το κτίριο σε
 * άλλη ήπειρο χωρίς να το πει κανείς. Η μετατροπή γίνεται **εδώ και μόνο εδώ**.
 */
function geometryOf(
  listing: PublicListing,
  shape: ListingMapShape
): GeoJSON.Point | GeoJSON.Polygon {
  if (listing.position.kind !== 'known') {
    // Μήνυμα προγραμματιστή, όχι οθόνης (σύμβαση src/lib + N.11): αν φτάσει εδώ, το φίλτρο
    // «έχει θέση;» έχει ήδη αποτύχει ανάντη — ο ζωγράφος δεν είναι το σημείο να το κρύψει.
    throw new Error(`listingsToGeoJson: listing "${listing.id}" reached the painter without a position`);
  }

  const outline = shape === 'outline' ? listing.position.outline : undefined;
  if (outline && outline.length > 0) {
    // Το GeoJSON απαιτεί ΚΛΕΙΣΤΟ δακτύλιο (πρώτη κορυφή == τελευταία). Ο εσωτερικός
    // τύπος δεν την επαναλαμβάνει επίτηδες — το κλείσιμο γίνεται εδώ, μία φορά, αντί
    // να ζητείται από κάθε γραφέα να το θυμάται.
    const ring = outline.map((p) => [p.lng, p.lat] as [number, number]);
    ring.push(ring[0]);
    return { type: 'Polygon', coordinates: [ring] };
  }

  const { point } = listing.position;
  return { type: 'Point', coordinates: [point.lng, point.lat] };
}
