/**
 * @module gtin
 * @description **Το GTIN ως αριθμός** (ADR-934 §5.1.3) — μορφή, ψηφίο ελέγχου GS1, κανονική μορφή 14 ψηφίων και
 * κατάταξη προθέματος. Καθαρό, χωρίς καμία εξάρτηση: πελάτης, διακομιστής, εισαγωγή.
 *
 * 🔑 **Ποτέ μαντεμένος κωδικός** (κανόνας Google Merchant Center): λάθος ψηφίο ελέγχου ⇒ `invalid`. Καμία «διόρθωση»,
 *    κανένα συμπλήρωμα ψηφίου. Ο άνθρωπος ξαναγράφει τον κωδικό.
 * 🔑 **Αποθήκευση και κλειδί = GTIN-14** (αριστερά μηδενικά, GS1 General Specifications). Ο κωδικός που έγραψε ο
 *    προμηθευτής κρατιέται για την εμφάνιση· η σύγκριση γίνεται **μόνο** στο `gtin14`.
 * 🔑 **Η κατάταξη προθέματος γίνεται στο ΑΡΧΙΚΟ μήκος.** Το GTIN-8 έχει **δικό του** πίνακα προθεμάτων
 *    (`000–099` και `200–299` = εσωτερικοί κωδικοί εταιρείας). Αν κατατασσόταν μετά το γέμισμα σε 14 ψηφία, κάθε GTIN-8
 *    θα έπεφτε στο `000` και θα έμοιαζε με κωδικό ΗΠΑ.
 *
 * 🏆 **Πέρα από τους μεγάλους — ποιος κωδικός ΜΠΟΡΕΙ να ταυτίσει δύο πωλητές** (`isMatchableGtin`):
 *    οι κωδικοί περιορισμένης κυκλοφορίας (`020–029`, `040–049`, `200–299`) εκδίδονται **μέσα** σε περιοχή ή εταιρεία
 *    (ζυγαριά σούπερ μάρκετ, εσωτερικός κωδικός καταστήματος) ⇒ **δεν** είναι παγκόσμια μοναδικοί. Δύο καταστήματα
 *    με τον ίδιο εσωτερικό κωδικό **δεν** πουλούν το ίδιο προϊόν. Το ίδιο για κουπόνια, αποδείξεις επιστροφής,
 *    παραδείγματα επίδειξης και δεσμευμένα εύρη.
 *    ⚠️ Τα όρια `980–999` αντιμετωπίζονται **συντηρητικά** ως μη εμπορεύσιμα συνολικά: οι πηγές διαφωνούν αν τα
 *    κουπόνια κοινού νομίσματος είναι `981–983` ή `981–984`, και η διαφωνία **δεν** αλλάζει το αποτέλεσμα εδώ.
 *
 * ⚠️ **UPC-E** (8 ψηφία, συμπιεσμένο GTIN-12) **δεν** είναι GTIN-8: πρέπει να δοθεί αναπτυγμένο σε 12 ψηφία. Αν δοθεί
 *    ως 8 ψηφία που αρχίζουν από `0`, κατατάσσεται ως εσωτερικός κωδικός GTIN-8 ⇒ **δεν** ταυτίζει. Αποτυγχάνει με
 *    ασφάλεια, ποτέ με λάθος ένωση.
 *
 * Πηγές: GS1 General Specifications §3.2 (ψηφίο ελέγχου) · GS1 Prefixes (`gs1.org/prefixes`) · πίνακας GS1-8 προθεμάτων.
 *
 * **Layering**: leaf, καθαρή.
 */

/** Τα μήκη GTIN του GS1. Το UPC-E δεν είναι εδώ: δίνεται αναπτυγμένο ως GTIN-12. */
export const GTIN_LENGTHS = [8, 12, 13, 14] as const;
export type GtinLength = (typeof GTIN_LENGTHS)[number];

/** Το κανονικό μήκος αποθήκευσης και σύγκρισης. */
export const GTIN14_LENGTH = 14;

/**
 * Τι **είναι** ο κωδικός, από το πρόθεμά του:
 *   - `global`: κανονική εμπορεύσιμη μονάδα, παγκόσμια μοναδική·
 *   - `restricted-region` / `restricted-company`: περιορισμένη κυκλοφορία — **όχι** παγκόσμια μοναδικός·
 *   - `publication`: ISSN (977) · ISBN/ISMN (978–979) — παγκόσμια μοναδικός·
 *   - `demonstration`: παραδείγματα του GS1 (952)·
 *   - `non-trade`: κουπόνια, αποδείξεις επιστροφής, GID (951)·
 *   - `reserved`: εύρος που δεν εκδίδεται σήμερα.
 */
export const GTIN_PREFIX_CLASSES = [
  'global',
  'restricted-region',
  'restricted-company',
  'publication',
  'demonstration',
  'non-trade',
  'reserved',
] as const;
export type GtinPrefixClass = (typeof GTIN_PREFIX_CLASSES)[number];

export const GTIN_INVALID_REASONS = ['format', 'length', 'checkDigit', 'allZero'] as const;
export type GtinInvalidReason = (typeof GTIN_INVALID_REASONS)[number];

/**
 * Το ψηφίο-δείκτης του GTIN-14:
 *   - `base`: `0` (ή GTIN-8/12/13) — η μονάδα βάσης·
 *   - `packaging`: `1–8` — **άλλη** εμπορεύσιμη μονάδα (κιβώτιο, παλέτα), όχι το ίδιο προϊόν·
 *   - `variable-measure`: `9` — είδος μεταβλητής ποσότητας (ζυγιζόμενο).
 */
export type GtinIndicator =
  | { readonly kind: 'base' }
  | { readonly kind: 'packaging'; readonly digit: number }
  | { readonly kind: 'variable-measure' };

export interface ValidGtin {
  readonly kind: 'valid';
  /** Το κλειδί αποθήκευσης και σύγκρισης: πάντα 14 ψηφία. */
  readonly gtin14: string;
  /** Τα ψηφία όπως δόθηκαν (χωρίς κενά/παύλες) — για εμφάνιση. */
  readonly digits: string;
  readonly length: GtinLength;
  readonly prefixClass: GtinPrefixClass;
  readonly indicator: GtinIndicator;
}

export interface InvalidGtin {
  readonly kind: 'invalid';
  readonly reason: GtinInvalidReason;
}

export type ParsedGtin = ValidGtin | InvalidGtin;

/** Διαχωριστικά που ανέχεται **μόνο** η είσοδος: κενά (και NBSP), παύλες κάθε είδους. */
const INPUT_SEPARATORS = /[\s \p{Pd}]/gu;
const DIGITS_ONLY = /^\d+$/;

const isGtinLength = (length: number): length is GtinLength => (GTIN_LENGTHS as readonly number[]).includes(length);

/**
 * Το ψηφίο ελέγχου GS1 (mod-10) για τα ψηφία **χωρίς** το τελευταίο. Από δεξιά: βάρη 3, 1, 3, 1…
 * Ίδιος αλγόριθμος για κάθε μήκος — τα αριστερά μηδενικά δεν αλλάζουν το άθροισμα.
 */
export function gs1CheckDigit(payload: string): number {
  let sum = 0;
  for (let index = 0; index < payload.length; index += 1) {
    const fromRight = payload.length - 1 - index;
    sum += Number(payload[index]) * (fromRight % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/** Ισχύει το ψηφίο ελέγχου; Ο καλών εγγυάται μόνο ψηφία. */
export function hasValidGs1CheckDigit(digits: string): boolean {
  if (digits.length < 2) return false;
  return gs1CheckDigit(digits.slice(0, -1)) === Number(digits[digits.length - 1]);
}

/** GTIN-14: αριστερά μηδενικά. */
export function toGtin14(digits: string): string {
  return digits.padStart(GTIN14_LENGTH, '0');
}

/** Η κατάταξη ενός GTIN-8 από τα τρία πρώτα ψηφία του (πίνακας GS1-8). */
function classifyGtin8(digits: string): GtinPrefixClass {
  const prefix = Number(digits.slice(0, 3));
  if (prefix <= 99 || (prefix >= 200 && prefix <= 299)) return 'restricted-company';
  if (prefix >= 977) return 'reserved';
  return 'global';
}

/** Ειδικά εύρη του GS1 Prefix (3 ψηφία) με το νόημά τους. Ό,τι δεν είναι εδώ = κωδικός μέλους GS1 ⇒ `global`. */
const GTIN13_SPECIAL_RANGES: ReadonlyArray<readonly [number, number, GtinPrefixClass]> = [
  [20, 29, 'restricted-region'],
  [40, 49, 'restricted-company'],
  [50, 59, 'reserved'],
  [200, 299, 'restricted-region'],
  [951, 951, 'non-trade'],
  [952, 952, 'demonstration'],
  [977, 979, 'publication'],
  [980, 999, 'non-trade'],
];

/** Η κατάταξη του GS1 Prefix ενός GTIN-12/13/14, πάνω στα 13 ψηφία **μετά** τον δείκτη. */
function classifyGtin13Body(body13: string): GtinPrefixClass {
  const prefix = Number(body13.slice(0, 3));
  const range = GTIN13_SPECIAL_RANGES.find(([from, to]) => prefix >= from && prefix <= to);
  return range ? range[2] : 'global';
}

function indicatorOf(digits: string, length: GtinLength): GtinIndicator {
  if (length !== GTIN14_LENGTH) return { kind: 'base' };
  const digit = Number(digits[0]);
  if (digit === 0) return { kind: 'base' };
  if (digit === 9) return { kind: 'variable-measure' };
  return { kind: 'packaging', digit };
}

/** Τα ψηφία της εισόδου χωρίς διαχωριστικά, ή `null` αν περιέχει κάτι άλλο εκτός από ψηφία. */
export function gtinDigitsOf(input: string): string | null {
  const digits = input.normalize('NFKC').replace(INPUT_SEPARATORS, '');
  return DIGITS_ONLY.test(digits) ? digits : null;
}

/** Ο ΕΝΑΣ αναλυτής GTIN. Κάθε άλλο σημείο (οθόνη, γραφέας, εισαγωγή, ETIM) τον ρωτά — ποτέ δικό του regex. */
export function parseGtin(input: string): ParsedGtin {
  const digits = gtinDigitsOf(input);
  if (digits === null) return { kind: 'invalid', reason: 'format' };
  const length = digits.length;
  if (!isGtinLength(length)) return { kind: 'invalid', reason: 'length' };
  if (/^0+$/.test(digits)) return { kind: 'invalid', reason: 'allZero' };
  if (!hasValidGs1CheckDigit(digits)) return { kind: 'invalid', reason: 'checkDigit' };
  const gtin14 = toGtin14(digits);
  const prefixClass = length === 8 ? classifyGtin8(digits) : classifyGtin13Body(gtin14.slice(1));
  return { kind: 'valid', gtin14, digits, length, prefixClass, indicator: indicatorOf(digits, length) };
}

/** Οι κατηγορίες που ταυτίζουν **ένα** προϊόν σε όλο τον κόσμο. */
const MATCHABLE_PREFIX_CLASSES: ReadonlySet<GtinPrefixClass> = new Set<GtinPrefixClass>(['global', 'publication']);

/**
 * Μπορεί αυτός ο κωδικός να γίνει **κλειδί ταύτισης** ανάμεσα σε πωλητές (ADR-934 §5.1.3 σημ. 4); Η ΜΙΑ κρίση —
 * τη ρωτούν ο γραφέας (Σ1β) και η μηχανή ταύτισης (Σ1δ). `false` ⇒ ο κωδικός αποθηκεύεται, αλλά η ταύτιση πέφτει
 * στο επόμενο σκαλί (μάρκα + MPN).
 */
export function isMatchableGtin(parsed: ParsedGtin): parsed is ValidGtin {
  return parsed.kind === 'valid' && MATCHABLE_PREFIX_CLASSES.has(parsed.prefixClass);
}
