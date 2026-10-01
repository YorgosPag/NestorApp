/**
 * @fileoverview **«ΑΠΟ ΠΟΥ ΤΡΑΒΗΧΤΗΚΕ ΑΥΤΗ Η ΦΩΤΟΓΡΑΦΙΑ, ΚΑΙ ΠΡΟΣ ΤΑ ΠΟΥ ΚΟΙΤΑΖΕΙ;»** — η μία απάντηση (ADR-897).
 * @related ADR-897 · ADR-880 (η αδελφή δήλωση: `photo-focal-point`) · ADR-841 §7 Α17 (οι κατόψεις)
 * @module lib/listings/photo-capture-spot
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΕΥΤΕΡΗ ΔΗΛΩΣΗ ΔΙΠΛΑ ΣΤΟ ΣΗΜΕΙΟ ΕΣΤΙΑΣΗΣ — ΙΔΙΟ ΚΑΝΑΛΙ, ΚΑΝΕΝΑ ΝΕΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το σημείο εστίασης απαντά *«πού είναι το θέμα **μέσα** στη φωτογραφία;»*· αυτό εδώ απαντά
 * *«πού στεκόταν η **κάμερα** μέσα στο σπίτι;»*. Ίδιο είδος γνώσης *(ανθρώπινη δήλωση ανά
 * φωτογραφία, δεμένη στο `FileRecord.id`, ποτέ στη θέση)* ⇒ ίδιος κύκλος ζωής από άκρη σε άκρη.
 *
 * 🏆 **Μοντέλο Revit** *(σημείο ματιού + κατεύθυνση + οπτικό πεδίο)* και όχι μόνο «πινέζα» όπως
 * Kuula/3DVista: ο κώνος έχει το **πραγματικό** εύρος του φακού όταν το ξέρουμε από το EXIF
 * *(δες {@link horizontalFovFromExif})* — η Zillow δείχνει σταθερό κώνο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 📐 ΣΥΜΒΑΣΕΙΣ ΧΩΡΟΥ — ΧΩΡΟΣ ΤΗΣ ΕΙΚΟΝΑΣ ΚΑΤΟΨΗΣ, ΟΧΙ ΤΟΥ ΚΟΣΜΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * - `x`, `y` ∈ [0,1] από **πάνω-αριστερά** της (ήδη προσανατολισμένης) εικόνας κάτοψης — ίδια
 *   σύμβαση με το {@link PhotoFocalPoint}. Τα παράγωγα του ραφιού είναι η **ίδια εικόνα σε άλλο
 *   μέγεθος** ⇒ ένα σημείο ισχύει για όλα.
 * - `headingRad`: `0` = προς τα **πάνω** της εικόνας, **δεξιόστροφα** — η σύμβαση του SVG
 *   `rotate()`, άρα ο αποδότης γράφει την τιμή **αυτούσια**. ⚠️ **Δεν** είναι πυξίδα: μια
 *   raster κάτοψη δεν ξέρει πού είναι ο βορράς.
 * - `fovRad`: **οριζόντιο** οπτικό πεδίο, ∈ [{@link MIN_PHOTO_FOV_RAD}, {@link MAX_PHOTO_FOV_RAD}].
 *
 * ⚠️ **Καθαρό module** — καμία εξάρτηση από React, Firestore ή `exifr`.
 */

import { z } from 'zod';

import { degToRad, normalizeAngleRad } from '@/lib/geometry/angle';

import { readDeclaredFileMap, sameDeclaredFileMap, withDeclaredFileEntry } from './declared-file-map';

// ============================================================================
// 1. ΤΟ ΣΗΜΕΙΟ ΛΗΨΗΣ
// ============================================================================

/** Το σημείο λήψης **όπως το δηλώνει ο άνθρωπος** — με την κάτοψη ως ταυτότητα αρχείου. */
export interface PhotoCaptureSpot {
  /** Ποια κάτοψη (όροφος) — `FileRecord.id` της **δηλωμένης** κάτοψης. */
  readonly floorplanFileId: string;
  readonly x: number;
  readonly y: number;
  readonly headingRad: number;
  readonly fovRad: number;
}

/**
 * Το σημείο λήψης **όπως το βλέπει το κοινό** — η κάτοψη ως **δείκτης** στο `floorplans[]` του
 * **ίδιου** εγγράφου.
 *
 * 🔴 **Καμία εσωτερική ταυτότητα αρχείου δεν φεύγει στο κοινό.** Ο δείκτης είναι σταθερός επειδή
 * `gallery` και `floorplans` γράφονται **μαζί**, ατομικά, από τον ένα γραφέα
 * (`withPublishedGallery`).
 */
export interface ListingCaptureSpot {
  readonly floorplanIndex: number;
  readonly x: number;
  readonly y: number;
  readonly headingRad: number;
  readonly fovRad: number;
}

/**
 * Πλάτος/ύψος του κάδρου 35 mm — η βάση του `FocalLengthIn35mmFilm`.
 * ⚠️ Δηλώνονται **πριν** το {@link DEFAULT_PHOTO_FOV_RAD}, που τα διαβάζει κατά την αρχικοποίηση του module.
 */
const FILM_35MM_WIDTH_MM = 36;
const FILM_35MM_HEIGHT_MM = 24;

/** Το στενότερο λογικό πεδίο — τηλεφακός ~200 mm ισοδύναμου (≈ 10°). */
export const MIN_PHOTO_FOV_RAD = degToRad(10);
/** Το ευρύτερο **επίπεδο** πεδίο — υπερευρυγώνιος ~10 mm ισοδύναμου (≈ 121°). Τα 360° είναι το spatial-tour. */
export const MAX_PHOTO_FOV_RAD = degToRad(125);
/**
 * Η προεπιλογή όταν το EXIF σιωπά — ο **κύριος φακός κινητού** (~26 mm ισοδύναμου ⇒ ≈ 69°), δηλαδή
 * η συντριπτική πλειονότητα των φωτογραφιών αγγελιών.
 */
export const DEFAULT_PHOTO_FOV_RAD = horizontalFovFromFocal35(26);

const unit = z.number().finite().min(0).max(1);
const heading = z.number().finite().min(0).max(Math.PI * 2);
const fov = z.number().finite().min(MIN_PHOTO_FOV_RAD).max(MAX_PHOTO_FOV_RAD);
const fileId = z.string().trim().min(1).max(128);

/** Το σχήμα της **πόρτας** (PATCH γραφείου, φόρμα κατόχου) — αυστηρό: σκουπίδι απορρίπτεται. */
export const photoCaptureSpotSchema = z
  .object({ floorplanFileId: fileId, x: unit, y: unit, headingRad: heading, fovRad: fov })
  .strict();

/** Το σχήμα του **χάρτη** `photoFileId → σημείο` στην πόρτα. */
export function declaredCaptureSpotsSchema(limit: number) {
  return z
    .record(fileId, photoCaptureSpotSchema)
    .refine((value) => Object.keys(value).length <= limit, { message: `at most ${limit} capture spots` });
}

/**
 * **Η μία ανάγνωση αποθηκευμένου σημείου** — ποτέ δεν πετά. Άκυρο ⇒ `null` («κανείς δεν δήλωσε»).
 *
 * 🔑 Η κατεύθυνση **κανονικοποιείται** στο [0, 2π) πριν τον έλεγχο: `-π/2` και `3π/2` είναι η
 * **ίδια** δήλωση, και ένα ιστορικό έγγραφο με την πρώτη δεν πρέπει να χάσει το σημείο του.
 */
export function readPhotoCaptureSpot(value: unknown): PhotoCaptureSpot | null {
  const normalised = isRecord(value) && typeof value.headingRad === 'number'
    ? { ...value, headingRad: normalizeAngleRad(value.headingRad) }
    : value;
  const parsed = photoCaptureSpotSchema.safeParse(normalised);
  if (!parsed.success) return null;
  const { floorplanFileId, x, y, headingRad, fovRad } = parsed.data;
  return { floorplanFileId, x, y, headingRad, fovRad };
}

/**
 * **Δηλωμένα σημεία ανά φωτογραφία** (`FileRecord.id` → σημείο) — ωμό πεδίο εγγράφου.
 * Άκυρη γραμμή πέφτει **μόνη της** — δεν ακυρώνει τις άλλες (ίδια πειθαρχία με το `readDeclaredFocalPoints`).
 */
export function readDeclaredCaptureSpots(value: unknown): ReadonlyMap<string, PhotoCaptureSpot> {
  return readDeclaredFileMap(value, readPhotoCaptureSpot);
}

/** Ίδιο σημείο; — για ισότητα δηλώσεων (αισιόδοξη ενημέρωση), όχι για απόδοση. */
export function sameCaptureSpot(a: PhotoCaptureSpot | null, b: PhotoCaptureSpot | null): boolean {
  if (a === null || b === null) return a === b;
  return a.floorplanFileId === b.floorplanFileId
    && a.x === b.x && a.y === b.y
    && a.headingRad === b.headingRad && a.fovRad === b.fovRad;
}

/** Ίδιες δηλώσεις; — ίδιο σύνολο φωτογραφιών, ίδιο σημείο η καθεμιά (η σειρά αδιάφορη). */
export function sameDeclaredCaptureSpots(
  a: ReadonlyMap<string, PhotoCaptureSpot>,
  b: ReadonlyMap<string, PhotoCaptureSpot>,
): boolean {
  return sameDeclaredFileMap(a, b, sameCaptureSpot);
}

/** Ένα σημείο αλλαγμένο μέσα στη δήλωση — νέος χάρτης, ποτέ μετάλλαξη. `null` ⇒ η γραμμή **φεύγει**. */
export function withDeclaredCaptureSpot(
  declared: ReadonlyMap<string, PhotoCaptureSpot>,
  photoFileId: string,
  spot: PhotoCaptureSpot | null,
): ReadonlyMap<string, PhotoCaptureSpot> {
  return withDeclaredFileEntry(declared, photoFileId, spot);
}

/**
 * **Η δημόσια μορφή** — η κάτοψη από ταυτότητα αρχείου σε δείκτη. `null` όταν η κάτοψη **δεν
 * δημοσιεύτηκε** *(αποσύρθηκε ή απορρίφθηκε από το ράφι)*: ποτέ κρεμασμένος δείκτης.
 */
export function toListingCaptureSpot(
  spot: PhotoCaptureSpot | null,
  floorplanIndexOf: ReadonlyMap<string, number>,
): ListingCaptureSpot | null {
  if (spot === null) return null;
  const floorplanIndex = floorplanIndexOf.get(spot.floorplanFileId);
  if (floorplanIndex === undefined) return null;
  return { floorplanIndex, x: spot.x, y: spot.y, headingRad: spot.headingRad, fovRad: spot.fovRad };
}

const listingCaptureSpotSchema = z
  .object({ floorplanIndex: z.number().int().min(0), x: unit, y: unit, headingRad: heading, fovRad: fov })
  .strict();

/**
 * **Η μία ανάγνωση του δημόσιου σημείου** (πλευρά επισκέπτη) — ποτέ δεν πετά.
 *
 * 🔑 Ελέγχει **και** τον δείκτη: σημείο που δείχνει σε κάτοψη πέρα από το `floorplans.length` ⇒ `null`.
 * Ο γραφέας δεν το παράγει ποτέ, αλλά το δημόσιο έγγραφο διαβάζεται **ρηχά** (`public-listing-schema`),
 * άρα ο αναγνώστης δεν δανείζεται την εμπιστοσύνη του γραφέα.
 */
export function readListingCaptureSpot(value: unknown, floorplanCount: number): ListingCaptureSpot | null {
  const parsed = listingCaptureSpotSchema.safeParse(value);
  if (!parsed.success || parsed.data.floorplanIndex >= floorplanCount) return null;
  const { floorplanIndex, x, y, headingRad, fovRad } = parsed.data;
  return { floorplanIndex, x, y, headingRad, fovRad };
}

// ============================================================================
// 2. ΤΟ ΟΠΤΙΚΟ ΠΕΔΙΟ ΑΠΟ ΤΟ EXIF
// ============================================================================

/** `2·atan(διάσταση / 2f)` για εστιακή απόσταση **ισοδύναμη 35 mm**, σφηνωμένο στα όρια. */
function horizontalFovFromFocal35(focal35mm: number, frameMm = FILM_35MM_WIDTH_MM): number {
  const raw = 2 * Math.atan(frameMm / (2 * focal35mm));
  return Math.min(MAX_PHOTO_FOV_RAD, Math.max(MIN_PHOTO_FOV_RAD, raw));
}

/**
 * **Το οριζόντιο πεδίο της φωτογραφίας όπως την ΒΛΕΠΕΙ ο θεατής**, από το EXIF.
 *
 * - `focal35mm`: `FocalLengthIn35mmFormat` — ήδη κανονικοποιημένο ανά αισθητήρα, άρα **χωρίς**
 *   πίνακα συσκευών. Απόν/άκυρο ⇒ `null` («δεν ξέρουμε» — **όχι** προεπιλογή: η προεπιλογή είναι
 *   απόφαση του καλούντα).
 * - `portrait`: η φωτογραφία, **μετά** τον προσανατολισμό EXIF, είναι όρθια ⇒ η οριζόντια
 *   διάσταση είναι η **μικρή** πλευρά του κάδρου (24 mm). Χωρίς αυτή τη διάκριση ο κώνος μιας
 *   όρθιας φωτογραφίας θα ήταν ~1,5× πιο φαρδύς απ' ό,τι είδε ο φακός.
 */
export function horizontalFovFromExif(focal35mm: unknown, portrait: boolean): number | null {
  if (typeof focal35mm !== 'number' || !Number.isFinite(focal35mm) || focal35mm <= 0) return null;
  return horizontalFovFromFocal35(focal35mm, portrait ? FILM_35MM_HEIGHT_MM : FILM_35MM_WIDTH_MM);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
