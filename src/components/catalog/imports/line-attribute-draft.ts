/**
 * @fileoverview Η **αφετηρία της φόρμας «Νέα ιδιότητα από τη γραμμή»** (ADR-923 §5.5.2 Β3 Γ7): η πρόταση της γραμμής πάνω στο κενό
 *   πρόχειρο του `AttributeEditor`. Καθαρό. Ό,τι δεν προτείνεται με βεβαιότητα μένει όπως στο κενό πρόχειρο.
 * @module components/catalog/imports/line-attribute-draft
 */

import type { LineAttributeSuggestion } from '@/subapps/catalog/import/suggest-attribute-from-line';
import type { CatalogAttributeDefinition } from '@/subapps/catalog/types/attribute';
import { typedConfig } from '../attributes/attribute-draft';

const NUMBER_BOUNDS = { min: null, max: null, negativeAllowed: false } as const;

export function lineAttributeDraft(blank: CatalogAttributeDefinition, suggestion: LineAttributeSuggestion): CatalogAttributeDefinition {
  const named: CatalogAttributeDefinition = { ...blank, code: suggestion.code, labels: { ...blank.labels, el: suggestion.label } };
  const { measurement, decimals } = suggestion;
  if (measurement) {
    return { ...named, ...typedConfig('measurement', { ...NUMBER_BOUNDS, decimals, measurementFamilyCode: measurement.familyCode, defaultUnitCode: measurement.unitCode }) };
  }
  if (suggestion.numeric) return { ...named, ...typedConfig('number', { ...NUMBER_BOUNDS, decimals }) };
  return named;
}
