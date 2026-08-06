/**
 * @related ADR-759 Φ3γ — «ΧΡΟΝΟΣ ΜΕΛΕΤΗΣ» γίνεται ημερομηνία **μόνο όταν είναι** ημερομηνία
 *
 * 🔴 ΤΟ ΚΕΝΤΡΙΚΟ ΣΗΜΕΙΟ: το G753 γράφει «ΙΟΥΛΙΟΣ 2026». Αυτό **δεν είναι** ημερομηνία —
 * είναι μήνας. Το `SurveyRecord.surveyDate` τεκμηριώνεται ως ISO `YYYY-MM-DD`, οπότε ένα
 * `2026-07-01` θα ήταν **εφευρημένη ημέρα που διαβάζεται ως γεγονός**: κανείς, έξι μήνες
 * μετά, δεν θα μπορούσε να ξεχωρίσει το «η μελέτη έγινε την 1η Ιουλίου» από το «το σχέδιο
 * είπε Ιούλιος και κάποιος συμπλήρωσε την πρώτη».
 *
 * ⇒ Ανάλυση **μόνο** όταν υπάρχουν και οι τρεις συνιστώσες. Αλλιώς `null` — και το `rawText`
 * του {@link Sourced} κρατά ακέραιο το «ΙΟΥΛΙΟΣ 2026», που η καρτέλα **εμφανίζει**. Είναι ο
 * κανόνας 3 του ADR-745 §8 («ό,τι διαβάστηκε δεν πετιέται») εφαρμοσμένος στη **μερική**
 * ανάγνωση: η ανάλυση μπορεί να είναι αδύνατη· το πρωτότυπο ποτέ δεν είναι λάθος.
 *
 * 🔑 Και είναι ο λόγος που ο Άξονας Α αξίζει: το **σώμα** του ίδιου σχεδίου γράφει
 * «Θεσσαλονίκη 30/7/2026» (ADR-759 §2β.6) — δηλαδή η πλήρης ημερομηνία **υπάρχει στο αρχείο**
 * και απλώς δεν είναι στην πινακίδα. Η ίδια συνάρτηση τη διαβάζει χωρίς καμία αλλαγή.
 *
 * Καθαρό, μηδέν I/O, καμία εξάρτηση σε React/Firestore — ο Λ2 το φτάνει (άγκυρα καθαρότητας).
 */
import { normalizeForLabelMatch } from '@/utils/greek-text';

/**
 * Οι μήνες σε **ονομαστική και γενική**, γιατί το σχέδιο χρησιμοποιεί και τις δύο:
 * «ΙΟΥΛΙΟΣ 2026» (πινακίδα) και «30 Ιουλίου 2026» (πρόζα σώματος).
 *
 * Τα κλειδιά είναι ήδη κανονικοποιημένα με {@link normalizeForLabelMatch} — δηλαδή χωρίς
 * τόνους, πεζά, χωρίς στίξη. Δεν γράφονται με το χέρι σε δύο μορφές: ο πίνακας κρατά την
 * **πηγαία** γραφή και η κανονικοποίηση γίνεται μία φορά, παρακάτω.
 *
 * ⚠️ **Δεδομένα αναγνώρισης, ΟΧΙ κείμενο διεπαφής** — δεν περνούν από `t()` (ADR-759 §5.6).
 * Μεταφρασμένα, το ίδιο αρχείο θα διαβαζόταν αλλιώς σε αγγλικό περιβάλλον.
 */
const GREEK_MONTH_SOURCES: readonly (readonly [number, readonly string[]])[] = [
  [1, ['ΙΑΝΟΥΑΡΙΟΣ', 'ΙΑΝΟΥΑΡΙΟΥ']],
  [2, ['ΦΕΒΡΟΥΑΡΙΟΣ', 'ΦΕΒΡΟΥΑΡΙΟΥ']],
  [3, ['ΜΑΡΤΙΟΣ', 'ΜΑΡΤΙΟΥ']],
  [4, ['ΑΠΡΙΛΙΟΣ', 'ΑΠΡΙΛΙΟΥ']],
  [5, ['ΜΑΙΟΣ', 'ΜΑΙΟΥ']],
  [6, ['ΙΟΥΝΙΟΣ', 'ΙΟΥΝΙΟΥ']],
  [7, ['ΙΟΥΛΙΟΣ', 'ΙΟΥΛΙΟΥ']],
  [8, ['ΑΥΓΟΥΣΤΟΣ', 'ΑΥΓΟΥΣΤΟΥ']],
  [9, ['ΣΕΠΤΕΜΒΡΙΟΣ', 'ΣΕΠΤΕΜΒΡΙΟΥ']],
  [10, ['ΟΚΤΩΒΡΙΟΣ', 'ΟΚΤΩΒΡΙΟΥ']],
  [11, ['ΝΟΕΜΒΡΙΟΣ', 'ΝΟΕΜΒΡΙΟΥ']],
  [12, ['ΔΕΚΕΜΒΡΙΟΣ', 'ΔΕΚΕΜΒΡΙΟΥ']],
];

const MONTH_BY_NAME: ReadonlyMap<string, number> = new Map(
  GREEK_MONTH_SOURCES.flatMap(([index, names]) =>
    names.map((name) => [normalizeForLabelMatch(name), index] as const),
  ),
);

/** Πόσο ακριβής είναι η ανάγνωση — **δηλωμένη**, ποτέ συμπερασμένη από το αν το ISO είναι `null`. */
export type SurveyDatePrecision = 'day' | 'month' | 'year' | 'none';

export interface ParsedSurveyDate {
  /** ISO `YYYY-MM-DD`. **Μόνο** όταν η ακρίβεια είναι `'day'` — αλλιώς πάντα `null`. */
  readonly iso: string | null;
  readonly precision: SurveyDatePrecision;
  /** Το έτος, όταν αναγνωρίστηκε — χρήσιμο ακόμη κι όταν λείπει η μέρα. */
  readonly year: number | null;
}

const NOTHING: ParsedSurveyDate = { iso: null, precision: 'none', year: null };

/**
 * Έτη που δεχόμαστε ως έτη τοπογραφικής μελέτης.
 *
 * 🔑 Το κάτω όριο **δεν** είναι αυθαίρετο: το G753 φέρει ΦΕΚ του **1992** και συμβόλαιο του
 * **1993**, άρα ένα «σύγχρονο» κατώφλι θα έκοβε πραγματικά δεδομένα. Το πάνω όριο είναι
 * ανοιχτό μέχρι το 2100 — μια μελέτη με έτος 3025 είναι τυπογραφικό, όχι δεδομένο, και το
 * να το δεχτούμε σημαίνει να το γράψουμε στη βάση ως γεγονός.
 */
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

const isPlausibleYear = (year: number): boolean => year >= MIN_YEAR && year <= MAX_YEAR;

/** Πόσες μέρες έχει ο μήνας — ώστε η «31/02» να **μην** γίνει σιωπηλά 3 Μαρτίου. */
function daysInMonth(year: number, month: number): number {
  // `Date.UTC(y, m, 0)` = η τελευταία μέρα του μήνα `m` (1-based) — χωρίς βιβλιοθήκη και
  // χωρίς τοπική ζώνη ώρας, που εδώ θα ήταν σφάλμα: μια ημερομηνία εγγράφου δεν έχει ώρα.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const iso = (year: number, month: number, day: number): string =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/** Πλήρης ημερομηνία, όταν και οι τρεις συνιστώσες στέκουν ως ημερολόγιο. */
function fullDate(year: number, month: number, day: number): ParsedSurveyDate | null {
  if (!isPlausibleYear(year)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { iso: iso(year, month, day), precision: 'day', year };
}

/** Αριθμητικές μορφές: `30/7/2026` · `30-07-2026` · `30.7.2026` · `2026-07-30`. */
const NUMERIC_DMY = /(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{4})/;
const NUMERIC_YMD = /(\d{4})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})/;

/** Λεκτικός μήνας: `30 Ιουλίου 2026` · `Ιούλιος 2026` — η μέρα είναι **προαιρετική**. */
const TEXTUAL = /(?:(\d{1,2})\s+)?([\p{L}]{3,})\s+(\d{4})/u;

/** Σκέτο έτος, τελευταία καταφυγή: `2026`. */
const YEAR_ONLY = /(?:^|\D)(\d{4})(?:\D|$)/;

/**
 * «Τι ημερομηνία λέει αυτό το κείμενο;» — και **πόσο σίγουρα**.
 *
 * ⚠️ Η σειρά των μορφών **είναι** ο αλγόριθμος, όχι στιλ:
 * 1. `YYYY-MM-DD` **πρώτα**, αλλιώς το `2026-07-30` θα το άρπαζε το `NUMERIC_DMY` ως
 *    «ημέρα 20, μήνας 26» από κάποιο υποσύνολο — και το αποτέλεσμα θα ήταν **έγκυρη
 *    ημερομηνία σε λάθος χρονιά**, δηλαδή ακριβώς το «ψέμα με σωστή μορφή» του ADR-745 §8.1.
 * 2. Μετά η αριθμητική DMY (η ελληνική σύμβαση· η αμερικανική MDY **δεν** υποστηρίζεται και
 *    δεν πρέπει: `7/3/2026` δεν είναι διφορούμενο σε ελληνικό έγγραφο).
 * 3. Μετά ο λεκτικός μήνας — που είναι και ο **μόνος** τρόπος να προκύψει `precision: 'month'`.
 * 4. Τέλος σκέτο έτος.
 *
 * Ό,τι δεν ταιριάζει επιστρέφει `'none'` — **ποτέ** εικασία.
 */
export function parseSurveyDate(raw: string): ParsedSurveyDate {
  const text = raw.trim();
  if (text.length === 0) return NOTHING;

  const ymd = NUMERIC_YMD.exec(text);
  if (ymd) {
    const parsed = fullDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
    if (parsed) return parsed;
  }

  const dmy = NUMERIC_DMY.exec(text);
  if (dmy) {
    const parsed = fullDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
    if (parsed) return parsed;
  }

  const textual = TEXTUAL.exec(text);
  if (textual) {
    const parsed = fromTextualMonth(textual);
    if (parsed) return parsed;
  }

  const yearOnly = YEAR_ONLY.exec(text);
  if (yearOnly) {
    const year = Number(yearOnly[1]);
    if (isPlausibleYear(year)) return { iso: null, precision: 'year', year };
  }

  return NOTHING;
}

/** `[, ημέρα?, μήνας-λέξη, έτος]` → ημερομηνία ή μήνας. `null` όταν η λέξη δεν είναι μήνας. */
function fromTextualMonth(match: RegExpExecArray): ParsedSurveyDate | null {
  const month = MONTH_BY_NAME.get(normalizeForLabelMatch(match[2]));
  if (month === undefined) return null;

  const year = Number(match[3]);
  if (!isPlausibleYear(year)) return null;

  const dayText = match[1];
  if (dayText === undefined) return { iso: null, precision: 'month', year };

  // Μέρα **παρούσα αλλά άκυρη** (π.χ. «32 Ιουλίου 2026»): υποβαθμίζουμε σε μήνα αντί να
  // απορρίψουμε τα πάντα. Ο μήνας και το έτος διαβάστηκαν σωστά· μόνο η μέρα δεν στέκει.
  return fullDate(year, month, Number(dayText)) ?? { iso: null, precision: 'month', year };
}
