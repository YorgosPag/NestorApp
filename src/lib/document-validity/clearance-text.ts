/**
 * =============================================================================
 * Ανάγνωση κειμένου: φορολογική ενημερότητα (ΑΑΔΕ) · ασφαλιστική ενημερότητα (e-ΕΦΚΑ) · πιστοποιητικό ΕΝΦΙΑ (ΑΑΔΕ)
 * =============================================================================
 *
 * `σελίδες κειμένου (extractPdfText) → { είδος, έκδοση, τυπωμένη λήξη }` — καθαρή, ντετερμινιστική, ποτέ μαντεψιά
 * (ADR-915 §19). Ο αδελφός του `pea-text` για τα έγγραφα του πωλητή.
 *
 * 🔑 **Διασταύρωση, όχι θέση**: το pdf.js βγάζει αυτά τα έντυπα με **ανακατεμένη** σειρά (μετρημένο σε πραγματικά
 * PDF, 2026-10-16: η φορολογική βγαίνει «22/08/2026 Ισχύει έως 22/07/2026 Ισχύει από» — ετικέτα **μετά** από τιμή).
 * Μια ανάγνωση «ετικέτα → επόμενη τιμή» θα έδινε λήξη = έκδοση. Γι' αυτό κάθε ημερομηνία γίνεται δεκτή μόνο όταν
 * **δύο ανεξάρτητες μαρτυρίες του ίδιου εγγράφου συμφωνούν** (ζεύγος ημερομηνιών που απέχει όσο λέει το «ισχύει για
 * N μήνα» · ολογράφως μήνας λήξης · μοναδική ημερομηνία έκδοσης).
 *
 * ⚠️ Ό,τι δεν διασταυρώνεται ⇒ `null` + όνομα στο `unread`. Άγνωστο έντυπο ⇒ `not-recognized`.
 * 🔒 **Δεν διαβάζονται ποτέ** ονόματα, ΑΦΜ, ταυτότητα ή διεύθυνση: δεν τα χρειάζεται τίποτα, και ό,τι δεν διαβάζεται
 * δεν μπορεί να διαρρεύσει.
 * ⚠️ Τα έντυπα **δεν** φέρουν ψηφιακή υπογραφή (κανένα `/ByteRange`, μετρημένο) — η γνησιότητα ελέγχεται από άνθρωπο με
 * τον κωδικό εγκυρότητας του εγγράφου.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι.
 *
 * @module lib/document-validity/clearance-text
 */

import { addDaysToDateKey } from '@/lib/calendar/date-key';
import { normalizeCalendarDay } from '@/lib/date-local';
import { matchCalendarName } from '@/lib/date/calendar-name-vocabulary';
import type { DocumentKind } from '@/config/document-validity/document-validity';
import { addMonthsToDateKey } from '@/lib/calendar/date-key';

/** Ο αναγνώστης ανά έντυπο — η **προέλευση** που γράφεται στο `documentFacts.source.reader`. */
export const CLEARANCE_TEXT_READERS = {
  'tax-clearance': 'aade-tax-clearance-text',
  'insurance-clearance': 'efka-insurance-clearance-text',
  'enfia-certificate': 'aade-enfia-certificate-text',
} as const satisfies Partial<Record<DocumentKind, string>>;

export type ClearanceKind = keyof typeof CLEARANCE_TEXT_READERS;
export type ClearanceTextReader = (typeof CLEARANCE_TEXT_READERS)[ClearanceKind];

export interface ClearanceReading {
  readonly kind: ClearanceKind;
  readonly reader: ClearanceTextReader;
  /** `YYYY-MM-DD` — `null` = δεν διασταυρώθηκε. */
  readonly issuedOn: string | null;
  readonly printedValidUntil: string | null;
  readonly unread: readonly ('issuedOn' | 'printedValidUntil')[];
}

export type ClearanceTextResult =
  | { readonly kind: 'read'; readonly reading: ClearanceReading }
  | { readonly kind: 'not-recognized' };

/**
 * Πόσες ημέρες **πριν** από το «έκδοση + N μήνες» μπορεί να τυπώσει ο e-ΕΦΚΑ τη λήξη. Μετρημένο: έκδοση 21/07/2026,
 * «6 μήνες», τυπωμένη 20/01/2027 (−1 ημέρα)· η ΥΑ 15435/913/2020 άρθρο 6 μεταφέρει λήξη σε αργία στην **προηγούμενη**
 * εργάσιμη (Σαββατοκύριακο + αργία ⇒ έως 3 ακόμη). Πέρα από αυτό η διασταύρωση αποτυγχάνει ⇒ `null`.
 */
const EFKA_EARLY_EXPIRY_TOLERANCE_DAYS = 5;

// =============================================================================
// ΚΟΙΝΑ
// =============================================================================

const flatten = (pages: readonly string[]): string => pages.join(' ').replace(/\s+/g, ' ');

/** Όλες οι ημερομηνίες `ΗΗ/ΜΜ/ΕΕΕΕ` του κειμένου, μοναδικές, ως `YYYY-MM-DD` (άκυρες πετιούνται). */
function slashDatesOf(text: string): string[] {
  const keys = [...text.matchAll(/(?<!\d)\d{2}\/\d{2}\/\d{4}(?!\d)/g)]
    .map(([date]) => normalizeCalendarDay(date))
    .filter((key): key is string => key !== null);
  return [...new Set(keys)];
}

/** Ο αριθμός μήνα (1–12) μιας λέξης σε γενική πτώση («Αυγούστου», «ΑΥΓΟΥΣΤΟΥ») — `null` αν δεν είναι μήνας. */
function genitiveMonthOf(word: string): number | null {
  const match = matchCalendarName(word, ['greek-month'], ['genitive']);
  return match === null ? null : match.index + 1;
}

function readingOf(kind: ClearanceKind, issuedOn: string | null, printedValidUntil: string | null): ClearanceTextResult {
  const unread = [
    ...(issuedOn === null ? ['issuedOn' as const] : []),
    ...(printedValidUntil === null ? ['printedValidUntil' as const] : []),
  ];
  return { kind: 'read', reading: { kind, reader: CLEARANCE_TEXT_READERS[kind], issuedOn, printedValidUntil, unread } };
}

// =============================================================================
// ΦΟΡΟΛΟΓΙΚΗ ΕΝΗΜΕΡΟΤΗΤΑ (ΑΑΔΕ)
// =============================================================================

const TAX_SIGNATURE = /ΑΠΟΔΕΙΚΤΙΚΟ ΕΝΗΜΕΡΟΤΗΤΑΣ ΓΙΑ ΧΡΕΗ ΠΡΟΣ ΤΟ ΔΗΜΟΣΙΟ/;

/**
 * Το ζεύγος (έκδοση, λήξη) που απέχει **ακριβώς** όσο λέει το «ισχύει για N μήνα», επιβεβαιωμένο από τον **ολογράφως**
 * μήνα της «Ημερομηνίας λήξης ισχύος». Δύο ή κανένα ζεύγος ⇒ δεν διαβάζεται.
 */
function readTax(text: string): ClearanceTextResult {
  const months = /ισχύει για (\d{1,2}) μήν(?:α|ες)/i.exec(text);
  const spelled = /Ημερομηνία λήξης ισχύος\s*:\s*([Α-ΩΆ-Ώ ]+)/.exec(text);
  if (months === null) return readingOf('tax-clearance', null, null);
  const dates = slashDatesOf(text);
  const pairs = dates.flatMap((from) => {
    const until = addMonthsToDateKey(from, Number(months[1]));
    return until !== null && dates.includes(until) ? [[from, until] as const] : [];
  });
  if (pairs.length !== 1) return readingOf('tax-clearance', null, null);
  const [issuedOn, until] = pairs[0];
  const spelledMonths = (spelled?.[1] ?? '').split(' ').map(genitiveMonthOf).filter((month): month is number => month !== null);
  const confirmed = spelledMonths.length === 1 && spelledMonths[0] === Number(until.slice(5, 7));
  return confirmed ? readingOf('tax-clearance', issuedOn, until) : readingOf('tax-clearance', null, null);
}

// =============================================================================
// ΑΣΦΑΛΙΣΤΙΚΗ ΕΝΗΜΕΡΟΤΗΤΑ (e-ΕΦΚΑ)
// =============================================================================

const INSURANCE_SIGNATURE = /ΑΠΟΔΕΙΚΤΙΚΟ ΑΣΦΑΛΙΣΤΙΚΗΣ ΕΝΗΜΕΡΟΤΗΤΑΣ/;

/** Η μοναδική άλλη ημερομηνία του εγγράφου που, + N μήνες, πέφτει λίγες μέρες **μετά** την τυπωμένη λήξη. */
function efkaIssueOf(text: string, until: string): string | null {
  const months = /ΙΣΧΥΕΙ ΕΠΙ [Α-Ω]+ \((\d{1,2})\) ΜΗΝ(?:ΕΣ|Α)/.exec(text);
  if (months === null) return null;
  const candidates = slashDatesOf(text).filter((from) => {
    const nominal = addMonthsToDateKey(from, Number(months[1]));
    const earliest = nominal === null ? null : addDaysToDateKey(nominal, -EFKA_EARLY_EXPIRY_TOLERANCE_DAYS);
    return from !== until && nominal !== null && earliest !== null && until >= earliest && until <= nominal;
  });
  return candidates.length === 1 ? candidates[0] : null;
}

function readInsurance(text: string): ClearanceTextResult {
  const printed = /Μέχρι (\d{2}\/\d{2}\/\d{4})/.exec(text);
  const until = printed === null ? null : normalizeCalendarDay(printed[1]);
  return readingOf('insurance-clearance', until === null ? null : efkaIssueOf(text, until), until);
}

// =============================================================================
// ΠΙΣΤΟΠΟΙΗΤΙΚΟ ΕΝΦΙΑ (ΑΑΔΕ)
// =============================================================================

const ENFIA_SIGNATURE = /ενιαίου φόρου ιδιοκτησίας ακινήτων/;

/** Η έκδοση = η **μοναδική** ημερομηνία `ΗΗ/ΜΜ/ΕΕΕΕ` του εντύπου, με την ετικέτα της παρούσα· η λήξη = ολογράφως. */
function readEnfia(text: string): ClearanceTextResult {
  const dates = slashDatesOf(text);
  const issuedOn = dates.length === 1 && /Ημερομηνία Έκδοσης/.test(text) ? dates[0] : null;
  const spelled = /ισχύει μέχρι την (\d{1,2}) ?η ([Α-Ωα-ωΆ-Ώά-ώϊϋΐΰ]+) (\d{4})/.exec(text);
  const month = spelled === null ? null : genitiveMonthOf(spelled[2]);
  const until = spelled === null || month === null
    ? null
    : normalizeCalendarDay(`${spelled[3]}-${String(month).padStart(2, '0')}-${spelled[1].padStart(2, '0')}`);
  return readingOf('enfia-certificate', issuedOn, until);
}

// =============================================================================
// ΕΙΣΟΔΟΣ
// =============================================================================

/** Ποιο έντυπο είναι — **πριν** από κάθε ανάγνωση. Η σειρά μετρά: η ασφαλιστική δεν περιέχει τη φράση της φορολογικής. */
const TEMPLATES: readonly { readonly signature: RegExp; readonly read: (text: string) => ClearanceTextResult }[] = [
  { signature: TAX_SIGNATURE, read: readTax },
  { signature: INSURANCE_SIGNATURE, read: readInsurance },
  { signature: ENFIA_SIGNATURE, read: readEnfia },
];

/** Σελίδες κειμένου → ανάγνωση, ή `not-recognized` για κάθε άλλο έντυπο (ή σαρωμένη εικόνα χωρίς κείμενο). */
export function readClearanceText(pages: readonly string[]): ClearanceTextResult {
  const text = flatten(pages);
  const template = TEMPLATES.find(({ signature }) => signature.test(text));
  return template === undefined ? { kind: 'not-recognized' } : template.read(text);
}
