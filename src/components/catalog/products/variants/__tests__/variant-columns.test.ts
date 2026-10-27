/**
 * ADR-923 §5.10.5 — το κελί άξονα **αποθηκευμένης** παραλλαγής κλειδώνει με λόγο (Akeneo `ImmutableVariantAxesValues`).
 * Ζωντανά ήταν επεξεργάσιμο· η ανταλλαγή δύο μεγεθών περνούσε και τον έλεγχο διπλού συνδυασμού.
 */
import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import { MFP_ATTRIBUTE_MAP } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil.fixture';
import { MFP_VARIANTS, mfpVariantId } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil-products.fixture';
import { PLATFORM_MEASUREMENT_REGISTRY } from '@/subapps/catalog/measurement/measurement-registry';

import type { ValueEditorEnv } from '../../../values/value-editor-types';
import { variantColumns } from '../variant-columns';
import type { VariantRow } from '../variant-rows';

const meta = { companyId: 'c', revision: 1, isDeleted: false, createdAt: '', createdBy: '', updatedAt: '', updatedBy: '', deletedAt: null, deletedBy: null };
const attributeById = new Map([...MFP_ATTRIBUTE_MAP].map(([id, a]) => [id, { ...meta, ...a, id, measurementFamilyCodes: [] } as AttributeRecord]));
const env = {
  codec: { registry: PLATFORM_MEASUREMENT_REGISTRY, language: 'el', assetIdByCode: new Map(), assetCodeById: new Map(), yes: 'Ναι', no: 'Όχι' },
} as unknown as ValueEditorEnv;

const columns = variantColumns({
  columnIds: ['size', 'model_code'], axisIds: ['size'], attributeById, scope: { channel: 'print', locale: 'el' }, env,
  message: (issue) => issue.code, percentOf: () => null, words: { t: (key: string) => key, text: (value, fallback = '') => value?.el ?? fallback },
});
const column = (id: string) => columns.find((candidate) => candidate.id === id)!;
const stored: VariantRow = { id: mfpVariantId(0), definition: MFP_VARIANTS[0], stored: { ...MFP_VARIANTS[0], id: mfpVariantId(0), revision: 1, derived: {} as never } };
const fresh: VariantRow = { id: 'cprod_new', definition: MFP_VARIANTS[0], stored: null };

describe('variantColumns — κλείδωμα άξονα', () => {
  it('🔴 αποθηκευμένη γραμμή ⇒ ο άξονας κλειδωμένος, με τον ΙΔΙΟ λόγο που δείχνει ο επεξεργαστής', () => {
    expect(column('size').lock?.(stored)).toEqual({ reason: 'values.axisLocked' });
  });

  it('νέα γραμμή ⇒ ο άξονας ορίζεται ελεύθερα · άλλη ιδιότητα αποθηκευμένης γραμμής μένει επεξεργάσιμη', () => {
    expect(column('size').lock?.(fresh)).toBeNull();
    expect(column('model_code').lock?.(stored)).toBeNull();
  });
});
