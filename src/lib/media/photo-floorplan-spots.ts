/**
 * @fileoverview **«Πού τραβήχτηκε αυτή η φωτογραφία;» — το ΟΥΔΕΤΕΡΟ σχήμα** του πάνελ κάτοψης (ADR-897 · ADR-899 §4).
 * @module lib/media/photo-floorplan-spots
 * @related lib/listings/listing-capture-spots (προσαρμογέας δημόσιας αγγελίας) ·
 *          lib/properties/property-floorplan-spots (προσαρμογέας εσωτερικού ακινήτου) ·
 *          components/shared/media/PhotoLightbox · PhotoFloorplanPanel · FloorplanSpotsFigure
 *
 * 🔑 **Γιατί ουδέτερο**: το ίδιο πάνελ δείχνει **δύο** πηγές — το δημόσιο ράφι (`ListingImage`, διαστάσεις γνωστές
 * από το manifest) και τα ιδιωτικά αρχεία ενός ακινήτου (`FileRecord`, **χωρίς** διαστάσεις). Ένα πάνελ ανά πηγή θα
 * ήταν δύο αντίγραφα του ίδιου UI· εδώ κάθε πηγή έχει έναν **καθαρό προσαρμογέα** προς αυτό το σχήμα.
 *
 * ⛔ **Καμία επινοημένη διάσταση**: `width`/`height` = `null` σημαίνει «δεν τις ξέρουμε» — τις **μετρά** η εικόνα όταν
 * φορτώσει (`naturalWidth/Height`) και μόνο τότε σχεδιάζονται τα σημεία. Τα σημεία είναι κανονικοποιημένα (0..1),
 * αλλά ο κώνος θέασης χρειάζεται την **αναλογία** — λάθος αναλογία = λάθος κατεύθυνση στην οθόνη.
 */

/** Η γεωμετρία ενός σημείου λήψης — κανονικοποιημένη θέση, κατεύθυνση και οπτικό πεδίο. */
export interface PhotoSpotGeometry {
  readonly x: number;
  readonly y: number;
  readonly headingRad: number;
  readonly fovRad: number;
}

/** Η εικόνα της κάτοψης, όπως τη χρειάζεται ένα `<img>` — και ό,τι ξέρουμε για τον βορρά της. */
export interface FloorplanFigureSource {
  readonly src: string;
  readonly srcSet?: string;
  readonly alt: string;
  /** Εγγενείς διαστάσεις — `null` ⇒ άγνωστες, μετρώνται στη φόρτωση. */
  readonly width: number | null;
  readonly height: number | null;
  /** Ο βορράς της κάτοψης σε rad — `null` ⇒ δεν δηλώθηκε. */
  readonly northRad: number | null;
}

/** Μία φωτογραφία πάνω σε μία κάτοψη: η θέση της **στη σειρά του θεατή** και το σημείο. */
export interface PlacedPhoto {
  readonly imageIndex: number;
  readonly spot: PhotoSpotGeometry;
}

/** Μία κάτοψη του πάνελ, με όσες φωτογραφίες τραβήχτηκαν πάνω της. */
export interface FloorplanSpotsEntry {
  /** Σταθερό κλειδί React. */
  readonly key: string;
  /** «Κάτοψη N» — 1-based, ίδιο σε κάθε επιφάνεια της ίδιας πηγής. */
  readonly ordinal: number;
  readonly figure: FloorplanFigureSource;
  readonly photos: readonly PlacedPhoto[];
}

/** Η κάτοψη όπου τραβήχτηκε η φωτογραφία `imageIndex` — `null` ⇒ δεν τοποθετήθηκε. */
export function floorplanEntryOf<E extends { readonly photos: readonly { readonly imageIndex: number }[] }>(
  entries: readonly E[],
  imageIndex: number,
): E | null {
  return entries.find((entry) => entry.photos.some((photo) => photo.imageIndex === imageIndex)) ?? null;
}
