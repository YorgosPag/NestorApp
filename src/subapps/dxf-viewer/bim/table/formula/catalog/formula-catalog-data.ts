/**
 * ADR-763 §3 — **τα δεδομένα του καταλόγου**: ποια συνάρτηση σε ποια οικογένεια, και ποιες
 * είναι τεκμηριωμένες. Αρχείο δεδομένων: μηδέν λογική, μηδέν εξάρτηση.
 *
 * ## 🔴 Η διαμέριση είναι ΟΛΟΚΛΗΡΗ — η τεκμηρίωση ΟΧΙ (και είναι δηλωμένο)
 * Κάθε καλέσιμο όνομα ανήκει σε **ακριβώς μία** κατηγορία· αυτό το επιβάλλει test, με τον
 * ίδιο fail-closed κανόνα του §49 (καλέσιμη χωρίς κατηγορία ⇒ κόκκινο). Η **τεκμηρίωση**
 * (υπογραφή ορισμάτων + περιγραφή) καλύπτει τη Φάση 1: όσες γράφει πραγματικά ένας μηχανικός
 * σε πίνακα ποσοτήτων. Οι υπόλοιπες εμφανίζονται κανονικά στη λίστα με `ΟΝΟΜΑ(…)`.
 *
 * ⚠️ **Αυτό είναι απόφαση, όχι έλλειψη.** Μια εφευρημένη υπογραφή είναι **χειρότερη** από την
 * απουσία της: ο χρήστης θα έγραφε τα ορίσματα με τη σειρά που του είπαμε, θα έπαιρνε
 * `#VALUE!` και θα συμπέραινε ότι η συνάρτηση δεν δουλεύει. Η τελεία στο `ΟΝΟΜΑ(…)` λέει
 * «δεν το ξέρω», που είναι αλήθεια και επαληθεύσιμη.
 *
 * ## Γιατί λίστες ανά κατηγορία και όχι `Record<όνομα, κατηγορία>`
 * Ο άνθρωπος που προσθέτει συνάρτηση ρωτά «σε ποια οικογένεια;» και βλέπει τη διπλανή της.
 * Στην αντίστροφη μορφή θα έβλεπε τη διπλανή **αλφαβητικά**, δηλαδή τίποτα χρήσιμο. Και το
 * διπλότυπο (ίδιο όνομα σε δύο λίστες) το πιάνει test — δες `formula-catalog.ts`.
 *
 * @module subapps/dxf-viewer/bim/table/formula/catalog/formula-catalog-data
 * @see docs/centralized-systems/reference/adrs/ADR-763-table-insert-function-dialog.md §3
 */

import type { FormulaCategory } from './formula-catalog-taxonomy';

/**
 * Κατηγορία → τα ονόματα που ανήκουν σε αυτήν, **αλφαβητικά**.
 *
 * Η αλφαβητική σειρά εδώ είναι για τον άνθρωπο που συντηρεί το αρχείο· η σειρά **εμφάνισης**
 * στον διάλογο αποφασίζεται αλλού (και είναι επίσης αλφαβητική, όπως στο Excel).
 */
export const FORMULA_CATEGORY_MEMBERS: Readonly<Record<FormulaCategory, readonly string[]>> = {
  financial: [
    'ACCRINT', 'COUPDAYS', 'CUMIPMT', 'CUMPRINC', 'DB', 'DDB', 'DISC', 'DOLLARDE',
    'DOLLARFR', 'EFFECT', 'FV', 'FVSCHEDULE', 'IPMT', 'IRR', 'ISPMT', 'MIRR',
    'NOMINAL', 'NPER', 'NPV', 'PDURATION', 'PMT', 'PPMT', 'PRICEDISC', 'PV',
    'RATE', 'RRI', 'SLN', 'SYD', 'TBILLEQ', 'TBILLPRICE', 'TBILLYIELD', 'XIRR',
    'XNPV',
  ],

  dateTime: [
    'DATE', 'DATEDIF', 'DAY', 'DAYS', 'DAYS360', 'EDATE', 'EOMONTH', 'HOUR',
    'ISOWEEKNUM', 'MINUTE', 'MONTH', 'NETWORKDAYS', 'NETWORKDAYS.INTL', 'SECOND',
    'TIME', 'WEEKDAY', 'WEEKNUM', 'WORKDAY', 'WORKDAY.INTL', 'YEAR', 'YEARFRAC',
  ],

  mathTrig: [
    'ABS', 'ACOS', 'ACOSH', 'ACOT', 'ACOTH', 'AGGREGATE', 'ARABIC', 'ASIN',
    'ASINH', 'ATAN', 'ATAN2', 'ATANH', 'BASE', 'CEILING', 'CEILING.MATH',
    'CEILING.PRECISE', 'COMBIN', 'COMBINA', 'COS', 'COSH', 'COT', 'COTH', 'CSC',
    'CSCH', 'DECIMAL', 'DEGREES', 'EVEN', 'EXP', 'FACT', 'FACTDOUBLE', 'FLOOR',
    'FLOOR.MATH', 'FLOOR.PRECISE', 'GCD', 'INT', 'ISO.CEILING', 'LCM', 'LN',
    'LOG', 'LOG10', 'MOD', 'MROUND', 'MULTINOMIAL', 'ODD', 'PI', 'POWER',
    'PRODUCT', 'QUOTIENT', 'RADIANS', 'ROMAN', 'ROUND', 'ROUNDDOWN', 'ROUNDUP',
    'SEC', 'SECH', 'SERIESSUM', 'SIGN', 'SIN', 'SINH', 'SQRT', 'SQRTPI',
    'SUBTOTAL', 'SUM', 'SUMIF', 'SUMIFS', 'SUMPRODUCT', 'SUMSQ', 'SUMX2MY2',
    'SUMX2PY2', 'SUMXMY2', 'TAN', 'TANH', 'TRUNC',
  ],

  statistical: [
    'AVEDEV', 'AVERAGE', 'AVERAGEA', 'AVERAGEIF', 'AVERAGEIFS', 'BETA.DIST',
    'BETA.INV', 'BINOM.DIST', 'BINOM.INV', 'CHISQ.DIST', 'CHISQ.DIST.RT',
    'CHISQ.INV', 'CHISQ.INV.RT', 'CHISQ.TEST', 'CONFIDENCE.NORM', 'CONFIDENCE.T',
    'CORREL', 'COUNT', 'COUNTA', 'COUNTBLANK', 'COUNTIF', 'COUNTIFS',
    'COVARIANCE.P', 'COVARIANCE.S', 'DEVSQ', 'EXPON.DIST', 'F.DIST', 'F.DIST.RT',
    'F.INV', 'F.INV.RT', 'F.TEST', 'FISHER', 'FISHERINV', 'FORECAST', 'GAMMA',
    'GAMMALN', 'GAMMALN.PRECISE', 'GAUSS', 'GEOMEAN', 'HARMEAN', 'HYPGEOM.DIST',
    'INTERCEPT', 'KURT', 'LARGE', 'LOGNORM.DIST', 'LOGNORM.INV', 'MAX', 'MAXA',
    'MAXIFS', 'MEDIAN', 'MIN', 'MINA', 'MINIFS', 'MODE.SNGL', 'NEGBINOM.DIST',
    'NORM.DIST', 'NORM.INV', 'NORM.S.DIST', 'NORM.S.INV', 'PEARSON',
    'PERCENTILE.EXC', 'PERCENTILE.INC', 'PERCENTRANK.EXC', 'PERCENTRANK.INC',
    'PERMUT', 'PERMUTATIONA', 'PHI', 'POISSON.DIST', 'PROB', 'QUARTILE.EXC',
    'QUARTILE.INC', 'RANK.AVG', 'RANK.EQ', 'RSQ', 'SKEW', 'SKEW.P', 'SLOPE',
    'SMALL', 'STANDARDIZE', 'STDEV.P', 'STDEV.S', 'STDEVA', 'STDEVPA', 'STEYX',
    'T.DIST.RT', 'TRIMMEAN', 'VAR.P', 'VAR.S', 'VARA', 'VARPA', 'WEIBULL.DIST',
    'Z.TEST',
  ],

  lookup: ['CHOOSE', 'HLOOKUP', 'INDEX', 'LOOKUP', 'MATCH', 'VLOOKUP'],

  database: [
    'DAVERAGE', 'DCOUNT', 'DCOUNTA', 'DGET', 'DMAX', 'DMIN', 'DPRODUCT',
    'DSTDEV', 'DSTDEVP', 'DSUM', 'DVAR', 'DVARP',
  ],

  text: [
    'CHAR', 'CLEAN', 'CODE', 'CONCAT', 'EXACT', 'FIND', 'LEFT', 'LEN', 'LOWER',
    'MID', 'PROPER', 'REPLACE', 'REPT', 'RIGHT', 'SEARCH', 'SUBSTITUTE', 'T',
    'TEXTJOIN', 'TRIM', 'UNICHAR', 'UNICODE', 'UPPER',
  ],

  logical: [
    'AND', 'FALSE', 'IF', 'IFERROR', 'IFNA', 'IFS', 'NOT', 'OR', 'SWITCH',
    'TRUE', 'XOR',
  ],

  information: [
    'ERROR.TYPE', 'ISBLANK', 'ISERR', 'ISERROR', 'ISEVEN', 'ISLOGICAL', 'ISNA',
    'ISNONTEXT', 'ISNUMBER', 'ISODD', 'ISTEXT', 'N', 'NA', 'TYPE',
  ],

  engineering: [
    'BESSELI', 'BESSELJ', 'BESSELK', 'BESSELY', 'BIN2DEC', 'BIN2HEX', 'BIN2OCT',
    'BITAND', 'BITLSHIFT', 'BITOR', 'BITRSHIFT', 'BITXOR', 'COMPLEX', 'CONVERT',
    'DEC2BIN', 'DEC2HEX', 'DEC2OCT', 'DELTA', 'ERF', 'ERFC', 'GESTEP', 'HEX2BIN',
    'HEX2DEC', 'HEX2OCT', 'IMABS', 'IMAGINARY', 'IMARGUMENT', 'IMCONJUGATE',
    'IMCOS', 'IMCOSH', 'IMCOT', 'IMCSC', 'IMCSCH', 'IMDIV', 'IMEXP', 'IMLN',
    'IMLOG10', 'IMLOG2', 'IMPOWER', 'IMPRODUCT', 'IMREAL', 'IMSEC', 'IMSECH',
    'IMSIN', 'IMSINH', 'IMSQRT', 'IMSUB', 'IMSUM', 'IMTAN', 'OCT2BIN', 'OCT2DEC',
    'OCT2HEX',
  ],

  /**
   * Τα παλαιά ονόματα του Excel. Δεν είναι «δεύτερες υλοποιήσεις»: άλλα είναι ψευδώνυμα στην
   * ίδια διαδρομή (`STDEV` → `STDEV.S`, δες `LEGACY_EXCEL_ALIASES`) και άλλα είναι οι
   * προ-2010 εξαγωγές της βιβλιοθήκης. Το Excel τα δείχνει **εδώ** — και ο λόγος που τα
   * δείχνει καθόλου είναι ότι ένας μηχανικός γράφει `=STDEV(...)` από μνήμη.
   */
  compatibility: [
    'BETADIST', 'BETAINV', 'BINOMDIST', 'CHIDIST', 'CHIINV', 'CHITEST',
    'CONCATENATE', 'CONFIDENCE', 'COVAR', 'CRITBINOM', 'EXPONDIST', 'FDIST',
    'FINV', 'FTEST', 'GAMMADIST', 'GAMMAINV', 'HYPGEOMDIST', 'LOGINV',
    'LOGNORMDIST', 'MODE', 'NEGBINOMDIST', 'NORMDIST', 'NORMINV', 'NORMSDIST',
    'NORMSINV', 'PERCENTILE', 'PERCENTRANK', 'POISSON', 'QUARTILE', 'RANK',
    'STDEV', 'STDEVP', 'TDIST', 'TINV', 'TTEST', 'VAR', 'VARP', 'WEIBULL',
    'ZTEST',
  ],
};

/**
 * Οι **τεκμηριωμένες**: για καθεμιά υπάρχουν `args` και `help` σε **αμφότερα** τα locale.
 *
 * 🔴 Το test `formula-catalog-i18n.test.ts` το επιβεβαιώνει ανοίγοντας τα δύο JSON. Ένα όνομα
 * εδώ χωρίς κλειδί εκεί θα έβαφε ωμό κλειδί στην οθόνη (N.11) — γι' αυτό ο έλεγχος δεν είναι
 * «καλό να υπάρχει» αλλά ο **λόγος ύπαρξης** αυτής της λίστας.
 *
 * Το κριτήριο επιλογής είναι ρητό: όσες γράφονται σε **πίνακα ποσοτήτων και προμέτρησης** —
 * αθροίσεις με κριτήρια, στρογγυλοποιήσεις, αναζητήσεις σε τιμοκατάλογο, χειρισμός κειμένου
 * περιγραφών, ημερομηνίες προγράμματος, αποσβέσεις. Οι κατανομές πιθανοτήτων και οι μιγαδικές
 * συναρτήσεις υπάρχουν στη λίστα αλλά δεν τεκμηριώνονται σε αυτή τη φάση.
 */
export const DOCUMENTED_FUNCTION_NAMES: readonly string[] = [
  // Μαθηματικές & Τριγωνομετρικές
  'ABS', 'CEILING', 'COS', 'DEGREES', 'EVEN', 'FLOOR', 'GCD', 'INT', 'LCM',
  'LN', 'LOG', 'LOG10', 'MOD', 'MROUND', 'ODD', 'PI', 'POWER', 'PRODUCT',
  'QUOTIENT', 'RADIANS', 'ROUND', 'ROUNDDOWN', 'ROUNDUP', 'SIGN', 'SIN', 'SQRT',
  'SUBTOTAL', 'SUM', 'SUMIF', 'SUMIFS', 'SUMPRODUCT', 'SUMSQ', 'TAN', 'TRUNC',
  // Στατιστικές
  'AVERAGE', 'AVERAGEIF', 'AVERAGEIFS', 'COUNT', 'COUNTA', 'COUNTBLANK',
  'COUNTIF', 'COUNTIFS', 'LARGE', 'MAX', 'MAXIFS', 'MEDIAN', 'MIN', 'MINIFS',
  'MODE.SNGL', 'PERCENTILE.INC', 'QUARTILE.INC', 'RANK.EQ', 'SMALL', 'STDEV.P',
  'STDEV.S', 'VAR.P', 'VAR.S',
  // Λογικές
  'AND', 'FALSE', 'IF', 'IFERROR', 'IFNA', 'IFS', 'NOT', 'OR', 'SWITCH', 'TRUE',
  'XOR',
  // Αναζήτηση & Αναφορά
  'CHOOSE', 'HLOOKUP', 'INDEX', 'LOOKUP', 'MATCH', 'VLOOKUP',
  // Κείμενο
  'CHAR', 'CLEAN', 'CODE', 'CONCAT', 'EXACT', 'FIND', 'LEFT', 'LEN', 'LOWER',
  'MID', 'PROPER', 'REPLACE', 'REPT', 'RIGHT', 'SEARCH', 'SUBSTITUTE', 'T',
  'TEXTJOIN', 'TRIM', 'UPPER',
  // Πληροφορίες
  'ERROR.TYPE', 'ISBLANK', 'ISERR', 'ISERROR', 'ISEVEN', 'ISLOGICAL', 'ISNA',
  'ISNONTEXT', 'ISNUMBER', 'ISODD', 'ISTEXT', 'N', 'NA', 'TYPE',
  // Ημερομηνία & Ώρα
  'DATE', 'DATEDIF', 'DAY', 'DAYS', 'DAYS360', 'EDATE', 'EOMONTH', 'HOUR',
  'MINUTE', 'MONTH', 'NETWORKDAYS', 'SECOND', 'TIME', 'WEEKDAY', 'WEEKNUM',
  'WORKDAY', 'YEAR', 'YEARFRAC',
  // Χρηματοοικονομικές
  'DDB', 'FV', 'IPMT', 'IRR', 'NPER', 'NPV', 'PMT', 'PPMT', 'PV', 'RATE', 'SLN',
  'SYD',
  // Βάση δεδομένων
  'DAVERAGE', 'DCOUNT', 'DCOUNTA', 'DGET', 'DMAX', 'DMIN', 'DSUM',
  // Μηχανική
  'CONVERT', 'DELTA', 'GESTEP',
  // Συμβατότητα
  'CONCATENATE', 'MODE', 'RANK', 'STDEV', 'VAR',
];
