/**
 * Ποσό γραμμής από τιμή **ανά ποσότητα τιμής** (BMEcat `PRICE_QUANTITY`, ADR-923 §5.11):
 * 12,5 m καλωδίου × 84,00 € «ανά 100 m» = 10,50 €. Ακέραια λεπτά, **μία** στρογγύλευση.
 *
 * 🔑 Η ποσότητα παραγγελίας δέχεται έως `quantityDecimals` δεκαδικά και **αρνείται** περισσότερα —
 * ποτέ σιωπηλή στρογγύλευση της ποσότητας που ζήτησε ο άνθρωπος.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 * @module lib/pricing/line-amount
 */

import type { MinorAmount } from '@/lib/money/money';
import { divideHalfUp, scaledInteger } from './exact-arithmetic';

export interface LineAmountInput {
  /** Καθαρή τιμή σε λεπτά για `perQuantity` μονάδες. */
  readonly unitPrice: MinorAmount;
  /** Πόσες μονάδες αφορά η τιμή (1 · 10 · 100 · 1.000). */
  readonly perQuantity: number;
  /** Η ποσότητα της γραμμής (> 0). */
  readonly quantity: number;
  readonly quantityDecimals: number;
}

/**
 * `unitPrice × quantity / perQuantity`, στρογγυλεμένο **μία** φορά μισό-προς-τα-πάνω.
 * `null` για άκυρη είσοδο (μη θετική ποσότητα, περισσότερα δεκαδικά, μη ακέραιο ποσό).
 */
export function lineAmount(input: LineAmountInput): MinorAmount | null {
  const { unitPrice, perQuantity, quantity, quantityDecimals } = input;
  if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) return null;
  if (!Number.isSafeInteger(perQuantity) || perQuantity <= 0) return null;
  const scale = 10 ** quantityDecimals;
  const scaledQuantity = scaledInteger(quantity, scale);
  if (scaledQuantity === null || scaledQuantity <= 0) return null;
  const amount = divideHalfUp(BigInt(unitPrice) * BigInt(scaledQuantity), BigInt(perQuantity) * BigInt(scale));
  return amount <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(amount) : null;
}
