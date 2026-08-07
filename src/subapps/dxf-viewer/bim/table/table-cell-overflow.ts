/**
 * ADR-739 Φ.Δ βήμα 5 — **Ο ΕΝΑΣ ΚΑΝΟΝΑΣ: πού τελειώνει το ορατό κείμενο ενός κελιού.**
 *
 * ## Το πρόβλημα που λύνει (μετρημένο, 2026-08-01)
 * Πριν από αυτό το αρχείο δεν υπήρχε **καμία** λογική περικοπής πουθενά στον πίνακα
 * (`grep -riE "overflow|ellips|truncat|clip"` σε `bim/table/` + `rendering/entities/table/`
 * → μηδέν). Κείμενο που δεν χωρούσε ζωγραφιζόταν **πάνω από τα περιγράμματα** — στην οθόνη,
 * στο PDF και στο DXF. Για εργαλείο που παράγει **εκτυπώσιμα σχέδια** αυτό δεν είναι
 * αισθητικό ελάττωμα· είναι άχρηστο παραδοτέο.
 *
 * ## 🔴 Γιατί ΕΔΩ και όχι στους ζωγράφους — τα τέσσερα backends είναι ΕΝΑ σημείο
 * Το ερώτημα «τέσσερα backends, πώς τα συγχρονίζω;» έχει καλύτερη απάντηση από «τα κάνω και
 * τα τέσσερα να καλούν την ίδια συνάρτηση»: **δεν χρειάζεται να την καλέσουν καθόλου.**
 * ```
 *   placeText  (ΕΔΩ γεννιέται το TableTextRun.text)
 *      ├─ stampTableText          → cell.text  (καμβάς)
 *      ├─ tableLayoutToPrimitives → cell.text  (σκηνή/PDF)
 *      ├─ decomposeTable          → καλεί το παραπάνω  (DXF)
 *      └─ buildScheduleTable      → καλεί το παραπάνω  (φύλλα λεπτομερειών)
 * ```
 * Και οι τέσσερις διαβάζουν το **ίδιο** `TableCellLayout.text`, που γεννιέται σε **ένα**
 * σημείο. Ο κανόνας μπαίνει εκεί και οι τέσσερις τον **κληρονομούν δομικά**: δεν υπάρχει
 * σημείο όπου να μπορούν να αποκλίνουν — ούτε από αμέλεια, ούτε από μελλοντική προσθήκη
 * πέμπτου backend. «Οθόνη === PDF === DXF === σκηνή» παραμένει **δομή**, όχι υπόσχεση (§3).
 *
 * ## 🔴 Ποιον μετρητή ρωτά — ρητή απόφαση, όχι παράλειψη
 * Ρωτά τον μετρητή **της διάταξης** (`measureTextAdvanceWorld` μέσω `TableTextMeasurer`) —
 * τον ίδιο που αποφάσισε τα πλάτη στηλών. **Όχι** τον `ctx.measureText` του καμβά, παρότι
 * αυτός είναι που τελικά ζωγραφίζει. Ο λόγος είναι ότι δεν υπάρχει `ctx` σε PDF, σε DXF, σε
 * jest ή σε SSR: μια περικοπή δεμένη στον καμβά θα ήταν **ανυπολόγιστη** στα τρία από τα
 * τέσσερα backends, δηλαδή ακριβώς η απόκλιση που το βήμα κλείνει.
 *
 * ⚠️ **Το γνωστό τίμημα, δηλωμένο**: ο καμβάς ζωγραφίζει σήμερα πάντα `'arial'` ενώ ο
 * μετρητής τιμά το `fontFamily` (χρέος ήδη καταγραμμένο, ADR-739 §21.8). Όσο ζει αυτό, σε
 * κελί με **άλλη** γραμματοσειρά η κοπή μπορεί να πέσει κατά έναν χαρακτήρα δίπλα από το
 * ιδανικό στην **οθόνη**. Δεν «διορθώνεται» εδώ παρεμπιπτόντως: η ένωση των δύο μετρητών
 * είναι ξεχωριστό βήμα, και μια βιαστική αλλαγή θα μετακινούσε **κάθε** πλάτος στήλης του
 * repo. Με το σημερινό preset (ίδια οικογένεια) η απόκλιση είναι μηδενική.
 *
 * ## 🔴 Το μοντέλο ΔΕΝ αγγίζεται
 * Κόβεται **μόνο** η απόδοση (`TableTextRun.text`). Το `TableCell.value` μένει ακέραιο· ο
 * in-cell επεξεργαστής διαβάζει από το μοντέλο (`getPersistedCellText`), οπότε `F2` πάνω σε
 * περικομμένο κελί δείχνει το **πλήρες** κείμενο. Ένα `value.slice(...)` οπουδήποτε θα ήταν
 * μη αναστρέψιμη απώλεια δεδομένων του χρήστη.
 *
 * ## Καθαρή συνάρτηση της διάταξης — ΠΟΤΕ της διαδραστικής κατάστασης (ADR-040 #3)
 * Καμία είσοδος επιλογής/hover/δρομέα. Ο πίνακας ζωγραφίζεται και σε cached raster· μια
 * περικοπή που άλλαζε με το hover θα ακύρωνε ολόκληρο το raster σε κάθε κίνηση ποντικιού.
 *
 * @module subapps/dxf-viewer/bim/table/table-cell-overflow
 * @see bim/text/text-fit.ts — ο κοινός χάρακας «πόσοι χαρακτήρες χωρούν»
 * @see bim/table/table-layout-place.ts — ο ΜΟΝΑΔΙΚΟΣ καλών
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §23
 */

import type { TableCellOverflow, TableCellTextRun } from '../../types/table';
import { fittingPrefixLengthByChar, type TextWidthMeasure } from '../text/text-fit';
import {
  fittingPrefixLengthAcrossSpans,
  resolveCellStyledSpans,
  styledSpansWidthMm,
} from './table-cell-styled-spans';
import type { TableTextMeasurer, TableTextStyleSpan } from './table-layout-types';
import type { TableCellStyle } from './table-style';

/**
 * Η συμπεριφορά όταν η στήλη **και** το κελί σιωπούν.
 *
 * `'clip'` και όχι `'overflow'` (Excel/Sheets) — απόφαση Giorgio 2026-08-01, με τρία
 * επιχειρήματα: (α) σε DXF ένα ξεχειλισμένο κείμενο δεν ανήκει σε **κανένα** κελί, και το
 * native `ACAD_TABLE` (Φ.Ε) **δεν μπορεί καν να το εκφράσει** — ο πίνακας θα έδειχνε αλλιώς
 * στο AutoCAD απ' ό,τι στην οθόνη· (β) σε πίνακα ποσοτήτων οι διπλανές στήλες σχεδόν ποτέ
 * δεν είναι κενές, άρα το ξεχείλισμα του Excel δεν θα ενεργοποιούνταν ούτως ή άλλως·
 * (γ) το ξεχείλισμα κάνει τη διάταξη ενός κελιού να εξαρτάται από το **περιεχόμενο άλλου**
 * κελιού, δηλαδή μη τοπική — σπάει την καθαρή συνάρτηση που κάνει το raster ασφαλές.
 */
export const DEFAULT_TABLE_CELL_OVERFLOW: TableCellOverflow = 'clip';

/**
 * Ο δείκτης «εδώ κόπηκε» για **κείμενο**.
 *
 * Το Excel δεν βάζει κανέναν — αλλά το Excel είναι **διαδραστικό**: κάνεις κλικ και βλέπεις
 * την πλήρη τιμή στη γραμμή τύπων. Ένα **τυπωμένο σχέδιο δεν έχει γραμμή τύπων**: χωρίς
 * ένδειξη ο μηχανικός δεν μπορεί να ΞΕΡΕΙ ότι το παραδοτέο του κρύβει δεδομένα. Τα schedules
 * του Revit/ArchiCAD και το `Truncate text` της Figma βάζουν αποσιωπητικά για ακριβώς αυτόν
 * τον λόγο.
 */
export const CELL_CLIP_ELLIPSIS = '…';

/**
 * Ο δείκτης «εδώ κόπηκε» για **αριθμό** — η σύμβαση `#####` του Excel.
 *
 * 🔴 **Δεν είναι διακοσμητική διάκριση.** Ένα κομμένο κείμενο (`«ΠΕΡΙΓΡΑΦΗ ΕΡΓ…»`) διαβάζεται
 * ως προφανώς ελλιπές. Ένας κομμένος αριθμός (`«12345»` → `«12…»`) διαβάζεται ως **άλλος
 * αριθμός** — και σε πίνακα ποσοτήτων αυτό είναι σφάλμα **ΤΙΜΗΣ**, όχι εμφάνισης· η ίδια
 * κατηγορία με τα ADR-712/713. Το `#` δεν μοιάζει με ψηφίο σε καμία ματιά.
 */
export const CELL_CLIP_NUMERIC_FILL = '#';

/** Οι τιμές που η μηχανή **όντως** ξέρει να εκτελέσει σήμερα (βλ. {@link resolveCellOverflow}). */
const SUPPORTED_OVERFLOW: ReadonlySet<string> = new Set<TableCellOverflow>(['clip', 'shrink']);

/**
 * 🔴 ADR-739 §58 Γ1 — **το κάτω όριο της σμίκρυνσης, και γιατί υπάρχει ενώ το Excel δεν έχει.**
 *
 * Το *Shrink to Fit* του Excel δεν έχει κατώτατο μέγεθος: σμικρύνει όσο χρειαστεί, και σε
 * στενή στήλη παράγει γράμματα που **κανείς δεν μπορεί να διαβάσει**. Σε φύλλο υπολογισμού
 * αυτό είναι ανεκτό — κάνεις κλικ και βλέπεις την τιμή στη γραμμή τύπων.
 *
 * **Ένα τυπωμένο σχέδιο δεν έχει γραμμή τύπων.** Και δεν είναι θέμα γούστου πόσο μικρό
 * επιτρέπεται να τυπωθεί ένα γράμμα: το **ISO 3098-1:2015** (Τεχνική τεκμηρίωση προϊόντος —
 * Γραμματογραφία) ορίζει τη σειρά ονομαστικών υψών `1,8 · 2,5 · 3,5 · 5 · 7 · 10 · 14 · 20`
 * mm. Το `1,8` είναι το **κάτω άκρο της σειράς** — κάτω από αυτό δεν υπάρχει νόμιμο ύψος
 * γραμμάτων σε τεχνικό σχέδιο.
 *
 * Άρα η σμίκρυνση σταματά εδώ και το κελί **περικόπτεται** αντί να σμικρυνθεί άλλο. Η
 * επιλογή αποτυγχάνει προς την **ανιχνεύσιμη** πλευρά: ένα «…» λέει στον μηχανικό ότι
 * κρύβονται δεδομένα· μια δυσανάγνωστη μουτζούρα του λέει ότι κάτι γράφει, και τον αφήνει
 * να μαντέψει τι. Ίδιο σκεπτικό με το `CELL_CLIP_NUMERIC_FILL`.
 *
 * @see https://www.iso.org/standard/65679.html — ISO 3098-1:2015
 */
export const MIN_PRINTABLE_TEXT_HEIGHT_MM = 1.8;

/**
 * Η επίλυση **κελί → στήλη → προεπιλογή**, ίδια σειρά προτεραιότητας με τη στοίχιση.
 *
 * 🔴 **Άγνωστη τιμή ⇒ προεπιλογή, ποτέ κατάρρευση.** Ένας πίνακας αποθηκευμένος από
 * μελλοντική έκδοση (`'wrap'`) που ανοίγει σε σημερινή **πρέπει** να ζωγραφιστεί περικομμένος
 * αντί να ρίξει τη σκηνή. Το `PersistedTableModel` ταξιδεύει μέσα από `JSON.parse` — δεν
 * υπάρχει καμία εγγύηση τύπου στην άλλη άκρη, μόνο η δήλωσή μας.
 */
export function resolveCellOverflow(
  cellOverride: TableCellOverflow | undefined,
  columnDefault: TableCellOverflow | undefined,
): TableCellOverflow {
  const raw: string | undefined = cellOverride ?? columnDefault;
  return raw !== undefined && SUPPORTED_OVERFLOW.has(raw)
    ? (raw as TableCellOverflow)
    : DEFAULT_TABLE_CELL_OVERFLOW;
}

/** Ό,τι χρειάζεται ο κανόνας — γεωμετρία + τυπογραφία + φύση τιμής. Καμία κατάσταση διεπαφής. */
export interface CellTextFitInput {
  /** Το **ακέραιο** κείμενο του κελιού (`cellText(cell)`) — ποτέ ήδη κομμένο. */
  readonly text: string;
  /** Το ωφέλιμο πλάτος: πλάτος ορθογωνίου **μείον τα δύο οριζόντια περιθώρια**. */
  readonly availableWidthMm: number;
  /** Το τελικό στυλ του κελιού — δίνει ύψος, οικογένεια και βάρος στη μέτρηση. */
  readonly style: TableCellStyle;
  readonly overflow: TableCellOverflow;
  /**
   * Είναι **αριθμός** η τιμή του κελιού;
   *
   * 🔴 Κρίνεται από το `typeof cell.value === 'number'` και **ΟΧΙ** από το
   * `TableColumn.valueType` — ακριβώς όπως το Excel, που κοιτά την **τιμή**. Με κριτήριο τη
   * στήλη, η κεφαλίδα «ΠΟΣΟΤΗΤΑ» μιας αριθμητικής στήλης θα ζωγραφιζόταν `####`, που είναι
   * ανοησία: η κεφαλίδα είναι κείμενο ό,τι κι αν λέει η στήλη για τα δεδομένα της.
   */
  readonly numeric: boolean;
  /**
   * 🔴 ADR-753 Φ2 — η μορφοποίηση **ανά χαρακτήρα** του κελιού. Απούσα ⇒ ομοιογενές κείμενο
   * και η μέτρηση είναι ταυτόσημη με πριν το ADR-753.
   *
   * Δεν είναι διακοσμητική για την περικοπή: με έντονα γράμματα στη μέση, το «πού τελειώνει
   * ό,τι χωράει» **αλλάζει** — και ένας χάρακας που τα αγνοούσε θα έκοβε συστηματικά αργά,
   * δηλαδή θα ζωγράφιζε πάνω στο περίγραμμα ακριβώς όπως πριν υπάρξει αυτό το αρχείο.
   */
  readonly runs?: readonly TableCellTextRun[];
  /** Ο μετρητής **της διάταξης** — ο ίδιος που αποφάσισε τα πλάτη στηλών (βλ. κεφαλίδα). */
  readonly measure: TableTextMeasurer;
}

/** Το ορατό κείμενο + αν χρειάστηκε να κοπεί. */
export interface VisibleCellText {
  /** Ό,τι ζωγραφίζεται — **ποτέ** ό,τι αποθηκεύεται. */
  readonly text: string;
  readonly clipped: boolean;
  /**
   * 🔴 ADR-753 Φ2 — τα ομοιογενή τμήματα **του ορατού** κειμένου, πάντα παρόντα (ένα, όταν
   * δεν υπάρχει μορφοποίηση ανά χαρακτήρα).
   *
   * Γεννιούνται **εδώ** και όχι στον καλούντα επειδή μόνο εδώ είναι γνωστό **πού κόπηκε** το
   * κείμενο: τα τμήματα του ακέραιου κειμένου δεν περιγράφουν το ορατό, και μια δεύτερη
   * παραγωγή τους στον `placeText` θα ήταν δεύτερη απάντηση στο «ποιοι χαρακτήρες φαίνονται».
   */
  readonly spans: readonly TableTextStyleSpan[];
  /**
   * 🔴 ADR-739 §58 Γ1 — ο **συντελεστής σμίκρυνσης** που εφαρμόστηκε· `1` όταν καμία.
   *
   * ## Γιατί ταξιδεύει ρητά ενώ τα `spans` είναι ΗΔΗ κλιμακωμένα
   * Τα τμήματα φτάνουν στον ζωγράφο με τα τελικά τους μεγέθη, οπότε θα μπορούσε κανείς να
   * πει ότι ο συντελεστής είναι περιττός. **Δεν είναι**, για δύο λόγους που δεν έχουν σχέση
   * με τη ζωγραφική:
   *  1. Το `TableTextRun.heightMm` και η **γραμμή βάσης** (`cellBaselineYMm`) διαβάζουν το
   *     `TableCellStyle.textHeightMm` — που **δεν** έχει κλιμακωθεί. Χωρίς τον συντελεστή,
   *     ένα σμικρυμένο κείμενο θα ζωγραφιζόταν στη γραμμή βάσης του **αρχικού** μεγέθους,
   *     δηλαδή μετατοπισμένο κατακόρυφα μέσα στο κελί.
   *  2. Ένα **κενό** κελί δεν έχει καθόλου `spans`, αλλά ο in-cell επεξεργαστής χρειάζεται
   *     να ξέρει με τι μέγεθος θα φανεί ό,τι πληκτρολογηθεί.
   */
  readonly heightScale: number;
}

const NOTHING: VisibleCellText = { text: '', clipped: false, spans: [], heightScale: 1 };

/** Ο μετρητής δεμένος στο στυλ αυτού του κελιού — μία έκφραση, ώστε να μη γραφτεί δεύτερη. */
function boundMeasure(input: CellTextFitInput): TextWidthMeasure {
  const { measure, style } = input;
  return (s) =>
    measure(s, style.textHeightMm, {
      fontFamily: style.fontFamily,
      bold: style.bold,
      italic: style.italic,
    });
}

/**
 * Το **ορατό** κείμενο ενός κελιού. Καθαρή συνάρτηση: ίδιες είσοδοι ⇒ ίδιο αποτέλεσμα,
 * πάντα (προϋπόθεση για την ασφαλή απομνημόνευση της διάταξης και για το bitmap cache).
 */
export function resolveVisibleCellText(input: CellTextFitInput): VisibleCellText {
  if (!input.text) return NOTHING;
  // Μηδενικό ή αρνητικό ωφέλιμο πλάτος (στήλη στενότερη από τα περιθώριά της): τίποτα δεν
  // χωρά, και είναι **περικοπή** — ο καλών πρέπει να το ξέρει, δεν είναι κενό κελί.
  if (!(input.availableWidthMm > 0)) {
    return { text: '', clipped: true, spans: [], heightScale: 1 };
  }

  const spans = spansOf(input, input.text, input.text.length);
  const widthMm = styledSpansWidthMm(spans);
  if (widthMm <= input.availableWidthMm) {
    return { text: input.text, clipped: false, spans, heightScale: 1 };
  }

  // Ο διακόπτης γράφεται ρητά και **χωρίς `default`** ώστε η προσθήκη μέλους στο union να
  // σπάει τη ΜΕΤΑΓΛΩΤΤΙΣΗ εδώ — δηλαδή να μην μπορεί να προστεθεί τιμή χωρίς τη μηχανή της
  // (βλ. `TableCellOverflow`). Έτσι μπήκε το `'shrink'` στο §58 Γ1.
  switch (input.overflow) {
    case 'shrink': {
      const shrunk = shrinkToFit(input, spans, widthMm);
      if (shrunk) return shrunk;
      // Η σμίκρυνση χτύπησε στο όριο αναγνωσιμότητας ({@link MIN_PRINTABLE_TEXT_HEIGHT_MM}):
      // **πέφτουμε στην περικοπή**, δεν τυπώνουμε δυσανάγνωστο. Δεν είναι σιωπηλή υποχώρηση —
      // ο δείκτης «…» / «####» είναι ορατός και λέει ακριβώς ότι κρύβονται δεδομένα.
      return clipToFit(input, spans);
    }
    case 'clip':
      return clipToFit(input, spans);
  }
}

/**
 * ADR-739 §58 Γ1 — η **περικοπή**, ως μία διατύπωση για τους δύο καλούντες.
 *
 * Εξήχθη όταν το `'shrink'` απέκτησε ανάγκη να πέσει σε αυτήν: δύο αντίγραφα του ίδιου
 * τριγράμμου θα ήταν structural clone μέσα στο ίδιο αρχείο (N.18 / CHECK 3.28).
 */
function clipToFit(
  input: CellTextFitInput,
  spans: readonly TableTextStyleSpan[],
): VisibleCellText {
  const cut = input.numeric
    ? numericCut(input.availableWidthMm, boundMeasure(input))
    : ellipsisCut(input, spans);
  return {
    text: cut.text,
    clipped: true,
    spans: spansOf(input, cut.text, cut.runsLimit),
    heightScale: 1,
  };
}

/**
 * 🏆 ADR-739 §58 Γ1 — **Shrink to Fit**: το κείμενο σμικραίνει ώστε να χωρέσει, ακέραιο.
 *
 * ## Γιατί ΜΙΑ διαίρεση και όχι δυαδική αναζήτηση — μετρημένο, όχι υποτεθειμένο
 * Ο μετρητής (`measureTextAdvanceWorld`, ADR-557) είναι **αυστηρά γραμμικός** ως προς το
 * ύψος και στα **τρία** του tiers:
 * ```
 *   opentype :  (run.width / GLYPH_REFERENCE_SIZE) × emSizeForTextHeight(h)   →  h / capRatio
 *   CSS      :  (px / CSS_MEASURE_REF_PX) × h
 *   monospace:  len × h × CHAR_WIDTH_MONOSPACE
 * ```
 * Άρα ο ζητούμενος συντελεστής είναι **ακριβώς** `διαθέσιμο / μετρημένο` — καμία επανάληψη,
 * καμία προσέγγιση, καμία ανοχή. Το Excel σμικραίνει σε **διακριτά βήματα** μεγέθους
 * γραμματοσειράς και γι' αυτό αφήνει ορατό κενό στο τέλος του κελιού· εδώ το κείμενο
 * τελειώνει **ακριβώς** στο περιθώριο.
 *
 * ⚠️ Ο πολλαπλασιασμός εφαρμόζεται στα **ήδη μετρημένα** τμήματα, όχι σε νέα μέτρηση με
 * μικρότερο στυλ. Έτσι ένα τμήμα που δηλώνει **δικό του** `textHeightMm` (ADR-753) σμικραίνεται
 * κι αυτό αναλογικά — ενώ μια επαναμέτρηση με κλιμακωμένο **στυλ κελιού** θα το άφηνε
 * ανέγγιχτο, και το κελί θα συνέχιζε να ξεχειλίζει ακριβώς εκεί που ο χρήστης έβαλε έμφαση.
 *
 * `null` όταν ο συντελεστής θα έριχνε **οποιοδήποτε** τμήμα κάτω από το όριο ISO 3098.
 */
function shrinkToFit(
  input: CellTextFitInput,
  spans: readonly TableTextStyleSpan[],
  widthMm: number,
): VisibleCellText | null {
  if (!(widthMm > 0)) return null;
  const scale = input.availableWidthMm / widthMm;
  // Το **μικρότερο** τμήμα είναι αυτό που φτάνει πρώτο στο όριο — όχι το στυλ του κελιού:
  // ένας εκθέτης σε «m³» έχει ήδη μικρότερο ύψος από το κελί.
  const smallestMm = spans.reduce((min, s) => Math.min(min, s.heightMm), input.style.textHeightMm);
  if (smallestMm * scale < MIN_PRINTABLE_TEXT_HEIGHT_MM) return null;

  return {
    text: input.text,
    // **Δεν** είναι περικοπή: κανένας χαρακτήρας δεν χάθηκε, άρα ούτε δείκτης «…» χρειάζεται
    // ούτε ο επεξεργαστής έχει λόγο να δείξει «πού θα κοπεί» (Φ.Δ βήμα 6).
    clipped: false,
    spans: spans.map((span) => ({
      ...span,
      heightMm: span.heightMm * scale,
      offsetMm: span.offsetMm * scale,
      advanceMm: span.advanceMm * scale,
    })),
    heightScale: scale,
  };
}

/**
 * Το κομμένο κείμενο **μαζί με το πόσο του ανήκει στον χρήστη**.
 *
 * Ο δεύτερος αριθμός δεν είναι λογιστική: είναι η γραμμή που χωρίζει το περιεχόμενο από το
 * **σημάδι του πίνακα**. Δες το `runsLimit` στο `table-cell-styled-spans.ts` για το γιατί το
 * «…» δεν κληρονομεί ποτέ τα έντονα του τελευταίου γράμματος.
 */
interface ClippedCellText {
  readonly text: string;
  readonly runsLimit: number;
}

/** Τα ομοιογενή τμήματα μιας **συγκεκριμένης** ορατής συμβολοσειράς — η μία διατύπωση. */
function spansOf(
  input: CellTextFitInput,
  text: string,
  runsLimit: number,
): readonly TableTextStyleSpan[] {
  return resolveCellStyledSpans({
    text,
    runs: input.runs,
    runsLimit,
    style: input.style,
    measure: input.measure,
  });
}

/**
 * Κείμενο → το μεγαλύτερο πρόθεμα **που χωρά μαζί με τα αποσιωπητικά**.
 *
 * Δύο επιλογές που φαίνονται λεπτομέρειες και δεν είναι:
 *  1. **Ο δείκτης μπαίνει ΜΕΣΑ στο διαθέσιμο πλάτος**, δεν προστίθεται μετά. Αλλιώς το
 *     «κομμένο» κείμενο θα ξεχείλιζε — δηλαδή θα κάναμε ακριβώς το σφάλμα που διορθώνουμε.
 *  2. **Τα κενά στο τέλος του προθέματος πέφτουν.** Ένα `«ΠΕΡΙΓΡΑΦΗ …»` με το κενό μέσα
 *     δείχνει σαν να λείπει λέξη ενώ απλώς κόπηκε — και σε δεξιά/κεντρική στοίχιση το
 *     αόρατο κενό μετατοπίζει ορατά το κείμενο. Ίδια επιλογή κάνει η αναδίπλωση
 *     (`text-layout.ts`: «ο διαχωριστής πέφτει και από τις δύο πλευρές»).
 *
 * Όταν δεν χωρά **ούτε ο δείκτης**, γίνεται σκέτη κοπή χαρακτήρα: ένα μισό γράμμα λέει
 * περισσότερα από ένα κενό κελί, και η στήλη είναι τόσο στενή που καμία ένδειξη δεν θα
 * ήταν αναγνώσιμη ούτως ή άλλως.
 *
 * 🔴 ADR-753 Φ2 — **δύο μετρητές, σκόπιμα διαφορετικοί**: το περιεχόμενο μετριέται με τα
 * τμήματά του (ετερογενές), ο **δείκτης** με το στυλ του κελιού. Ο δείκτης δεν είναι κείμενο
 * του χρήστη, άρα δεν έχει τμήμα να κληρονομήσει — και το `####`, που αντικαθιστά ολόκληρο
 * τον αριθμό, δεν θα είχε καν από πού.
 */
function ellipsisCut(
  input: CellTextFitInput,
  spans: readonly TableTextStyleSpan[],
): ClippedCellText {
  const { text, availableWidthMm, measure } = input;
  const budgetMm = availableWidthMm - boundMeasure(input)(CELL_CLIP_ELLIPSIS);
  if (!(budgetMm > 0)) {
    const bare = trimEnd(text.slice(0, fittingPrefixLengthAcrossSpans(spans, availableWidthMm, measure)));
    return { text: bare, runsLimit: bare.length };
  }
  const head = trimEnd(text.slice(0, fittingPrefixLengthAcrossSpans(spans, budgetMm, measure)));
  return { text: head + CELL_CLIP_ELLIPSIS, runsLimit: head.length };
}

/** Το `####` του Excel — **αντικαθιστά** την τιμή, άρα κανένας χαρακτήρας δεν είναι του χρήστη. */
function numericCut(availableMm: number, measure: TextWidthMeasure): ClippedCellText {
  return { text: numericFill(availableMm, measure), runsLimit: 0 };
}

/**
 * Αριθμός → όσα `#` χωρούν, σαν το Excel. **Ποτέ** ψηφία: βλ. {@link CELL_CLIP_NUMERIC_FILL}.
 *
 * Το πλήθος βγαίνει από τον **ίδιο** χάρακα με το κείμενο και όχι από διαίρεση
 * `πλάτος / πλάτος('#')`: σε αναλογική γραμματοσειρά η διαίρεση αγνοεί το kerning και δίνει
 * κατά έναν χαρακτήρα λάθος — που εδώ σημαίνει `#` ζωγραφισμένο **πάνω** στο περίγραμμα.
 */
function numericFill(availableMm: number, measure: TextWidthMeasure): string {
  const oneMm = measure(CELL_CLIP_NUMERIC_FILL);
  if (!(oneMm > 0)) return '';
  // Ένα ταβάνι που σίγουρα ξεπερνά το διαθέσιμο (+2 για kerning), ώστε ο χάρακας να έχει
  // υποψήφιο να κόψει — και φραγμένο, γιατί ένα κελί δεν είναι ποτέ χιλιάδες `#` πλατύ.
  const ceiling = Math.min(Math.ceil(availableMm / oneMm) + 2, MAX_NUMERIC_FILL);
  const candidate = CELL_CLIP_NUMERIC_FILL.repeat(Math.max(ceiling, 1));
  return candidate.slice(0, fittingPrefixLengthByChar(candidate, availableMm, measure));
}

/** Φράγμα ασφαλείας για το γέμισμα `#` — μηδενικό/παθολογικό πλάτος δεν γεννά τεράστιο string. */
const MAX_NUMERIC_FILL = 256;

/** Κενά **μόνο** στο τέλος· τα εσωτερικά είναι περιεχόμενο του χρήστη. */
function trimEnd(text: string): string {
  return text.replace(/\s+$/u, '');
}
