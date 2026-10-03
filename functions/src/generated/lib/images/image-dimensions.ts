// ⚠️ GENERATED — DO NOT EDIT. Verbatim projection of src/lib/images/image-dimensions.ts (ADR-874 · CHECK 3.93).
// Edit the source, then run: npm run generate:functions-projection
// sha256:80241a79a2e891d9d0db466e18d73840c21fa129153b9589ddf38a2426f3d29b

/**
 * @fileoverview 📐 **ΟΙ ΔΙΑΣΤΑΣΕΙΣ ΜΙΑΣ ΕΙΚΟΝΑΣ ΟΠΩΣ ΤΗ ΒΛΕΠΕΙ Ο ΘΕΑΤΗΣ** — το ΕΝΑ σημείο που ξέρει τι σημαίνει
 *   «πλάτος × ύψος» μετά τον προσανατολισμό EXIF (ADR-899 §3.7).
 * @module lib/images/image-dimensions
 * @related functions/storage/image-dimensions-onfinalize (ο ΕΝΑΣ γραφέας, προβολή ADR-874) ·
 *          lib/files/file-preview-ladder (κόβει την κλίμακα στο πλάτος) · server/images/image-header (ανάγνωση κεφαλίδας)
 *
 * 🔑 **Ο προσανατολισμός ΔΕΝ είναι λεπτομέρεια**: ένα κινητό αποθηκεύει την κάθετη λήψη ως `4000×3000` με
 *   `Orientation = 6`. Ο θεατής βλέπει `3000×4000`. Ό,τι αποφασίζει με τις ωμές διαστάσεις (κάθετη; πόσο φαρδιά; ποια
 *   βαθμίδα;) αποφασίζει **λάθος**. Πριν ζούσε δύο φορές (`photo-capture-facts` σωστά, `panorama-facts` χωρίς στροφή).
 * 🏆 **Πιο έξυπνα από το Cloudinary**: εκείνο επιστρέφει στο upload τις διαστάσεις **πριν** τη στροφή — γνωστή παγίδα.
 *   Εδώ αποθηκεύεται **μόνο** η εκδοχή του θεατή, άρα κανένας αναγνώστης δεν χρειάζεται να ξέρει για EXIF.
 * ⚠️ **Καθαρό module, χωρίς imports**: προβάλλεται αυτούσιο στα Cloud Functions (`.functions-projection.json`) —
 *   client, server και Functions εκτελούν **τον ίδιο κώδικα**.
 */

/** Πλάτος × ύψος σε pixel, **μετά** τον προσανατολισμό EXIF. */
export interface ImageDimensions {
  readonly width: number;
  readonly height: number;
}

/** EXIF `Orientation` 5–8 = η εικόνα αποθηκεύτηκε **στραμμένη κατά 90°** — πλάτος και ύψος ανταλλάσσονται για τον θεατή. */
const QUARTER_TURN_ORIENTATIONS: ReadonlySet<number> = new Set([5, 6, 7, 8]);

/** Η μεγαλύτερη πλευρά που δεχόμαστε ως αληθινή — ίδια τάξη με το `limitInputPixels` του κωδικοποιητή. */
const MAX_EDGE_PX = 65_535;

/**
 * **Τυπικό μέγεθος**: θετικός ακέραιος ≤ {@link MAX_EDGE_PX}. Ό,τι άλλο (0, NaN, κλάσμα, αρνητικό, string) ⇒ `null` —
 * ποτέ επινοημένη διάσταση.
 */
function edgeOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MAX_EDGE_PX ? value : null;
}

/**
 * **Ωμές διαστάσεις αρχείου + προσανατολισμός ⇒ διαστάσεις θεατή.** `null` όταν κάποια πλευρά λείπει ή είναι άκυρη.
 * Άγνωστος/απών προσανατολισμός = 1 (όπως κάθε αποκωδικοποιητής).
 */
export function orientedDimensions(rawWidth: unknown, rawHeight: unknown, orientation?: unknown): ImageDimensions | null {
  const width = edgeOf(rawWidth);
  const height = edgeOf(rawHeight);
  if (width === null || height === null) return null;
  return typeof orientation === 'number' && QUARTER_TURN_ORIENTATIONS.has(orientation)
    ? { width: height, height: width }
    : { width, height };
}

/** **Φρουρός ανάγνωσης** αποθηκευμένης τιμής (Firestore, props) — `null` για ό,τι δεν είναι έγκυρο ζεύγος. */
export function imageDimensionsOf(value: unknown): ImageDimensions | null {
  if (value === null || typeof value !== 'object') return null;
  const candidate = value as { readonly width?: unknown; readonly height?: unknown };
  return orientedDimensions(candidate.width, candidate.height);
}

/** Όρθια (κάθετη) όπως τη βλέπει ο θεατής. Τετράγωνη ⇒ όχι. */
export function isPortraitDimensions(dimensions: ImageDimensions): boolean {
  return dimensions.height > dimensions.width;
}

/**
 * **Πόσο φαρδιά ζωγραφίζεται** μια εικόνα μέσα σε κουτί με `object-contain` (και `max-w/max-h`, χωρίς μεγέθυνση) — σε
 * μονάδες του κουτιού. 🔑 Μια κάθετη λήψη σε οριζόντιο κουτί περιορίζεται από το **ύψος**: εκεί το «70vw» του `sizes`
 * υπερεκτιμά (μετρημένο: 803 px ζωγραφισμένα έναντι 1.680 δηλωμένων, ADR-899 §9). `0` για άκυρο κουτί.
 */
export function containedWidth(box: { readonly width: number; readonly height: number }, image: ImageDimensions): number {
  if (!(box.width > 0) || !(box.height > 0)) return 0;
  return Math.min(box.width, (box.height * image.width) / image.height, image.width);
}

/**
 * **Πόσο φαρδιά ζωγραφίζεται** μια εικόνα σε κουτί με `object-cover` (μικρογραφίες) — ο δίδυμος του `containedWidth`.
 * 🔑 Το cover **γεμίζει** το κουτί: μια πανοραμική λήψη σε τετράγωνο κουτί κλιμακώνεται στο **ύψος** και ξεχειλίζει
 * πλάγια ⇒ χρειάζεται πλάτος **μεγαλύτερο** από του κουτιού, αλλιώς θολώνει. Ποτέ πάνω από τα pixel της εικόνας
 * (κανένα παράγωγο δεν έχει περισσότερα). `0` για άκυρο κουτί.
 */
export function coveredWidth(box: { readonly width: number; readonly height: number }, image: ImageDimensions): number {
  if (!(box.width > 0) || !(box.height > 0)) return 0;
  return Math.min(Math.max(box.width, (box.height * image.width) / image.height), image.width);
}

// ---------------------------------------------------------------------------
// Τύποι που μετριούνται — ο ΕΝΑΣ κατάλογος (και της κλίμακας προεπισκοπήσεων)
// ---------------------------------------------------------------------------

/**
 * **Raster τύποι που αποκωδικοποιεί η πλατφόρμα** (`sharp`). ⛔ Όχι `svg` (διανυσματικό — δεν έχει «πλάτος pixel», και η
 * ραστεροποίηση ξένου SVG στον server είναι επιφάνεια επίθεσης) · ⛔ όχι `gif` (η προεπισκόπηση θα έχανε την κίνηση) ·
 * ⛔ όχι `heic` (το prebuilt `sharp` δεν τον διαβάζει).
 */
export const RASTER_IMAGE_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/tiff',
]);

/** `image/JPEG; charset=…` ⇒ `image/jpeg`. */
function mediaTypeOf(contentType: string): string {
  return contentType.split(';')[0].trim().toLowerCase();
}

export function isRasterImageContentType(contentType: unknown): boolean {
  return typeof contentType === 'string' && RASTER_IMAGE_TYPES.has(mediaTypeOf(contentType));
}

// ---------------------------------------------------------------------------
// Custom metadata του αντικειμένου στο Storage — οι διαστάσεις ΔΕΜΕΝΕΣ με τη γενιά
// ---------------------------------------------------------------------------

/**
 * Τα κλειδιά στο custom metadata του αντικειμένου GCS. 🔑 Το metadata ζει **μαζί με τη γενιά**: αντικατάσταση του αρχείου
 * = νέα γενιά **χωρίς** αυτά τα κλειδιά ⇒ μια παλιά μέτρηση **δεν μπορεί** να περιγράψει νέα bytes. Ο server τα παίρνει
 * δωρεάν από την κλήση μεταδεδομένων που κάνει ήδη (ADR-899 §3.3).
 */
export const IMAGE_DIMENSIONS_METADATA_KEYS = { width: 'imageWidth', height: 'imageHeight' } as const;

/** Διαστάσεις ⇒ custom metadata (τιμές string, όπως απαιτεί το GCS). */
export function imageDimensionsToMetadata(dimensions: ImageDimensions): Record<string, string> {
  return {
    [IMAGE_DIMENSIONS_METADATA_KEYS.width]: String(dimensions.width),
    [IMAGE_DIMENSIONS_METADATA_KEYS.height]: String(dimensions.height),
  };
}

/** Κανονική μορφή ακεραίου: ψηφία χωρίς αρχικό μηδέν — ό,τι άλλο δεν γράφτηκε από εμάς. */
function metadataEdgeOf(raw: unknown): number | null {
  return typeof raw === 'string' && /^[1-9]\d{0,4}$/.test(raw) ? Number(raw) : null;
}

/** Custom metadata ⇒ διαστάσεις, ή `null` όταν δεν μετρήθηκε (ή γράφτηκε από άλλον σε άλλη μορφή). */
export function imageDimensionsFromMetadata(metadata: unknown): ImageDimensions | null {
  if (metadata === null || typeof metadata !== 'object') return null;
  const record = metadata as Record<string, unknown>;
  return orientedDimensions(
    metadataEdgeOf(record[IMAGE_DIMENSIONS_METADATA_KEYS.width]),
    metadataEdgeOf(record[IMAGE_DIMENSIONS_METADATA_KEYS.height]),
  );
}
