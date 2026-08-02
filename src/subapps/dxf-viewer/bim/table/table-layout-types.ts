/**
 * ADR-739 Φάση Α — το **αποτέλεσμα** της μηχανής διάταξης.
 *
 * Το `layoutTable(model, style)` βγάζει γεωμετρία σε **sheet-mm και τίποτε άλλο** (§3
 * Αρχή 3): καμία αναφορά σε canvas, PDF, entities ή DXF. Τα τέσσερα backends διαβάζουν
 * ΑΥΤΟ και ζωγραφίζουν το καθένα με τα δικά του μέσα — έτσι «οθόνη === PDF === DXF ===
 * σκηνή» δεν είναι υπόσχεση αλλά δομή.
 *
 * ## Σύστημα συντεταγμένων
 * Αρχή στην **πάνω-αριστερή** γωνία του πίνακα, **+y προς τα κάτω** — ταυτόσημο με το
 * `DetailPrimitive` (`detail-sheet-types.ts`) και με τον χώρο σελίδας του jsPDF. Έτσι
 * τα παραγόμενα primitives δεν χρειάζονται καμία ενδιάμεση μετατροπή· η μοναδική
 * αναστροφή y ζει, όπως πάντα, στο `detail-primitives-to-entities.ts` (§4.1).
 *
 * ## Γιατί επιστρέφεται προϋπολογισμένο και όχι lazy
 * Η διάταξη τρέχει **μόνο** όταν αλλάζει μοντέλο/στυλ — ποτέ ανά frame (§6). Το
 * αποτέλεσμα απομνημονεύεται· ο ζωγράφος κάνει binary search πάνω στο `rows` (αύξον
 * `yMm`) για να βρει μόνο τις ορατές γραμμές: **O(log n + ορατές)**, όχι O(γραμμές).
 * Αυτό είναι το άμεσο μάθημα του ADR-735 — μην κάνεις δουλειά ανάλογη του zoom.
 *
 * @module subapps/dxf-viewer/bim/table/table-layout-types
 */

import type { Point2D } from '../../rendering/types/Types';
import type { TextAlign } from '../structural/detail-sheet/detail-sheet-types';
import type { TableBorderSpec, TableColumnId, TableRowId } from '../../types/table';
import type { TableCellStyle } from './table-style';

/** Ορθογώνιο σε sheet-mm, τοπικά ως προς την πάνω-αριστερή γωνία του πίνακα. */
export interface TableRectMm {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Μία στήλη μετά την επίλυση πλάτους: αριστερή ακμή + τελικό πλάτος. */
export interface TableColumnLayout {
  readonly id: TableColumnId;
  /** Αριστερή ακμή (sheet-mm από την αρχή του πίνακα). */
  readonly xMm: number;
  readonly widthMm: number;
}

/** Μία γραμμή μετά την επίλυση ύψους: πάνω ακμή + τελικό ύψος. Αύξον `yMm`. */
export interface TableRowLayout {
  readonly id: TableRowId;
  /** Πάνω ακμή (sheet-mm από την αρχή του πίνακα). */
  readonly yMm: number;
  readonly heightMm: number;
}

/**
 * Ένα κομμάτι κειμένου έτοιμο προς ζωγραφική. Το `position` είναι το **σημείο
 * αγκύρωσης** που ταιριάζει στο `hAlign` (αριστερή / μεσαία / δεξιά ακμή του κειμένου)
 * και το `y` είναι η **γραμμή βάσης** — ακριβώς η σύμβαση του `TextPrimitive`, ώστε η
 * μετατροπή σε `DetailPrimitive` να είναι αντιγραφή πεδίων.
 */
export interface TableTextRun {
  readonly position: Point2D;
  /**
   * Το **ορατό** κείμενο — ήδη περικομμένο στο όριο του κελιού (ADR-739 Φ.Δ βήμα 5,
   * `table-cell-overflow.ts`). **ΔΕΝ** είναι το κείμενο του μοντέλου: το `TableCell.value`
   * μένει ακέραιο και είναι αυτό που διαβάζει ο in-cell επεξεργαστής.
   */
  readonly text: string;
  /** Ύψος κεφαλαίου γράμματος σε sheet-mm. */
  readonly heightMm: number;
  readonly colorHex: string;
  readonly hAlign: TextAlign;
  readonly bold: boolean;
  /** ADR-739 Φ.Ε — πλάγια γραφή. */
  readonly italic: boolean;
  /** ADR-739 Φ.Ε — υπογράμμιση. */
  readonly underline: boolean;
  /**
   * ADR-739 Φ.Ε (Α3) — η οικογένεια που **και** μετρήθηκε **και** ζωγραφίζεται. Απούσα ⇒ η
   * προεπιλογή του μετρητή.
   *
   * 🔴 Ταξιδεύει στο run και δεν ξαναδιαβάζεται από το στυλ στον ζωγράφο: μέχρι τη Φ.Ε ο
   * καμβάς ζωγράφιζε **καρφωτά** Arial ενώ η διάταξη μετρούσε ό,τι έλεγε το στυλ. Δύο
   * απαντήσεις στην ίδια ερώτηση σημαίνει κείμενο που κόβεται ή αφήνει κενό — και το πιο
   * ύπουλο, μόνο για όσους δηλώσουν άλλη γραμματοσειρά.
   */
  readonly fontFamily?: string;
  /**
   * `true` **μόνο** όταν το κείμενο δεν χώρεσε και κόπηκε· απόν αλλιώς.
   *
   * ## Γιατί προαιρετικό-όταν-αληθές και όχι `boolean`
   * Ίδιος λόγος με το `dashMm` του `borderPrimitive`: ένα ρητό `clipped: false` θα άλλαζε το
   * **σχήμα** κάθε μη-περικομμένου run και μαζί κάθε snapshot που ήδη κλειδώνει τη
   * συμπεριφορά των φύλλων οπλισμού (ADR-622 χαρακτηρισμός), χωρίς καμία οπτική διαφορά.
   *
   * ## Ποιος το χρειάζεται
   * Ο δείκτης («…» / «###») είναι **μέσα** στο `text` — άρα ο ζωγράφος δεν χρειάζεται αυτό
   * το πεδίο. Το χρειάζεται (α) το test που αποδεικνύει ότι και τα τέσσερα backends βλέπουν
   * την ίδια απόφαση, και (β) το **επόμενο** βήμα: ο επεξεργαστής που επεκτείνεται πέρα από
   * το κελί ρωτά ακριβώς αυτό — «κρύβει αυτό το κελί κείμενο;».
   */
  readonly clipped?: true;
  /**
   * 🔴 ADR-739 Φ.Ε/Φ2 βήμα 4 — το **μετρημένο πλάτος** του ορατού κειμένου σε sheet-mm.
   * Παρόν **μόνο** όταν το run είναι υπογραμμισμένο (ίδια σύμβαση σχήματος με το `clipped`:
   * κανένα υπάρχον snapshot δεν μετακινείται για κείμενα χωρίς διακόσμηση).
   *
   * ## Γιατί το πλάτος γεννιέται στη ΔΙΑΤΑΞΗ και όχι στον καθένα που ζωγραφίζει
   * Η υπογράμμιση είναι το **μόνο** μέρος της τυπογραφίας που χρειάζεται να ξέρει πόσο
   * απλώνεται το κείμενο. Μέχρι τη Φ2 ο καμβάς το ρωτούσε με δικό του `ctx.measureText`,
   * δηλαδή με **δεύτερο** όργανο, τη στιγμή που τα άλλα τρία backends (PDF, DXF, ΤΕΚ) δεν
   * έχουν καν όργανο να ρωτήσουν — μια υπογράμμιση εκεί θα ήταν αδύνατη ή μαντεψιά.
   *
   * Εδώ τη μετρά ο **ίδιος** `TableTextMeasurer` που αποφάσισε τα πλάτη στηλών **και** την
   * περικοπή — άρα «πόσο πλατύ είναι αυτό το κείμενο;» έχει μία απάντηση σε ολόκληρη τη
   * διαδρομή, και ο καμβάς σταματά να μετρά ξανά σε κάθε καρέ.
   */
  readonly advanceMm?: number;
}

/**
 * Ένα **ορατό** κελί (τα καλυμμένα από συγχώνευση δεν εμφανίζονται καθόλου). Το `rect`
 * καλύπτει ολόκληρο το εύρος της συγχώνευσης όταν το κελί είναι άγκυρα.
 */
export interface TableCellLayout {
  readonly rowId: TableRowId;
  readonly colId: TableColumnId;
  /** Πλήρες ορθογώνιο του κελιού (μαζί με τα περιθώρια). */
  readonly rect: TableRectMm;
  /** Το τελικό στυλ, με την παράκαμψη κελιού ήδη εφαρμοσμένη. */
  readonly style: TableCellStyle;
  /**
   * Η **επιλυμένη** οριζόντια στοίχιση του κελιού (κελί → στήλη → κλάση γραμμής).
   *
   * Υπάρχει ξεχωριστά από το `text.hAlign` επειδή ένα **κενό** κελί δεν έχει καθόλου
   * `text`, και όμως έχει στοίχιση: ο in-cell επεξεργαστής (ADR-739 Φ.Δ βήμα 3) πρέπει να
   * στοιχίσει τον κέρσορα σε κελί που δεν έχει γράψει ακόμα τίποτα. Και τα δύο πεδία
   * γράφονται από την **ίδια** έκφραση στο `placeCells` — καμία δεύτερη απόφαση.
   */
  readonly hAlign: TextAlign;
  /** Το κείμενο τοποθετημένο· απόν όταν το κελί είναι κενό (κανένα glyph να ζωγραφιστεί). */
  readonly text?: TableTextRun;
  /** Πλήθος γραμμών/στηλών που καλύπτει (1×1 όταν δεν συμμετέχει σε συγχώνευση). */
  readonly rowSpan: number;
  readonly colSpan: number;
}

/**
 * Ένα ευθύγραμμο τμήμα περιγράμματος. Παράγεται **μία φορά ανά ακμή**: δύο γειτονικά
 * κελιά μοιράζονται μία ακμή, οπότε αν το κάθε κελί έβγαζε τις δικές του τέσσερις, κάθε
 * εσωτερική γραμμή θα ζωγραφιζόταν δύο φορές — ορατό σε ημιδιαφανή μολύβια και διπλάσιο
 * κόστος σε PDF/DXF.
 */
export interface TableBorderSegment {
  readonly a: Point2D;
  readonly b: Point2D;
  readonly spec: TableBorderSpec;
}

/** Το πλήρες, απομνημονευμένο αποτέλεσμα της διάταξης. */
export interface TableLayout {
  /** Συνολικό πλάτος = άθροισμα πλατών στηλών. */
  readonly widthMm: number;
  /** Συνολικό ύψος = άθροισμα υψών γραμμών. */
  readonly heightMm: number;
  readonly columns: readonly TableColumnLayout[];
  readonly rows: readonly TableRowLayout[];
  readonly cells: readonly TableCellLayout[];
  readonly borders: readonly TableBorderSegment[];
}

/**
 * Πώς μετριέται το πλάτος ενός κειμένου — βλ. `table-layout-measure.ts`.
 *
 * Το σχήμα του `style` είναι **υποσύνολο** του `TextAdvanceStyle` του text-engine, ώστε ο
 * προεπιλεγμένος μετρητής να είναι πέρασμα πεδίων και όχι μεταφραστής.
 */
export interface TableTextMeasurer {
  (
    text: string,
    heightMm: number,
    style: {
      readonly fontFamily?: string;
      readonly bold?: boolean;
      readonly italic?: boolean;
    },
  ): number;
}

/** Ρυθμίσεις της μιας κλήσης διάταξης. */
export interface TableLayoutOptions {
  /**
   * Διαθέσιμο πλάτος σε sheet-mm. **Απαιτείται** όταν υπάρχει έστω μία `fill` στήλη —
   * χωρίς αυτό δεν ορίζεται τι σημαίνει «το υπόλοιπο». Απόν με μόνο `fixed`/`hug`
   * στήλες ⇒ ο πίνακας παίρνει το φυσικό του πλάτος.
   */
  readonly availableWidthMm?: number;
  /**
   * Μετρητής πλάτους κειμένου. Απών ⇒ `measureTextAdvanceWorld` (ADR-557), ο ΙΔΙΟΣ που
   * χρησιμοποιεί ο renderer — ώστε το πλάτος που υπολογίζει το `hug` να είναι το πλάτος
   * που τελικά ζωγραφίζεται. Η ένεση υπάρχει για ντετερμινιστικά tests, ΟΧΙ για δεύτερη
   * υλοποίηση μέτρησης (N.18).
   */
  readonly measureText?: TableTextMeasurer;
}
