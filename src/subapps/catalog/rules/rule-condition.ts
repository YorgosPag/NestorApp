/**
 * Η **συνθήκη «όταν»** των κανόνων συνέπειας (ADR-923 §21.5) — καθαρή, χωρίς I/O. Ο αξιολογητής τη ρωτά **μία** φορά ανά
 * κανόνα και κρίνει μόνο τις παραλλαγές που την ικανοποιούν· έτσι κάθε είδος κανόνα (μοναδικότητα, διάταξη, μονοτονία,
 * σύγκριση) αποκτά συνθήκη χωρίς δεύτερο αξιολογητή.
 *
 * 🔑 Τιμή που λείπει ή δεν είναι του είδους που ζητά ο έλεγχος ⇒ η συνθήκη **δεν** ικανοποιείται ⇒ η παραλλαγή δεν κρίνεται.
 *    Ποτέ «ισχύει επειδή δεν ξέρω»: ο κανόνας «τριφασικό ⇒ ≥ 380 V» δεν πρέπει να κρίνει προϊόν χωρίς δηλωμένες φάσεις.
 * @module subapps/catalog/rules/rule-condition
 */

import { toStandardUnit } from '../measurement/conversion';
import type { MeasurementRegistry } from '../measurement/measurement-registry';
import type { CatalogAttributeDefinition } from '../types/attribute';
import type { RuleCondition, RuleConditionTest } from '../types/family';
import { compareNumbers } from './rule-comparisons';

/**
 * Μια σταθερά κανόνα στη μονάδα-πρότυπο της ιδιότητας με την οποία συγκρίνεται (οι τιμές είναι ήδη σε πρότυπο, §5.2).
 * Καθαρός αριθμός ή σταθερά χωρίς μονάδα ⇒ όπως είναι. Άγνωστη οικογένεια μέτρησης ⇒ `null` (ο κανόνας δεν κρίνει).
 */
export function constantInStandardUnit(
  attribute: CatalogAttributeDefinition | undefined,
  value: number,
  unitCode: string | null,
  registry: MeasurementRegistry,
): number | null {
  if (attribute?.type !== 'measurement' || unitCode === null) return value;
  const family = registry.get(attribute.config.measurementFamilyCode);
  return family ? toStandardUnit(family, value, unitCode) : null;
}

type ValueTest = (value: unknown) => boolean;

function numberTest(
  test: Extract<RuleConditionTest, { kind: 'number' }>,
  attribute: CatalogAttributeDefinition | undefined,
  registry: MeasurementRegistry,
): ValueTest {
  const constant = constantInStandardUnit(attribute, test.value, test.unitCode, registry);
  return (value) => constant !== null && typeof value === 'number' && compareNumbers(value, test.operator, constant);
}

/**
 * Ο έλεγχος της συνθήκης ως συνάρτηση της τιμής της ιδιότητάς της — χτισμένος **μία** φορά (η σταθερά μετατρέπεται μία
 * φορά, όχι ανά παραλλαγή).
 */
export function conditionPredicate(
  condition: RuleCondition,
  attributes: ReadonlyMap<string, CatalogAttributeDefinition>,
  registry: MeasurementRegistry,
): ValueTest {
  const { test } = condition;
  switch (test.kind) {
    case 'number':
      return numberTest(test, attributes.get(condition.attributeId), registry);
    case 'option': {
      const codes = new Set(test.optionCodes);
      return (value) => typeof value === 'string' && codes.has(value) === (test.operator === 'in');
    }
    case 'boolean':
      return (value) => typeof value === 'boolean' && value === test.value;
  }
}
