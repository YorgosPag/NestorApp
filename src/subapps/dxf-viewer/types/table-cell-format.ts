/**
 * 🔴 ADR-760 — **Η ΜΟΡΦΗ ΕΝΟΣ ΚΕΛΙΟΥ**: τι *σημαίνει* ο αριθμός, όχι πώς
 * γράφονται τα ψηφία του.
 *
 * Καθαρό type module (μηδέν runtime), αδελφό των `table-edges.ts` / `table-formula.ts`. Η
 * μηχανή ζει στο `bim/table/table-cell-format.ts`.
 *
 * ## 🔴 Ο ΚΑΝΟΝΑΣ ΠΟΥ ΔΕΝ ΣΠΑΕΙ ΠΟΤΕ: ΤΙΜΗ ≠ ΕΜΦΑΝΙΣΗ
 * Η **αποθηκευμένη** τιμή ({@link TableCell.value}) μένει ο ωμός αριθμός. Η μορφή αλλάζει
 * **μόνο** ό,τι διαβάζει το μάτι. Αν την άγγιζε:
 *  1. ο επόμενος τύπος θα διάβαζε στρογγυλεμένο αριθμό ⇒ **σφάλμα τιμής, όχι εμφάνισης**
 *     (ADR-720)·
 *  2. η γραμμή τύπων θα έδειχνε άλλο νούμερο από αυτό που πληκτρολογήθηκε·
 *  3. το round-trip DXF θα έχανε ακρίβεια σε **κάθε** άνοιγμα.
 *
 * Το ArchiCAD είναι η ζωντανή απόδειξη του κόστους: οι Calculation Units ισχύουν για
 * **ολόκληρο** το schedule και η τεκμηρίωσή του δηλώνει ρητά ότι δεν μπορείς να δείξεις άλλη
 * ακρίβεια από αυτή που υπολογίζεις — *«τα νούμερα δεν θα βγαίνουν»*. Δεν είναι περιορισμός
 * υλοποίησης: είναι η συνέπεια του να μην υπάρχει αυτός ο διαχωρισμός. Το Excel τον έχει εδώ
 * και σαράντα χρόνια (value / displayed value).
 *
 * ## 🔬 ΓΙΑΤΙ ΔΟΜΗΜΕΝΗ ΠΡΟΘΕΣΗ ΚΑΙ ΟΧΙ ΜΟΤΙΒΟ ΨΗΦΙΩΝ — η έρευνα, με ονόματα
 *
 * | Εργαλείο | Τι αποθηκεύει | Τι πληρώνει |
 * |---|---|---|
 * | **AutoCAD** | Data type (Angle · Currency · Date · Decimal · General · Percentage · Point · Text · Whole) + format + precision, **ανά κελί**, κληρονομήσιμο από το cell style του TABLESTYLE. Η αριθμητική μορφή είναι `%lu4%pr2` — **τύπος μονάδας + ακρίβεια**, ποτέ μοτίβο ψηφίων | Καμία έννοια locale· κρέμεται από τα καθολικά UNITS του σχεδίου |
 * | **Excel** | Κυριολεκτικό μοτίβο (`#,##0.00`) + προαιρετικό LCID (`[$-409]`) | Η **ίδια** η προδιαγραφή της Microsoft (MS-OE376 §3.8.30) παραδέχεται: *«Some format IDs can be interpreted differently, depending on the UI language of the implementing application»*. Το μοτίβο **δεν είναι φορητό** |
 * | **Revit** | Ανά πεδίο: μονάδα + rounding + σύμβολο, με ρητό opt-out «Use project settings» | Ούτε νόμισμα ούτε ημερομηνία στα schedules |
 * | **CLDR/ICU** | **Number skeletons** — locale-agnostic tokens που αποδίδονται ανά locale | — |
 *
 * 🎯 **Η θέση του ΝΕΣΤΟΡΑ**: δομή AutoCAD/Revit (πρόθεση) + κοκκομέτρηση Excel (ανά κελί) +
 * δεδομένα CLDR (`Intl`). Κανένας από τους τρεις δεν έχει και τα τρία. Και επειδή αποθηκεύεται
 * **πρόθεση**, η μετάφραση προς τα έξω μένει πάντα δυνατή (`ACAD_TABLE` cell format στη Φ.Ε,
 * `numFmt` του `.xlsx` στη Φ5) — ενώ η αντίστροφη, από μοτίβο σε πρόθεση, είναι μαντεψιά.
 *
 * ## Πού ΔΕΝ γεννιέται λεξιλόγιο
 * Κάθε συστατικό έρχεται από SSoT που **ήδη υπάρχει**: `Precision` και `AngularUnitType` και
 * `SupportedLocale` από το `config/number-format-config.ts` (ADR-082, ο «`rtos()`/`angtos()` της
 * TypeScript»). Νέο λεξιλόγιο εδώ θα ήταν το τέταρτο λεξιλόγιο αριθμών του viewer — ακριβώς η
 * παγίδα «2 λεξιλόγια ρόλων» του ADR-694 που η κεφαλίδα του `types/table.ts` επικαλείται ήδη.
 *
 * @module subapps/dxf-viewer/types/table-cell-format
 * @see bim/table/table-cell-format.ts — η μηχανή (απόδοση + επίλυση κληρονομικότητας)
 * @see config/number-format-config.ts — τα λεξιλόγια ακρίβειας/γωνίας/locale (ADR-082)
 * @see docs/centralized-systems/reference/adrs/ADR-760-table-cell-number-format.md
 */

import type {
  AngularUnitType,
  Precision,
  SupportedLocale,
} from '../config/number-format-config';

/**
 * Οι εννέα τύποι δεδομένων του AutoCAD, μείον όσοι **δεν είναι εκφράσιμοι** στο μοντέλο μας.
 *
 * ⚠️ **Λείπει το `Point`, και είναι απόφαση**: το {@link TableCell.value} είναι
 * `string | number | null` (ADR-363), οπότε ένα ζεύγος συντεταγμένων δεν χωρά — θα απαιτούσε
 * νέο `CellKind` με δικό του σχήμα τιμής, δηλαδή **δικιά του φάση**. Δηλωμένο ρητά αντί για
 * σιωπηλά απόν: το `TableCellOverflow` πλήρωσε ήδη το μάθημα ότι «τιμή που πέφτει σιωπηλά σε
 * κάτι άλλο είναι ψέμα του τύπου».
 */
export type TableCellFormatKind =
  | 'general'
  | 'text'
  | 'whole'
  | 'decimal'
  | 'percent'
  | 'currency'
  | 'date'
  | 'angle';

/**
 * Το locale **του σχεδίου**, όχι του χρήστη.
 *
 * ## 🔴 Γιατί ζει στο μοντέλο και όχι σε `getCurrentLocale()`
 * Δύο ανεξάρτητοι λόγοι, και ο δεύτερος είναι μηχανικός:
 *
 * 1. **Το παραδοτέο δεν αλλάζει με το ποιος το άνοιξε.** Ένα σχέδιο που δείχνει `1.200,50`
 *    στον Έλληνα μηχανικό και `1,200.50` στον Άγγλο συνάδελφό του είναι **δύο διαφορετικά
 *    σχέδια**. Είναι ακριβώς το σκεπτικό που κρατά τους `TableFormulaErrorCode` αμετάφραστους
 *    (§49.8): το αρχείο μένει πιστό, ο άνθρωπος παίρνει τον λόγο αλλού.
 * 2. **Η διάταξη είναι απομνημονευμένη.** Το `resolveTableLayout` κρατά `WeakMap` με κλειδί
 *    την **ταυτότητα του μοντέλου**. Ανάγνωση καθολικού locale μέσα στη διάταξη θα σήμαινε ότι
 *    μετά από αλλαγή γλώσσας η μνήμη επιστρέφει **μπαγιάτικο κείμενο** — και, χειρότερα, με
 *    πλάτη στηλών μετρημένα στο παλιό. Ό,τι επηρεάζει τη διάταξη **οφείλει** να είναι στο
 *    μοντέλο.
 *
 * Απόν ⇒ η προεπιλογή του σχεδίου ({@link DEFAULT_TABLE_FORMAT_LOCALE}).
 */
export type TableFormatLocale = SupportedLocale;

/**
 * Η σύμβαση αριθμών του σχεδίου όταν κανείς δεν έχει πει κάτι άλλο: **ελληνική**.
 *
 * Δεν είναι «η γλώσσα του χρήστη» — είναι η σύμβαση των παραδοτέων του γραφείου, όπως τα
 * `UNITS`/`DIMDSEP` του AutoCAD είναι ρυθμίσεις **του σχεδίου**. Ονομασμένη σταθερά ώστε η
 * μέρα που θα γίνει ρύθμιση εγγράφου να είναι μία αλλαγή, όχι αναζήτηση.
 */
export const DEFAULT_TABLE_FORMAT_LOCALE: TableFormatLocale = 'el-GR';

/** Ό,τι ισχύει για κάθε μορφή: πού γράφτηκε, με ποια σύμβαση αριθμών. */
interface TableCellFormatBase {
  readonly locale?: TableFormatLocale;
}

/**
 * **Καμία μορφή** — ο αριθμός όπως τον έγραψε ο χρήστης, το κείμενο ως έχει.
 *
 * 🔑 Το `general` **δεν μαντεύει ποτέ**. Ένα `46239` μπορεί να είναι σειριακή ημερομηνία,
 * τιμή σε ευρώ ή αριθμός τεμαχίων· η αυτόματη αναγνώριση θα ήταν σωστή τις περισσότερες φορές
 * και **σιωπηλά καταστροφική** τις υπόλοιπες. Ίδιος κανόνας με το Excel και το AutoCAD: κελί
 * χωρίς μορφή δείχνει τον αριθμό.
 */
export interface TableGeneralFormat extends TableCellFormatBase {
  readonly kind: 'general';
}

/** **Κείμενο** — ακόμη κι ο αριθμός δείχνεται ως γράμματα, χωρίς ομαδοποίηση. */
export interface TableTextFormat extends TableCellFormatBase {
  readonly kind: 'text';
}

/** **Ακέραιος** (AutoCAD «Whole Number»). */
export interface TableWholeFormat extends TableCellFormatBase {
  readonly kind: 'whole';
  /** Διαχωριστικό χιλιάδων. Απόν ⇒ ναι — η σύμβαση κάθε φύλλου υπολογισμού. */
  readonly grouping?: boolean;
}

/** **Δεκαδικός** (AutoCAD «Decimal Number», Revit «rounding»). */
export interface TableDecimalFormat extends TableCellFormatBase {
  readonly kind: 'decimal';
  readonly decimals: Precision;
  readonly grouping?: boolean;
}

/**
 * **Ποσοστό**.
 *
 * ⚠️ Η αποθηκευμένη τιμή είναι **κλάσμα** (`0,25` ⇒ `25%`), όπως στο Excel: αν ήταν το `25`,
 * τότε το `=A1*B1` πάνω σε ποσοστό θα έδινε εκατονταπλάσιο αποτέλεσμα και ο χρήστης θα έπρεπε
 * να θυμάται να διαιρεί. Η μορφή **πολλαπλασιάζει στην εμφάνιση**, ποτέ στο μοντέλο.
 */
export interface TablePercentFormat extends TableCellFormatBase {
  readonly kind: 'percent';
  readonly decimals: Precision;
}

/**
 * **Νόμισμα**.
 *
 * Ο κωδικός είναι **ISO 4217 τριών γραμμάτων** (`EUR`), όχι το σύμβολο (`€`). Είναι η μία
 * μορφή που η ίδια η τεκμηρίωση του Excel χαρακτηρίζει **φορητή** (*«Three letter currency
 * codes do not need the locale specified»*), ενώ το γυμνό σύμβολο σε μοτίβο εξαρτάται από τη
 * γλώσσα της εφαρμογής. Η **θέση** του συμβόλου (πριν/μετά) και το κενό είναι δουλειά του
 * CLDR, όχι δική μας: στα ελληνικά `1.200,50 €`, στα αγγλικά `€1,200.50`.
 */
export interface TableCurrencyFormat extends TableCellFormatBase {
  readonly kind: 'currency';
  readonly decimals: Precision;
  /** Κωδικός ISO 4217 (`'EUR'`, `'USD'`). Απόν ⇒ {@link DEFAULT_TABLE_CURRENCY}. */
  readonly currency?: string;
  readonly grouping?: boolean;
}

/** Το νόμισμα του γραφείου. Ίδια λογική με το {@link DEFAULT_TABLE_FORMAT_LOCALE}. */
export const DEFAULT_TABLE_CURRENCY = 'EUR';

/**
 * Οι μορφές ημερομηνίας που προσφέρονται — **κατάλογος, όχι ελεύθερο μοτίβο**.
 *
 * Ένα ελεύθερο `'dd/MM/yyyy'` θα ήταν το μοτίβο του Excel με άλλο όνομα: μη επικυρώσιμο, μη
 * μεταφράσιμο σε `Intl`, και με τα ίδια προβλήματα φορητότητας (`MM` σημαίνει άλλο πράγμα σε
 * κάθε βιβλιοθήκη). Ο κατάλογος αντιστοιχίζεται σε `Intl.DateTimeFormatOptions`, οπότε ο ίδιος
 * κωδικός δίνει `05/08/2026` στα ελληνικά και `08/05/2026` στα αγγλικά — **η ίδια πρόθεση**,
 * σωστά γραμμένη και στις δύο.
 */
export type TableDateStyle =
  /** `05/08/2026` — αριθμητική, η προεπιλογή. */
  | 'short'
  /** `5 Αυγ 2026` — μήνας συντομευμένος με γράμματα (καμία διφορούμενη σειρά ψηφίων). */
  | 'medium'
  /** `5 Αυγούστου 2026` */
  | 'long'
  /** `2026-08-05` — ISO 8601, ίδιο σε **κάθε** locale· για ταξινομήσιμες στήλες. */
  | 'iso'
  /** `Αύγουστος 2026` */
  | 'monthYear'
  /** `2026` */
  | 'year';

/** **Ημερομηνία** από σειριακό αριθμό Excel (εποχή `1899-12-30` — δες `excel-serial-date.ts`). */
export interface TableDateFormat extends TableCellFormatBase {
  readonly kind: 'date';
  /** Απόν ⇒ {@link DEFAULT_TABLE_DATE_STYLE}. */
  readonly style?: TableDateStyle;
}

/** Η αριθμητική μορφή — αυτή που καταλαβαίνει κάθε μηχανικός χωρίς λεζάντα. */
export const DEFAULT_TABLE_DATE_STYLE: TableDateStyle = 'short';

/**
 * **Γωνία** — δεκαδικές μοίρες, μοίρες/λεπτά/δευτερόλεπτα, grads, ακτίνια, τοπογραφική.
 *
 * Ο τύπος μονάδας είναι **αυτούσιος** ο `AngularUnitType` του ADR-082: η απόδοση περνά από τον
 * ίδιο `FormatterRegistry` που ήδη ζωγραφίζει κάθε γωνία του viewer. Ένας δεύτερος μετατροπέας
 * DMS εδώ θα σήμαινε ότι η ίδια γωνία μπορεί να γραφτεί αλλιώς σε διάσταση και αλλιώς σε κελί
 * πίνακα — μέσα στο **ίδιο** σχέδιο.
 */
export interface TableAngleFormat extends TableCellFormatBase {
  readonly kind: 'angle';
  /** Απόν ⇒ `'degrees'`. */
  readonly unit?: AngularUnitType;
  readonly decimals: Precision;
}

/**
 * **Πώς δείχνει αυτό το κελί** — η ένωση, με το `kind` ως διακριτή ετικέτα.
 *
 * Η επιλογή διακριτής ένωσης αντί για ένα «flat» αντικείμενο με προαιρετικά πεδία δεν είναι
 * γούστο: κάνει τους παράλογους συνδυασμούς **μη εκφράσιμους** (νόμισμα με μονάδα γωνίας,
 * ημερομηνία με δεκαδικά), και ο μεταγλωττιστής επιβάλλει την πλήρη κάλυψη στη μηχανή απόδοσης
 * — δηλαδή ένας δέκατος τύπος αύριο δεν μπορεί να ξεχαστεί σε κανένα `switch`.
 */
export type TableCellFormat =
  | TableGeneralFormat
  | TableTextFormat
  | TableWholeFormat
  | TableDecimalFormat
  | TablePercentFormat
  | TableCurrencyFormat
  | TableDateFormat
  | TableAngleFormat;

/** «Καμία μορφή» ως τιμή — η βάση κάθε επίλυσης κληρονομικότητας. */
export const TABLE_GENERAL_FORMAT: TableCellFormat = { kind: 'general' };
