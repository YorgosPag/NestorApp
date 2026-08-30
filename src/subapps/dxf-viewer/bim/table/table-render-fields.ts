/**
 * ADR-833 §3.1 — TABLE flat RENDER-FIELD contract (**anti-drift SSoT**· τέταρτος αδελφός των
 * ADR-557 για TEXT, ADR-507 για HATCH και ADR-736 για IMAGE).
 *
 * Η **ΜΙΑ** λίστα των table-specific πεδίων που κουβαλούν κατάσταση απόδοσης (πέρα από το
 * κοινό base id/layer/color/lineweight). **ΚΑΘΕ** προβολή που περνά έναν πίνακα μέσα στο render
 * pipeline αντιγράφει **ΑΚΡΙΒΩΣ** αυτή τη λίστα:
 *   - `hooks/canvas/dxf-scene-entity-handlers.ts` — scene `TableEntity` → flat `DxfTable`.
 *   - `canvas-v2/dxf-canvas/dxf-renderer-entity-model.ts` — `DxfTable` → render `EntityModel`.
 *
 * ...και ο **ίδιος ο τύπος** `DxfTable` (`canvas-v2/dxf-canvas/dxf-types.ts`) **παράγεται** από
 * εδώ με `Pick`, αντί να απαριθμεί τα ίδια πεδία τρίτη φορά.
 *
 * ## 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (η ίδια κλάση, **ένατο** περιστατικό — προληπτικά αυτή τη φορά)
 *
 * Τα δύο παραπάνω σημεία κρατούσαν το καθένα τη **δική του χειρόγραφη λίστα** πεδίων, και ο
 * τύπος `DxfTable` μια τρίτη. Τρία αντίγραφα της ίδιας απάντησης, κανένα δεμένο με τα άλλα.
 *
 * Η κλάση είναι **μετρημένη**: η ADR-736 §2.Β πρόσθεσε το `sourcePath` στο `ImageEntity`, στο
 * σημείο εγγραφής και στον `ImageRenderer` — και **32/32 tests πέρασαν** ενώ στην οθόνη το πεδίο
 * δεν έφτανε ποτέ, γιατί κανένα test δεν διέσχιζε αυτά τα δύο περάσματα. Το ίδιο σχήμα το
 * τεκμηριώνει **έξι** φορές το `hatch-render-fields.ts` και άλλη μία το `text-render-fields.ts`.
 *
 * Ο πίνακας είναι ο **επόμενος στη σειρά** και το ξέρουμε πριν συμβεί: το ADR-833 προσθέτει
 * `worksheets` + `activeWorksheetId` στο `TableEntity`. Με τις τρεις χειρόγραφες λίστες, τα νέα
 * πεδία θα γράφονταν σωστά στη σκηνή και θα **έπεφταν σιωπηλά** πριν τον ζωγράφο ⇒ οι καρτέλες
 * φύλλων θα ζωγραφίζονταν σε κάποιες διαδρομές και σε άλλες όχι, διακοπτόμενα, με πράσινα tests.
 * **Ένα σχόλιο δεν είναι μηχανισμός.**
 *
 * **Πλέον: πρόσθεσε πεδίο ΕΔΩ (+ στον `TableEntity`) και ΟΛΕΣ οι προβολές το μεταφέρουν.** Ο
 * contract test (`__tests__/table-render-fields.test.ts`) κοκκινίζει αν κάποια προβολή ρίξει
 * έστω ένα πεδίο ⇒ **η κλάση δεν μπορεί να επιστρέψει σιωπηλά.**
 *
 * Import-time pure: μηδέν React / DOM / THREE / Firestore εξαρτήσεις.
 *
 * @see bim/table/table-worksheet-resolve.ts — γιατί τα φύλλα περνούν **λυμένα** σε αυτό το σύνορο
 *
 * @module bim/table/table-render-fields
 * @see bim/image/image-render-fields.ts — ο αδελφός SSoT για IMAGE (ADR-736), ίδιο ιδίωμα
 * @see bim/hatch/hatch-render-fields.ts — ο αδελφός SSoT για HATCH (ADR-507)
 * @see bim/text/text-render-fields.ts — ο αδελφός SSoT για TEXT/MTEXT (ADR-557)
 */

import { resolveWorksheetFields } from './table-worksheet-resolve';
import type { TableEntity } from '../../types/table-entity';

/**
 * Τα table-specific πεδία που κουβαλούν κατάσταση **απόδοσης**. Τα `position`/`angleRad`/
 * `styleId`/`worksheets`/`activeWorksheetId` είναι πάντα παρόντα· τα υπόλοιπα optional
 * (αντιγράφονται μόνο όταν έχουν τιμή).
 *
 * ✅ **ADR-833 Φάση 2 — ΤΟ ΣΗΜΕΙΟ ΓΙΑ ΤΟ ΟΠΟΙΟ ΓΡΑΦΤΗΚΕ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ.** Η μετάβαση
 * `model`/`binding` → `worksheets`/`activeWorksheetId` άλλαξε **αυτή τη λίστα και μόνο**: οι δύο
 * προβολές και ο τύπος `DxfTable` ακολούθησαν χωρίς να τους αγγίξει κανείς. Με τις τρεις
 * χειρόγραφες λίστες που υπήρχαν πριν τη Φάση 0, θα ήταν τρεις χωριστές αλλαγές, και η
 * παράλειψη οποιασδήποτε θα περνούσε με **πράσινα tests**.
 *
 * ⚠️ Το `binding` **δεν λείπει από παράβλεψη**: μετακόμισε **μέσα** στο φύλλο
 * (`TableWorksheet.binding`, ADR-833 §5.2), άρα ταξιδεύει ήδη μέσα στο `worksheets`. Δύο
 * κληρονόμοι θα ήταν δύο απαντήσεις στο «σε τι είναι δεμένος αυτός ο πίνακας».
 *
 * 🚫 **Εκτός λίστας ΕΠΙΤΗΔΕΣ** — το `geometry`: είναι **παράγωγη** μνήμη (`computeTableEntityGeometry`),
 * ξαναφτιάχνεται στην απόδοση μέσω `computeTableEntityGeometryLive` (απομνημονευμένη) και δεν
 * επιβιώνει καν του JSON round-trip. Το να ταξιδέψει θα σήμαινε **δύο** απαντήσεις στο «πού είναι
 * ο πίνακας» — η μία μπαγιάτικη. Ίδια στάση με τα `intrinsicWidth`/`externalRefId` του IMAGE.
 */
export const TABLE_RENDER_FIELDS = [
  'position',
  'angleRad',
  'styleId',
  'worksheets',
  'activeWorksheetId',
  'breaking',
] as const satisfies readonly (keyof TableEntity)[];

/** Το όνομα ενός πεδίου του συμβολαίου — η πηγή του `Pick` που παράγει τον τύπο `DxfTable`. */
export type TableRenderField = (typeof TABLE_RENDER_FIELDS)[number];

/**
 * Αντιγράφει ακριβώς τα {@link TABLE_RENDER_FIELDS} που υπάρχουν (non-`undefined`) από μια πηγή
 * πίνακα σε ένα partial. Τα απόντα optionals **ΠΑΡΑΛΕΙΠΟΝΤΑΙ** (ποτέ ως κλειδιά με τιμή
 * `undefined` → Firestore-safe, και byte-ισοδύναμο με τις προηγούμενες χειρόγραφες απαριθμήσεις).
 * Αυτό είναι ΤΟ γενικό passthrough που χρησιμοποιούν οι προβολές scene→`DxfTable` και
 * `DxfTable`→`EntityModel` αντί να απαριθμούν πεδία η καθεμιά μόνη της.
 */
export function pickTableRenderFields(source: Partial<TableEntity>): Partial<TableEntity> {
  // 🔴 ADR-833 Φάση 2 — τα φύλλα περνούν **ΛΥΜΕΝΑ**. Μια οντότητα της παλιάς μορφής δεν έχει
  // ούτε `worksheets` ούτε `activeWorksheetId`, και ο βρόχος από κάτω αντιγράφει **μόνο ό,τι
  // έχει τιμή** — άρα χωρίς αυτή τη γραμμή κάθε πίνακας γραμμένος πριν τη Φάση 2 θα έφτανε στον
  // ζωγράφο χωρίς κανένα σχήμα και θα ζωγραφιζόταν **άδειος**. Δες `resolveWorksheetFields`.
  const resolved: Record<string, unknown> = {
    ...source,
    ...resolveWorksheetFields(source as TableEntity),
  };
  const out: Record<string, unknown> = {};
  for (const field of TABLE_RENDER_FIELDS) {
    const value = resolved[field];
    if (value !== undefined) out[field] = value;
  }
  return out as Partial<TableEntity>;
}
