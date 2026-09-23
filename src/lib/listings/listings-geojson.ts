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

import { mercatorScaleAt } from '@/lib/maps/metric-size';
import type { PublicListing } from '@/types/public-listing';
import { LISTING_UNCERTAINTY_KM, type ListingMapShape } from './listing-map-shape';
import { listingMapMark, type ListingMapMark } from './listing-map-mark';

/** Χιλιόμετρα → μέτρα. Γραμμένο μία φορά ώστε το `1000` να μη γίνει μαγικός αριθμός. */
const METRES_PER_KM = 1000;

/** Ό,τι χρειάζεται ο ζωγράφος από κάθε αγγελία — και τίποτα άλλο. */
export interface ListingFeatureProperties {
  readonly id: string;
  /** Το σχήμα, **παραγμένο**. Ο ζωγράφος το διαβάζει· δεν το επιλέγει. */
  readonly shape: ListingMapShape;
  readonly title: string;
  /**
   * **Πόσο δεν ξέρουμε, σε ΜΕΤΡΑ** — το ίδιο νούμερο που κρίνει το «μέσα/ίσως/έξω».
   *
   * 🔴 **Γεννήθηκε επειδή ο ζωγράφος μιλούσε άλλη γλώσσα από τον κριτή** (ADR-777
   * §8.64): οι ακτίνες του χάρτη ήταν **pixel σταθερά** (`34` · `90`) ενώ η ίδια
   * αβεβαιότητα κρινόταν σε μέτρα, άρα ο ίδιος ισχυρισμός κάλυπτε δεκάδες χιλιόμετρα
   * στο ζουμ 10 και λίγα μέτρα στο ζουμ 18.
   *
   * 🔑 **Ταξιδεύει με το feature, δεν είναι σταθερά του επιπέδου** — γιατί έτσι κάθε
   * αγγελία ζωγραφίζεται με **τη δική της** αβεβαιότητα ταυτόχρονα, και ο ζωγράφος
   * διαβάζει **το ίδιο πεδίο** που κρίνει ο κριτής. Ένας δεύτερος πίνακας ακτίνων
   * μέσα στο επίπεδο θα ήταν δεύτερο λεξιλόγιο, δηλαδή το σχήμα ADR-749.
   */
  readonly uncertaintyM: number;
  /**
   * **Ο συντελεστής παραμόρφωσης Mercator στο πλάτος αυτής της αγγελίας.**
   *
   * 🏆 Είναι η μισή γραμμή που **ξεπερνά** την επίσημη πρακτική: η MapLibre καταγράφει
   * ότι η διόρθωση «δεν είναι δυνατή από πλευράς style», επειδή σκέφτεται κατάσταση
   * της **οθόνης** (`global-state`, μία τιμή για όλους). Ως ιδιότητα του **σημείου**
   * είναι τετριμμένη — και σωστή για **κάθε** σχήμα ταυτόχρονα.
   */
  readonly mercatorScale: number;
}

/**
 * **Τα ονόματα των πεδίων, ως ΕΝΑ λεξιλόγιο** — ο ζωγράφος τα ζητά από εδώ.
 *
 * 🔴 Χωρίς αυτό, το `['get', 'uncertaintyM']` του επιπέδου θα ήταν **αλφαριθμητικό σε
 * δεύτερο αρχείο**: μια μετονομασία εδώ θα άφηνε τον χάρτη να ζητά πεδίο που δεν
 * υπάρχει, και το MapLibre **δεν σκάει σε άγνωστο `get`** — αφήνει το επίπεδο σιωπηλά
 * αζωγράφιστο. Το `satisfies` παρακάτω κάνει τη μετονομασία **σφάλμα μεταγλώττισης**.
 */
export const LISTING_FEATURE_KEY = {
  id: 'id',
  shape: 'shape',
  title: 'title',
  uncertaintyM: 'uncertaintyM',
  mercatorScale: 'mercatorScale',
} as const satisfies { readonly [K in keyof ListingFeatureProperties]: K };

export type ListingFeature = GeoJSON.Feature<GeoJSON.Point | GeoJSON.Polygon, ListingFeatureProperties>;

/** Το GeoJSON του ζωγράφου — **η μία** αυθεντία θέσης και σχήματος, για κάθε καταναλωτή του χάρτη. */
export type ListingGeoJson = GeoJSON.FeatureCollection<GeoJSON.Point | GeoJSON.Polygon, ListingFeatureProperties>;

/**
 * Αγγελίες → GeoJSON.
 *
 * ⚠️ **Οι αγγελίες χωρίς σχήμα ΔΕΝ μπαίνουν** — δεν έχουν γεωμετρία να μπουν. Δεν
 * εξαφανίζονται όμως: τις δείχνει η **συμπτυγμένη γραμμή** (Α5 §4.1) και τις μετρά η
 * **λογιστική**. Το ότι λείπουν από τον χάρτη είναι **ειπωμένο**, όχι σιωπηλό.
 */
export function listingsToGeoJson(
  listings: readonly Pick<PublicListing, 'id' | 'title' | 'position'>[]
): ListingGeoJson {
  const features: ListingFeature[] = [];

  for (const listing of listings) {
    const mark = listingMapMark(listing.position);
    if (mark === null) continue;
    features.push(listingFeature(listing.id, listing.title, mark));
  }

  return { type: 'FeatureCollection', features };
}

/**
 * **Ένα σημάδι → ένα feature** — ο ΕΝΑΣ ζωγράφος (ADR-777 §8.70 Φάση 2).
 *
 * 🔑 Τον καλούν **δύο**: ο δημόσιος χάρτης (μέσω {@link listingsToGeoJson}) και το στιγμιότυπο
 * της κάρτας «Τα ακίνητά μου», που έχει μόνο το σημάδι της δημοσιευμένης αγγελίας. Αν η
 * κάρτα έχτιζε δικό της feature, η «σκιασμένη πόλη» θα μπορούσε να αποκλίνει από τον χάρτη.
 */
export function listingFeature(id: string, title: string, mark: ListingMapMark): ListingFeature {
  // 🔑 **Το `?? 0` ΔΕΝ κρύβει κατάσταση.** Ο μόνος παραγωγός του `null` είναι το σχήμα
  //    `'none'`, που δεν έχει σημάδι — άρα ο κλάδος είναι δομικά ανέφικτος και υπάρχει
  //    μόνο για τον τύπο. Η μηδενική ακτίνα είναι η αλήθεια για κάθε σχήμα χωρίς
  //    αβεβαιότητα (`outline`, `pin`).
  const uncertaintyM = (LISTING_UNCERTAINTY_KM[mark.shape] ?? 0) * METRES_PER_KM;

  return {
    type: 'Feature',
    id,
    geometry: geometryOf(mark),
    properties: {
      id,
      shape: mark.shape,
      title,
      uncertaintyM,
      mercatorScale: mercatorScaleAt(mark.point.lat),
    },
  };
}

/**
 * Η γεωμετρία που αντιστοιχεί στο σημάδι.
 *
 * 🔑 **`[lng, lat]` — η ΑΝΤΙΣΤΡΟΦΗ σειρά από την ανθρώπινη ανάγνωση.** Είναι το
 * σύνορο εξόδου προς GeoJSON, και το `types/geo/coordinates.ts` δηλώνει ρητά γιατί ο
 * εσωτερικός τύπος **δεν** είναι GeoJSON: ένα μπερδεμένο ζεύγος τοποθετεί το κτίριο σε
 * άλλη ήπειρο χωρίς να το πει κανείς. Η μετατροπή γίνεται **εδώ και μόνο εδώ**.
 */
function geometryOf(mark: ListingMapMark): GeoJSON.Point | GeoJSON.Polygon {
  if (mark.outline && mark.outline.length > 0) {
    // Το GeoJSON απαιτεί ΚΛΕΙΣΤΟ δακτύλιο (πρώτη κορυφή == τελευταία). Ο εσωτερικός
    // τύπος δεν την επαναλαμβάνει επίτηδες — το κλείσιμο γίνεται εδώ, μία φορά, αντί
    // να ζητείται από κάθε γραφέα να το θυμάται.
    const ring = mark.outline.map((p) => [p.lng, p.lat] as [number, number]);
    ring.push(ring[0]);
    return { type: 'Polygon', coordinates: [ring] };
  }

  return { type: 'Point', coordinates: [mark.point.lng, mark.point.lat] };
}

// ============================================================================
// Ο ΔΙΑΧΩΡΙΣΜΟΣ ΓΕΩΜΕΤΡΙΑΣ — επειδή η ομαδοποίηση ΔΕΝ βλέπει πολύγωνα (ADR-777 §8.66)
// ============================================================================

/** Οι δύο συλλογές που χρειάζεται ο χάρτης: ό,τι ομαδοποιείται, και ό,τι δεν μπορεί. */
export interface SplitListingGeometry {
  /** Σημεία — **ομαδοποιήσιμα**. Πινέζες, δακτύλιοι, σκιασμένοι κύκλοι. */
  readonly points: GeoJSON.FeatureCollection<GeoJSON.Point, ListingFeatureProperties>;
  /** Πολύγωνα — **μετρημένα περιγράμματα**, ποτέ ομαδοποιημένα. */
  readonly polygons: GeoJSON.FeatureCollection<GeoJSON.Polygon, ListingFeatureProperties>;
}

/**
 * **Χώρισε τη μία παραγωγή σε δύο πηγές** — και ο λόγος είναι περιορισμός βιβλιοθήκης.
 *
 * 🔴 **ΤΟ SUPERCLUSTER ΔΕΧΕΤΑΙ ΜΟΝΟ `Point`/`MultiPoint`. Τα πολύγωνα τα ΑΓΝΟΕΙ.** Και
 * το «αγνοεί» εδώ σημαίνει **εξαφανίζονται**: μια πηγή με `cluster: true` δεν
 * ζωγραφίζει καθόλου τα μη-σημειακά features της, **χωρίς σφάλμα, χωρίς προειδοποίηση**.
 * Δηλαδή ένα σκέτο `cluster: true` πάνω στην υπάρχουσα πηγή θα έσβηνε **κάθε μετρημένο
 * περίγραμμα ακινήτου** από τον χάρτη — και τα περιγράμματα είναι ό,τι **ακριβέστερο**
 * έχουμε, το αντίθετο ακριβώς από ό,τι θα δεχόμασταν να χάσουμε.
 *
 * ⚠️ **Τρίτη εμφάνιση της οικογένειας «η οθόνη μοιάζει σωστή»** *(§8.63 `source` που
 * έλειπε · §8.64.3 `['zoom']` σε λάθος θέση)*: ο χάρτης θα ζωγράφιζε πινέζες,
 * συσσωματώματα και σκιάσεις — **όλα σωστά** — και θα έλειπε σιωπηλά μία κατηγορία.
 *
 * 🔑 **Ο διαχωρισμός γίνεται ΕΔΩ, όχι στο συστατικό**: είναι ερώτηση για τη **γεωμετρία
 * των δεδομένων**, και η απάντησή της είναι η ίδια για κάθε καταναλωτή. Ένα `.filter()`
 * μέσα στο JSX θα ήταν δεύτερη δήλωση του *«τι είναι ομαδοποιήσιμο»*.
 */
export function splitListingGeometry(
  collection: ListingGeoJson
): SplitListingGeometry {
  const points: Array<GeoJSON.Feature<GeoJSON.Point, ListingFeatureProperties>> = [];
  const polygons: Array<GeoJSON.Feature<GeoJSON.Polygon, ListingFeatureProperties>> = [];

  for (const feature of collection.features) {
    if (feature.geometry.type === 'Point') {
      points.push(feature as GeoJSON.Feature<GeoJSON.Point, ListingFeatureProperties>);
    } else {
      polygons.push(feature as GeoJSON.Feature<GeoJSON.Polygon, ListingFeatureProperties>);
    }
  }

  return {
    points: { type: 'FeatureCollection', features: points },
    polygons: { type: 'FeatureCollection', features: polygons },
  };
}
