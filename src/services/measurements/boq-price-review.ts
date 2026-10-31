/**
 * Ο ΕΛΕΓΧΟΣ ΤΙΜΩΝ ΕΝΟΣ ΚΤΙΡΙΟΥ ΑΠΕΝΑΝΤΙ ΣΤΟΝ ΤΙΜΟΚΑΤΑΛΟΓΟ ΚΟΣΤΟΥΣ (ADR-923 §5.11 «3ε»).
 *
 * Μόνο **κρίνει**: ποιες δεμένες γραμμές απέκλιναν και ποιες αδέτες βρίσκουν ακριβές ταίριασμα. Η εφαρμογή είναι ρητή πράξη.
 * Οι γραμμές BIM έχουν ήδη κωδικό άρθρου (`OIK-4.01`) ⇒ ένα κτίριο τιμολογείται με ένα κλικ, με προεπισκόπηση.
 *
 * 🔑 Αδέτη γραμμή προτείνεται **μόνο** αν δεν έχει καμία τιμή: τιμή που έγραψε ο άνθρωπος δεν αντικαθίσταται με πρόταση.
 * 🔑 Η επίπτωση σε € υπολογίζεται στη **μικτή** ποσότητα (με φύρα), όπως και το `cost-engine`.
 * 🔑 Γραμμή που δόθηκε φαίνεται, αλλά δεν εφαρμόζεται (`applicable: false`): η απόκλιση πληροφορεί, δεν γράφει.
 *
 * @module services/measurements/boq-price-review
 */

import { matchCostRate, judgeCostDrift } from '@/subapps/catalog/pricing/cost-rate';
import type { CostRate, CostRateBook } from '@/subapps/catalog/types/cost-rate';
import { majorFromMinor } from '@/lib/money/money';
import type { BOQItem } from '@/types/boq';
import { countableBoqLines, isSummaryBoqLine } from './boq-line-role';
import { boqLineAtoeCode, canApplyPrice } from './boq-price-source';
import { computeGrossQuantity } from './cost-engine';

export type BoqPriceReviewRow =
  | { readonly kind: 'proposal'; readonly item: BOQItem; readonly rate: CostRate; readonly impact: number; readonly applicable: boolean }
  | { readonly kind: 'ambiguous'; readonly item: BOQItem }
  | { readonly kind: 'changed'; readonly item: BOQItem; readonly rate: CostRate; readonly changeBp: number | null; readonly exceedsFence: boolean; readonly impact: number; readonly applicable: boolean }
  | { readonly kind: 'upcoming'; readonly item: BOQItem; readonly rate: CostRate; readonly changeBp: number | null; readonly impact: number }
  | { readonly kind: 'unitChanged' | 'lineGone' | 'listGone'; readonly item: BOQItem };

const unitTotal = (item: BOQItem): number => item.materialUnitCost + item.laborUnitCost + item.equipmentUnitCost;

/** Τι θα άλλαζε στο σύνολο της γραμμής σε €. */
function impactOf(item: BOQItem, rate: CostRate): number {
  const next = majorFromMinor(rate.netPrice) / rate.priceQuantity;
  return computeGrossQuantity(item.estimatedQuantity, item.wasteFactor) * (next - unitTotal(item));
}

function reviewLinked(item: BOQItem, book: CostRateBook): BoqPriceReviewRow | null {
  if (!item.priceSource) return null;
  const drift = judgeCostDrift(item.priceSource, book);
  switch (drift.kind) {
    case 'current':
      return null;
    case 'changed':
      return { ...drift, item, impact: impactOf(item, drift.rate), applicable: canApplyPrice(item) };
    case 'upcoming':
      return { ...drift, item, impact: impactOf(item, drift.rate) };
    default:
      return { kind: drift.kind, item };
  }
}

function reviewUnpriced(item: BOQItem, book: CostRateBook): BoqPriceReviewRow | null {
  if (unitTotal(item) !== 0 || !canApplyPrice(item)) return null;
  const match = matchCostRate(book.current, { atoeCode: boqLineAtoeCode(item), unitCode: item.unit, region: null, projectId: item.projectId });
  if (match.kind === 'selected') return { kind: 'proposal', item, rate: match.winner, impact: impactOf(item, match.winner), applicable: true };
  return match.kind === 'ambiguous' ? { kind: 'ambiguous', item } : null;
}

export function reviewBoqPrices(items: readonly BOQItem[], book: CostRateBook): readonly BoqPriceReviewRow[] {
  return countableBoqLines(items)
    .filter((item) => !isSummaryBoqLine(item))
    .flatMap((item) => (item.priceSource ? reviewLinked(item, book) : reviewUnpriced(item, book)) ?? []);
}

/** Οι γραμμές που εφαρμόζονται. Πάνω από τον φράχτη: μόνο μετά από ρητή επιβεβαίωση. */
export function applicableReviewRows(rows: readonly BoqPriceReviewRow[], fenceConfirmed: boolean) {
  return rows.flatMap((row) => {
    if ((row.kind !== 'proposal' && row.kind !== 'changed') || !row.applicable) return [];
    return row.kind === 'changed' && row.exceedsFence && !fenceConfirmed ? [] : [row];
  });
}

/** Το σύνολο επίπτωσης των γραμμών που θα εφαρμοστούν. */
export const reviewImpact = (rows: ReadonlyArray<{ readonly impact: number }>): number => rows.reduce((sum, row) => sum + row.impact, 0);
