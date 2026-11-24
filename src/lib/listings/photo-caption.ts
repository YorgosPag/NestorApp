/**
 * @fileoverview **«ΤΙ ΔΕΙΧΝΕΙ ΑΥΤΗ Η ΕΙΚΟΝΑ;»** — η λεζάντα μιας φωτογραφίας αγγελίας, η μία απάντηση.
 * @related ADR-880 (`photo-focal-point`) · ADR-897 (`photo-capture-spot`) — οι αδελφές δηλώσεις, ίδιο κανάλι ·
 *   lib/listings/declared-file-map · services/listings/public-listing-gallery-projection (ο ένας γραφέας)
 * @module lib/listings/photo-caption
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΡΙΤΗ ΔΗΛΩΣΗ ΑΝΑ ΦΩΤΟΓΡΑΦΙΑ — ΙΔΙΟ ΚΑΝΑΛΙ, ΚΑΝΕΝΑ ΝΕΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το σημείο εστίασης λέει *«πού είναι το θέμα»*· το σημείο λήψης *«πού στεκόταν η κάμερα»*· αυτό εδώ *«**τι** είναι το
 * θέμα»*. Ίδιο είδος γνώσης *(ανθρώπινη δήλωση ανά φωτογραφία, δεμένη στο `FileRecord.id`, ποτέ στη θέση)* ⇒ ίδιος
 * κύκλος ζωής: δίπλα στη δήλωση της αγγελίας → `PublicShelfSource` → `withPublishedGallery` → `ListingImage.caption`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΔΥΟ ΣΤΡΩΜΑΤΑ, ΟΠΩΣ ΤΟ ΠΡΟΤΥΠΟ RESO (`ImageOf` + περιγραφή)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **`subject`** — *είδος* από **κλειστό** λεξιλόγιο ({@link PHOTO_SUBJECTS}). Το κοινό το διαβάζει **στη γλώσσα του**:
 *    η τιμή είναι ταυτότητα, η ετικέτα ζει στα locales. Κάνει και την εικόνα **αναζητήσιμη/ομαδοποιήσιμη**.
 * 2. **`text`** — ελεύθερο κείμενο **του ανθρώπου**, σύντομο. Δεδομένο, όχι διεπαφή (N.11): **δεν** μεταφράζεται.
 *
 * Τουλάχιστον **ένα** από τα δύο· λεζάντα χωρίς τίποτα **δεν υπάρχει** (`null`), και η οθόνη τότε **σιωπά** — ποτέ όνομα
 * αρχείου, ποτέ μαντεψιά περιεχομένου.
 *
 * ⛔ **ΟΧΙ το `FileRecord.description`**: εκείνο είναι **ιδιωτική σημείωση** του φακέλου. Αν γινόταν λεζάντα, ό,τι
 * έγραψε κάποιος για δική του χρήση θα έφευγε στο κοινό. Η λεζάντα ανήκει στη **χρήση** *(η ίδια φωτογραφία λέγεται
 * αλλιώς στην πώληση και αλλιώς στην ενοικίαση)* — το σκεπτικό του `publishedFileFocalPoints`.
 *
 * ⚠️ **Καθαρό module** — καμία εξάρτηση από React ή Firestore.
 */

import { z } from 'zod';

import { readDeclaredFileMap, sameDeclaredFileMap, withDeclaredFileEntry } from './declared-file-map';

// ============================================================================
// 1. ΤΟ ΛΕΞΙΛΟΓΙΟ — η λίστα είναι η πηγή, ο τύπος ΠΑΡΑΓΕΤΑΙ
// ============================================================================

/**
 * **Τι μπορεί να δείχνει μια εικόνα αγγελίας.**
 *
 * 🔑 **Ομαδοποιημένα, και η σειρά είναι η σειρά του επιλογέα**: το ακίνητο και ο τόπος του → εσωτερικοί χώροι → σχέδια
 * και χάρτες. Η ομάδα `documents` είναι και η απάντηση στο «είναι αυτή η εικόνα φωτογραφία του ακινήτου;».
 * ⛔ **Χωρίς «Άλλο»**: η απουσία είδους **είναι** το «άλλο» (`subject: null` + ελεύθερο κείμενο) — μια τιμή-μπαλαντέρ
 * θα τύπωνε τη λέξη «Άλλο» κάτω από φωτογραφία, δηλαδή λεζάντα που δεν λέει τίποτα.
 */
export const PHOTO_SUBJECT_GROUPS = {
  /** Το ακίνητο από έξω και ο τόπος του. */
  site: [
    'exterior', 'plot', 'street', 'surroundings', 'view', 'aerial',
    'entrance', 'garden', 'balcony', 'parking', 'pool', 'commonAreas',
  ],
  /** Εσωτερικοί χώροι. */
  interior: ['livingRoom', 'kitchen', 'diningRoom', 'bedroom', 'bathroom', 'office', 'hallway', 'storage', 'interior'],
  /** Σχέδια, διαγράμματα, χάρτες — εικόνες που **δεν** είναι φωτογραφία του ακινήτου. */
  documents: ['survey', 'cityPlan', 'implementationAct', 'locationMap', 'drawing'],
} as const;

/** Μια ομάδα του επιλογέα — δες {@link PHOTO_SUBJECT_GROUPS}. */
export type PhotoSubjectGroup = keyof typeof PHOTO_SUBJECT_GROUPS;

/** Όλα τα είδη, στη σειρά των ομάδων — **παράγεται**, ώστε είδος εκτός ομάδας να μην μπορεί να υπάρξει. */
export const PHOTO_SUBJECTS = [
  ...PHOTO_SUBJECT_GROUPS.site,
  ...PHOTO_SUBJECT_GROUPS.interior,
  ...PHOTO_SUBJECT_GROUPS.documents,
] as const;

/** Δες {@link PHOTO_SUBJECTS}. **Κλειστή ένωση, ποτέ `string`.** */
export type PhotoSubject = (typeof PHOTO_SUBJECTS)[number];

const DOCUMENT_SUBJECTS: readonly PhotoSubject[] = PHOTO_SUBJECT_GROUPS.documents;

/**
 * **Είναι αυτή η εικόνα σχέδιο ή χάρτης, και όχι φωτογραφία του ακινήτου;** — η μία κρίση για τον χωρισμό της συλλογής.
 * Χωρίς λεζάντα ή χωρίς είδος ⇒ `false`: ό,τι δεν δηλώθηκε ως σχέδιο μένει στις φωτογραφίες (ποτέ μαντεψιά).
 */
export function isDocumentCaption(caption: PhotoCaption | null): boolean {
  return caption !== null && caption.subject !== null && DOCUMENT_SUBJECTS.includes(caption.subject);
}

/** Το όριο του ελεύθερου κειμένου — μία γραμμή κάτω από μικρογραφία, όχι παράγραφος (η περιγραφή έχει δικό της πεδίο). */
export const PHOTO_CAPTION_TEXT_MAX = 120;

// ============================================================================
// 2. Η ΛΕΖΑΝΤΑ
// ============================================================================

/**
 * Η λεζάντα — **ίδιο σχήμα** στη δήλωση του ανθρώπου και στο δημόσιο έγγραφο: δεν περιέχει καμία εσωτερική ταυτότητα,
 * άρα δεν χρειάζεται δεύτερη «δημόσια μορφή» (αντίθετα με το σημείο λήψης, που κουβαλά `floorplanFileId`).
 */
export interface PhotoCaption {
  readonly subject: PhotoSubject | null;
  readonly text: string | null;
}

/** Κενά στις άκρες και πολλαπλά κενά ⇒ ένα· κενό αποτέλεσμα ⇒ `null`. Η **μία** κανονικοποίηση του κειμένου. */
function normaliseCaptionText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const collapsed = value.replace(/\s+/g, ' ').trim();
  return collapsed === '' ? null : collapsed;
}

/**
 * Το σχήμα της **πόρτας** (φόρμα κατόχου, PATCH γραφείου) — αυστηρό: σκουπίδι απορρίπτεται, και λεζάντα **χωρίς**
 * είδος **και** χωρίς κείμενο δεν είναι λεζάντα (η γραμμή οφείλει να **λείπει**, όχι να υπάρχει άδεια).
 */
export const photoCaptionSchema = z
  .object({
    subject: z.enum(PHOTO_SUBJECTS).nullable(),
    text: z.string().trim().min(1).max(PHOTO_CAPTION_TEXT_MAX).nullable(),
  })
  .strict()
  .refine((value) => value.subject !== null || value.text !== null, { message: 'empty caption' });

const fileId = z.string().trim().min(1).max(128);

/** Το σχήμα του **χάρτη** `photoFileId → λεζάντα` στην πόρτα. */
export function declaredCaptionsSchema(limit: number) {
  return z
    .record(fileId, photoCaptionSchema)
    .refine((value) => Object.keys(value).length <= limit, { message: `at most ${limit} captions` });
}

/**
 * **Η λεζάντα από ό,τι έγραψε ο άνθρωπος στη φόρμα** — ή `null` όταν δεν έμεινε τίποτα να ειπωθεί.
 * Το κείμενο κανονικοποιείται και **κόβεται** στο όριο· άγνωστο είδος πέφτει σε `null`.
 */
export function photoCaptionOf(subject: PhotoSubject | null, text: string | null): PhotoCaption | null {
  const cleanText = normaliseCaptionText(text)?.slice(0, PHOTO_CAPTION_TEXT_MAX).trim() ?? null;
  return subject === null && cleanText === null ? null : { subject, text: cleanText };
}

/**
 * **Η μία ανάγνωση αποθηκευμένης λεζάντας** — ποτέ δεν πετά. Άκυρο ⇒ `null` («κανείς δεν δήλωσε»).
 *
 * 🔑 Διαβάζει **και** τη δήλωση **και** το δημόσιο έγγραφο (ίδιο σχήμα): το δημόσιο έγγραφο διαβάζεται **ρηχά**
 * (`public-listing-schema`), άρα ο αναγνώστης δεν δανείζεται την εμπιστοσύνη του γραφέα.
 */
export function readPhotoCaption(value: unknown): PhotoCaption | null {
  const parsed = photoCaptionSchema.safeParse(value);
  if (!parsed.success) return null;
  return { subject: parsed.data.subject, text: parsed.data.text };
}

/**
 * **Δηλωμένες λεζάντες ανά φωτογραφία** (`FileRecord.id` → λεζάντα) — ωμό πεδίο εγγράφου.
 * Άκυρη γραμμή πέφτει **μόνη της** — δεν ακυρώνει τις άλλες (ίδια πειθαρχία με το `readDeclaredFocalPoints`).
 */
export function readDeclaredCaptions(value: unknown): ReadonlyMap<string, PhotoCaption> {
  return readDeclaredFileMap(value, readPhotoCaption);
}

/** Ίδια λεζάντα; — για ισότητα δηλώσεων (αισιόδοξη ενημέρωση), όχι για απόδοση. */
function sameCaption(a: PhotoCaption, b: PhotoCaption): boolean {
  return a.subject === b.subject && a.text === b.text;
}

/** Ίδιες δηλώσεις; — ίδιο σύνολο φωτογραφιών, ίδια λεζάντα η καθεμιά (η σειρά αδιάφορη). */
export function sameDeclaredCaptions(
  a: ReadonlyMap<string, PhotoCaption>,
  b: ReadonlyMap<string, PhotoCaption>,
): boolean {
  return sameDeclaredFileMap(a, b, sameCaption);
}

/** Μία λεζάντα αλλαγμένη μέσα στη δήλωση — νέος χάρτης, ποτέ μετάλλαξη. `null` ⇒ η γραμμή **φεύγει**. */
export function withDeclaredCaption(
  declared: ReadonlyMap<string, PhotoCaption>,
  photoFileId: string,
  caption: PhotoCaption | null,
): ReadonlyMap<string, PhotoCaption> {
  return withDeclaredFileEntry(declared, photoFileId, caption);
}
