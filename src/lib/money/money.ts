/**
 * @fileoverview **ΧΡΗΜΑ ΣΕ ΑΚΕΡΑΙΑ ΛΕΠΤΑ** — το SSoT κάθε υπολογισμού ποσού (ADR-835 §4.8 · §21).
 * @related lib/intl-formatting.ts (`formatCurrency`) · lib/properties/price-resolver.ts ·
 *   lib/stay/stay-nightly-quote.ts
 * @module lib/money/money
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΛΕΠΤΑ ΚΑΙ ΟΧΙ ΕΥΡΩ ΜΕ ΥΠΟΔΙΑΣΤΟΛΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `0.1 + 0.2 !== 0.3`. Ένα σύνολο επτά νυχτών με τιμές `64.9` αθροισμένες σε κινητή
 * υποδιαστολή δίνει `454.29999999999995` — και η στρογγύλευση **στο τέλος** κρύβει ότι
 * κάθε ενδιάμεσο άθροισμα ήταν ήδη λάθος. Stripe, Adyen και το API της Airbnb κρατούν
 * ποσά σε **ελάχιστες μονάδες** (ακέραια λεπτά) για ακριβώς αυτόν τον λόγο.
 *
 * ⚠️ **ΔΗΛΩΜΕΝΟ ΟΡΙΟ**: οι **αποθηκευμένες** τιμές της αγγελίας (`askingPrice` ·
 * `rentPrice` · `nightlyRate`) είναι σήμερα ευρώ. Περνούν σε λεπτά **μία φορά**, στο
 * σύνορο, μέσω {@link minorFromMajor} — ποτέ με `* 100` γραμμένο στον καταναλωτή. Η
 * μετάπτωση της αποθήκευσης είναι καταγεγραμμένη στο `.claude-rules/pending-ratchet-work.md`.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 */

import { formatCurrency } from '@/lib/intl-formatting';

/** Ακέραιο ποσό σε **λεπτά** του ευρώ. Ο τύπος είναι ονομαστικός για τον αναγνώστη. */
export type MinorAmount = number;

/** Το νόμισμα του μοντέλου — ένα, σήμερα. */
export const MONEY_CURRENCY = 'EUR';

/** Λεπτά ανά ευρώ. */
const MINOR_PER_MAJOR = 100;

/** `true` αν η τιμή είναι έγκυρο ποσό σε λεπτά (ακέραιο, πεπερασμένο, μη αρνητικό). */
export function isMinorAmount(value: unknown): value is MinorAmount {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/**
 * **Ευρώ → λεπτά**, η ΜΙΑ στρογγύλευση του μοντέλου.
 *
 * 🔑 Το `Number.EPSILON` διορθώνει την αναπαράσταση πριν το `Math.round`: το `1.005`
 * αποθηκεύεται ως `1.00499999…` και χωρίς διόρθωση θα γινόταν **100** λεπτά αντί για 101.
 *
 * @returns `null` για μη πεπερασμένο ή αρνητικό ποσό — ποτέ `NaN` που ταξιδεύει.
 */
export function minorFromMajor(major: number): MinorAmount | null {
  if (!Number.isFinite(major) || major < 0) return null;
  const minor = Math.round((major + Number.EPSILON) * MINOR_PER_MAJOR);
  return Number.isSafeInteger(minor) ? minor : null;
}

/** **Λεπτά → ευρώ**, μόνο για μορφοποίηση ή για πεδίο φόρμας. Ποτέ για αριθμητική. */
export function majorFromMinor(minor: MinorAmount): number {
  return minor / MINOR_PER_MAJOR;
}

/** Άθροισμα σε λεπτά — ακέραια αριθμητική, χωρίς σφάλμα αναπαράστασης. */
export function sumMinor(amounts: readonly MinorAmount[]): MinorAmount {
  return amounts.reduce((total, amount) => total + amount, 0);
}

/** Μορφοποίηση ποσού σε λεπτά με τη γλώσσα του χρήστη (π.χ. «454,30 €»). */
export function formatMinor(minor: MinorAmount): string {
  return formatCurrency(majorFromMinor(minor), MONEY_CURRENCY);
}
