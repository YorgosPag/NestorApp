/**
 * Το σύνορο ανάγνωσης του δημόσιου εγγράφου (ADR-923 §5.13 Σ2): ό,τι δεν είναι ακριβώς το σχήμα απαντά `null`.
 */

import { publicCatalogModelFromDocument } from '../public-catalog-from-document';
import { PUBLIC_CATALOG_SCHEMA_VERSION, type PublicCatalogModel } from '../public-catalog-schema';

const VALID: PublicCatalogModel = {
  schemaVersion: PUBLIC_CATALOG_SCHEMA_VERSION,
  companyId: 'comp_a',
  modelId: 'cpmod_1',
  kind: 'productModel',
  code: 'mfp_tm',
  familyId: 'fam_1',
  familyLabels: { el: 'Fan coil' },
  categoryIds: [],
  locales: ['el'],
  attributes: [{ attributeId: 'attr_1', labels: { el: 'Ισχύς' }, values: { el: { type: 'number', value: '12' } } }],
  media: [],
  variants: [{ variantId: 'cpr_1', code: '099-01-001', label: null, attributes: [], media: [] }],
};

const read = (raw: unknown, id = VALID.modelId) => publicCatalogModelFromDocument(raw, id);

describe('publicCatalogModelFromDocument', () => {
  it('δέχεται το έγκυρο έγγραφο', () => {
    expect(read(VALID)).toEqual(VALID);
  });

  it.each([
    ['κλειδί πάνω στο έγγραφο', { ...VALID, price: 10 }],
    ['κλειδί σε παραλλαγή', { ...VALID, variants: [{ ...VALID.variants[0], listAmount: '10' }] }],
    ['κλειδί σε τιμή', { ...VALID, attributes: [{ ...VALID.attributes[0], values: { el: { type: 'number', value: '12', amount: '12' } } }] }],
    ['τύπος τιμής που δεν δημοσιεύεται', { ...VALID, attributes: [{ ...VALID.attributes[0], values: { el: { type: 'table', rows: [] } } }] }],
    ['άγνωστη γλώσσα', { ...VALID, familyLabels: { xx: 'Fan coil' } }],
    ['άλλη έκδοση σχήματος', { ...VALID, schemaVersion: PUBLIC_CATALOG_SCHEMA_VERSION + 1 }],
    ['χωρίς κανένα SKU', { ...VALID, variants: [] }],
    ['μη αντικείμενο', 'x'],
    ['κενό', undefined],
  ])('⛔ %s ⇒ null', (_name, raw) => {
    expect(read(raw)).toBeNull();
  });

  it('⛔ έγγραφο άλλου μοντέλου ⇒ null', () => {
    expect(read(VALID, 'cpmod_other')).toBeNull();
  });
});
