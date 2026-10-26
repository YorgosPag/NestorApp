/**
 * ADR-923 §5.10.4 Β6 — ο πραγματικός πίνακας του μοντέλου: μία στήλη ανά παραλλαγή, ο αριθμός στη μονάδα της γραμμής.
 *
 * Ζωντανά το MFP-85 έγραφε ψύξη L «2,83» (2835 W → kW, `toFixed` πάνω στο double 2,83499…)· ο κατάλογος γράφει 2,84.
 */
import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import { MFP_ATTRIBUTE_MAP, MFP_FAMILY } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil.fixture';
import { MFP_MODEL, MFP_MODEL_ID, MFP_SETTINGS, MFP_VARIANTS, mfpVariantId } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil-products.fixture';
import type { StoredMemberShape } from '@/subapps/catalog/aggregate/aggregate-members';
import { editAggregate, NO_EDITS, schemaSnapshotOf } from '@/subapps/catalog/aggregate/edit-aggregate';
import { PLATFORM_MEASUREMENT_REGISTRY } from '@/subapps/catalog/measurement/measurement-registry';

import { modelTableColumns } from '../model-table-data';

const meta = { companyId: 'c', revision: 1, isDeleted: false, createdAt: '', createdBy: '', updatedAt: '', updatedBy: '', deletedAt: null, deletedBy: null };
const attributeById = new Map([...MFP_ATTRIBUTE_MAP].map(([id, a]) => [id, { ...meta, ...a, id, measurementFamilyCodes: [] } as AttributeRecord]));
const derived = { sortKey: 'k' } as never;
const members: StoredMemberShape[] = [
  { kind: 'productModel', record: { ...MFP_MODEL, id: MFP_MODEL_ID, revision: 1, derived } },
  ...MFP_VARIANTS.map((variant, index): StoredMemberShape => ({ kind: 'product', record: { ...variant, id: mfpVariantId(index), revision: 1, derived } })),
];
const schema = schemaSnapshotOf({ family: MFP_FAMILY, attributes: MFP_ATTRIBUTE_MAP, registry: PLATFORM_MEASUREMENT_REGISTRY, settings: MFP_SETTINGS, variantSchemeCode: 'by_size' });
const codec = { registry: PLATFORM_MEASUREMENT_REGISTRY, language: 'el' as const, assetIdByCode: new Map(), assetCodeById: new Map(), yes: 'Ναι', no: 'Όχι' };

const columns = () => modelTableColumns({
  aggregate: editAggregate(MFP_MODEL_ID, members, NO_EDITS),
  order: MFP_VARIANTS.map((_, index) => mfpVariantId(index)),
  schema, attributeById, scope: { channel: 'print', locale: 'el' }, codec,
});

describe('modelTableColumns', () => {
  it('🔴 W → kW με τα δεκαδικά της ιδιότητας, στρογγυλεμένα στο ΔΕΚΑΔΙΚΟ (2835 W ⇒ «2,84», όχι «2,83»)', () => {
    const coolingL = columns().map((column) => column.valueOf('cooling_l', null));
    expect(coolingL[3]).toBe('2,84');
    expect(coolingL[0]).toBe('1,13');
  });

  it('χωρίς μετατροπή κρατά ΑΚΡΙΒΩΣ την ακρίβεια του προμηθευτή (βάρος 15.4 kg ⇒ «15,4»)', () => {
    expect(columns()[0].valueOf('weight', 'kg')).toBe('15,4');
  });

  it('μία στήλη ανά παραλλαγή, με τη σειρά του πλέγματος · ο άξονας ως ετικέτα', () => {
    const all = columns();
    expect(all).toHaveLength(7);
    expect(all[0].axisCodes.get('size')).toBe('mfp_34');
  });
});
