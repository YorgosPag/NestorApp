/**
 * =============================================================================
 * ΤΙΜΟΛΟΓΗΣΗ ΠΑΡΑΓΓΕΛΙΑΣ — συμβάσεις ανά γραμμή → εκπτώσεις → σύνολα (ADR-923 §5.11 «3γ»)
 * =============================================================================
 *
 * Η ΜΙΑ συνάρτηση που τιμολογεί μια PO· την καλούν **και** ο server (αυθεντικά, tamper-proof —
 * ADR-330 C.2) **και** η φόρμα (ζωντανή προεπισκόπηση). Ίδια είσοδος ⇒ ίδιο αποτέλεσμα, παντού.
 *
 * 1. ακαθάριστο κάθε γραμμής (`po-totals`) · 2. σύμβαση κάθε γραμμής (`selectLineAgreement`) ·
 * 3. 🔑 **group condition** (SAP): η κλίμακα μιας σύμβασης μετρά στο **άθροισμα** των γραμμών που
 *    καλύπτει, και το ποσοστό εφαρμόζεται σε **κάθε** γραμμή της · 4. σύνολα με ΦΠΑ **μετά** την έκπτωση.
 *
 * Χωρίς I/O και χωρίς `server-only` ⇒ τρέχει σε jest, σε browser και στον server.
 * @module lib/procurement/price-purchase-order-pure
 */

import type { MinorAmount } from '@/lib/money/money';
import { majorFromMinor, sumMinor } from '@/lib/money/money';
import { applyDiscountSteps, effectivePercent, stepsForBasis, type BasisPoints } from '@/lib/pricing/discount-rule';
import type { FrameworkAgreementLike } from '@/subapps/procurement/types/framework-agreement';
import {
  faDiscountRule,
  selectLineAgreement,
  type FaSelection,
} from '@/subapps/procurement/utils/framework-agreement-discount';
import type { POLineFaDiscount } from '@/types/procurement/purchase-order';
import { computePOTotalsMinor, poLineGrossMinor, poTotalsInMajor, type POTotals } from './po-totals';

export interface POPricingLine {
  readonly quantity: number;
  readonly unitPrice: number;
  readonly materialId?: string | null;
  readonly categoryCode: string;
}

export interface POPricingInput {
  readonly supplierId: string | null | undefined;
  readonly projectId: string | null | undefined;
  readonly items: readonly POPricingLine[];
  readonly taxRate: number;
  /** Ημερομηνία τιμολόγησης (SAP pricing date): δημιουργία = τώρα, επεξεργασία = `dateCreated`. */
  readonly atMs: number;
}

export interface PricedPOLine {
  /** `null` αν ποσότητα/τιμή δεν αναπαρίστανται ακριβώς — ο server αρνείται, η φόρμα το δείχνει. */
  readonly grossMinor: MinorAmount | null;
  readonly faDiscount: POLineFaDiscount | null;
  /** Το ίχνος της επιλογής (SAP «pricing analysis») — `null` όταν δεν έγινε επιλογή. */
  readonly selection: FaSelection | null;
}

export interface POPricing {
  readonly lines: readonly PricedPOLine[];
  readonly totals: POTotals;
  readonly appliedFaIds: readonly string[];
  readonly ambiguousLineIndexes: readonly number[];
  readonly invalidLineIndexes: readonly number[];
}

interface LineWinner {
  readonly index: number;
  readonly gross: MinorAmount;
  readonly fa: FrameworkAgreementLike;
}

function selectWinners(
  agreements: readonly FrameworkAgreementLike[],
  input: POPricingInput,
  grosses: readonly (MinorAmount | null)[],
): { selections: (FaSelection | null)[]; winners: LineWinner[] } {
  const { supplierId, projectId } = input;
  const selections: (FaSelection | null)[] = [];
  const winners: LineWinner[] = [];
  input.items.forEach((item, index) => {
    const gross = grosses[index];
    if (!supplierId || !projectId || gross === null || agreements.length === 0) {
      selections.push(null);
      return;
    }
    const line = { supplierId, projectId, materialId: item.materialId ?? null, categoryCode: item.categoryCode };
    const selection = selectLineAgreement(agreements, line, input.atMs);
    selections.push(selection);
    if (selection.kind === 'selected') winners.push({ index, gross, fa: selection.winner });
  });
  return { selections, winners };
}

/** Group condition: τα βήματα κάθε σύμβασης πάνω στο άθροισμα των γραμμών της. */
function stepsByAgreement(winners: readonly LineWinner[]): Map<string, readonly BasisPoints[]> {
  const groups = new Map<string, { fa: FrameworkAgreementLike; grosses: MinorAmount[] }>();
  for (const winner of winners) {
    const group = groups.get(winner.fa.id) ?? { fa: winner.fa, grosses: [] };
    group.grosses.push(winner.gross);
    groups.set(winner.fa.id, group);
  }
  const steps = new Map<string, readonly BasisPoints[]>();
  for (const [id, group] of groups) steps.set(id, stepsForBasis(faDiscountRule(group.fa), sumMinor(group.grosses)));
  return steps;
}

interface LineDiscount {
  readonly record: POLineFaDiscount;
  readonly minor: MinorAmount;
}

function lineDiscounts(winners: readonly LineWinner[]): Map<number, LineDiscount> {
  const steps = stepsByAgreement(winners);
  const discounts = new Map<number, LineDiscount>();
  for (const winner of winners) {
    const lineSteps = steps.get(winner.fa.id) ?? [];
    if (lineSteps.length === 0) continue;
    const { discount } = applyDiscountSteps(winner.gross, lineSteps);
    const record = { agreementId: winner.fa.id, discountPercent: effectivePercent(lineSteps), discountAmount: majorFromMinor(discount) };
    discounts.set(winner.index, { record, minor: discount });
  }
  return discounts;
}

function indexesWhere<T>(values: readonly T[], predicate: (value: T) => boolean): number[] {
  return values.flatMap((value, index) => (predicate(value) ? [index] : []));
}

/** Τιμολογεί την παραγγελία. Γραμμή με μη αναπαραστάσιμο ποσό μετρά 0 και αναφέρεται στο `invalidLineIndexes`. */
export function pricePurchaseOrder(
  agreements: readonly FrameworkAgreementLike[],
  input: POPricingInput,
): POPricing {
  const grosses = input.items.map(poLineGrossMinor);
  const { selections, winners } = selectWinners(agreements, input, grosses);
  const discounts = lineDiscounts(winners);
  const lines = input.items.map((_, index) => ({
    grossMinor: grosses[index],
    faDiscount: discounts.get(index)?.record ?? null,
    selection: selections[index],
  }));
  const totals = computePOTotalsMinor(
    lines.map((line, index) => ({ gross: line.grossMinor ?? 0, discount: discounts.get(index)?.minor ?? 0 })),
    input.taxRate,
  );
  return {
    lines,
    totals: poTotalsInMajor(totals),
    appliedFaIds: [...new Set(winners.filter((w) => discounts.has(w.index)).map((w) => w.fa.id))],
    ambiguousLineIndexes: indexesWhere(selections, (selection) => selection?.kind === 'ambiguous'),
    invalidLineIndexes: indexesWhere(grosses, (gross) => gross === null),
  };
}

/** Τα πεδία της PO που ανήκουν στην τιμολόγηση: γραμμές με `total` + `faDiscount`, σύνολα, συμβάσεις. */
export type POPricedItem<TItem> = TItem & { total: number; faDiscount: POLineFaDiscount | null };

export interface POPricedRecord<TItem> extends POTotals {
  readonly items: POPricedItem<TItem>[];
  readonly appliedFaIds: string[];
}

/**
 * Ενώνει τις γραμμές με την τιμολόγησή τους. Το `total` γραμμής είναι **πάντα** του server —
 * ό,τι έστειλε ο πελάτης αγνοείται. Ο ΕΝΑΣ τρόπος να γεμίσει μια PO τα οικονομικά της.
 */
export function pricedRecord<TItem>(items: readonly TItem[], pricing: POPricing): POPricedRecord<TItem> {
  const { subtotal, discountAmount, taxableAmount, taxAmount, total } = pricing.totals;
  return {
    items: items.map((item, index) => ({
      ...item,
      total: majorFromMinor(pricing.lines[index]?.grossMinor ?? 0),
      faDiscount: pricing.lines[index]?.faDiscount ?? null,
    })),
    subtotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    total,
    appliedFaIds: [...pricing.appliedFaIds],
  };
}
