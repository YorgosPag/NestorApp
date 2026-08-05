/**
 * ADR-739 §48 — **οι εγκεκριμένες**: η ρητή λίστα που χτίζει το μητρώο. Αρχείο δεδομένων:
 * μηδέν λογική, μηδέν εξάρτηση.
 *
 * ## Γιατί ρητή λίστα και όχι «επιφάνεια μείον απορριφθείσες»
 * Το δεύτερο θα ήταν **fail-open**: μια συνάρτηση που θα πρόσθετε αύριο η βιβλιοθήκη θα
 * έμπαινε στο μητρώο **μόνη της**, χωρίς να την κοιτάξει άνθρωπος. Εδώ ισχύει το αντίστροφο —
 * ό,τι δεν γράφεται εδώ δεν υπάρχει, και η πύλη πληρότητας φροντίζει να μην μπορεί να
 * **λείπει** σιωπηλά.
 *
 * Η σειρά είναι **αλφαβητική επίτηδες**: ο άνθρωπος που ελέγχει την πληρότητα συγκρίνει με
 * την ταξινομημένη επιφάνεια της βιβλιοθήκης, όχι με τη μνήμη του.
 *
 * @module subapps/dxf-viewer/bim/table/formula/library/formula-library-admitted
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §48
 */

/** Οι 340 διαδρομές που μπαίνουν στο μητρώο, όπως εξάγονται από τη βιβλιοθήκη. */
export const ADMITTED_LIBRARY_PATHS: readonly string[] = [
  'ACCRINT', 'ACOS', 'ACOSH', 'ACOT', 'ACOTH', 'AGGREGATE',
  'AND', 'ARABIC', 'ASIN', 'ASINH', 'ATAN', 'ATAN2',
  'ATANH', 'AVEDEV', 'AVERAGEA', 'AVERAGEIF', 'AVERAGEIFS', 'BASE',
  'BESSELI', 'BESSELJ', 'BESSELK', 'BESSELY', 'BETA.DIST', 'BETA.INV',
  'BETADIST', 'BETAINV', 'BIN2DEC', 'BIN2HEX', 'BIN2OCT', 'BINOM.DIST',
  'BINOM.INV', 'BINOMDIST', 'BITAND', 'BITLSHIFT', 'BITOR', 'BITRSHIFT',
  'BITXOR', 'CEILING', 'CEILINGMATH', 'CEILINGPRECISE', 'CHAR', 'CHIDIST',
  'CHIDISTRT', 'CHIINV', 'CHIINVRT', 'CHISQ.DIST', 'CHISQ.INV', 'CHISQ.TEST',
  'CHITEST', 'CLEAN', 'CODE', 'COMBIN', 'COMBINA', 'COMPLEX',
  'CONCAT', 'CONCATENATE', 'CONFIDENCE.NORM', 'CONFIDENCE.T', 'CONVERT', 'CORREL',
  'COS', 'COSH', 'COT', 'COTH', 'COUNTA', 'COUNTBLANK',
  'COUNTIF', 'COUNTIFS', 'COUPDAYS', 'COVAR', 'COVARIANCE.P', 'COVARIANCE.S',
  'CRITBINOM', 'CSC', 'CSCH', 'CUMIPMT', 'CUMPRINC', 'DATE',
  'DATEDIF', 'DAVERAGE', 'DAY', 'DAYS', 'DAYS360', 'DB',
  'DCOUNT', 'DCOUNTA', 'DDB', 'DEC2BIN', 'DEC2HEX', 'DEC2OCT',
  'DECIMAL', 'DEGREES', 'DELTA', 'DEVSQ', 'DGET', 'DISC',
  'DMAX', 'DMIN', 'DOLLARDE', 'DOLLARFR', 'DPRODUCT', 'DSTDEV',
  'DSTDEVP', 'DSUM', 'DVAR', 'DVARP', 'EDATE', 'EFFECT',
  'EOMONTH', 'ERF', 'ERFC', 'EVEN', 'EXACT', 'EXP',
  'EXPON.DIST', 'EXPONDIST', 'F.DIST', 'F.INV', 'F.TEST', 'FACT',
  'FACTDOUBLE', 'FALSE', 'FDIST', 'FDISTRT', 'FIND', 'FINV',
  'FINVRT', 'FISHER', 'FISHERINV', 'FLOOR', 'FLOORMATH', 'FLOORPRECISE',
  'FORECAST', 'FTEST', 'FV', 'FVSCHEDULE', 'GAMMA', 'GAMMADIST',
  'GAMMAINV', 'GAMMALN', 'GAMMALNPRECISE', 'GAUSS', 'GCD', 'GEOMEAN',
  'GESTEP', 'HARMEAN', 'HEX2BIN', 'HEX2DEC', 'HEX2OCT', 'HLOOKUP',
  'HOUR', 'HYPGEOM.DIST', 'HYPGEOMDIST', 'IMABS', 'IMAGINARY', 'IMARGUMENT',
  'IMCONJUGATE', 'IMCOS', 'IMCOSH', 'IMCOT', 'IMCSC', 'IMCSCH',
  'IMDIV', 'IMEXP', 'IMLN', 'IMLOG10', 'IMLOG2', 'IMPOWER',
  'IMPRODUCT', 'IMREAL', 'IMSEC', 'IMSECH', 'IMSIN', 'IMSINH',
  'IMSQRT', 'IMSUB', 'IMSUM', 'IMTAN', 'INDEX', 'INT',
  'INTERCEPT', 'IPMT', 'IRR', 'ISEVEN', 'ISO.CEILING', 'ISODD',
  'ISOWEEKNUM', 'ISPMT', 'KURT', 'LARGE', 'LCM', 'LEFT',
  'LEN', 'LN', 'LOG', 'LOG10', 'LOGINV', 'LOGNORM.DIST',
  'LOGNORM.INV', 'LOGNORMDIST', 'LOOKUP', 'LOWER', 'MATCH', 'MAXA',
  'MAXIFS', 'MEDIAN', 'MID', 'MINA', 'MINIFS', 'MINUTE',
  'MIRR', 'MOD', 'MODE.SNGL', 'MONTH', 'MROUND', 'MULTINOMIAL',
  'NEGBINOM.DIST', 'NEGBINOMDIST', 'NETWORKDAYS', 'NETWORKDAYSINTL', 'NOMINAL', 'NORM.DIST',
  'NORM.INV', 'NORM.S.DIST', 'NORM.S.INV', 'NORMDIST', 'NORMINV', 'NORMSDIST',
  'NORMSINV', 'NOT', 'NPER', 'NPV', 'OCT2BIN', 'OCT2DEC',
  'OCT2HEX', 'ODD', 'OR', 'PDURATION', 'PEARSON', 'PERCENTILE.EXC',
  'PERCENTILE.INC', 'PERCENTRANK.EXC', 'PERCENTRANK.INC', 'PERMUT', 'PERMUTATIONA', 'PHI',
  'PI', 'PMT', 'POISSON.DIST', 'POWER', 'PPMT', 'PRICEDISC',
  'PROB', 'PRODUCT', 'PROPER', 'PV', 'QUARTILE.EXC', 'QUARTILE.INC',
  'QUOTIENT', 'RADIANS', 'RANK.AVG', 'RANK.EQ', 'RATE', 'REPLACE',
  'REPT', 'RIGHT', 'ROMAN', 'ROUNDDOWN', 'ROUNDUP', 'RRI',
  'RSQ', 'SEARCH', 'SEC', 'SECH', 'SECOND', 'SERIESSUM',
  'SIGN', 'SIN', 'SINH', 'SKEW', 'SKEWP', 'SLN',
  'SLOPE', 'SMALL', 'SQRT', 'SQRTPI', 'STANDARDIZE', 'STDEV.P',
  'STDEV.S', 'STDEVA', 'STDEVP', 'STDEVPA', 'STEYX', 'SUBSTITUTE',
  'SUBTOTAL', 'SUMIF', 'SUMIFS', 'SUMPRODUCT', 'SUMSQ', 'SUMX2MY2',
  'SUMX2PY2', 'SUMXMY2', 'SYD', 'T', 'TAN', 'TANH',
  'TBILLEQ', 'TBILLPRICE', 'TBILLYIELD', 'TDIST', 'TDISTRT', 'TEXTJOIN',
  'TIME', 'TINV', 'TRIM', 'TRIMMEAN', 'TRUE', 'TRUNC',
  'TTEST', 'UNICHAR', 'UNICODE', 'UPPER', 'VAR.P', 'VAR.S',
  'VARA', 'VARP', 'VARPA', 'VLOOKUP', 'WEEKDAY', 'WEEKNUM',
  'WEIBULL.DIST', 'WORKDAY', 'WORKDAYINTL', 'XIRR', 'XNPV', 'XOR',
  'YEAR', 'YEARFRAC', 'Z.TEST', 'ZTEST',
];

/**
 * Όσες χρειάζονται το εύρος ως **2Δ** πίνακα γραμμών. Όλες οι υπόλοιπες το παίρνουν
 * επίπεδο — δες {@link FormulaLibraryShape}.
 *
 * Δεν είναι θέμα γούστου: μετρημένο ότι `VLOOKUP` πάνω σε **επίπεδο** πίνακα επιστρέφει
 * `#N/A`. Η λίστα είναι ακριβώς όσες έχουν έννοια «στήλης μέσα στην περιοχή»: οι τέσσερις
 * αναζήτησης και οι δώδεκα βάσης δεδομένων (που δέχονται πίνακα με **κεφαλίδες**).
 */
export const GRID_SHAPED_LIBRARY_PATHS: readonly string[] = [
  'VLOOKUP', 'HLOOKUP', 'LOOKUP', 'INDEX',
  'DAVERAGE', 'DCOUNT', 'DCOUNTA', 'DGET', 'DMAX', 'DMIN',
  'DPRODUCT', 'DSTDEV', 'DSTDEVP', 'DSUM', 'DVAR', 'DVARP',
];

/**
 * Διαδρομή → το όνομα που **γράφει ο χρήστης**, όταν η βιβλιοθήκη ισοπεδώνει την τελεία.
 *
 * Το Excel λέει `CEILING.MATH`· η βιβλιοθήκη το εξάγει ως `CEILINGMATH`. Ο λεξικογράφος μας
 * δέχεται ήδη τελεία μέσα σε όνομα (`NAME_PART`), οπότε το `=CEILING.MATH(...)` φτάνει
 * ολόκληρο στο μητρώο — αρκεί το μητρώο να το ξέρει με **αυτή** τη γραφή.
 */
export const EXCEL_NAME_OVERRIDES: Readonly<Record<string, string>> = {
  CEILINGMATH: 'CEILING.MATH',
  CEILINGPRECISE: 'CEILING.PRECISE',
  FLOORMATH: 'FLOOR.MATH',
  FLOORPRECISE: 'FLOOR.PRECISE',
  GAMMALNPRECISE: 'GAMMALN.PRECISE',
  NETWORKDAYSINTL: 'NETWORKDAYS.INTL',
  WORKDAYINTL: 'WORKDAY.INTL',
  SKEWP: 'SKEW.P',
  CHIDISTRT: 'CHISQ.DIST.RT',
  CHIINVRT: 'CHISQ.INV.RT',
  FDISTRT: 'F.DIST.RT',
  FINVRT: 'F.INV.RT',
  TDISTRT: 'T.DIST.RT',
};

/**
 * Τα **παλαιά** ονόματα του Excel, δεμένα στη σύγχρονη υλοποίηση.
 *
 * ## Γιατί δεν είναι πολυτέλεια
 * Το Excel μετονόμασε αυτές τις εννιά το 2010 και **κράτησε** τα παλιά ονόματα για πάντα.
 * Ένας μηχανικός γράφει `=STDEV(...)`, όχι `=STDEV.S(...)` — και η βιβλιοθήκη δεν εξάγει
 * καλέσιμο `STDEV` καθόλου (είναι **αντικείμενο** χώρου ονομάτων). Χωρίς αυτόν τον πίνακα, οι
 * εννιά πιο συχνά πληκτρολογούμενες στατιστικές θα έδιναν `#NAME?` — και ο χρήστης θα
 * συμπέραινε ότι δεν υπάρχουν.
 *
 * Ένα ψευδώνυμο **δεν** είναι δεύτερη υλοποίηση: δείχνει στην ίδια διαδρομή, άρα δεν μπορεί
 * ποτέ να αποκλίνει. Το ισοπεδωμένο δίδυμο της βιβλιοθήκης (`STDEVS`) μένει απορριφθέν ως
 * `duplicate` — ένα κλειδί, μία σημασία.
 */
export const LEGACY_EXCEL_ALIASES: Readonly<Record<string, readonly string[]>> = {
  'STDEV.S': ['STDEV'],
  'VAR.S': ['VAR'],
  'MODE.SNGL': ['MODE'],
  'POISSON.DIST': ['POISSON'],
  'WEIBULL.DIST': ['WEIBULL'],
  'PERCENTILE.INC': ['PERCENTILE'],
  'QUARTILE.INC': ['QUARTILE'],
  'PERCENTRANK.INC': ['PERCENTRANK'],
  'RANK.EQ': ['RANK'],
  'CONFIDENCE.NORM': ['CONFIDENCE'],
};
