/**
 * «Ποια είναι αυτή η τιμή σε **μονάδα-πρότυπο**;» — μία φορά (ADR-923 §5.10 Δ4). Τη ρωτούν ο
 * συνδυασμός αξόνων («500 L» ≡ «0,5 m³»), οι κανόνες συνέπειας και (2β) ο γραφέας για το παράγωγο
 * `amountStandard`. `null` όταν δεν υπάρχει αριθμός, το ποσό δεν είναι κανονικό ή η μονάδα είναι
 * άγνωστη — **ποτέ** εξαίρεση, ποτέ μαντεψιά.
 * @module subapps/catalog/values/standard-amount
 */

import { findUnit, toStandardUnit } from '../measurement/conversion';
import type { MeasurementRegistry } from '../measurement/measurement-registry';
import type { CatalogAttributeDefinition } from '../types/attribute';
import type { AttributeValue } from '../types/product';
import { amountFromCanonical } from './decimal-amount';

export function standardAmountOf(
  attribute: CatalogAttributeDefinition,
  value: AttributeValue | undefined,
  registry: MeasurementRegistry,
): number | null {
  if (value?.type === 'number') return amountFromCanonical(value.amount)?.value ?? null;
  if (value?.type !== 'measurement' || attribute.type !== 'measurement') return null;
  const parsed = amountFromCanonical(value.amount);
  const family = registry.get(attribute.config.measurementFamilyCode);
  if (!parsed || !family || !findUnit(family, value.unitCode)) return null;
  return toStandardUnit(family, parsed.value, value.unitCode);
}
