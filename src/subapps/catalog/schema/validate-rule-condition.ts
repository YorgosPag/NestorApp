/**
 * Επικύρωση της **συνθήκης «όταν»** ενός κανόνα συνέπειας (ADR-923 §21.5) και ο κοινός έλεγχος μονάδας σταθεράς που
 * μοιράζεται με τον κανόνα `compare` — ένας κανόνας για το «ανήκει η μονάδα στη διάσταση της ιδιότητας;», όχι δύο.
 *
 * Μια συνθήκη που δεν ταιριάζει στον τύπο της ιδιότητάς της («φάσεις ∈ {μονοφασικό}» πάνω σε αριθμό) δεν είναι λάθος
 * δεδομένων — είναι λάθος κανόνα, και απορρίπτεται όταν **γράφεται**.
 * @module subapps/catalog/schema/validate-rule-condition
 */

import { findUnit } from '../measurement/conversion';
import type { CatalogAttributeDefinition } from '../types/attribute';
import type { RuleCondition, RuleConditionKind } from '../types/family';
import { familyAttribute, numericDimension, type FamilyValidationContext } from './family-validation-context';

/**
 * Η μονάδα μιας σταθεράς απέναντι στη διάσταση της ιδιότητας: καθαρός αριθμός (`null`) ⇒ καμία μονάδα · μέτρηση ⇒ μονάδα
 * της οικογένειας μέτρησης. `dimension` όπως το δίνει το `numericDimension` (ήδη ελεγμένο ότι δεν είναι `undefined`).
 */
export function checkConstantUnit(
  context: FamilyValidationContext,
  dimension: string | null,
  unitCode: string | null,
  path: string,
): void {
  if (dimension === null) {
    if (unitCode !== null) context.collector.add('ruleConstantUnitUnknown', path);
    return;
  }
  const family = context.registry.get(dimension);
  if (unitCode === null || !family || !findUnit(family, unitCode)) context.collector.add('ruleConstantUnitUnknown', path);
}

/** Ποιο είδος ελέγχου δέχεται κάθε τύπος ιδιότητας· `null` = ο τύπος δεν μπορεί να είναι συνθήκη. */
function conditionKindOf(attribute: CatalogAttributeDefinition): RuleConditionKind | null {
  if (numericDimension(attribute) !== undefined) return 'number';
  if (attribute.type === 'select') return 'option';
  if (attribute.type === 'boolean') return 'boolean';
  return null;
}

function checkOptionCodes(
  context: FamilyValidationContext,
  attribute: CatalogAttributeDefinition,
  optionCodes: readonly string[],
  path: string,
): void {
  if (attribute.type !== 'select') return;
  const known = new Set(attribute.config.options.map((option) => option.code));
  optionCodes.forEach((code, index) => {
    if (!known.has(code)) context.collector.add('ruleConditionOptionUnknown', `${path}.optionCodes[${index}]`, { code });
  });
}

export function validateRuleCondition(context: FamilyValidationContext, condition: RuleCondition, path: string): void {
  const attribute = familyAttribute(context, condition.attributeId);
  if (!attribute) {
    context.collector.add('attributeUnknown', `${path}.attributeId`);
    return;
  }
  const { test } = condition;
  if (conditionKindOf(attribute) !== test.kind) {
    context.collector.add('ruleConditionTypeMismatch', `${path}.test`);
    return;
  }
  if (test.kind === 'number') {
    checkConstantUnit(context, numericDimension(attribute) ?? null, test.unitCode, `${path}.test.unitCode`);
  } else if (test.kind === 'option') {
    checkOptionCodes(context, attribute, test.optionCodes, `${path}.test`);
  }
}
