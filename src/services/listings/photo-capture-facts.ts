/**
 * @fileoverview 📷 **ΤΙ ΞΕΡΕΙ Η ΙΔΙΑ Η ΦΩΤΟΓΡΑΦΙΑ ΓΙΑ ΤΗ ΛΗΨΗ ΤΗΣ** — οπτικό πεδίο και πυξίδα από το EXIF (ADR-897 Φ5).
 * @related lib/listings/photo-capture-spot (`horizontalFovFromExif` — η μία αριθμητική) · api/files/[fileId]/capture-facts
 * @module services/listings/photo-capture-facts
 *
 * 🏆 **Ο κώνος με το ΠΡΑΓΜΑΤΙΚΟ πλάτος του φακού** — η Zillow/3DVista/Kuula δείχνουν σταθερό κώνο. Εδώ ο επεξεργαστής
 *   προτείνει πεδίο από το `FocalLengthIn35mmFormat`, διορθωμένο για **όρθια** φωτογραφία (μετά τον προσανατολισμό EXIF).
 * ⚠️ **Πυξίδα = μόνο πρόταση**: μέσα σε κτίριο το μαγνητόμετρο αποκλίνει (οπλισμός, συσκευές) — τεκμηριωμένο. Επιστρέφεται
 *   με το **σύστημα αναφοράς** του (`true` / `magnetic`) και ποτέ δεν αποθηκεύεται χωρίς ανθρώπινη επιβεβαίωση.
 * 🔒 **Ιδιωτικότητα**: διαβάζεται **μόνο** η κατεύθυνση (`pick`) — **ποτέ** γεωγραφικό πλάτος/μήκος. Η απάντηση δεν περιέχει
 *   τίποτα που να εντοπίζει το σπίτι.
 * ⚠️ Ποτέ δεν πετά: μεταδεδομένα που λείπουν ή δεν διαβάζονται ⇒ `null` («δεν ξέρουμε»), όχι προεπιλογή.
 */

import exifr from 'exifr';
import sharp from 'sharp';

import { degToRad } from '@/lib/geometry/angle';
import { horizontalFovFromExif } from '@/lib/listings/photo-capture-spot';

export type CompassReference = 'true' | 'magnetic';

export interface PhotoCaptureFacts {
  /** Οριζόντιο πεδίο όπως το βλέπει ο θεατής — `null` χωρίς `FocalLengthIn35mmFormat`. */
  readonly fovRad: number | null;
  /** Κατεύθυνση πυξίδας (0 = βορράς, δεξιόστροφα) — `null` όταν η συσκευή δεν την έγραψε. */
  readonly compass: { readonly headingRad: number; readonly reference: CompassReference } | null;
}

const NO_FACTS: PhotoCaptureFacts = { fovRad: null, compass: null };
const EXIF_TAGS = ['FocalLengthIn35mmFormat', 'GPSImgDirection', 'GPSImgDirectionRef'];
/** EXIF `Orientation` 5–8 = η εικόνα αποθηκεύτηκε **στραμμένη κατά 90°** — πλάτος και ύψος ανταλλάσσονται για τον θεατή. */
const ROTATED_ORIENTATIONS = new Set([5, 6, 7, 8]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Όρθια **όπως τη βλέπει ο θεατής** — οι διαστάσεις του αρχείου, ανταλλαγμένες όταν το EXIF λέει περιστροφή 90°. */
async function isPortrait(bytes: Buffer): Promise<boolean | null> {
  const { width, height, orientation } = await sharp(bytes).metadata();
  if (width === undefined || height === undefined) return null;
  return ROTATED_ORIENTATIONS.has(orientation ?? 1) ? width > height : height > width;
}

function compassOf(tags: Record<string, unknown>): PhotoCaptureFacts['compass'] {
  const degrees = tags.GPSImgDirection;
  if (typeof degrees !== 'number' || !Number.isFinite(degrees) || degrees < 0 || degrees >= 360) return null;
  return { headingRad: degToRad(degrees), reference: tags.GPSImgDirectionRef === 'M' ? 'magnetic' : 'true' };
}

/** Τα στοιχεία λήψης από τα bytes — ποτέ δεν πετά. */
export async function readPhotoCaptureFacts(bytes: Buffer): Promise<PhotoCaptureFacts> {
  try {
    const [parsed, portrait] = await Promise.all([
      exifr.parse(bytes, { tiff: true, exif: true, gps: true, xmp: false, icc: false, iptc: false, pick: EXIF_TAGS }),
      isPortrait(bytes),
    ]);
    const tags = isRecord(parsed) ? parsed : {};
    return {
      fovRad: portrait === null ? null : horizontalFovFromExif(tags.FocalLengthIn35mmFormat, portrait),
      compass: compassOf(tags),
    };
  } catch {
    return NO_FACTS;
  }
}
