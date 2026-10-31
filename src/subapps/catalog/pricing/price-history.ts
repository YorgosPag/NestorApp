/**
 * =============================================================================
 * ΙΣΤΟΡΙΚΟ ΤΙΜΗΣ — ένα υποκείμενο μέσα από τις δημοσιευμένες εκδόσεις (ADR-923 §5.11 «3δ» Τμήμα 3)
 * =============================================================================
 *
 * 🔑 **Ένα σημείο ανά δημοσιευμένη έκδοση, ΚΑΙ όταν το υποκείμενο λείπει από αυτήν** (`line: null`): «αφαιρέθηκε στην
 *    έκδοση 3» είναι γεγονός του ιστορικού, όχι κενό. Η χρονογραμμή είναι η **ίδια** του επιλυτή (`publishedTimeline`).
 * 🔑 **Μεταβολή ανά μονάδα**, από την ίδια συνάρτηση με τον φράχτη της δημοσίευσης (`unitPriceChangeBp`): 100 €/1 τεμ. →
 *    1.000 €/10 τεμ. δεν είναι αλλαγή. Συγκρίνεται με το τελευταίο σημείο **που είχε τιμή** — επανεμφάνιση μετά από
 *    αφαίρεση λέει πόσο άλλαξε σε σχέση με τότε. `null` στο πρώτο σημείο και σε τιμή 0 → θετική (δεν ορίζεται ποσοστό).
 *
 * Καθαρή: οι γραμμές έρχονται από `lineOf` (ο διακομιστής διαβάζει με ντετερμινιστικά id, χωρίς ερώτημα).
 * @module subapps/catalog/pricing/price-history
 */

import type { BasisPoints } from '@/lib/pricing/discount-rule';
import type { PriceListLineDefinition } from '../types/price-list';
import { unitPriceChangeBp } from './diff-price-versions';
import { publishedTimeline, type PriceVersionRef } from './version-timeline';

export type PriceHistoryLine = Pick<PriceListLineDefinition, 'netPrice' | 'priceQuantity' | 'unitCode' | 'discountGroupId'>;

export interface PriceHistoryPoint {
  readonly versionId: string;
  readonly versionNumber: number;
  readonly validFromMs: number;
  /** Παραγόμενο (η επόμενη έκδοση κόβει την προηγούμενη)· `null` = ισχύει χωρίς τέλος. */
  readonly validUntilMs: number | null;
  /** `null` ⇒ το υποκείμενο **δεν** υπάρχει σε αυτή την έκδοση. */
  readonly line: PriceHistoryLine | null;
  readonly unitChangeBp: BasisPoints | null;
}

const lineFieldsOf = ({ netPrice, priceQuantity, unitCode, discountGroupId }: PriceHistoryLine): PriceHistoryLine => ({
  netPrice,
  priceQuantity,
  unitCode,
  discountGroupId,
});

/** Τα σημεία από το παλαιότερο στο νεότερο. Έκδοση χωρίς έγκυρο `validFrom` δεν έχει ισχύ, άρα ούτε σημείο. */
export function buildPriceHistory(
  versions: readonly PriceVersionRef[],
  lineOf: (versionId: string) => PriceHistoryLine | null,
): readonly PriceHistoryPoint[] {
  const points: PriceHistoryPoint[] = [];
  let previous: PriceHistoryLine | null = null;
  for (const { version, window } of publishedTimeline(versions)) {
    const found = lineOf(version.id);
    const line = found === null ? null : lineFieldsOf(found);
    points.push({
      versionId: version.id,
      versionNumber: version.number,
      validFromMs: window.fromMs ?? 0,
      validUntilMs: window.untilMs,
      line,
      unitChangeBp: line !== null && previous !== null ? unitPriceChangeBp(previous, line) : null,
    });
    previous = line ?? previous;
  }
  return points;
}
