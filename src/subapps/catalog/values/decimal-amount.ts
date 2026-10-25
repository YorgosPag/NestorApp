/**
 * =============================================================================
 * ΠΟΣΑ ΚΑΤΑΛΟΓΟΥ — από ό,τι πληκτρολογήθηκε σε κανονική δεκαδική μορφή (ADR-923 §5.10 Δ4)
 * =============================================================================
 *
 * «2,50» (ελληνικό πληκτρολόγιο) · «2.50» · «1.200,50» · «1,200.50» ⇒ **`"2.50"`** / **`"1200.50"`**:
 * κανονική συμβολοσειρά με τελεία, χωρίς ομαδοποίηση, **με** τα τελικά μηδενικά του προμηθευτή.
 *
 * 🔑 **Η διάκριση υποδιαστολής/χιλιάδων ΔΕΝ ξαναγράφεται εδώ**: τη λέει ο ένας κανόνας της
 * πλατφόρμας, το `normalizeDecimalString` (`lib/number/locale-number.ts` — ένα διαχωριστικό =
 * υποδιαστολή· και τα δύο = το τελευταίο είναι υποδιαστολή). Εδώ ζει μόνο η **άρνηση**.
 *
 * 🔴 **Γιατί ΟΧΙ το `parseLocaleNumber`**: εκείνο **αφαιρεί πρώτα τον θόρυβο** (το πεδίο του είναι
 * το νόμισμα: «€ 12,50» → 12,5). Σε τιμή καταλόγου το ίδιο συμβόλαιο θα ήταν σφάλμα τιμής:
 * «2,5x» θα γινόταν 2,5 και «2,5 kW» θα έχανε σιωπηλά τη μονάδα του. Ούτε το
 * `parseStrictDecimal` (επιβιώνει το `Number("0x10") = 16` και το `"1e3"`). Εδώ η γραμματική
 * είναι **ρητή**: πρόσημο · ψηφία (με ή χωρίς ομαδοποίηση ανά 3) · προαιρετικό δεκαδικό μέρος.
 *
 * @module subapps/catalog/values/decimal-amount
 */

import { normalizeDecimalString } from '@/lib/number/locale-number';
import { CATALOG_LIMITS } from '../vocabulary/catalog-limits';

/** Ό,τι δέχεται ο άνθρωπος: πρόσημο (και U+2212), ψηφία με προαιρετική ομαδοποίηση, δεκαδικό μέρος. */
const ENTERED_AMOUNT = /^[-−+]?(?:\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d+)?$/;

/** Η κανονική μορφή: χωρίς περιττά αρχικά μηδενικά, τελεία ως υποδιαστολή, ποτέ «-0». */
const CANONICAL_AMOUNT = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

export interface ParsedAmount {
  /** Κανονική δεκαδική συμβολοσειρά (`"2.50"`) — αυτή αποθηκεύεται. */
  readonly amount: string;
  /** Η αριθμητική τιμή — για σύγκριση και μετατροπή, **ποτέ** για αποθήκευση. */
  readonly value: number;
  /** Δεκαδικά ψηφία όπως γράφτηκαν (`"2.50"` ⇒ 2). */
  readonly decimals: number;
}

function significantDigits(amount: string): number {
  const digits = amount.replace(/^-/, '').replace('.', '').replace(/^0+/, '');
  return digits.length;
}

/** Αφαιρεί περιττά αρχικά μηδενικά και το «-0» από μια ήδη μηχανική δεκαδική συμβολοσειρά. */
function canonicalize(machine: string): string {
  const negative = machine.startsWith('-');
  const [whole, fraction] = machine.replace(/^-/, '').split('.');
  const trimmedWhole = whole.replace(/^0+(?=\d)/, '');
  const body = fraction === undefined ? trimmedWhole : `${trimmedWhole}.${fraction}`;
  const isZero = /^0(?:\.0+)?$/.test(body);
  return negative && !isZero ? `-${body}` : body;
}

/**
 * Διαβάζει ποσό όπως το πληκτρολόγησε άνθρωπος ή το έγραψε κατάλογος. `null` για κενό,
 * για ό,τι δεν είναι **εξ ολοκλήρου** αριθμός («2,5 kW», «abc», «1e3», «0x10») και για ποσό
 * με περισσότερα σημαντικά ψηφία από όσα κρατά ακριβώς ένα double.
 *
 *   "2,50" → 2.50 · "1.200,50" → 1200.50 · "−3,5" → -3.5 · "007" → 7 · "-0,0" → 0.0
 */
export function parseEnteredAmount(input: string): ParsedAmount | null {
  const text = input.trim();
  if (!ENTERED_AMOUNT.test(text)) return null;
  const signless = text.replace(/^[-−+]/, '');
  const negative = /^[-−]/.test(text);
  const machine = normalizeDecimalString(`${negative ? '-' : ''}${signless}`);
  const amount = canonicalize(machine);
  return amountFromCanonical(amount);
}

/** Είναι η συμβολοσειρά **ήδη** κανονικό ποσό (όπως το αποθηκεύει ο γραφέας); */
export function isCanonicalAmount(amount: string): boolean {
  return CANONICAL_AMOUNT.test(amount) && amount !== '-0' && !/^-0\.0+$/.test(amount);
}

/** Κανονικό ποσό → τιμή + δεκαδικά. `null` αν δεν είναι κανονικό ή ξεπερνά την ακρίβεια του double. */
export function amountFromCanonical(amount: string): ParsedAmount | null {
  if (!isCanonicalAmount(amount)) return null;
  if (significantDigits(amount) > CATALOG_LIMITS.maxAmountSignificantDigits) return null;
  const fraction = amount.split('.')[1];
  return { amount, value: Number(amount), decimals: fraction === undefined ? 0 : fraction.length };
}

/**
 * Το **κλειδί ισότητας** ενός κανονικού ποσού: «1.50» και «1.5» είναι ο ίδιος αριθμός, άρα
 * το ίδιο κλειδί (μοναδικότητα, συνδυασμοί αξόνων). Η ακρίβεια κρατιέται στο `amount`· εδώ όχι.
 */
export function amountIdentityKey(amount: string): string {
  if (!amount.includes('.')) return amount;
  const trimmed = amount.replace(/0+$/, '').replace(/\.$/, '');
  return trimmed === '-0' ? '0' : trimmed;
}
