/**
 * ADR-750 Φ6 — **ο κατάλογος στυλ του listbox «Μορφοποίηση κελιών → Περίγραμμα»**.
 *
 * Καθαρά δεδομένα + μία καθαρή σύνθεση: μηδέν React, μηδέν i18n, μηδέν κατάσταση.
 *
 * ## 🔑 Τα «στυλ» του Excel είναι ΠΡΟΕΠΙΛΟΓΕΣ, όχι νέο πεδίο του μοντέλου
 * Το Excel εκθέτει ένα **κλειστό πλέγμα 13 προκατασκευασμένων συνδυασμών** επειδή δεν έχει
 * τίποτα άλλο: το `.xlsx` γράφει `<border style="mediumDashDot">`, δηλαδή το μοτίβο και το
 * πάχος είναι **μία αδιαίρετη λέξη**. Ο Νέστωρ έχει ήδη το **πιο εκφραστικό** μοντέλο —
 * μοτίβο (`LinetypeRegistry`) × πάχος (23 πένες ISO 128-20) × διπλή (`doubleGapMm`, Α24) —
 * και μπορεί να παραγάγει **κάθε** έναν από τους 13 ως συνδυασμό, μαζί με άπειρους άλλους
 * που το Excel δεν μπορεί καν να εκφράσει (π.χ. `Phantom` στα 0,70 mm).
 *
 * Άρα εδώ **δεν** γεννιέται:
 * - ❌ νέο πεδίο στο `TableBorderSpec` (δεύτερη αναπαράσταση στυλ δίπλα στην υπάρχουσα)
 * - ❌ νέο enum τύπου γραμμής (δεύτερος κατάλογος δίπλα στο `LinetypeRegistry`)
 * - ❌ δεύτερη κλίμακα πένας (δίπλα στο `config/lineweight-iso-catalog.ts`)
 *
 * Γεννιούνται **μόνο 14 σταθερές ταυτότητες** που δείχνουν σε υπάρχοντα ονόματα και υπάρχουσες
 * πένες. Η ημέρα που ο χρήστης θα φορτώσει δικό του `.lin` δεν αγγίζει αυτό το αρχείο: το
 * listbox είναι **συντομεύσεις**, ενώ ο πλήρης κατάλογος μένει προσβάσιμος από το χειριστήριο
 * «Στυλ γραμμής» της Φ5 (`table-border-pencil-options.ts`).
 *
 * ## ⚠️ Δεκατρία στυλ, ΔΕΚΑΤΕΣΣΕΡΑ κελιά
 * Το listbox είναι πλέγμα **2 στήλες × 7 σειρές = 14** θέσεις, και η **πρώτη** είναι το
 * «Καμία». Δηλαδή 13 **ζωγραφίσιμα** στυλ + το «Καμία», που δεν είναι στυλ γραμμής αλλά η
 * εντολή «εδώ δεν θέλω γραμμή» ({@link HIDDEN_TABLE_EDGE}, απόφαση Α14).
 *
 * ## Πού δεν υπάρχει ακριβές ISO αντίστοιχο
 * Και τα 13 απεικονίστηκαν σε **υπαρκτά** ονόματα του `LINETYPE_CATALOG_NAMES` — κανένα δεν
 * εφευρέθηκε. Οι δύο σημειώσεις που το χρειάζονται είναι γραμμένες στα σχόλια των εγγραφών
 * ({@link TABLE_BORDER_STYLES}: `Dot` και `Divide`).
 *
 * @module subapps/dxf-viewer/bim/table/table-border-style-catalog
 * @see bim/table/table-border-pencil.ts — η ΜΙΑ σύνθεση μολυβιού (Α23), που καλείται εδώ
 * @see ui/components/table-format-toolbar/table-border-pencil-options.ts — ο πλήρης κατάλογος
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §8.2 · §19.1 · §13
 */

import type { TableBorderSpec } from '../../types/table-edges';
import { HIDDEN_TABLE_EDGE } from './table-edge-model';
import { resolveTableBorderPencil } from './table-border-pencil';
import type { TableStyle } from './table-style';

// ──────────────────────────────────────────────────────────────────────────────
// Το λεξιλόγιο
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Οι ταυτότητες των 14 θέσεων. Αγγλικές και σταθερές: είναι **κλειδιά**, όχι ετικέτες — το
 * listbox του Excel δεν δείχνει καν όνομα (μόνο τη γραμμή), οπότε καμία από αυτές δεν
 * χρειάζεται ποτέ μετάφραση· χρειάζεται μόνο `aria-label` (ευθύνη του UI, Φ6).
 *
 * Το όνομα λέει **βαθμίδα + μοτίβο**, δηλαδή ακριβώς τα δύο πεδία που γράφει η εγγραφή. Ένα
 * `style1…style13` θα ήταν αδιαφανές, και θα άφηνε την αντιστοίχιση «ποιο είναι το παχύ;» να
 * ζει μόνο στο μυαλό όποιου κοίταξε τελευταίος το στιγμιότυπο.
 */
export type TableBorderStyleId =
  | 'none'
  | 'hairlineDotted'
  | 'thinDashed'
  | 'thinDashedLong'
  | 'thinDashDot'
  | 'thinDashDotDot'
  | 'thinSolid'
  | 'mediumDashDotDot'
  | 'mediumDashDot'
  | 'mediumDashed'
  | 'mediumDashedLong'
  | 'mediumSolid'
  | 'thickSolid'
  | 'double';

/** Το μολύβι μιας προεπιλογής: **όνομα** τύπου γραμμής × πένα × διπλή. */
export interface TableBorderStylePen {
  /**
   * Όνομα του `LinetypeRegistry` — **η απόφαση**, όχι η σημερινή της τιμή. Ίδιος συλλογισμός
   * με το `TableBorderPencilSelection.linetypeName` (§19.1): αν ο χρήστης επεξεργαστεί τον
   * τύπο γραμμής, η προεπιλογή οφείλει να δείχνει στο **νέο** μοτίβο.
   */
  readonly linetypeName: string;
  /** Πένα ISO 128-20 σε sheet-mm — μία από τις {@link LINEWEIGHT_CONCRETE_MM_VALUES}. */
  readonly widthMm: number;
  /** Α24 — δύο παράλληλες· η **απόσταση** παράγεται από την πένα, ποτέ σταθερή. */
  readonly double?: boolean;
}

/** Μία θέση του listbox. Απόν μολύβι ⇒ «Καμία». */
export interface TableBorderStylePreset {
  readonly id: TableBorderStyleId;
  /**
   * Απόν **μόνο** για το «Καμία», και αυτό είναι ο τύπος που εκφράζει την Α14: το «Καμία»
   * δεν είναι λεπτότερο μολύβι — δεν είναι μολύβι **καθόλου**. Ένα `widthMm: 0` θα ήταν
   * ψέμα που κάθε καταναλωτής θα έπρεπε να θυμάται να ελέγχει.
   */
  readonly pen?: TableBorderStylePen;
}

/**
 * Το σχήμα του listbox, **μετρημένο** από στιγμιότυπο ελληνικού Excel (2026-08-04).
 *
 * Ζει στα δεδομένα και όχι στο CSS του component για τον ίδιο λόγο με το `group` των 13
 * εντολών (`table-range-border-ops.ts`): μια χειρόγραφη διάταξη στο UI θα ήταν δεύτερη
 * δήλωση της ίδιας γνώσης, που αποκλίνει την ημέρα που θα προστεθεί 15η θέση.
 *
 * ⚠️ Η σειρά του {@link TABLE_BORDER_STYLES} είναι **κατά στήλη** (πρώτα ολόκληρη η αριστερή,
 * μετά η δεξιά) — όπως γεμίζει το Excel. Ένα CSS grid με `grid-auto-flow: column` και
 * `grid-template-rows: repeat(7, …)` το αποδίδει αυτούσιο, χωρίς καμία αναδιάταξη.
 */
export const TABLE_BORDER_STYLE_GRID: { readonly columns: number; readonly rows: number } = {
  columns: 2,
  rows: 7,
};

// ──────────────────────────────────────────────────────────────────────────────
// Οι τέσσερις βαθμίδες πάχους
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Οι τέσσερις βαθμίδες που διακρίνει το listbox — **διαδοχικά ζεύγη του ISO 128-20**.
 *
 * Το Excel εκφράζει «hairline / λεπτή / μεσαία / παχιά» σε **εικονοστοιχεία** (1 / 1 / 2 / 3
 * px), νούμερα χωρίς νόημα σε φύλλο σχεδίου. Εδώ κάθε βαθμίδα είναι **ακριβώς η επόμενη**
 * της κλίμακας ISO, με τον λόγο 1:2 που ορίζει το ίδιο το πρότυπο:
 *
 * ```
 *   0,13  →  0,25  →  0,50  →  1,00     (κάθε μία = το «παχύ» της προηγούμενης)
 * ```
 *
 * 🔑 Δεν είναι σύμπτωση ότι η **λεπτή** είναι 0,25: είναι η ίδια πένα που ήδη επιλέγει
 * ανεξάρτητα το preset `standard` για το πλέγμα, και η ίδια {@link FALLBACK_PEN_MM} του
 * `table-border-pencil.ts`. Και η **μεσαία** 0,50 είναι ακριβώς ό,τι παράγει ο τροποποιητής
 * `'thick'` του μητρώου των 13 εντολών πάνω στη λεπτή — δηλαδή το listbox και το dropdown
 * **συμφωνούν εκ κατασκευής**, χωρίς να το δηλώνει κανείς.
 *
 * ⚠️ Και οι τέσσερις τιμές περνούν από το `nearestIsoLineweight` μέσα στο
 * {@link resolveTableBorderPencil}, άρα δεν μπορούν να διαρρεύσουν εκτός κλίμακας — ένα test
 * το καρφώνει αντί να το εμπιστεύεται.
 */
const HAIRLINE_MM = 0.13;
const THIN_MM = 0.25;
const MEDIUM_MM = 0.5;
const THICK_MM = 1;

// ──────────────────────────────────────────────────────────────────────────────
// Το μητρώο — η SSoT των 14 (και η σειρά τους στο listbox)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Οι 14 θέσεις, **στη σειρά του Excel** (κατά στήλη: 7 αριστερά, 7 δεξιά).
 *
 * Μετρημένες από στιγμιότυπο ελληνικού Excel (2026-08-04), όχι επινοημένες. Κάθε εγγραφή
 * δείχνει σε **υπαρκτό** όνομα του `LINETYPE_CATALOG_NAMES` — καμία δεν εφευρίσκει τύπο.
 */
export const TABLE_BORDER_STYLES: readonly TableBorderStylePreset[] = [
  // ── Αριστερή στήλη ────────────────────────────────────────────────────────
  /** Θέση 1 — «Καμία». Δεν είναι στυλ: είναι η Α14 σε κελί του πλέγματος. */
  { id: 'none' },
  /**
   * Στιγμές. ⚠️ Το `Dot` **δεν** ανήκει στα 8 του `LINETYPE_ISO_NAMES` (η αυστηρή βάση), αλλά
   * είναι κανονική εγγραφή του `LINETYPE_ISO_CATALOG` με `origin: 'iso-baseline'` και το
   * προσφέρει ήδη το `tableBorderLinetypeNames()` της Φ5. Το πλησιέστερο των 8 θα ήταν το
   * `Hidden` (κοντή παύλα) — που **δεν** είναι στιγμή και θα φαινόταν αμέσως λάθος δίπλα
   * στην παύλα-τελεία της ίδιας στήλης.
   */
  { id: 'hairlineDotted', pen: { linetypeName: 'Dot', widthMm: HAIRLINE_MM } },
  /** Κοντή παύλα — το `Hidden` του καταλόγου (`6.35 / -3.175`). */
  { id: 'thinDashed', pen: { linetypeName: 'Hidden', widthMm: THIN_MM } },
  /** Μακριά παύλα — το `Dashed` (`12.7 / -6.35`). */
  { id: 'thinDashedLong', pen: { linetypeName: 'Dashed', widthMm: THIN_MM } },
  /** Παύλα-τελεία — το `DashDot`. */
  { id: 'thinDashDot', pen: { linetypeName: 'DashDot', widthMm: THIN_MM } },
  /**
   * Παύλα-τελεία-τελεία. ⚠️ Ο κατάλογος το λέει `Divide` (`__ . . __ . .`) — το ISO όνομα
   * της «διπλά διάστικτης» γραμμής. Το `Border` (`__ __ . __ __ .`) είναι **δύο παύλες και
   * μία τελεία**, δηλαδή άλλο μοτίβο· η ομοιότητα των ονομάτων είναι η παγίδα εδώ.
   */
  { id: 'thinDashDotDot', pen: { linetypeName: 'Divide', widthMm: THIN_MM } },
  /** Συνεχής λεπτή — η βάση όλου του πλέγματος. */
  { id: 'thinSolid', pen: { linetypeName: 'Continuous', widthMm: THIN_MM } },

  // ── Δεξιά στήλη — τα ίδια μοτίβα, μία βαθμίδα πάνω ────────────────────────
  { id: 'mediumDashDotDot', pen: { linetypeName: 'Divide', widthMm: MEDIUM_MM } },
  { id: 'mediumDashDot', pen: { linetypeName: 'DashDot', widthMm: MEDIUM_MM } },
  { id: 'mediumDashed', pen: { linetypeName: 'Hidden', widthMm: MEDIUM_MM } },
  { id: 'mediumDashedLong', pen: { linetypeName: 'Dashed', widthMm: MEDIUM_MM } },
  { id: 'mediumSolid', pen: { linetypeName: 'Continuous', widthMm: MEDIUM_MM } },
  { id: 'thickSolid', pen: { linetypeName: 'Continuous', widthMm: THICK_MM } },
  /**
   * Θέση 14 — **διπλή**: δύο παράλληλες συνεχείς. Λεπτές, όπως στο Excel· η **απόσταση**
   * παράγεται από την πένα (Α24, `tableBorderDoubleGapMm`) και δεν δηλώνεται εδώ, γιατί μια
   * σταθερή απόσταση θα έδινε στη διπλή 0,13 mm και στη διπλή 0,70 mm **την ίδια** εικόνα.
   */
  { id: 'double', pen: { linetypeName: 'Continuous', widthMm: THIN_MM, double: true } },
];

const STYLES_BY_ID: ReadonlyMap<TableBorderStyleId, TableBorderStylePreset> = new Map(
  TABLE_BORDER_STYLES.map((preset) => [preset.id, preset]),
);

// ──────────────────────────────────────────────────────────────────────────────
// Η σύνθεση
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Το **μολύβι** μιας προεπιλογής — δηλαδή ό,τι θα γραφτεί στην ακμή αν ο χρήστης πατήσει
 * τώρα μια θέση του widget.
 *
 * ## Γιατί δεν χτίζει μόνο του `TableBorderSpec`
 * Θα ήταν sibling clone της {@link resolveTableBorderPencil} — του **ενός** σημείου όπου
 * γεννιέται μολύβι από επιλογή (CHECK 3.28 / N.18). Χειρότερα, θα ξεχνούσε την **Α23**: το
 * `colorHex` του Excel listbox είναι **άλλο** χειριστήριο (το «Χρώμα» δίπλα του), οπότε ένα
 * στυλ που έγραφε δικό του χρώμα θα ακύρωνε σιωπηλά την επιλογή χρώματος του χρήστη. Εδώ το
 * χρώμα είναι **προαιρετικό όρισμα** και, όταν λείπει, ισχύει η Α20 («Από το στυλ»).
 *
 * ## Γιατί το `dashMm` έρχεται ΕΤΟΙΜΟ και δεν λύνεται εδώ
 * Ίδια σύμβαση με το `TableBorderPencilChoice` (§19.1): η μετάφραση ονόματος → μοτίβο θέλει
 * το `LinetypeRegistry`, δηλαδή **κατάσταση**. Ο καλών τη ζητά μία φορά ανά εντολή από το
 * `resolveLinetypePatternMm`, και αυτό το module μένει ντετερμινιστικό — εκτελέσιμο σε test
 * χωρίς κανένα στήσιμο.
 *
 * ⚠️ **Κενό `dashMm` σημαίνει «συνεχής», όχι «δεν διάλεξα»** — γι' αυτό περνιέται πάντα, και
 * γι' αυτό το `Continuous` υπερισχύει σωστά μιας διακεκομμένης που τυχόν ορίζει το στυλ.
 *
 * Άγνωστη ταυτότητα ⇒ {@link HIDDEN_TABLE_EDGE}, η ασφαλής απάντηση: μια θέση που δεν ξέρουμε
 * τι είναι δεν επιτρέπεται να ζωγραφίσει τυχαία γραμμή.
 */
export function tableBorderStylePencil(
  id: TableBorderStyleId,
  style: TableStyle,
  dashMm: readonly number[],
  colorHex?: string,
): TableBorderSpec {
  const pen = STYLES_BY_ID.get(id)?.pen;
  if (pen === undefined) return HIDDEN_TABLE_EDGE;

  return resolveTableBorderPencil(style, {
    ...(colorHex !== undefined ? { colorHex } : {}),
    widthMm: pen.widthMm,
    dashMm,
    ...(pen.double === true ? { double: true } : {}),
  });
}

/**
 * Η εγγραφή μιας ταυτότητας — για την **προεπισκόπηση** κάθε θέσης του listbox, που πρέπει να
 * ρωτήσει το `linetypeName` για να ζωγραφίσει τη σωστή γραμμή δείγματος.
 */
export function tableBorderStylePreset(
  id: TableBorderStyleId,
): TableBorderStylePreset | undefined {
  return STYLES_BY_ID.get(id);
}
