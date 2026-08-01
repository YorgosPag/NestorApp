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

import type { TableCellOverflow } from '../../types/table';
import { fittingPrefixLengthByChar, type TextWidthMeasure } from '../text/text-fit';
import type { TableTextMeasurer } from './table-layout-types';
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
const SUPPORTED_OVERFLOW: ReadonlySet<string> = new Set<TableCellOverflow>(['clip']);

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
  /** Ο μετρητής **της διάταξης** — ο ίδιος που αποφάσισε τα πλάτη στηλών (βλ. κεφαλίδα). */
  readonly measure: TableTextMeasurer;
}

/** Το ορατό κείμενο + αν χρειάστηκε να κοπεί. */
export interface VisibleCellText {
  /** Ό,τι ζωγραφίζεται — **ποτέ** ό,τι αποθηκεύεται. */
  readonly text: string;
  readonly clipped: boolean;
}

const NOTHING: VisibleCellText = { text: '', clipped: false };

/** Ο μετρητής δεμένος στο στυλ αυτού του κελιού — μία έκφραση, ώστε να μη γραφτεί δεύτερη. */
function boundMeasure(input: CellTextFitInput): TextWidthMeasure {
  const { measure, style } = input;
  return (s) => measure(s, style.textHeightMm, { fontFamily: style.fontFamily, bold: style.bold });
}

/**
 * Το **ορατό** κείμενο ενός κελιού. Καθαρή συνάρτηση: ίδιες είσοδοι ⇒ ίδιο αποτέλεσμα,
 * πάντα (προϋπόθεση για την ασφαλή απομνημόνευση της διάταξης και για το bitmap cache).
 */
export function resolveVisibleCellText(input: CellTextFitInput): VisibleCellText {
  if (!input.text) return NOTHING;
  // Μηδενικό ή αρνητικό ωφέλιμο πλάτος (στήλη στενότερη από τα περιθώριά της): τίποτα δεν
  // χωρά, και είναι **περικοπή** — ο καλών πρέπει να το ξέρει, δεν είναι κενό κελί.
  if (!(input.availableWidthMm > 0)) return { text: '', clipped: true };

  const measure = boundMeasure(input);
  if (measure(input.text) <= input.availableWidthMm) return { text: input.text, clipped: false };

  // Σήμερα υπάρχει ΜΙΑ λειτουργία. Ο διακόπτης γράφεται ρητά και **χωρίς `default`** ώστε η
  // προσθήκη μέλους στο union να σπάει τη ΜΕΤΑΓΛΩΤΤΙΣΗ εδώ — δηλαδή να μην μπορεί να
  // προστεθεί τιμή χωρίς τη μηχανή της (βλ. `TableCellOverflow`).
  switch (input.overflow) {
    case 'clip':
      return {
        text: input.numeric
          ? numericFill(input.availableWidthMm, measure)
          : clipWithEllipsis(input.text, input.availableWidthMm, measure),
        clipped: true,
      };
  }
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
 */
function clipWithEllipsis(text: string, availableMm: number, measure: TextWidthMeasure): string {
  const budgetMm = availableMm - measure(CELL_CLIP_ELLIPSIS);
  if (!(budgetMm > 0)) return trimEnd(text.slice(0, fittingPrefixLengthByChar(text, availableMm, measure)));
  const head = trimEnd(text.slice(0, fittingPrefixLengthByChar(text, budgetMm, measure)));
  return head + CELL_CLIP_ELLIPSIS;
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
