/**
 * **Ο πραγματικός πίνακας ενός μοντέλου** — μία στήλη ανά παραλλαγή, από το **επεξεργασμένο** σύνολο (ADR-923 §5.10.4 Β6).
 *
 * Τροφοδοτεί τον **ίδιο** builder/renderer με την προεπισκόπηση της οικογένειας (`buildTablePreview` + `PreviewTable`).
 * Επειδή διαβάζει το σύνολο **μετά** τις αλλαγές του προχείρου, ο πίνακας ενημερώνεται **όσο επικολλάς** — πριν από
 * την αποθήκευση. Όπως στο τυπωμένο φυλλάδιο, η μονάδα ζει στην κεφαλίδα της γραμμής και το κελί έχει τον **αριθμό**
 * στη μονάδα προβολής της γραμμής: χωρίς μετατροπή κρατά **ακριβώς** την ακρίβεια του προμηθευτή, με μετατροπή τα
 * δεκαδικά της ιδιότητας.
 *
 * @module components/catalog/products/variants/model-table-data
 */

import type { RealTableColumn } from '@/components/catalog/families/family-table-preview';
import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import { chainOf, type CatalogAggregate } from '@/subapps/catalog/aggregate/aggregate-model';
import type { CatalogSchemaSnapshot } from '@/subapps/catalog/derived/chain-derived';
import { convertMeasurement, toFixedDecimal } from '@/subapps/catalog/measurement/conversion';
import type { AttributeValue } from '@/subapps/catalog/types/product';
import { resolveInheritedValues } from '@/subapps/catalog/values/resolve-inherited';
import { readSlot } from '@/subapps/catalog/values/value-shape';
import { displayAmount, formatAttributeValue, type ValueTextContext } from '@/subapps/catalog/values/value-text-codec';

import type { ListScope } from '../ProductListToolbar';

/** Η μέτρηση στη μονάδα προβολής της γραμμής, **χωρίς** σύμβολο (η μονάδα είναι στην κεφαλίδα). */
function measurementCell(attribute: Extract<AttributeRecord, { type: 'measurement' }>, value: Extract<AttributeValue, { type: 'measurement' }>, unit: string | null, codec: ValueTextContext): string {
  const target = unit ?? attribute.config.defaultUnitCode;
  if (target === value.unitCode) return displayAmount(value.amount, codec.language);
  const family = codec.registry.get(attribute.config.measurementFamilyCode);
  if (!family) return displayAmount(value.amount, codec.language);
  const converted = convertMeasurement(family, Number(value.amount), value.unitCode, target);
  return displayAmount(toFixedDecimal(converted, attribute.config.decimals), codec.language);
}

function cellText(attribute: AttributeRecord | undefined, value: AttributeValue | undefined, unit: string | null, codec: ValueTextContext): string {
  if (!attribute || !value) return '';
  if (attribute.type === 'measurement' && value.type === 'measurement') return measurementCell(attribute, value, unit, codec);
  return formatAttributeValue(attribute, value, codec);
}

/** Οι στήλες του πίνακα: τα SKU του μοντέλου `parentId` με τη σειρά που δίνεται (η σειρά του πλέγματος). */
export function modelTableColumns(input: {
  readonly aggregate: CatalogAggregate;
  readonly order: readonly string[];
  readonly schema: CatalogSchemaSnapshot;
  readonly attributeById: ReadonlyMap<string, AttributeRecord>;
  readonly scope: ListScope;
  readonly codec: ValueTextContext;
}): RealTableColumn[] {
  const { aggregate, schema, scope, codec } = input;
  // Όλοι οι άξονες του σχήματος — όπως ο builder της προεπισκόπησης (μία ταυτότητα στήλης).
  const axisIds = schema.scheme?.levels.flatMap((level) => level.axisAttributeIds) ?? [];
  return input.order.filter((id) => aggregate.members.get(id)?.after).map((id) => {
    const resolved = resolveInheritedValues(chainOf(aggregate, id, 'after'), schema.scheme);
    const valueAt = (attributeId: string) => {
      const attribute = input.attributeById.get(attributeId);
      return attribute ? readSlot(resolved.values.get(attributeId)?.slots, attribute, scope.channel, scope.locale) : undefined;
    };
    const axes = new Map(axisIds.map((axisId) => [axisId, cellText(input.attributeById.get(axisId), valueAt(axisId), null, codec)] as const));
    const axisCodes = new Map(axisIds.flatMap((axisId) => { const value = valueAt(axisId); return value?.type === 'select' ? [[axisId, value.optionCode] as const] : []; }));
    return { axes, axisCodes, valueOf: (attributeId, unit) => cellText(input.attributeById.get(attributeId), valueAt(attributeId), unit, codec) };
  });
}
