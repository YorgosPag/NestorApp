/**
 * =============================================================================
 * ΣΗΜΑΣΙΟΛΟΓΙΚΗ ΕΠΙΚΥΡΩΣΗ ΤΙΜΟΚΑΤΑΛΟΓΟΥ ΚΑΙ ΣΥΝΘΗΚΩΝ (ADR-923 §5.11)
 * =============================================================================
 *
 * Η ίδια συνάρτηση σε πελάτη (πλέγμα, φόρμα) και διακομιστή (422) — κωδικοί, ποτέ κείμενο.
 *
 * 🔑 **Ασάφεια = σφάλμα αποθήκευσης** (όχι «η πρώτη στη λίστα», όπως το Odoo): δύο συνθήκες
 * με **ίδιο** κοινό, **ίδια** ομάδα έκπτωσης και **επικαλυπτόμενη** ισχύ απορρίπτονται.
 * 🔑 **Κλίμακες μονότονες**: μεγαλύτερο κατώφλι δεν δίνει **μικρότερη** έκπτωση — αλλιώς ο
 * πελάτης που αγοράζει περισσότερα πληρώνει ακριβότερα τη μονάδα.
 * 🔑 **`net_customer` χωρίς ομάδες έκπτωσης** (BMEcat): η τιμή είναι ήδη του πελάτη.
 *
 * @module subapps/catalog/schema/validate-pricing
 */

import { hasAnyLocalizedText } from '@/i18n/localized-text';
import { normalizeToMillisOrNull } from '@/lib/date-local';
import { isMinorAmount, sumMinor } from '@/lib/money/money';
import {
  compareDiscountSteps,
  effectivePercent,
  isDiscountSteps,
  type BasisPoints,
  type DiscountRule,
  type DiscountTierBasis,
} from '@/lib/pricing/discount-rule';
import { scaledInteger } from '@/lib/pricing/exact-arithmetic';
import { isEmptyWindow, windowsOverlap, type ValidityWindow } from '@/lib/pricing/validity';
import { audienceIdentity } from '../pricing/price-audience';
import { priceLineSubjectKey } from '../pricing/price-line-subject';
import type {
  CustomerGroupDefinition,
  DiscountConditionDefinition,
  DiscountGroupDefinition,
  PriceAudience,
  PriceListDefinition,
  PriceListLineDefinition,
  PriceType,
} from '../types/price-list';
import { MEASUREMENT_UNIT_CODE_PATTERN, isCatalogCode } from '../vocabulary/catalog-limits';
import {
  MAX_DISCOUNT_STEPS,
  MAX_DISCOUNT_TIERS,
  ORDER_QUANTITY_DECIMALS,
  PRICE_CHANGE_FENCE_MAX_BP,
  PRICE_CHANGE_FENCE_MIN_BP,
  acceptsDiscountGroups,
  isPriceQuantity,
} from '../vocabulary/pricing';
import { IssueCollector, type CatalogIssue } from './catalog-issues';

export interface PriceLineContext {
  readonly priceType: PriceType;
  readonly discountGroupIds: ReadonlySet<string>;
}

export interface PriceListContext {
  readonly customerGroupIds: ReadonlySet<string>;
}

export interface DiscountConditionContext extends PriceListContext {
  readonly discountGroupIds: ReadonlySet<string>;
}

/** Η **μία** αναφορά κοινού σε ομάδα πελάτη — ίδιος έλεγχος για λίστα και συνθήκη. */
function checkAudienceReference(
  collector: IssueCollector,
  audience: PriceAudience | null,
  context: PriceListContext,
  path: string,
): void {
  if (audience?.kind === 'customerGroup' && !context.customerGroupIds.has(audience.customerGroupId)) {
    collector.add('unknownReference', `${path}.customerGroupId`);
  }
}

function checkFence(collector: IssueCollector, changeFenceBp: BasisPoints | null): void {
  if (changeFenceBp === null) return;
  if (!Number.isInteger(changeFenceBp) || changeFenceBp < PRICE_CHANGE_FENCE_MIN_BP || changeFenceBp > PRICE_CHANGE_FENCE_MAX_BP) {
    // Το μήνυμα μιλά σε ποσοστό (ο άνθρωπος δεν σκέφτεται σε μονάδες βάσης).
    collector.add('fenceOutOfBounds', 'changeFenceBp', {
      min: effectivePercent([PRICE_CHANGE_FENCE_MIN_BP]),
      max: effectivePercent([PRICE_CHANGE_FENCE_MAX_BP]),
    });
  }
}

export function validatePriceList(list: PriceListDefinition, context: PriceListContext): readonly CatalogIssue[] {
  const collector = new IssueCollector();
  if (!isCatalogCode(list.code)) collector.add('invalidCode', 'code');
  if (!hasAnyLocalizedText(list.labels)) collector.add('labelRequired', 'labels');
  if (list.kind === 'cost' && list.audience !== null) collector.add('costListHasAudience', 'audience');
  checkAudienceReference(collector, list.audience, context, 'audience');
  checkFence(collector, list.changeFenceBp);
  return collector.issues;
}

/** Ομάδα έκπτωσης **ή** ομάδα πελάτη (ίδιο σχήμα): κωδικός + ετικέτα — ο ίδιος έλεγχος σε φόρμα και γραφέα. */
export function validatePricingGroup(group: DiscountGroupDefinition | CustomerGroupDefinition): readonly CatalogIssue[] {
  const collector = new IssueCollector();
  if (!isCatalogCode(group.code)) collector.add('invalidCode', 'code');
  if (!hasAnyLocalizedText(group.labels)) collector.add('labelRequired', 'labels');
  return collector.issues;
}

// ── Γραμμή ───────────────────────────────────────────────────────────────────

function checkBreakdown(collector: IssueCollector, line: PriceListLineDefinition): void {
  const { breakdown } = line;
  if (line.subject.kind === 'variant') {
    if (breakdown !== null) collector.add('costBreakdownNotAllowed', 'breakdown');
    return;
  }
  if (breakdown === null) {
    collector.add('costBreakdownRequired', 'breakdown');
    return;
  }
  const parts = [breakdown.material, breakdown.labor, breakdown.equipment];
  if (!parts.every(isMinorAmount)) collector.add('priceAmountInvalid', 'breakdown');
  else if (sumMinor(parts) !== line.netPrice) collector.add('costBreakdownMismatch', 'breakdown');
  if (!isDiscountSteps([breakdown.defaultWasteBp])) collector.add('discountStepInvalid', 'breakdown.defaultWasteBp');
}

function checkDiscountGroup(collector: IssueCollector, line: PriceListLineDefinition, context: PriceLineContext): void {
  if (line.discountGroupId === null) return;
  if (!acceptsDiscountGroups(context.priceType)) collector.add('discountGroupNotAccepted', 'discountGroupId');
  else if (!context.discountGroupIds.has(line.discountGroupId)) collector.add('unknownReference', 'discountGroupId');
}

export function validatePriceListLine(line: PriceListLineDefinition, context: PriceLineContext): readonly CatalogIssue[] {
  const collector = new IssueCollector();
  if (!isMinorAmount(line.netPrice)) collector.add('priceAmountInvalid', 'netPrice');
  if (!isPriceQuantity(line.priceQuantity)) collector.add('priceQuantityInvalid', 'priceQuantity');
  if (!MEASUREMENT_UNIT_CODE_PATTERN.test(line.unitCode)) collector.add('measurementUnitUnknown', 'unitCode');
  checkDiscountGroup(collector, line, context);
  checkBreakdown(collector, line);
  return collector.issues;
}

/** Μία γραμμή ανά υποκείμενο ανά έκδοση. */
export function validateVersionLines(lines: readonly PriceListLineDefinition[]): readonly CatalogIssue[] {
  const collector = new IssueCollector();
  const seen = new Set<string>();
  lines.forEach((line, index) => {
    const key = priceLineSubjectKey(line.subject);
    if (seen.has(key)) collector.add('priceLineSubjectDuplicate', `lines[${index}].subject`, { subject: key });
    seen.add(key);
  });
  return collector.issues;
}

// ── Κανόνας έκπτωσης ─────────────────────────────────────────────────────────

function checkSteps(collector: IssueCollector, steps: readonly number[], path: string): void {
  if (steps.length > MAX_DISCOUNT_STEPS) collector.add('tooMany', path, { max: MAX_DISCOUNT_STEPS });
  if (!isDiscountSteps(steps)) collector.add('discountStepInvalid', path);
}

function isTierMin(min: number, basis: DiscountTierBasis): boolean {
  if (basis === 'amount') return isMinorAmount(min);
  const scaled = scaledInteger(min, 10 ** ORDER_QUANTITY_DECIMALS);
  return scaled !== null && scaled >= 0;
}

function checkTiers(collector: IssueCollector, rule: Extract<DiscountRule, { kind: 'tiers' }>, path: string): void {
  if (rule.tiers.length === 0) collector.add('discountTiersRequired', `${path}.tiers`);
  if (rule.tiers.length > MAX_DISCOUNT_TIERS) collector.add('tooMany', `${path}.tiers`, { max: MAX_DISCOUNT_TIERS });
  rule.tiers.forEach((tier, index) => {
    if (!isTierMin(tier.min, rule.basis)) collector.add('discountTierMinInvalid', `${path}.tiers[${index}].min`);
    checkSteps(collector, tier.steps, `${path}.tiers[${index}].steps`);
  });
  if (!collector.ok) return;
  const ordered = [...rule.tiers].sort((a, b) => a.min - b.min);
  for (let index = 1; index < ordered.length; index++) {
    const [previous, current] = [ordered[index - 1], ordered[index]];
    if (current.min === previous.min) collector.add('discountTierDuplicate', `${path}.tiers`, { min: current.min });
    else if (compareDiscountSteps(current.steps, previous.steps) < 0) {
      collector.add('discountTiersNotMonotonic', `${path}.tiers`, { min: current.min });
    }
  }
}

export function validateDiscountRule(rule: DiscountRule, path = 'rule'): readonly CatalogIssue[] {
  const collector = new IssueCollector();
  if (rule.kind === 'chain') checkSteps(collector, rule.steps, `${path}.steps`);
  else checkTiers(collector, rule, path);
  return collector.issues;
}

// ── Συνθήκη ──────────────────────────────────────────────────────────────────

/** Το παράθυρο ισχύος μιας συνθήκης· `null` αν κάποια ημερομηνία δεν διαβάζεται. */
export function conditionWindow(condition: DiscountConditionDefinition): ValidityWindow | null {
  const fromMs = normalizeToMillisOrNull(condition.validFrom);
  const untilMs = normalizeToMillisOrNull(condition.validUntil);
  if ((condition.validFrom !== null && fromMs === null) || (condition.validUntil !== null && untilMs === null)) return null;
  return { fromMs, untilMs };
}

function checkConditionReferences(
  collector: IssueCollector,
  condition: DiscountConditionDefinition,
  context: DiscountConditionContext,
): void {
  if (condition.discountGroupId !== null && !context.discountGroupIds.has(condition.discountGroupId)) {
    collector.add('unknownReference', 'discountGroupId');
  }
  checkAudienceReference(collector, condition.audience, context, 'audience');
}

export function validateDiscountCondition(
  condition: DiscountConditionDefinition,
  context: DiscountConditionContext,
): readonly CatalogIssue[] {
  const collector = new IssueCollector();
  checkConditionReferences(collector, condition, context);
  const window = conditionWindow(condition);
  if (window === null) collector.add('invalidDate', 'validFrom');
  else if (isEmptyWindow(window)) collector.add('validityRangeInverted', 'validUntil');
  for (const issue of validateDiscountRule(condition.rule)) collector.add(issue.code, issue.path, issue.params);
  return collector.issues;
}

/** Ίδιο κοινό + ίδια ομάδα + επικαλυπτόμενη ισχύς = ασάφεια. Ελέγχει την **υποψήφια** απέναντι στις υπόλοιπες. */
export function findAmbiguousConditions(
  candidate: DiscountConditionDefinition,
  others: readonly { readonly id: string; readonly definition: DiscountConditionDefinition }[],
): readonly CatalogIssue[] {
  const collector = new IssueCollector();
  const window = conditionWindow(candidate);
  if (window === null) return collector.issues;
  const identity = audienceIdentity(candidate.audience);
  for (const other of others) {
    const otherWindow = conditionWindow(other.definition);
    const sameScope =
      other.definition.discountGroupId === candidate.discountGroupId && audienceIdentity(other.definition.audience) === identity;
    if (sameScope && otherWindow !== null && windowsOverlap(window, otherWindow)) {
      collector.add('discountConditionAmbiguous', 'validFrom', { conditionId: other.id });
    }
  }
  return collector.issues;
}
