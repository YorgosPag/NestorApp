/**
 * =============================================================================
 * ΕΠΙΛΥΣΗ ΤΙΜΗΣ ΚΑΤΑΛΟΓΟΥ — έκδοση «ως προς» ημερομηνία → γραμμή → συνθήκη → ποσό (ADR-923 §5.11)
 * =============================================================================
 *
 * 1. **Έκδοση**: η δημοσιευμένη που ισχύει τη στιγμή `atMs` (χρονογραμμή, όχι «η τρέχουσα»).
 * 2. **Γραμμή**: του υποκειμένου μέσα σε αυτή την έκδοση.
 * 3. **Ποσό λίστας**: τιμή × ποσότητα / ποσότητα τιμής — μία στρογγύλευση.
 * 4. **Έκπτωση** (μόνο σε τιμοκατάλογο πώλησης `net_list`): σκληρά φίλτρα (κοινό, ομάδα έκπτωσης, ισχύς)
 *    → ο ειδικότερος νικά (κοινό πρώτα, μετά ομάδα > `*`) → αλυσίδα ή κλίμακα της **μίας** μηχανής.
 *
 * 🔑 Συνθήκη με `discountGroupId: null` (`*`) αφορά **κάθε** γραμμή του τιμοκαταλόγου λίστας·
 *    συνθήκη ομάδας αφορά **μόνο** γραμμές της ομάδας ⇒ γραμμή χωρίς ομάδα παίρνει μόνο `*`.
 * 🔑 Το αποτέλεσμα `priced` είναι **στιγμιότυπο** (`PriceQuote`): ο καταναλωτής το κρατά αυτούσιο,
 *    ώστε νέα έκδοση να μην ξαναγράφει ποτέ προσφορά που δόθηκε (§5.4).
 * 🔑 Ασάφεια συνθηκών ⇒ `ambiguousDiscount`, ποτέ «η πρώτη».
 *
 * Καθαρή: οι γραμμές έρχονται από `lineFor` (ο διακομιστής φορτώνει μόνο της έκδοσης που ισχύει).
 * @module subapps/catalog/pricing/resolve-catalog-price
 */

import { normalizeToMillisOrNull } from '@/lib/date-local';
import type { MinorAmount } from '@/lib/money/money';
import {
  applyDiscountSteps,
  stepsForBasis,
  type BasisPoints,
} from '@/lib/pricing/discount-rule';
import { lineAmount } from '@/lib/pricing/line-amount';
import { selectMostSpecific, type SelectionCandidate, type SelectionTraceEntry } from '@/lib/pricing/select-condition';
import type {
  DiscountConditionDefinition,
  PriceLineSubject,
  PriceListDefinition,
  PriceListLineDefinition,
  PricingViewer,
} from '../types/price-list';
import { ORDER_QUANTITY_DECIMALS, listAcceptsDiscounts } from '../vocabulary/pricing';
import { audienceCovers, audienceSpecificity } from './price-audience';
import { priceLineSubjectKey } from './price-line-subject';
import { versionAt, type PriceVersionRef } from './version-timeline';

/** Γιατί μια συνθήκη δεν ταιριάζει, πριν από την ισχύ. */
export type ConditionMismatch = 'audienceMismatch' | 'groupMismatch';

export interface PricedRecord<D> {
  readonly id: string;
  readonly definition: D;
}

export interface CatalogPriceRequest {
  readonly priceList: PricedRecord<PriceListDefinition>;
  readonly versions: readonly PriceVersionRef[];
  readonly lineFor: (versionId: string, subjectKey: string) => PricedRecord<PriceListLineDefinition> | null;
  readonly conditions: readonly PricedRecord<DiscountConditionDefinition>[];
  readonly viewer: PricingViewer;
  readonly subject: PriceLineSubject;
  readonly quantity: number;
  readonly atMs: number;
}

/** Το στιγμιότυπο τιμής που κρατά ο καταναλωτής (BOQ · προσφορά · παραγγελία). */
export interface PriceQuote {
  readonly priceListId: string;
  readonly priceListVersionId: string;
  readonly lineId: string;
  readonly subjectKey: string;
  readonly quantity: number;
  readonly netPrice: MinorAmount;
  readonly priceQuantity: number;
  readonly unitCode: string;
  /** Ποσό λίστας της γραμμής, πριν από έκπτωση. */
  readonly listAmount: MinorAmount;
  readonly conditionId: string | null;
  readonly discountSteps: readonly BasisPoints[];
  readonly discountAmount: MinorAmount;
  readonly netAmount: MinorAmount;
  readonly trace: readonly SelectionTraceEntry<ConditionMismatch>[];
}

export type CatalogPriceResolution =
  | { readonly kind: 'invalidQuantity' }
  | { readonly kind: 'noVersion' }
  | { readonly kind: 'noLine'; readonly priceListVersionId: string }
  | {
      readonly kind: 'ambiguousDiscount';
      readonly priceListVersionId: string;
      readonly tiedConditionIds: readonly string[];
      readonly trace: readonly SelectionTraceEntry<ConditionMismatch>[];
    }
  | { readonly kind: 'priced'; readonly quote: PriceQuote };

function conditionMismatch(
  condition: DiscountConditionDefinition,
  line: PriceListLineDefinition,
  viewer: PricingViewer,
): ConditionMismatch | null {
  if (!audienceCovers(condition.audience, viewer)) return 'audienceMismatch';
  if (condition.discountGroupId !== null && condition.discountGroupId !== line.discountGroupId) return 'groupMismatch';
  return null;
}

function toCandidate(
  record: PricedRecord<DiscountConditionDefinition>,
  line: PriceListLineDefinition,
  viewer: PricingViewer,
): SelectionCandidate<DiscountConditionDefinition, ConditionMismatch> {
  const condition = record.definition;
  return {
    id: record.id,
    item: condition,
    validity: { fromMs: normalizeToMillisOrNull(condition.validFrom), untilMs: normalizeToMillisOrNull(condition.validUntil) },
    mismatch: conditionMismatch(condition, line, viewer),
    specificity: [audienceSpecificity(condition.audience), condition.discountGroupId === null ? 0 : 1],
  };
}

interface PricedLine {
  readonly versionId: string;
  readonly line: PricedRecord<PriceListLineDefinition>;
  readonly listAmount: MinorAmount;
}

function priceQuote(request: CatalogPriceRequest, priced: PricedLine, discount: {
  readonly conditionId: string | null;
  readonly steps: readonly BasisPoints[];
  readonly trace: readonly SelectionTraceEntry<ConditionMismatch>[];
}): PriceQuote {
  const { line, listAmount } = priced;
  const applied = applyDiscountSteps(listAmount, discount.steps);
  return {
    priceListId: request.priceList.id,
    priceListVersionId: priced.versionId,
    lineId: line.id,
    subjectKey: priceLineSubjectKey(line.definition.subject),
    quantity: request.quantity,
    netPrice: line.definition.netPrice,
    priceQuantity: line.definition.priceQuantity,
    unitCode: line.definition.unitCode,
    listAmount,
    conditionId: discount.conditionId,
    discountSteps: discount.steps,
    discountAmount: applied.discount,
    netAmount: applied.net,
    trace: discount.trace,
  };
}

function resolveDiscount(request: CatalogPriceRequest, priced: PricedLine): CatalogPriceResolution {
  if (!listAcceptsDiscounts(request.priceList.definition)) {
    return { kind: 'priced', quote: priceQuote(request, priced, { conditionId: null, steps: [], trace: [] }) };
  }
  const candidates = request.conditions.map((record) => toCandidate(record, priced.line.definition, request.viewer));
  const selection = selectMostSpecific(candidates, request.atMs);
  if (selection.kind === 'ambiguous') {
    return { kind: 'ambiguousDiscount', priceListVersionId: priced.versionId, tiedConditionIds: selection.tiedIds, trace: selection.trace };
  }
  if (selection.kind === 'none') {
    return { kind: 'priced', quote: priceQuote(request, priced, { conditionId: null, steps: [], trace: selection.trace }) };
  }
  const rule = selection.winner.rule;
  const basis = rule.kind === 'tiers' && rule.basis === 'amount' ? priced.listAmount : request.quantity;
  const steps = stepsForBasis(rule, basis);
  return { kind: 'priced', quote: priceQuote(request, priced, { conditionId: selection.winnerId, steps, trace: selection.trace }) };
}

/** Επιλύει την τιμή ενός υποκειμένου για θεατή, ποσότητα και στιγμή. */
export function resolveCatalogPrice(request: CatalogPriceRequest): CatalogPriceResolution {
  const version = versionAt(request.versions, request.atMs);
  if (version === null) return { kind: 'noVersion' };
  const line = request.lineFor(version.id, priceLineSubjectKey(request.subject));
  if (line === null) return { kind: 'noLine', priceListVersionId: version.id };
  const listAmount = lineAmount({
    unitPrice: line.definition.netPrice,
    perQuantity: line.definition.priceQuantity,
    quantity: request.quantity,
    quantityDecimals: ORDER_QUANTITY_DECIMALS,
  });
  if (listAmount === null) return { kind: 'invalidQuantity' };
  return resolveDiscount(request, { versionId: version.id, line, listAmount });
}
