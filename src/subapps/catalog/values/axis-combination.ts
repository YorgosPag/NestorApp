/**
 * =============================================================================
 * Ο ΣΥΝΔΥΑΣΜΟΣ ΑΞΟΝΩΝ ΜΙΑΣ ΠΑΡΑΛΛΑΓΗΣ — κλειδί ταυτότητας (ADR-923 §5.10 Θωράκιση 5)
 * =============================================================================
 *
 * Δύο παραλλαγές του ίδιου μοντέλου με **τον ίδιο** συνδυασμό αξόνων είναι **το ίδιο** προϊόν
 * δύο φορές (Akeneo: «Cannot set value … already set on another variant»). Το κλειδί
 * γράφεται από τον γραφέα στο `axisCombos` **πάνω στο μοντέλο** (σειριοποιεί φυσικά, χωρίς
 * `tx.get(query)`)· εδώ ζει **μόνο** η καθαρή απάντηση «ποιο είναι το κλειδί;».
 *
 * 🔑 Μέτρηση ⇒ **τυποποιημένη** τιμή: «500 L» και «0,5 m³» είναι ο ίδιος όγκος, άρα το ίδιο
 * κλειδί. Επιλογή ⇒ κωδικός. Ναι/όχι ⇒ `true`/`false`. Η σειρά των αξόνων είναι η σειρά του
 * επιπέδου (δηλωμένη), όχι αλφαβητική.
 *
 * @module subapps/catalog/values/axis-combination
 */

import type { MeasurementRegistry } from '../measurement/measurement-registry';
import { IssueCollector, type CatalogIssue } from '../schema/catalog-issues';
import type { CatalogAttributeDefinition } from '../types/attribute';
import type { AttributeValue, ProductValues } from '../types/product';
import { standardAmountOf } from './standard-amount';
import { readUnscopedSlot } from './value-shape';

/** Η ταυτότητα της τιμής **ενός** άξονα — `null` αν λείπει ή δεν είναι τιμή άξονα. */
export function axisValueIdentity(
  attribute: CatalogAttributeDefinition,
  value: AttributeValue | undefined,
  registry: MeasurementRegistry,
): string | null {
  if (!value) return null;
  if (value.type === 'select') return `o:${value.optionCode}`;
  if (value.type === 'boolean') return `b:${String(value.value)}`;
  if (value.type !== 'measurement') return null;
  const standard = standardAmountOf(attribute, value, registry);
  return standard === null ? null : `m:${String(standard)}`;
}

/**
 * Το κλειδί συνδυασμού αξόνων ενός φορέα. `null` όταν κάποιος άξονας λείπει (ο επικυρωτής
 * το αναφέρει ήδη ως `axisValueMissing` — ένα μισό κλειδί θα έφτιαχνε ψευδείς συγκρούσεις).
 */
export function axisCombinationKey(
  values: ProductValues,
  axisAttributeIds: readonly string[],
  attributes: ReadonlyMap<string, CatalogAttributeDefinition>,
  registry: MeasurementRegistry,
): string | null {
  const parts: string[] = [];
  for (const axisId of axisAttributeIds) {
    const attribute = attributes.get(axisId);
    const identity = attribute ? axisValueIdentity(attribute, readUnscopedSlot(values[axisId]), registry) : null;
    if (identity === null) return null;
    parts.push(`${axisId}=${identity}`);
  }
  return parts.join('|');
}

export interface AxisComboClash {
  readonly key: string;
  /** Οι φορείς (id) που μοιράζονται τον συνδυασμό, με τη σειρά εισόδου. */
  readonly holderIds: readonly string[];
}

/** Οι συγκρούσεις συνδυασμού ανάμεσα σε αδέλφια (ίδιο γονέα). */
export function findAxisCombinationClashes(
  siblings: ReadonlyArray<{ readonly id: string; readonly values: ProductValues }>,
  axisAttributeIds: readonly string[],
  attributes: ReadonlyMap<string, CatalogAttributeDefinition>,
  registry: MeasurementRegistry,
): readonly AxisComboClash[] {
  const byKey = new Map<string, string[]>();
  for (const sibling of siblings) {
    const key = axisCombinationKey(sibling.values, axisAttributeIds, attributes, registry);
    if (key !== null) byKey.set(key, [...(byKey.get(key) ?? []), sibling.id]);
  }
  return [...byKey.entries()]
    .filter(([, holderIds]) => holderIds.length > 1)
    .map(([key, holderIds]) => ({ key, holderIds }));
}

/** Οι συγκρούσεις ως ευρήματα: ο **δεύτερος** και κάθε επόμενος φορέας, με δείκτη στον πρώτο. */
export function axisClashIssues(clashes: readonly AxisComboClash[]): readonly CatalogIssue[] {
  const collector = new IssueCollector();
  for (const clash of clashes) {
    const [first, ...rest] = clash.holderIds;
    rest.forEach((holderId) => collector.add('axisComboDuplicate', `variants.${holderId}`, { other: first }));
  }
  return collector.issues;
}
