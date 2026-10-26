/**
 * **«Δημιουργία παραλλαγών»** — καρτεσιανό γινόμενο τιμών αξόνων (ADR-923 §5.10.4 Β4, Akeneo «variant generator»).
 *
 * Τα ήδη υπάρχοντα **σημειώνονται και παραλείπονται** με την **ίδια** ταυτότητα συνδυασμού με τον διακομιστή
 * (`axisCombinationKey`: τυποποιημένη τιμή — «500 L» ≡ «0,5 m³»). Το όριο απογόνων κρίνεται με τον **ίδιο**
 * `checkDescendantBudget` (≤ 200). Το αποτέλεσμα είναι **ορισμοί** γραμμών, όχι εγγραφές: μπαίνουν στο πλέγμα ως νέες
 * γραμμές, συμπληρώνονται (επικόλληση) και αποθηκεύονται με **μία** δέσμη.
 *
 * @module subapps/catalog/aggregate/variant-generator
 */

import type { MeasurementRegistry } from '../measurement/measurement-registry';
import type { CatalogIssue } from '../schema/catalog-issues';
import { checkDescendantBudget } from '../schema/validate-product-placement';
import type { CatalogAttributeDefinition } from '../types/attribute';
import type { AttributeValue, ProductValues } from '../types/product';
import { axisCombinationKey } from '../values/axis-combination';
import { unscopedSlots } from '../values/value-shape';

export interface AxisChoice {
  readonly attributeId: string;
  readonly values: readonly AttributeValue[];
}

export interface GeneratedVariants {
  /** Οι τιμές αξόνων κάθε **νέας** παραλλαγής, με τη σειρά του γινομένου (πρώτος άξονας = εξωτερικός βρόχος). */
  readonly combos: readonly ProductValues[];
  /** Συνδυασμοί που υπήρχαν ήδη (ή επαναλαμβάνονταν μέσα στην επιλογή) — **σημειωμένοι**, όχι σιωπηλά χαμένοι. */
  readonly existing: number;
  /** Το όριο απογόνων: μη κενό ⇒ η δημιουργία **δεν** επιτρέπεται. */
  readonly budget: readonly CatalogIssue[];
}

function cartesian(axes: readonly AxisChoice[]): ProductValues[] {
  return axes.reduce<ProductValues[]>(
    (combos, axis) => combos.flatMap((values) => axis.values.map((value) => ({ ...values, [axis.attributeId]: unscopedSlots(value) }))),
    [{}],
  );
}

export function generateVariants(input: {
  readonly axes: readonly AxisChoice[];
  readonly existing: readonly ProductValues[];
  readonly descendantCount: number;
  readonly attributes: ReadonlyMap<string, CatalogAttributeDefinition>;
  readonly registry: MeasurementRegistry;
}): GeneratedVariants {
  if (input.axes.length === 0 || input.axes.some((axis) => axis.values.length === 0)) return { combos: [], existing: 0, budget: [] };
  const axisIds = input.axes.map((axis) => axis.attributeId);
  const keyOf = (values: ProductValues) => axisCombinationKey(values, axisIds, input.attributes, input.registry);
  const seen = new Set(input.existing.map(keyOf).filter((key): key is string => key !== null));
  const combos: ProductValues[] = [];
  let existing = 0;
  for (const values of cartesian(input.axes)) {
    const key = keyOf(values);
    if (key === null || seen.has(key)) { existing += 1; continue; }
    seen.add(key);
    combos.push(values);
  }
  return { combos, existing, budget: checkDescendantBudget(input.descendantCount, combos.length) };
}
