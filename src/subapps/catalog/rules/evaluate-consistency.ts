/**
 * =============================================================================
 * Ο ΑΞΙΟΛΟΓΗΤΗΣ ΚΑΝΟΝΩΝ ΣΥΝΕΠΕΙΑΣ — καθαρή συνάρτηση (ADR-923 §21.3–21.4)
 * =============================================================================
 *
 * Μετρημένο στη Φάση 0: οι κανόνες «H ≥ M ≥ L», «αύξουσα κατά μέγεθος», «μοναδικός κωδικός»
 * σήκωσαν σημαία σε **κάθε** εκτέλεση της AI με μετατόπιση γραμμής/στήλης **και** στον
 * πραγματικό διπλό κωδικό 016-15-001 του καταλόγου Aries — ενώ η ίδια η AI δεν
 * αυτοελέγχθηκε ποτέ. Εδώ ζει η μηχανή που θα τρέχει πριν από κάθε πρόταση εισαγωγής
 * (Φάση 4) και σε κάθε αποθήκευση τιμών (Φάση 2).
 *
 * 🔑 **Είσοδος σε μονάδα-πρότυπο.** Οι αριθμητικές τιμές έρχονται ήδη εκφρασμένες στη
 * μονάδα-πρότυπο της οικογένειας μέτρησης (έτσι αποθηκεύονται, §5.2), άρα «3,2 kW ≥ 2900 W»
 * είναι απλή σύγκριση αριθμών. Μόνο η **σταθερά** ενός κανόνα μετατρέπεται εδώ.
 *
 * Τιμή `null` = «δεν έχει τιμή» ⇒ ο κανόνας **δεν** κρίνει αυτό το ζεύγος (η πληρότητα
 * είναι άλλη ερώτηση, §5.2). Ποτέ σιωπηλή απόρριψη: ό,τι δεν κρίνεται απλώς δεν αναφέρεται.
 *
 * @module subapps/catalog/rules/evaluate-consistency
 */

import { toStandardUnit } from '../measurement/conversion';
import type { MeasurementRegistry } from '../measurement/measurement-registry';
import type { CatalogAttributeDefinition } from '../types/attribute';
import type { ConsistencyRule, RuleSeverity } from '../types/family';
import { axisRank, compareNumbers, holdsOrder } from './rule-comparisons';

export type ComparableValue = number | string | boolean | null;

/** Μία παραλλαγή: οι τιμές της ανά id ιδιότητας (αριθμοί σε μονάδα-πρότυπο). */
export interface VariantValueRow {
  readonly variantId: string;
  readonly values: Readonly<Record<string, ComparableValue>>;
}

export interface ConsistencyInput {
  readonly rules: readonly ConsistencyRule[];
  readonly rows: readonly VariantValueRow[];
  /** Οι άξονες του σχήματος παραλλαγών (για ομαδοποίηση στη μονοτονία). */
  readonly schemeAxisIds: readonly string[];
  readonly attributes: ReadonlyMap<string, CatalogAttributeDefinition>;
  readonly registry: MeasurementRegistry;
}

export interface ConsistencyViolation {
  readonly ruleId: string;
  readonly kind: ConsistencyRule['kind'];
  readonly severity: RuleSeverity;
  readonly variantIds: readonly string[];
  readonly attributeIds: readonly string[];
}

const numberOf = (value: ComparableValue | undefined): number | null => (typeof value === 'number' ? value : null);

function evaluateUnique(rule: Extract<ConsistencyRule, { kind: 'unique' }>, input: ConsistencyInput): ConsistencyViolation[] {
  const byValue = new Map<string, string[]>();
  for (const row of input.rows) {
    const value = row.values[rule.attributeId];
    if (value === null || value === undefined) continue;
    const key = `${typeof value}:${String(value)}`;
    byValue.set(key, [...(byValue.get(key) ?? []), row.variantId]);
  }
  return [...byValue.values()]
    .filter((variantIds) => variantIds.length > 1)
    .map((variantIds) => violation(rule, variantIds, [rule.attributeId]));
}

function evaluateOrderAcross(
  rule: Extract<ConsistencyRule, { kind: 'orderAcrossAttributes' }>,
  input: ConsistencyInput,
): ConsistencyViolation[] {
  return input.rows
    .filter((row) => {
      const present = rule.attributeIds.map((id) => numberOf(row.values[id])).filter((n): n is number => n !== null);
      return present.some((value, index) => index > 0 && !holdsOrder(present[index - 1], value, rule.direction, rule.strict));
    })
    .map((row) => violation(rule, [row.variantId], rule.attributeIds));
}

function evaluateMonotonic(
  rule: Extract<ConsistencyRule, { kind: 'monotonicAlongAxis' }>,
  input: ConsistencyInput,
): ConsistencyViolation[] {
  const axis = input.attributes.get(rule.axisAttributeId);
  const otherAxes = input.schemeAxisIds.filter((id) => id !== rule.axisAttributeId);
  const groups = new Map<string, Array<{ rank: number; value: number; variantId: string }>>();
  for (const row of input.rows) {
    const rank = axis ? axisRank(axis, row.values[rule.axisAttributeId]) : null;
    const value = numberOf(row.values[rule.attributeId]);
    if (rank === null || value === null) continue;
    const key = otherAxes.map((id) => String(row.values[id] ?? '')).join('\u0000');
    groups.set(key, [...(groups.get(key) ?? []), { rank, value, variantId: row.variantId }]);
  }
  const violations: ConsistencyViolation[] = [];
  for (const members of groups.values()) {
    members.sort((a, b) => a.rank - b.rank);
    for (let i = 1; i < members.length; i++) {
      const [previous, current] = [members[i - 1], members[i]];
      if (previous.rank === current.rank) continue;
      if (!holdsOrder(previous.value, current.value, rule.direction, rule.strict)) {
        violations.push(violation(rule, [previous.variantId, current.variantId], [rule.attributeId]));
      }
    }
  }
  return violations;
}

function constantInStandard(
  rule: Extract<ConsistencyRule, { kind: 'compare' }>,
  input: ConsistencyInput,
): number | null {
  if (rule.right.kind !== 'constant') return null;
  const left = input.attributes.get(rule.leftAttributeId);
  if (left?.type !== 'measurement' || rule.right.unitCode === null) return rule.right.value;
  const family = input.registry.get(left.config.measurementFamilyCode);
  return family ? toStandardUnit(family, rule.right.value, rule.right.unitCode) : null;
}

function evaluateCompare(rule: Extract<ConsistencyRule, { kind: 'compare' }>, input: ConsistencyInput): ConsistencyViolation[] {
  const constant = constantInStandard(rule, input);
  const involved = rule.right.kind === 'attribute' ? [rule.leftAttributeId, rule.right.attributeId] : [rule.leftAttributeId];
  return input.rows
    .filter((row) => {
      const left = numberOf(row.values[rule.leftAttributeId]);
      const right = rule.right.kind === 'attribute' ? numberOf(row.values[rule.right.attributeId]) : constant;
      return left !== null && right !== null && !compareNumbers(left, rule.operator, right);
    })
    .map((row) => violation(rule, [row.variantId], involved));
}

function violation(rule: ConsistencyRule, variantIds: readonly string[], attributeIds: readonly string[]): ConsistencyViolation {
  return { ruleId: rule.id, kind: rule.kind, severity: rule.severity, variantIds, attributeIds };
}

function evaluateRule(rule: ConsistencyRule, input: ConsistencyInput): ConsistencyViolation[] {
  switch (rule.kind) {
    case 'unique':
      return evaluateUnique(rule, input);
    case 'orderAcrossAttributes':
      return evaluateOrderAcross(rule, input);
    case 'monotonicAlongAxis':
      return evaluateMonotonic(rule, input);
    case 'compare':
      return evaluateCompare(rule, input);
  }
}

/** Αξιολογεί όλους τους κανόνες· η σειρά των παραβιάσεων ακολουθεί τη σειρά των κανόνων. */
export function evaluateConsistency(input: ConsistencyInput): readonly ConsistencyViolation[] {
  return input.rules.flatMap((rule) => evaluateRule(rule, input));
}
