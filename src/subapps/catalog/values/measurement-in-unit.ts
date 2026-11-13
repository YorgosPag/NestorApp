/**
 * Μια μέτρηση **στη μονάδα προβολής** (ADR-923 §5.6 · §21.6) — ο ΕΝΑΣ κανόνας για τη γραμμή του πίνακα καταλόγου και για το
 * μέρος της σύνθετης ένδειξης: `null` = η προεπιλεγμένη μονάδα της ιδιότητας· στρογγύλευση στα δεκαδικά της ιδιότητας μόνο
 * όταν μετατρέπεται· άγνωστη οικογένεια μέτρησης ⇒ η τιμή όπως είναι (ποτέ επινοημένος αριθμός).
 * @module subapps/catalog/values/measurement-in-unit
 */

import { convertMeasurement, findUnit, toFixedDecimal } from '../measurement/conversion';
import type { MeasurementRegistry } from '../measurement/measurement-registry';
import type { CatalogAttributeDefinition } from '../types/attribute';
import type { AttributeValue } from '../types/product';

type MeasurementAttribute = Extract<CatalogAttributeDefinition, { type: 'measurement' }>;
type MeasurementValue = Extract<AttributeValue, { type: 'measurement' }>;

export function measurementInUnit(
  attribute: MeasurementAttribute,
  value: MeasurementValue,
  displayUnitCode: string | null,
  registry: MeasurementRegistry,
): MeasurementValue {
  const target = displayUnitCode ?? attribute.config.defaultUnitCode;
  if (target === value.unitCode) return value;
  const family = registry.get(attribute.config.measurementFamilyCode);
  if (!family) return value;
  const converted = convertMeasurement(family, Number(value.amount), value.unitCode, target);
  return { type: 'measurement', amount: toFixedDecimal(converted, attribute.config.decimals), unitCode: target };
}

/**
 * Το **σύμβολο** της μονάδας προβολής (`null` = η προεπιλεγμένη) — κεφαλίδα γραμμής πίνακα και πρότυπο σύνθετης ένδειξης.
 * `null` όταν η ιδιότητα δεν είναι μέτρηση ή η οικογένεια/μονάδα δεν υπάρχει.
 */
export function displayUnitSymbol(attribute: CatalogAttributeDefinition, displayUnitCode: string | null, registry: MeasurementRegistry): string | null {
  if (attribute.type !== 'measurement') return null;
  const family = registry.get(attribute.config.measurementFamilyCode);
  return family ? findUnit(family, displayUnitCode ?? attribute.config.defaultUnitCode)?.symbol ?? null : null;
}
