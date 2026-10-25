/**
 * Επικύρωση των **κανόνων συνέπειας** της οικογένειας (ADR-923 §21.3–21.4): ένας κανόνας
 * σύγκρισης έχει νόημα **μόνο** ανάμεσα σε αριθμητικές ιδιότητες της **ίδιας** διάστασης —
 * «ψυκτική ισχύς ≥ παροχή αέρα» (kW ≥ m³/h) δεν είναι λάθος δεδομένων, είναι λάθος
 * κανόνα, και πρέπει να απορριφθεί όταν **γράφεται**, όχι όταν τρέξει.
 * @module subapps/catalog/schema/validate-family-rules
 */

import { findUnit } from '../measurement/conversion';
import type { ConsistencyRule } from '../types/family';
import { CATALOG_LIMITS } from '../vocabulary/catalog-limits';
import { reportDuplicates } from './catalog-issues';
import {
  allAxisIds,
  familyAttribute,
  numericDimension,
  type FamilyValidationContext,
} from './family-validation-context';

/** Ελέγχει ότι όλες οι ιδιότητες είναι αριθμητικές και ίδιας διάστασης. */
function checkSameNumericDimension(context: FamilyValidationContext, attributeIds: readonly string[], path: string): void {
  const dimensions = attributeIds.map((id) => numericDimension(familyAttribute(context, id)));
  if (dimensions.some((dimension) => dimension === undefined)) {
    context.collector.add('ruleAttributeNotNumeric', path);
    return;
  }
  if (new Set(dimensions).size > 1) context.collector.add('ruleMeasurementMismatch', path);
}

function checkCompare(context: FamilyValidationContext, rule: Extract<ConsistencyRule, { kind: 'compare' }>, path: string): void {
  if (rule.right.kind === 'attribute') {
    checkSameNumericDimension(context, [rule.leftAttributeId, rule.right.attributeId], path);
    return;
  }
  const dimension = numericDimension(familyAttribute(context, rule.leftAttributeId));
  if (dimension === undefined) {
    context.collector.add('ruleAttributeNotNumeric', `${path}.leftAttributeId`);
    return;
  }
  const { unitCode } = rule.right;
  if (dimension === null) {
    if (unitCode !== null) context.collector.add('ruleConstantUnitUnknown', `${path}.right.unitCode`);
    return;
  }
  const family = context.registry.get(dimension);
  if (unitCode === null || !family || !findUnit(family, unitCode)) {
    context.collector.add('ruleConstantUnitUnknown', `${path}.right.unitCode`);
  }
}

function validateRule(context: FamilyValidationContext, rule: ConsistencyRule, path: string): void {
  switch (rule.kind) {
    case 'unique':
      if (!familyAttribute(context, rule.attributeId)) context.collector.add('attributeUnknown', `${path}.attributeId`);
      return;
    case 'orderAcrossAttributes':
      if (rule.attributeIds.length < 2 || rule.attributeIds.length > CATALOG_LIMITS.maxAttributesPerOrderRule) {
        context.collector.add('tooMany', `${path}.attributeIds`, { max: CATALOG_LIMITS.maxAttributesPerOrderRule });
      }
      return checkSameNumericDimension(context, rule.attributeIds, `${path}.attributeIds`);
    case 'monotonicAlongAxis':
      if (numericDimension(familyAttribute(context, rule.attributeId)) === undefined) {
        context.collector.add('ruleAttributeNotNumeric', `${path}.attributeId`);
      }
      if (!allAxisIds(context.family).has(rule.axisAttributeId)) {
        context.collector.add('ruleAxisUnknown', `${path}.axisAttributeId`);
      }
      return;
    case 'compare':
      return checkCompare(context, rule, path);
  }
}

export function validateFamilyRules(context: FamilyValidationContext): void {
  const rules = context.family.consistencyRules;
  if (rules.length > CATALOG_LIMITS.maxConsistencyRules) {
    context.collector.add('tooMany', 'consistencyRules', { max: CATALOG_LIMITS.maxConsistencyRules });
  }
  rules.forEach((rule, index) => validateRule(context, rule, `consistencyRules[${index}]`));
  reportDuplicates(context.collector, rules.map((rule) => rule.id), (index) => `consistencyRules[${index}].id`);
}
