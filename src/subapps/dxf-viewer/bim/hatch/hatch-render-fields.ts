/**
 * ADR-507 — HATCH flat RENDER-FIELD contract (**anti-drift SSoT**· αδελφός του ADR-557 για TEXT).
 *
 * Η **ΜΙΑ** λίστα των hatch-specific πεδίων που κουβαλούν κατάσταση απόδοσης/αλληλεπίδρασης
 * (πέρα από το κοινό base id/layer/color/lineweight). **ΚΑΘΕ** προβολή που περνά μια
 * γραμμοσκίαση μέσα στο render pipeline αντιγράφει **ΑΚΡΙΒΩΣ** αυτή τη λίστα:
 *   - `hooks/canvas/dxf-scene-entity-handlers.ts` — scene `HatchEntity` → flat `DxfHatch`.
 *   - `canvas-v2/dxf-canvas/dxf-renderer-entity-model.ts` — `DxfHatch` → render `EntityModel`.
 *
 * ## 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (μετρημένο· **έξι** περιστατικά της ΙΔΙΑΣ κλάσης)
 *
 * Τα δύο παραπάνω σημεία κρατούσαν το καθένα τη **δική του χειρόγραφη λίστα** πεδίων (και ο
 * τύπος `DxfHatch` μια τρίτη). Κάθε νέα ιδιότητα γραμμοσκίασης απαιτούσε επεξεργασία **τριών**
 * λιστών· ξεχνώντας **μία** → η ιδιότητα γραφόταν κανονικά στη σκηνή/Firestore αλλά ο
 * `HatchRenderer` **δεν την έβλεπε ποτέ**. Το ιστορικό είναι γραμμένο στα ίδια τα σχόλια που
 * αντικατέστησε αυτό το module:
 *
 * | Πεδίο | Τι έσπασε ώσπου προστέθηκε |
 * |---|---|
 * | `backgroundColor` | ο Τέκτων έχανε το λευκό φόντο — «μόνο γραμμές» |
 * | `patternSpace`    | το raster μοτίβο έπεφτε σε world-space |
 * | `gradient`        | κάθε gradient γραμμοσκίαση αποδιδόταν **solid** |
 * | `imageFill`       | κάθε image fill αποδιδόταν **solid** |
 * | `lineweightMm`    | αγνοούνταν το πάχος → πάντα DEFAULT |
 * | **`inlinePattern`** | **ο πρωτότυπος ορισμός AutoCAD δεν έφτανε ΠΟΤΕ στον renderer** ⇒ ο resolver έπεφτε στον catalog ⇒ βήμα **6–63 m** αντί 250 mm ⇒ **αόρατες γραμμοσκιάσεις** (Giorgio, `47_ergasia.dxf`) |
 *
 * Το τελευταίο κόστισε πολλαπλές συνεδρίες, επειδή **όλα τα ενδιάμεσα ήταν σωστά**: ο parser
 * διάβαζε το μοτίβο, το Firestore το αποθήκευε, το scene entity το είχε — χανόταν **μόνο** στον
 * τελευταίο κρίκο πριν τον καμβά. Γι' αυτό οι έλεγχοι import/round-trip ήταν πράσινοι.
 *
 * **Πλέον: πρόσθεσε πεδίο ΕΔΩ (+ στον `HatchEntity`/`DxfHatch`) και ΟΛΕΣ οι προβολές το
 * μεταφέρουν.** Ο contract test (`__tests__/hatch-render-fields.test.ts`) κοκκινίζει αν κάποια
 * προβολή ρίξει έστω ένα πεδίο της λίστας ⇒ **η κλάση του bug δεν μπορεί να επιστρέψει σιωπηλά.**
 *
 * Import-time pure: μηδέν React / DOM / THREE / Firestore εξαρτήσεις.
 *
 * @module bim/hatch/hatch-render-fields
 * @see bim/text/text-render-fields.ts — ο αδελφός SSoT για TEXT/MTEXT (ADR-557), ίδιο ιδίωμα
 */

import type { HatchEntity } from '../../types/entities';

/**
 * Τα hatch-specific πεδία που κουβαλούν κατάσταση απόδοσης + αλληλεπίδρασης. Το `boundaryPaths`
 * είναι πάντα παρόν· τα υπόλοιπα είναι optional (αντιγράφονται μόνο όταν έχουν τιμή).
 *
 * 🚫 **Εκτός λίστας ΕΠΙΤΗΔΕΣ:** το `seedPoints` (δεδομένο προέλευσης AutoCAD — κανένας
 * renderer/geometry resolver δεν το διαβάζει· persist-άρεται χωριστά από το `pickHatchData`)
 * και το `associative`/`gapTolerance` (μεταδεδομένα συσχέτισης ορίου, όχι απόδοσης).
 * Αν κάποτε γίνουν render state, **προστίθενται εδώ** — όχι σε μία μόνο προβολή.
 */
export const HATCH_RENDER_FIELDS = [
  'boundaryPaths',
  'fillType',
  'fillColor',
  'patternType',
  'patternName',
  'patternScale',
  'patternAngle',
  'patternOrigin',
  'lineAngle',
  'lineSpacing',
  'doubleCrossHatch',
  'patternSpace',
  'islandStyle',
  'gradient',
  'imageFill',
  'backgroundColor',
  'drawOrder',
  'lineweightMm',
  // ADR-644 #7d / ADR-647 Φ1 — ο ΠΡΩΤΟΤΥΠΟΣ ορισμός μοτίβου του πηγαίου DXF. Ο
  // `buildHatchEntitySegments` τον προτιμά έναντι του catalog· χωρίς αυτόν τον κρίκο κάθε
  // εισαγόμενη γραμμοσκίαση αποδίδεται με **άλλο μοτίβο και άλλη πυκνότητα** από το AutoCAD.
  'inlinePattern',
] as const satisfies readonly (keyof HatchEntity)[];

export type HatchRenderField = (typeof HATCH_RENDER_FIELDS)[number];

/**
 * Αντιγράφει ακριβώς τα {@link HATCH_RENDER_FIELDS} που υπάρχουν (non-`undefined`) από μια πηγή
 * hatch σε ένα partial. Τα απόντα optionals **ΠΑΡΑΛΕΙΠΟΝΤΑΙ** (ποτέ ως κλειδιά με τιμή
 * `undefined` → Firestore-safe, και byte-ισοδύναμο με τις προηγούμενες χειρόγραφες απαριθμήσεις).
 * Αυτό είναι ΤΟ γενικό passthrough που χρησιμοποιούν οι προβολές scene→`DxfHatch` και
 * `DxfHatch`→`EntityModel` αντί να απαριθμούν πεδία η καθεμιά μόνη της.
 */
export function pickHatchRenderFields(source: Partial<HatchEntity>): Partial<HatchEntity> {
  const out: Record<string, unknown> = {};
  for (const field of HATCH_RENDER_FIELDS) {
    const value = (source as Record<string, unknown>)[field];
    if (value !== undefined) out[field] = value;
  }
  return out as Partial<HatchEntity>;
}
