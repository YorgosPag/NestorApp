/**
 * ADR-763 §12 — **η δομή των ορισμάτων**: είδος, υποχρεωτικότητα, επανάληψη. Αρχείο
 * δεδομένων: μηδέν λογική, μία γραμμή ανά συνάρτηση.
 *
 * ## Πώς διαβάζεται μια γραμμή
 * ```
 * 'VLOOKUP': { k: 'arnl', req: 3 },
 *             │            └── τα 3 πρώτα είναι ΥΠΟΧΡΕΩΤΙΚΑ (έντονα)· τα υπόλοιπα προαιρετικά
 *             └── είδη με τη σειρά: array, range, number, logical
 * ```
 * δίπλα στο ήδη μεταφρασμένο `τιμή_αναζήτησης;πίνακας;αριθμός_δείκτη_στήλης;εύρος_αναζήτησης`.
 * Η **σειρά** και το **πλήθος** πρέπει να συμφωνούν — και το test τα συγκρίνει με τα
 * πραγματικά JSON, σε **αμφότερες** τις γλώσσες.
 *
 * ## 🔑 Γιατί `req: <αριθμός>` και όχι σημαία ανά όρισμα
 * Στο Excel τα προαιρετικά ορίσματα είναι **πάντα τα τελευταία** — δεν υπάρχει συνάρτηση με
 * προαιρετικό δεύτερο και υποχρεωτικό τρίτο, γιατί η γραμματική της κλήσης δεν θα μπορούσε να
 * τα ξεχωρίσει. Ένας αριθμός εκφράζει ακριβώς αυτή την αναλλοίωτη· σημαίες ανά όρισμα θα
 * επέτρεπαν να γραφτεί κατάσταση που **δεν μπορεί να υπάρξει**, και κάποιος κάποτε θα τη
 * γράψει.
 *
 * ## ⚠️ ΤΟ ΟΡΙΟ ΕΠΑΝΑΛΗΨΗΣ ΕΙΝΑΙ ΕΝΑ, ΚΑΙ ΕΙΝΑΙ ΔΗΛΩΜΕΝΟ ΩΣ ΠΑΡΑΔΟΧΗ
 * Το Excel έχει διαφορετικό ανώτατο ανά συνάρτηση (252 για `TEXTJOIN`, 254 για `SWITCH`…).
 * **Δεν έχουμε αξιόπιστη πηγή για καθένα**, και μια εικασία ανά γραμμή θα ήταν 36 εφευρημένοι
 * αριθμοί που κανείς δεν θα ξανακοιτούσε. Χρησιμοποιούμε το **σκληρό όριο κλήσης του Excel**
 * ({@link FORMULA_MAX_ARGUMENTS}) για όλες: είναι αληθές ως *ανώτατο* για κάθε μία, και το
 * πραγματικό πλήθος που θα γράψει άνθρωπος σε πίνακα ποσοτήτων είναι μονοψήφιο. Την ημέρα που
 * υπάρξει πηγή, μπαίνει πεδίο εδώ και αλλάζει **μόνο** αυτό το αρχείο.
 *
 * @module subapps/dxf-viewer/bim/table/formula/catalog/formula-argument-data
 * @see formula-argument-taxonomy.ts — τι σημαίνει κάθε γράμμα του κωδικού
 * @see docs/centralized-systems/reference/adrs/ADR-763-table-insert-function-dialog.md §12
 */

/**
 * Το σκληρό όριο ορισμάτων μιας κλήσης στο Excel. Δες την παραδοχή στην κεφαλίδα — είναι
 * **ανώτατο**, όχι η ακριβής τιμή κάθε συνάρτησης.
 */
export const FORMULA_MAX_ARGUMENTS = 255;

/** Η δομή μιας υπογραφής, σε συμπαγή γραφή. */
export interface FormulaArgumentStructure {
  /** Κωδικός ειδών· `*` ή `*N` στο τέλος για επανάληψη. Δες `parseKindCode`. */
  readonly k: string;
  /** Πόσα από τα **πρώτα** ορίσματα είναι υποχρεωτικά. */
  readonly req: number;
  /**
   * 🔴 `true` όταν υπάρχει **γραμμένη περιγραφή για κάθε όρισμα** αυτής της συνάρτησης, στην
   * κάτω γραμμή του διαλόγου ορισμάτων (`table.functionArguments.argHelp.<ΟΝΟΜΑ>.<δείκτης>`).
   *
   * ## Γιατί σημαία εδώ και όχι έλεγχος «υπάρχει το κλειδί;»
   * Το i18next επιστρέφει **το ίδιο το κλειδί** όταν αστοχεί, όχι `undefined` — άρα ο έλεγχος
   * παρουσίας είναι σύγκριση συμβολοσειρών, ακριβώς το μοτίβο που ο `useTranslation`
   * απαγορεύει ρητά στην κεφαλίδα του (`isUnresolved`, ADR-635 Φ C.23). Η ίδια απόφαση με το
   * `documented` του καταλόγου: **τα δεδομένα** δηλώνουν τι ξέρουμε, όχι η αστοχία αναζήτησης.
   *
   * ## Γιατί εδώ και όχι σε δικό της λίστα
   * Μια δεύτερη λίστα ονομάτων συναρτήσεων είναι μια δεύτερη λίστα που αποκλίνει: η πρώτη
   * μετονομασία (`CEILING` → `CEILING.MATH`) θα διορθωνόταν στη μία και θα ξεχνιόταν στην
   * άλλη, και η περιγραφή θα εξαφανιζόταν σιωπηλά. Εδώ η σημαία **δεν μπορεί** να χάσει τη
   * γραμμή της, γιατί είναι μέσα της.
   *
   * ⚠️ **Παράλειψη = «δεν ξέρουμε», και είναι έγκυρη απάντηση.** Ο διάλογος δείχνει τότε κενή
   * κάτω γραμμή — και η ζωντανή προεπισκόπηση (`= <τιμή>`) απαντά στην πραγματικότητα στο «τι
   * περιμένει αυτό το κουτί;». Μια εφευρημένη περιγραφή θα ήταν χειρότερη από την απουσία
   * της: ο χρήστης τη διαβάζει ως βεβαιότητα. Ίδιος κανόνας με τις υπογραφές (ADR-763 §3).
   */
  readonly h?: true;
}

/**
 * Συνάρτηση → δομή ορισμάτων, για τις **153 τεκμηριωμένες**.
 *
 * Τα κλειδιά είναι τα ονόματα **όπως τα γράφει ο χρήστης** (`MODE.SNGL`, με τελεία) και όχι η
 * ισοπεδωμένη μορφή του i18n: εδώ μιλάμε τη γλώσσα του καταλόγου, και η μετάφραση
 * ονόματος→κλειδί γίνεται στο ένα σημείο που την κατέχει (`formulaCatalogKey`).
 */
export const FORMULA_ARGUMENT_STRUCTURE: Readonly<Record<string, FormulaArgumentStructure>> = {
  // ── Μαθηματικά & τριγωνομετρικά ───────────────────────────────────────────
  ABS: { k: 'n', req: 1, h: true },
  CEILING: { k: 'nn', req: 2 },
  COS: { k: 'n', req: 1 },
  DEGREES: { k: 'n', req: 1 },
  EVEN: { k: 'n', req: 1 },
  FLOOR: { k: 'nn', req: 2 },
  GCD: { k: 'nn*', req: 1 },
  INT: { k: 'n', req: 1, h: true },
  LCM: { k: 'nn*', req: 1 },
  LN: { k: 'n', req: 1 },
  LOG: { k: 'nn', req: 1 },
  LOG10: { k: 'n', req: 1 },
  MOD: { k: 'nn', req: 2, h: true },
  MROUND: { k: 'nn', req: 2 },
  ODD: { k: 'n', req: 1 },
  PI: { k: '', req: 0 },
  POWER: { k: 'nn', req: 2, h: true },
  PRODUCT: { k: 'nn*', req: 1, h: true },
  QUOTIENT: { k: 'nn', req: 2 },
  RADIANS: { k: 'n', req: 1 },
  ROUND: { k: 'nn', req: 2, h: true },
  ROUNDDOWN: { k: 'nn', req: 2, h: true },
  ROUNDUP: { k: 'nn', req: 2, h: true },
  SIGN: { k: 'n', req: 1 },
  SIN: { k: 'n', req: 1 },
  SQRT: { k: 'n', req: 1, h: true },
  SUBTOTAL: { k: 'nrr*', req: 2 },
  SUM: { k: 'nn*', req: 1, h: true },
  SUMIF: { k: 'rar', req: 2, h: true },
  SUMIFS: { k: 'rra*2', req: 3, h: true },
  SUMPRODUCT: { k: 'rr*', req: 1 },
  SUMSQ: { k: 'nn*', req: 1 },
  TAN: { k: 'n', req: 1 },
  TRUNC: { k: 'nn', req: 1 },

  // ── Στατιστικά ────────────────────────────────────────────────────────────
  AVERAGE: { k: 'nn*', req: 1, h: true },
  AVERAGEIF: { k: 'rar', req: 2 },
  AVERAGEIFS: { k: 'rra*2', req: 3, h: true },
  COUNT: { k: 'aa*', req: 1, h: true },
  COUNTA: { k: 'aa*', req: 1, h: true },
  COUNTBLANK: { k: 'r', req: 1 },
  COUNTIF: { k: 'ra', req: 2, h: true },
  COUNTIFS: { k: 'ra*2', req: 2, h: true },
  LARGE: { k: 'rn', req: 2 },
  MAX: { k: 'nn*', req: 1, h: true },
  MAXIFS: { k: 'rra*2', req: 3, h: true },
  MEDIAN: { k: 'nn*', req: 1 },
  MIN: { k: 'nn*', req: 1, h: true },
  MINIFS: { k: 'rra*2', req: 3, h: true },
  'MODE.SNGL': { k: 'nn*', req: 1 },
  'PERCENTILE.INC': { k: 'rn', req: 2 },
  'QUARTILE.INC': { k: 'rn', req: 2 },
  'RANK.EQ': { k: 'nrn', req: 2 },
  SMALL: { k: 'rn', req: 2 },
  'STDEV.P': { k: 'nn*', req: 1 },
  'STDEV.S': { k: 'nn*', req: 1 },
  'VAR.P': { k: 'nn*', req: 1 },
  'VAR.S': { k: 'nn*', req: 1 },

  // ── Συμβατότητα (παλαιά ονόματα, ίδια υλοποίηση) ──────────────────────────
  MODE: { k: 'nn*', req: 1 },
  RANK: { k: 'nrn', req: 2 },
  STDEV: { k: 'nn*', req: 1 },
  VAR: { k: 'nn*', req: 1 },

  // ── Κείμενο ───────────────────────────────────────────────────────────────
  CHAR: { k: 'n', req: 1 },
  CLEAN: { k: 't', req: 1 },
  CODE: { k: 't', req: 1 },
  CONCAT: { k: 'tt*', req: 1 },
  CONCATENATE: { k: 'tt*', req: 1, h: true },
  EXACT: { k: 'tt', req: 2 },
  FIND: { k: 'ttn', req: 2 },
  LEFT: { k: 'tn', req: 1, h: true },
  LEN: { k: 't', req: 1, h: true },
  LOWER: { k: 't', req: 1, h: true },
  MID: { k: 'tnn', req: 3, h: true },
  PROPER: { k: 't', req: 1 },
  REPLACE: { k: 'tnnt', req: 4 },
  REPT: { k: 'tn', req: 2 },
  RIGHT: { k: 'tn', req: 1, h: true },
  SEARCH: { k: 'ttn', req: 2 },
  SUBSTITUTE: { k: 'tttn', req: 3 },
  T: { k: 'a', req: 1 },
  TEXTJOIN: { k: 'tltt*', req: 3 },
  TRIM: { k: 't', req: 1, h: true },
  UPPER: { k: 't', req: 1, h: true },

  // ── Λογικές ───────────────────────────────────────────────────────────────
  AND: { k: 'll*', req: 1, h: true },
  FALSE: { k: '', req: 0 },
  IF: { k: 'laa', req: 2, h: true },
  IFERROR: { k: 'aa', req: 2, h: true },
  IFNA: { k: 'aa', req: 2 },
  IFS: { k: 'la*2', req: 2 },
  NOT: { k: 'l', req: 1, h: true },
  OR: { k: 'll*', req: 1, h: true },
  SWITCH: { k: 'aaa*2', req: 3 },
  TRUE: { k: '', req: 0 },
  XOR: { k: 'll*', req: 1 },

  // ── Ημερομηνία & ώρα ──────────────────────────────────────────────────────
  DATE: { k: 'nnn', req: 3 },
  DATEDIF: { k: 'nnt', req: 3 },
  DAY: { k: 'n', req: 1 },
  DAYS: { k: 'nn', req: 2 },
  DAYS360: { k: 'nnl', req: 2 },
  EDATE: { k: 'nn', req: 2 },
  EOMONTH: { k: 'nn', req: 2 },
  HOUR: { k: 'n', req: 1 },
  MINUTE: { k: 'n', req: 1 },
  MONTH: { k: 'n', req: 1 },
  NETWORKDAYS: { k: 'nnr', req: 2 },
  SECOND: { k: 'n', req: 1 },
  TIME: { k: 'nnn', req: 3 },
  WEEKDAY: { k: 'nn', req: 1 },
  WEEKNUM: { k: 'nn', req: 1 },
  WORKDAY: { k: 'nnr', req: 2 },
  YEAR: { k: 'n', req: 1 },
  YEARFRAC: { k: 'nnn', req: 2 },

  // ── Αναζήτηση & αναφορά ───────────────────────────────────────────────────
  CHOOSE: { k: 'naa*', req: 2 },
  HLOOKUP: { k: 'arnl', req: 3 },
  INDEX: { k: 'rnn', req: 2 },
  LOOKUP: { k: 'arr', req: 2 },
  MATCH: { k: 'arn', req: 2 },
  VLOOKUP: { k: 'arnl', req: 3, h: true },

  // ── Βάση δεδομένων ────────────────────────────────────────────────────────
  DAVERAGE: { k: 'rar', req: 3 },
  DCOUNT: { k: 'rar', req: 3 },
  DCOUNTA: { k: 'rar', req: 3 },
  DGET: { k: 'rar', req: 3 },
  DMAX: { k: 'rar', req: 3 },
  DMIN: { k: 'rar', req: 3 },
  DSUM: { k: 'rar', req: 3 },

  // ── Οικονομικά ────────────────────────────────────────────────────────────
  DDB: { k: 'nnnnn', req: 4 },
  FV: { k: 'nnnnn', req: 3 },
  IPMT: { k: 'nnnnnn', req: 4 },
  IRR: { k: 'rn', req: 1 },
  NPER: { k: 'nnnnn', req: 3 },
  NPV: { k: 'nnn*', req: 2 },
  PMT: { k: 'nnnnn', req: 3 },
  PPMT: { k: 'nnnnnn', req: 4 },
  PV: { k: 'nnnnn', req: 3 },
  RATE: { k: 'nnnnnn', req: 3 },
  SLN: { k: 'nnn', req: 3 },
  SYD: { k: 'nnnn', req: 4 },

  // ── Πληροφορίες ───────────────────────────────────────────────────────────
  'ERROR.TYPE': { k: 'a', req: 1 },
  ISBLANK: { k: 'a', req: 1 },
  ISERR: { k: 'a', req: 1 },
  ISERROR: { k: 'a', req: 1 },
  ISEVEN: { k: 'n', req: 1 },
  ISLOGICAL: { k: 'a', req: 1 },
  ISNA: { k: 'a', req: 1 },
  ISNONTEXT: { k: 'a', req: 1 },
  ISNUMBER: { k: 'a', req: 1 },
  ISODD: { k: 'n', req: 1 },
  ISTEXT: { k: 'a', req: 1 },
  N: { k: 'a', req: 1 },
  NA: { k: '', req: 0 },
  TYPE: { k: 'a', req: 1 },

  // ── Μηχανικές ─────────────────────────────────────────────────────────────
  CONVERT: { k: 'ntt', req: 3 },
  DELTA: { k: 'nn', req: 1 },
  GESTEP: { k: 'nn', req: 1 },
};
