/**
 * @fileoverview **ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΟΥ ΣΥΡΜΑΤΟΣ** της «Δημοσίευσης κάτοψης» — ό,τι οφείλουν να ξέρουν **και** η πόρτα **και** ο πελάτης.
 * @related ADR-909 §6.1 (η πόρτα) · §6.2 (ο πελάτης του viewer) · app/api/properties/[id]/floorplan/route
 * @module lib/listings/floorplan-publication-contract
 *
 * | τι | ποιος το γράφει | ποιος το διαβάζει |
 * |---|---|---|
 * | τα **τρία** πεδία του multipart | ο πελάτης | η πόρτα |
 * | τύπος και ταβάνι των bytes | — | και οι δύο *(ο πελάτης αρνείται **πριν** ανεβάσει 20 MB)* |
 * | οι **κωδικοί άρνησης** | η πόρτα | ο διάλογος, που οφείλει ανθρώπινο μήνυμα για **καθέναν** |
 *
 * 🔑 **Κλειστή λίστα κωδικών**: ο διάλογος μεταφράζει **κάθε** άρνηση σε μήνυμα στη γλώσσα του ανθρώπου. Κωδικός
 * που θα γεννιόταν στην πόρτα χωρίς να μπει εδώ θα έφτανε στην οθόνη ως «κάτι πήγε στραβά» — η άγκυρα
 * `floorplan-publication-contract.test` διαβάζει την **πηγή** της πόρτας και το πιάνει.
 *
 * ⛔ **Καθαρό module** — καμία I/O, καμία εξάρτηση διακομιστή: εισάγεται και από τον browser.
 */

/** Τα ονόματα των πεδίων του multipart. Ο browser δεν στέλνει **τίποτε άλλο** (ADR-845 §7.17 Α4). */
export const FLOORPLAN_UPLOAD_FIELDS = { file: 'file', levelId: 'levelId', recipe: 'recipe' } as const;

/** Ο τύπος περιεχομένου που γεννά ο viewer. Η πόρτα δέχεται **μόνο** αυτόν. */
export const FLOORPLAN_CONTENT_TYPE = 'image/png';

/**
 * Το ταβάνι μεγέθους της εικόνας που δέχεται η πόρτα.
 *
 * ⚠️ **Όχι το `FILE_TYPE_CONFIG.image.maxSize` (5 MB)**: εκείνο είναι όριο **ανεβάσματος φωτογραφίας από
 * άνθρωπο**. Εδώ φτάνει PNG υψηλής ανάλυσης από τη μηχανή εκτύπωσης, που το ράφι θα ξαναψήσει σε webp.
 */
export const FLOORPLAN_MAX_BYTES = 20 * 1024 * 1024;

/** **Κάθε** λόγος για τον οποίο η πόρτα αρνείται — με όνομα, ποτέ «κάτι πήγε στραβά». */
export const FLOORPLAN_REFUSAL_CODES = [
  // Το σώμα της αίτησης.
  'FLOORPLAN_LEVEL_REQUIRED',
  'FLOORPLAN_FILE_REQUIRED',
  'FLOORPLAN_TYPE_UNSUPPORTED',
  'FLOORPLAN_FILE_EMPTY',
  'FLOORPLAN_FILE_TOO_LARGE',
  // Η συνταγή απόδοσης.
  'FLOORPLAN_RECIPE_INVALID',
  'FLOORPLAN_PROFILE_UNKNOWN',
  'FLOORPLAN_PROFILE_STALE',
  'FLOORPLAN_BYTES_MISMATCH',
  // Το επίπεδο και ο δεσμός του με το ακίνητο.
  'FLOORPLAN_LEVEL_NOT_FOUND',
  'FLOORPLAN_LEVEL_UNPLACED',
  'FLOORPLAN_LEVEL_NOT_OF_PROPERTY',
  'FLOORPLAN_LEVEL_WITHOUT_DRAWING',
  'FLOORPLAN_SOURCE_UNREADABLE',
  // Η δημοσίευση.
  'FLOORPLAN_PUBLICATION_NOT_CAPABLE',
  'FLOORPLAN_SHELF_FULL',
  'FLOORPLAN_UPLOAD_FAILED',
] as const;

export type FloorplanRefusalCode = (typeof FLOORPLAN_REFUSAL_CODES)[number];

const REFUSAL_CODES: ReadonlySet<string> = new Set(FLOORPLAN_REFUSAL_CODES);

/** Είναι αυτό που έστειλε ο διακομιστής **δικός μας** κωδικός άρνησης; */
export function isFloorplanRefusalCode(value: unknown): value is FloorplanRefusalCode {
  return typeof value === 'string' && REFUSAL_CODES.has(value);
}
