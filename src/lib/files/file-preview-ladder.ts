/**
 * @fileoverview **Η ΚΛΙΜΑΚΑ των προεπισκοπήσεων εσωτερικών εικόνων** — ποια πλάτη υπάρχουν, για
 * ποιους τύπους, με ποια συνταγή (ADR-899 §3.1). Καθαρά δεδομένα: client **και** server.
 * @module lib/files/file-preview-ladder
 * @related lib/storage/storage-object-url (ο builder του `srcset`) ·
 *          server/files/image-preview.service (ο παραγωγός) ·
 *          services/upload/utils/public-shelf-encoding (ο ΙΔΙΟΣ τύπος κωδικοποίησης, ADR-841 Α2.2)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΚΛΕΙΣΤΗ ΚΛΙΜΑΚΑ, ΟΧΙ ΕΛΕΥΘΕΡΟ ΠΛΑΤΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 * Το `?w=` δέχεται **μόνο** ένα από τα πλάτη της κλίμακας — αλλιώς 400. Ελεύθερο πλάτος θα ήταν
 * όπλο: `w=1001, 1002, …` = μία αποκωδικοποίηση + κωδικοποίηση ανά αίτημα, χωρίς ποτέ cache hit.
 * Η κλειστή κλίμακα φράζει το πλήθος των παραγώγων ανά αρχείο σε **4**, όπως οι μεγάλοι
 * (Next.js `deviceSizes`, Zillow με τη διάσταση στο μονοπάτι).
 *
 * 🔑 **640 · 1280 · 2560 = τα πλάτη του δημόσιου ραφιού**, άρα ίδια ποιότητα σε όλο το προϊόν. Το
 * **320** προστέθηκε για τις μικρογραφίες: η κεφαλίδα ακινήτου είναι 12rem = 192 CSS px ⇒ 384
 * σε οθόνη DPR 2. Χωρίς το 320 ο browser θα κατέβαζε 640 για κουτί 192.
 */

// ⚠️ ΜΟΝΟ τύπος: το `public-shelf-encoding` κάνει `import 'server-only'`. Η εισαγωγή τύπου σβήνεται
//    στη μεταγλώττιση, άρα αυτό το αρχείο μένει client-safe. Η **συνταγή** (που χρειάζεται τις τιμές
//    `shelfRecipe`/`FRAMING_AS_GIVEN`) ζει στον παραγωγό, `server/files/image-preview-recipe`.
import type { RasterShelfEncoding } from '@/services/upload/utils/public-shelf-encoding';

import { RASTER_IMAGE_TYPES, isRasterImageContentType } from '@/lib/images/image-dimensions';

/** Η κωδικοποίηση των προεπισκοπήσεων — **ο ίδιος** τύπος με το δημόσιο ράφι. */
export const FILE_PREVIEW_ENCODING: RasterShelfEncoding = {
  kind: 'raster',
  widths: [320, 640, 1280, 2560],
  quality: 82,
  preset: 'photo',
};

/**
 * **Πόσο σκληρά ψάχνει ο κωδικοποιητής** στις προεπισκοπήσεις — η προεπιλογή του libwebp.
 *
 * 🔑 Το ράφι χρησιμοποιεί 6 επειδή κωδικοποιεί **μία** φορά ανά δημοσίευση. Εδώ η κωδικοποίηση
 * γίνεται **μέσα στο αίτημα** του ανθρώπου που περιμένει: το 4 δίνει ~ίδιο μέγεθος σε κλάσμα
 * του χρόνου. Μπαίνει στη συνταγή ⇒ αλλαγή του ακυρώνει αυτόματα κάθε ETag.
 */
export const FILE_PREVIEW_EFFORT = 4;

/** Το πλάτος που δίνει το `src` όταν ο browser δεν διαβάζει `srcset`. */
export const FILE_PREVIEW_FALLBACK_WIDTH = 1280;

/** Η παράμετρος του proxy που ζητά παράγωγο αντί για πρωτότυπο. */
export const FILE_PREVIEW_WIDTH_QUERY_PARAM = 'w';

/**
 * **Τύποι που προεπισκοπούνται** = οι raster τύποι που αποκωδικοποιεί η πλατφόρμα — **ο ίδιος** κατάλογος με τη μέτρηση
 * διαστάσεων (`lib/images/image-dimensions`, ADR-899 §3.7): ό,τι μετριέται προεπισκοπείται, και αντίστροφα.
 */
export const PREVIEWABLE_IMAGE_TYPES: ReadonlySet<string> = RASTER_IMAGE_TYPES;

export function isPreviewableContentType(contentType: unknown): boolean {
  return isRasterImageContentType(contentType);
}

export function isFilePreviewWidth(value: number): boolean {
  return FILE_PREVIEW_ENCODING.widths.includes(value);
}

/** Η ωμή τιμή του query (`'640'`) ⇒ πλάτος της κλίμακας ή `null` (κανονική μορφή: ψηφία χωρίς αρχικό μηδέν). */
export function filePreviewWidthOf(raw: string): number | null {
  if (!/^[1-9]\d{0,4}$/.test(raw)) return null;
  const width = Number(raw);
  return isFilePreviewWidth(width) ? width : null;
}

/** Η έκβαση της επιλογής βαθμίδας: πλάτος της κλίμακας, ή «μόνο το πρωτότυπο αρκεί». */
export type FilePreviewChoice = number | 'original';

/**
 * **Η κλίμακα αυτού του αρχείου** — έως την **πρώτη** βαθμίδα που καλύπτει το πλάτος του πρωτοτύπου (ADR-899 §3.7, Π2).
 *
 * 🔑 Ο κωδικοποιητής **ποτέ** δεν μεγεθύνει: για πρωτότυπο 1.183 px τα `w=1280` και `w=2560` δίνουν **τα ίδια** bytes.
 * Μια βαθμίδα πάνω από την πρώτη επαρκή είναι άρα αίτημα, κλειδί cache και κωδικοποίηση **για το τίποτα**.
 * Χωρίς γνωστό πλάτος ⇒ ολόκληρη η κλίμακα (καμία επινοημένη διάσταση).
 */
export function previewWidthsFor(intrinsicWidth: number | null | undefined): readonly number[] {
  const widths = FILE_PREVIEW_ENCODING.widths;
  if (typeof intrinsicWidth !== 'number' || !(intrinsicWidth > 0)) return widths;
  const covering = widths.findIndex((width) => width >= intrinsicWidth);
  return covering === -1 ? widths : widths.slice(0, covering + 1);
}

/**
 * **Το πλάτος που ΠΡΑΓΜΑΤΙΚΑ παράγεται** για αίτημα `requested` — η κανονική μορφή του κλειδιού στον server.
 * `requested` πάνω από την πρώτη επαρκή βαθμίδα ⇒ εκείνη (ίδια bytes, **ένα** κλειδί, **μία** κωδικοποίηση).
 */
export function effectivePreviewWidth(requested: number, intrinsicWidth: number | null | undefined): number {
  const widths = previewWidthsFor(intrinsicWidth);
  return Math.min(requested, widths[widths.length - 1]);
}

/**
 * **Ποια βαθμίδα αρκεί για `neededDevicePx` pixel συσκευής;** — η **μικρότερη** που τα καλύπτει.
 *
 * 🔑 Πιο έξυπνο από το «zoom ⇒ πρωτότυπο» των περισσότερων viewers (Immich, PhotoPrism): σε 2× zoom πάνελ
 * 600 px με DPR 2 χρειάζονται 2.400 ⇒ αρκεί το `w=2560` (εκατοντάδες KB), όχι ένα πρωτότυπο 8 MB. Το πρωτότυπο
 * ζητείται **μόνο** όταν η ανάγκη ξεπερνά την κορυφή της κλίμακας — ή, με γνωστό πλάτος, το **ίδιο το πρωτότυπο**: τότε
 * κανένα παράγωγο δεν έχει περισσότερα pixel, και τα αληθινά έρχονται χωρίς ξανασυμπίεση (γραμμές κάτοψης png).
 */
export function filePreviewWidthFor(neededDevicePx: number, intrinsicWidth?: number | null): FilePreviewChoice {
  const needed = Number.isFinite(neededDevicePx) ? neededDevicePx : Number.POSITIVE_INFINITY;
  if (typeof intrinsicWidth === 'number' && intrinsicWidth > 0 && needed > intrinsicWidth) return 'original';
  return previewWidthsFor(intrinsicWidth).find((width) => width >= needed) ?? 'original';
}
