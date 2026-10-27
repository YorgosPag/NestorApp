/**
 * =============================================================================
 * ΣΥΝΟΛΑ ΠΑΡΑΓΓΕΛΙΑΣ — ο ΕΝΑΣ λογαριασμός υποσύνολο → έκπτωση → φορολογητέα → ΦΠΑ → σύνολο
 * =============================================================================
 *
 * Πριν (ADR-923 §5.11 «3γ», Α6) ο τύπος ζούσε **πέντε** φορές (repository · service ×2 · φόρμα ·
 * `computeGrossTotal`), σε float, και η έκπτωση της σύμβασης κοβόταν **μετά** τον ΦΠΑ (Α2).
 *
 * 🔑 **Η έκπτωση μειώνει τη φορολογητέα αξία και ο ΦΠΑ υπολογίζεται ΜΕΤΑ** — ν. 2859/2000 άρθ. 19
 * §5α («δεν περιλαμβάνονται στη φορολογητέα αξία οι χορηγούμενες εκπτώσεις») και EN 16931 (BT-136
 * έκπτωση γραμμής εκτός ΦΠΑ · BT-109 φορολογητέα · BT-110 ΦΠΑ · BT-112 πληρωτέο).
 *
 * 🔑 Ακέραια λεπτά, **μία** στρογγύλευση ανά ποσό (μισό-προς-τα-πάνω). Αναλλοίωτο:
 * `subtotal − discountAmount = taxableAmount` και `taxableAmount + taxAmount = total`.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 * @module lib/procurement/po-totals
 */

import { majorFromMinor, sumMinor, type MinorAmount } from '@/lib/money/money';
import { divideHalfUp, scaledInteger } from '@/lib/pricing/exact-arithmetic';
import { lineAmount } from '@/lib/pricing/line-amount';

/** Δεκαδικά που δέχεται η ποσότητα γραμμής παραγγελίας. */
export const PO_QUANTITY_DECIMALS = 3;

/** Δεκαδικά που δέχεται η τιμή μονάδας (0,1250 €/τεμ.) — ακρίβεια 1/100 του λεπτού. */
export const PO_UNIT_PRICE_DECIMALS = 4;

/** Η τιμή μονάδας σε 1/100 του λεπτού ⇒ ανά 100 τέτοιες μονάδες βγαίνει ποσό σε λεπτά. */
const UNIT_PRICE_SCALE = 10 ** PO_UNIT_PRICE_DECIMALS;
const UNIT_PRICE_PER_MINOR = UNIT_PRICE_SCALE / 100;

export interface POLineQuantityPrice {
  readonly quantity: number;
  readonly unitPrice: number;
}

/** Ακαθάριστο γραμμής = ποσότητα × τιμή, σε λεπτά. `null` αν η είσοδος δεν αναπαρίσταται ακριβώς. */
export function poLineGrossMinor(line: POLineQuantityPrice): MinorAmount | null {
  const unitPrice = scaledInteger(line.unitPrice, UNIT_PRICE_SCALE);
  if (unitPrice === null || unitPrice < 0) return null;
  return lineAmount({
    unitPrice,
    perQuantity: UNIT_PRICE_PER_MINOR,
    quantity: line.quantity,
    quantityDecimals: PO_QUANTITY_DECIMALS,
  });
}

/** ΦΠΑ σε λεπτά πάνω στη φορολογητέα βάση· ο συντελεστής είναι ακέραιο ποσοστό 0..100. */
export function vatMinor(taxable: MinorAmount, ratePercent: number): MinorAmount {
  if (!Number.isInteger(ratePercent) || ratePercent < 0 || ratePercent > 100) {
    throw new RangeError(`VAT rate must be an integer percent in 0..100, got ${ratePercent}`);
  }
  return Number(divideHalfUp(BigInt(taxable) * BigInt(ratePercent), 100n));
}

export interface POLineAmounts {
  readonly gross: MinorAmount;
  readonly discount: MinorAmount;
}

export interface POTotalsMinor {
  readonly subtotal: MinorAmount;
  readonly discountAmount: MinorAmount;
  readonly taxableAmount: MinorAmount;
  readonly taxAmount: MinorAmount;
  readonly total: MinorAmount;
}

/** Τα σύνολα της παραγγελίας από τα ποσά των γραμμών της. */
export function computePOTotalsMinor(lines: readonly POLineAmounts[], taxRate: number): POTotalsMinor {
  const subtotal = sumMinor(lines.map((line) => line.gross));
  const discountAmount = sumMinor(lines.map((line) => line.discount));
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = vatMinor(taxableAmount, taxRate);
  return { subtotal, discountAmount, taxableAmount, taxAmount, total: taxableAmount + taxAmount };
}

/** Τα ίδια σύνολα σε ευρώ — η μορφή που αποθηκεύει και δείχνει η PO. */
export interface POTotals {
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly taxableAmount: number;
  readonly taxAmount: number;
  readonly total: number;
}

export function poTotalsInMajor(totals: POTotalsMinor): POTotals {
  return {
    subtotal: majorFromMinor(totals.subtotal),
    discountAmount: majorFromMinor(totals.discountAmount),
    taxableAmount: majorFromMinor(totals.taxableAmount),
    taxAmount: majorFromMinor(totals.taxAmount),
    total: majorFromMinor(totals.total),
  };
}
