/**
 * ADR-736 §5.3 — IMAGE flat RENDER-FIELD contract (**anti-drift SSoT**· τρίτος αδελφός των
 * ADR-557 για TEXT και ADR-507 για HATCH).
 *
 * Η **ΜΙΑ** λίστα των image-specific πεδίων που κουβαλούν κατάσταση απόδοσης (πέρα από το
 * κοινό base id/layer/color/lineweight). **ΚΑΘΕ** προβολή που περνά μια εικόνα μέσα στο render
 * pipeline αντιγράφει **ΑΚΡΙΒΩΣ** αυτή τη λίστα:
 *   - `hooks/canvas/dxf-scene-entity-flat-handlers.ts` — scene `ImageEntity` → flat `DxfImage`.
 *   - `canvas-v2/dxf-canvas/dxf-renderer-entity-model.ts` — `DxfImage` → render `EntityModel`.
 *
 * ## 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (μετρημένο — το **όγδοο** περιστατικό της ίδιας κλάσης)
 *
 * Τα δύο παραπάνω σημεία κρατούσαν το καθένα τη **δική του χειρόγραφη λίστα** πεδίων (και ο
 * τύπος `DxfImage` μια τρίτη). Η ADR-736 §2.Β πρόσθεσε το `sourcePath` (πλήρης διαδρομή στο
 * πλαίσιο-κράτημα) στο `ImageEntity`, στο **ένα** σημείο εγγραφής και στον `ImageRenderer` —
 * και **32/32 tests πέρασαν**, γιατί κανένα δεν διέσχιζε αυτά τα δύο περάσματα. Στην οθόνη το
 * πλαίσιο έδειχνε ακόμη σκέτο `2.jpg`: η διαδρομή χανόταν **μετά** το σημείο εγγραφής και
 * **πριν** τον καμβά.
 *
 * Η υπογραφή του σφάλματος ήταν ότι το `sourceName` **φαινόταν** ενώ το `sourcePath` όχι —
 * δηλαδή η γέφυρα δούλευε και χανόταν *ένα* πεδίο. Το προηγούμενο πέρασμα είχε μάλιστα γράψει
 * ρητά στο ίδιο σημείο «*Τα ΔΥΟ μονοπάτια πρέπει να το περνούν*» για το `sourceName` — και το
 * επόμενο πεδίο ξεχάστηκε ούτως ή άλλως. **Ένα σχόλιο δεν είναι μηχανισμός.**
 *
 * Είναι ακριβώς το σχήμα που το `hatch-render-fields.ts` τεκμηριώνει **έξι** φορές
 * (backgroundColor / patternSpace / gradient / imageFill / lineweightMm / inlinePattern) και το
 * `text-render-fields.ts` άλλη μία. **Πλέον: πρόσθεσε πεδίο ΕΔΩ (+ στον `ImageEntity`/`DxfImage`)
 * και ΟΛΕΣ οι προβολές το μεταφέρουν.** Ο contract test (`__tests__/image-render-fields.test.ts`)
 * κοκκινίζει αν κάποια προβολή ρίξει έστω ένα πεδίο ⇒ **η κλάση δεν μπορεί να επιστρέψει σιωπηλά.**
 *
 * Import-time pure: μηδέν React / DOM / THREE / Firestore εξαρτήσεις.
 *
 * @module bim/image/image-render-fields
 * @see bim/hatch/hatch-render-fields.ts — ο αδελφός SSoT για HATCH (ADR-507), ίδιο ιδίωμα
 * @see bim/text/text-render-fields.ts — ο αδελφός SSoT για TEXT/MTEXT (ADR-557)
 */

import type { ImageEntity } from '../../types/image';

/**
 * Τα image-specific πεδία που κουβαλούν κατάσταση **απόδοσης**. Τα `position`/`width`/`height`
 * είναι πάντα παρόντα· τα υπόλοιπα optional (αντιγράφονται μόνο όταν έχουν τιμή).
 *
 * 🚫 **Εκτός λίστας ΕΠΙΤΗΔΕΣ** — δεν είναι render state, και κανένας καταναλωτής τους δεν ζει
 * στον καμβά (και οι τρεις διαβάζονται από τις **scene** οντότητες, όχι από το flat μοντέλο):
 * · `intrinsicWidth`/`intrinsicHeight` — «Επαναφορά Διαστάσεων» (`useImageDimensionRibbonAction`
 *   φιλτράρει το `scene.entities`)·
 * · `externalRefId` — η γέφυρα προς τη `DxfExternalReference`· την ακολουθεί το
 *   `applyExternalReferencesToEntities` πάνω στη σκηνή. Ο renderer είναι pure leaf και **δεν**
 *   βλέπει τη σκηνή — γι' αυτό ακριβώς ταξιδεύουν τα `sourceName`/`sourcePath` ως αντίγραφα·
 * · `dxfImageExport` — export-only marker που γεμίζει ο DXF pre-pass (ίδια στάση με το
 *   `seedPoints` του hatch: το `hatch-firestore-service` το αποκλείει κι εκείνο ρητά).
 *
 * Αν κάποτε **γίνουν** render state, προστίθενται **εδώ** — όχι σε μία μόνο προβολή.
 */
export const IMAGE_RENDER_FIELDS = [
  'position',
  'width',
  'height',
  'url',
  'rotation',
  // ADR-736 — το όνομα που ζητά η εικόνα. Χωρίς αυτό, μια ανεπίλυτη αναφορά ζωγραφίζεται ως
  // **ανώνυμο** πλαίσιο και ο χρήστης δεν μαθαίνει ποτέ ποιο αρχείο λείπει.
  'sourceName',
  // ADR-736 §2.Β — η πλήρης διαδρομή που δηλώνει το σχέδιο. Το πεδίο που έλειπε: γραφόταν
  // σωστά στη σκηνή, αλλά **καμία** από τις δύο προβολές δεν το μετέφερε ⇒ ο `ImageRenderer`
  // έπαιρνε πάντα `path: undefined` και έπεφτε στη βαθμίδα «μόνο όνομα» — σε **κάθε** zoom.
  'sourcePath',
] as const satisfies readonly (keyof ImageEntity)[];


/**
 * Αντιγράφει ακριβώς τα {@link IMAGE_RENDER_FIELDS} που υπάρχουν (non-`undefined`) από μια πηγή
 * εικόνας σε ένα partial. Τα απόντα optionals **ΠΑΡΑΛΕΙΠΟΝΤΑΙ** (ποτέ ως κλειδιά με τιμή
 * `undefined` → Firestore-safe, και byte-ισοδύναμο με τις προηγούμενες χειρόγραφες απαριθμήσεις).
 * Αυτό είναι ΤΟ γενικό passthrough που χρησιμοποιούν οι προβολές scene→`DxfImage` και
 * `DxfImage`→`EntityModel` αντί να απαριθμούν πεδία η καθεμιά μόνη της.
 */
export function pickImageRenderFields(source: Partial<ImageEntity>): Partial<ImageEntity> {
  const out: Record<string, unknown> = {};
  for (const field of IMAGE_RENDER_FIELDS) {
    const value = (source as Record<string, unknown>)[field];
    if (value !== undefined) out[field] = value;
  }
  return out as Partial<ImageEntity>;
}
