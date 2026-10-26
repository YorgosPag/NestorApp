/**
 * @fileoverview 🧭 **Ο ΓΡΑΦΕΑΣ ΔΙΑΣΤΑΣΕΩΝ ΚΑΙ ΧΡΩΜΑΤΟΣ, ΧΩΡΙΣ I/O** — «πόσο μεγάλη είναι η εικόνα σε αυτό το αντικείμενο,
 *   σε ποιον χρωματικό χώρο, και ανήκει η μέτρηση στην εγγραφή;» (ADR-899 §3.7 · ADR-923 §5.10.3).
 * @module lib/images/stored-image-dimensions
 * @related functions/storage/image-dimensions-onfinalize (στο ανέβασμα) · app/api/admin/backfill-image-dimensions
 *          (συμπλήρωση) — **οι δύο καλούντες του ίδιου πυρήνα**, μόνο το I/O τους διαφέρει.
 *
 * 🏆 **Πρακτική Cloudinary / Firebase «Resize Images»**: μέτρηση **στην εισαγωγή**, από το ίδιο το σύστημα αποθήκευσης.
 *   🔑 **Πιο φθηνά**: διαβάζεται **μόνο η κεφαλίδα** (128 KiB — το sharp διαβάζει το μέγεθος χωρίς αποκωδικοποίηση).
 *   Ολόκληρο αρχείο μόνο όταν η κεφαλίδα δεν αρκεί (JPEG με τεράστιο EXIF/XMP πριν το SOF · TIFF με IFD στο τέλος).
 * 🔒 **Η μέτρηση ΑΝΗΚΕΙ σε ένα αντικείμενο**: η εγγραφή παίρνει διαστάσεις **μόνο** αν δείχνει **αυτό** το αντικείμενο
 *   (`storagePath` = όνομα). Μικρογραφία `{id}.png_thumb.png` που μοιάζει με το αρχείο `{id}` **δεν** περνά.
 * 🎨 **Ένας αναγνώστης, δύο απαντήσεις** (ADR-923 §5.10.3): το ίδιο `metadata()` δίνει διαστάσεις **και** χρώμα
 *   (`image-colour.ts`). Δεύτερη ανάγνωση για το χρώμα θα διπλασίαζε το I/O και θα μπορούσε να διαφωνήσει για τη γενιά.
 *   ⚠️ **Μετρημένο 2026-10-26**: ένα CMYK JPEG με ενσωματωμένο προφίλ (~650–960 KB) **δεν** διαβάζεται από κεφαλίδα
 *   128 KiB (`premature end of JPEG`) ⇒ ο δρόμος «ολόκληρο αν η κεφαλίδα δεν αρκεί» είναι **ο** δρόμος του CMYK.
 * ⚠️ **Καθαρό, χωρίς Node/React**: προβάλλεται στα Cloud Functions (ADR-874)· το `sharp` **εγχέεται**.
 */

import { imageColourOf, sameImageColour, type ImageColour, type RawColourMetadata } from './image-colour';
import { orientedDimensions, type ImageDimensions } from './image-dimensions';

/** Πόσα bytes κεφαλίδας αρκούν σε κάθε κοινή φωτογραφία/κάτοψη (μετρημένο 2026-10-02: 6/6 με 128 KiB). */
export const IMAGE_HEADER_PROBE_BYTES = 128 * 1024;

/** Πάνω από αυτό **δεν** κατεβαίνει ολόκληρο για μέτρηση — ίδιο όριο με την προεπισκόπηση (ADR-899 §3.4). */
export const IMAGE_PROBE_MAX_BYTES = 50 * 1024 * 1024;

/** Ό,τι δίνει ο αναγνώστης μεταδεδομένων (`sharp().metadata()`) — **ωμές** διαστάσεις + EXIF Orientation + χρώμα. */
export interface RawImageMetadata extends RawColourMetadata {
  readonly width?: number;
  readonly height?: number;
  readonly orientation?: number;
}

/** Ό,τι μετρά ο αναγνώστης για **ένα** αντικείμενο. `colour: null` = ο αναγνώστης δεν είπε χώρο/κανάλια. */
export interface ImageRasterFacts {
  readonly dimensions: ImageDimensions;
  readonly colour: ImageColour | null;
}

/** Ο αναγνώστης μεταδεδομένων — εγχέεται (`(bytes) => sharp(bytes).metadata()`). */
export type ImageMetadataReader = (bytes: Uint8Array) => Promise<RawImageMetadata>;

/** Η ανάγνωση **καρφωμένης γενιάς** του αντικειμένου — `null` = δεν υπάρχει πια (overwrite/διαγραφή). */
export interface StoredImageReader {
  /** Μέγεθος σε bytes, αν το ξέρει ο καλών (μεταδεδομένα αντικειμένου). */
  readonly size: number | null;
  /** Τα πρώτα `byteCount` bytes. */
  readonly readHeader: (byteCount: number) => Promise<Uint8Array | null>;
  readonly readWhole: () => Promise<Uint8Array | null>;
}

/**
 * **Bytes ⇒ διαστάσεις θεατή + χρώμα** — η ΜΙΑ διαδρομή «αναγνώστης μεταδεδομένων → προσανατολισμός». Ποτέ δεν πετά:
 * κομμένη κεφαλίδα / άγνωστη μορφή ⇒ `null`.
 */
export async function imageRasterFactsIn(bytes: Uint8Array, readMetadata: ImageMetadataReader): Promise<ImageRasterFacts | null> {
  try {
    const metadata = await readMetadata(bytes);
    const dimensions = orientedDimensions(metadata.width, metadata.height, metadata.orientation);
    return dimensions === null ? null : { dimensions, colour: imageColourOf(metadata) };
  } catch {
    // Κεφαλίδα κομμένη πριν το SOF / άγνωστη μορφή ⇒ «δεν ξέρουμε ακόμη», ποτέ σφάλμα προς τα πάνω.
    return null;
  }
}

/** **Bytes ⇒ διαστάσεις θεατή** — για όποιον δεν χρειάζεται το χρώμα (ίδιος αναγνώστης, ίδια κρίση). */
export async function imageDimensionsIn(bytes: Uint8Array, readMetadata: ImageMetadataReader): Promise<ImageDimensions | null> {
  return (await imageRasterFactsIn(bytes, readMetadata))?.dimensions ?? null;
}

/**
 * **Διαστάσεις + χρώμα για ένα αποθηκευμένο αντικείμενο** — κεφαλίδα πρώτα, ολόκληρο μόνο αν χρειαστεί και
 * επιτρέπεται. `null` = δεν μετρήθηκε (αντικείμενο που χάθηκε, μη αποκωδικοποιήσιμο, πολύ μεγάλο).
 */
export async function probeImageRaster(
  object: StoredImageReader,
  readMetadata: ImageMetadataReader,
): Promise<ImageRasterFacts | null> {
  const header = await object.readHeader(IMAGE_HEADER_PROBE_BYTES);
  if (header === null) return null;
  const fromHeader = await imageRasterFactsIn(header, readMetadata);
  if (fromHeader !== null) return fromHeader;
  // Η κεφαλίδα ήταν ήδη όλο το αρχείο — δεύτερη ανάγνωση θα έδινε τα ίδια bytes.
  if (header.byteLength < IMAGE_HEADER_PROBE_BYTES) return null;
  if (object.size === null || object.size > IMAGE_PROBE_MAX_BYTES) return null;
  const whole = await object.readWhole();
  return whole === null ? null : imageRasterFactsIn(whole, readMetadata);
}

/** Ό,τι χρειάζεται από την εγγραφή για να κριθεί η γραφή — δομικό. */
export interface DimensionsRecordSnapshot {
  readonly storagePath?: unknown;
  readonly imageDimensions?: unknown;
  readonly imageColour?: unknown;
}

/** Τα πεδία που γράφει η μέτρηση στην εγγραφή — **ένα** σημείο για trigger και συμπλήρωση. */
export function imageFactsRecordUpdate(measured: ImageRasterFacts): {
  readonly imageDimensions: ImageDimensions;
  readonly imageColour?: ImageColour;
} {
  return measured.colour === null
    ? { imageDimensions: measured.dimensions }
    : { imageDimensions: measured.dimensions, imageColour: measured.colour };
}

/**
 * Η ετυμηγορία για την εγγραφή — **ονομασμένη**, για log και άγκυρα:
 * - `write` · `already-recorded` (ιδεμποτία: ίδια τιμή ⇒ καμία γραφή, κανένα νέο trigger)
 * - `no-record` (Admin γραφείς γράφουν την εγγραφή **μετά** το ανέβασμα — τη γεμίζει η συμπλήρωση· ο server βρίσκει
 *   τις διαστάσεις στο metadata του αντικειμένου)
 * - `not-this-object` (η εγγραφή δείχνει **άλλο** αντικείμενο — συνοδευτικό, παλιά θέση, αντικατάσταση)
 */
export type DimensionsRecordVerdict = 'write' | 'already-recorded' | 'no-record' | 'not-this-object';

export function dimensionsRecordVerdict(
  record: DimensionsRecordSnapshot | null,
  objectName: string,
  measured: ImageRasterFacts,
): DimensionsRecordVerdict {
  if (record === null) return 'no-record';
  if (record.storagePath !== objectName) return 'not-this-object';
  return sameDimensions(record.imageDimensions, measured.dimensions) && colourRecorded(record.imageColour, measured.colour)
    ? 'already-recorded'
    : 'write';
}

function sameDimensions(stored: unknown, measured: ImageDimensions): boolean {
  if (stored === null || typeof stored !== 'object') return false;
  const { width, height } = stored as { readonly width?: unknown; readonly height?: unknown };
  return width === measured.width && height === measured.height;
}

/** Χρώμα που δεν μετρήθηκε δεν «διαφωνεί» — αλλιώς κάθε εικόνα χωρίς χώρο θα ξαναγραφόταν σε κάθε γεγονός. */
function colourRecorded(stored: unknown, measured: ImageColour | null): boolean {
  return measured === null || sameImageColour(measured, stored);
}
