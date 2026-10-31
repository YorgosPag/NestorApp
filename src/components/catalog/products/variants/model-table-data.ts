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

import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import { chainOf, type CatalogAggregate } from '@/subapps/catalog/aggregate/aggregate-model';
import type { CatalogSchemaSnapshot } from '@/subapps/catalog/derived/chain-derived';
import { realTableColumn, type RealTableColumn } from '@/subapps/catalog/table/catalog-table';
import { resolveInheritedValues } from '@/subapps/catalog/values/resolve-inherited';
import type { ValueTextContext } from '@/subapps/catalog/values/value-text-codec';

import type { ListScope } from '../ProductListToolbar';

/** Οι στήλες του πίνακα: τα SKU του μοντέλου `parentId` με τη σειρά που δίνεται (η σειρά του πλέγματος). */
export function modelTableColumns(input: {
  readonly aggregate: CatalogAggregate;
  readonly order: readonly string[];
  readonly schema: CatalogSchemaSnapshot;
  readonly attributeById: ReadonlyMap<string, AttributeRecord>;
  readonly scope: ListScope;
  readonly codec: ValueTextContext;
}): RealTableColumn[] {
  const { aggregate, schema, attributeById, scope, codec } = input;
  return input.order.filter((id) => aggregate.members.get(id)?.after).map((id) => {
    const resolved = resolveInheritedValues(chainOf(aggregate, id, 'after'), schema.scheme);
    return realTableColumn({ slotsOf: (attributeId) => resolved.values.get(attributeId)?.slots, scheme: schema.scheme, attributeById, scope, codec });
  });
}
