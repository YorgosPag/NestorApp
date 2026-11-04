/**
 * **Τελική τιμή με ΦΠΑ** από καθαρό ποσό σε λεπτά (ADR-923 §5.13 Σ6 · Οδηγία 98/6/ΕΚ άρθ. 2(α): «τελική τιμή … συμπεριλαμβανομένου
 * του ΦΠΑ»). Ακέραια λεπτά, **μία** στρογγύλευση μισό-προς-τα-πάνω, η ίδια με την υπόλοιπη μηχανή (`divideHalfUp`).
 *
 * 🔑 Το ποσοστό είναι ακέραιο (οι ελληνικοί συντελεστές: `GREEK_VAT_RATES`). Μη ακέραιο ή αρνητικό ποσοστό ⇒ `null`: η μηχανή
 *    δεν μαντεύει συντελεστή.
 *
 * **Layering**: leaf, καθαρές συναρτήσεις.
 * @module lib/pricing/vat-inclusive
 */

import type { MinorAmount } from '@/lib/money/money';
import { divideHalfUp } from './exact-arithmetic';

const PERCENT = 100n;

/** `net × (100 + ποσοστό) / 100`, μία στρογγύλευση. `null` για άκυρη είσοδο. */
export function vatInclusiveAmount(net: MinorAmount, ratePercent: number): MinorAmount | null {
  if (!Number.isSafeInteger(net) || net < 0) return null;
  if (!Number.isSafeInteger(ratePercent) || ratePercent < 0) return null;
  const gross = divideHalfUp(BigInt(net) * (PERCENT + BigInt(ratePercent)), PERCENT);
  return gross <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(gross) : null;
}
