/**
 * ADR-923 §5.10.4 Β2 — άλμα σε κωδικό σε όλο τον κατάλογο, χωρίς ερώτημα (ντετερμινιστικές ταυτότητες).
 */
import {
  generateDeterministicCatalogProductModelId,
  generateDeterministicCatalogUniqueValueId,
} from '@/services/enterprise-id-convenience';
import { uniqueValueKey } from '@/subapps/catalog/values/normalize-unique';

import { resolveCatalogCode, type CodeJumpCollection, type CodeJumpReader } from '../catalog-code-jump';

const COMPANY = 'comp_test';
const CODE_ATTR = { id: 'cattr_code', type: 'text' as const };
const EAN_ATTR = { id: 'cattr_ean', type: 'number' as const };

function store(docs: Record<string, Record<string, unknown>>): { read: CodeJumpReader; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    read: async (collection: CodeJumpCollection, id: string) => { calls.push(`${collection}/${id}`); return docs[`${collection}/${id}`] ?? null; },
  };
}

const reservationId = (attributeId: string, text: string) =>
  generateDeterministicCatalogUniqueValueId(COMPANY, attributeId, uniqueValueKey({ type: 'text', text })!);

describe('resolveCatalogCode', () => {
  it('μοντέλο: id από τον κωδικό (πεζά, χωρίς κενά) — μία ανάγνωση εγγράφου', async () => {
    const id = generateDeterministicCatalogProductModelId(COMPANY, 'mfp_tm');
    const { read } = store({ [`CATALOG_PRODUCT_MODELS/${id}`]: { isDeleted: false } });
    await expect(resolveCatalogCode(COMPANY, '  MFP_TM ', [CODE_ATTR], read)).resolves.toEqual({ kind: 'productModel', id });
  });

  it('SKU: κράτηση με την ΙΔΙΑ κανονικοποίηση με τον γραφέα — «016–15–001» (en dash) βρίσκει το «016-15-001»', async () => {
    const { read } = store({
      [`CATALOG_UNIQUE_VALUES/${reservationId(CODE_ATTR.id, '016-15-001')}`]: { holderKind: 'product', holderId: 'cprod_1' },
      'CATALOG_PRODUCTS/cprod_1': { isDeleted: false },
    });
    await expect(resolveCatalogCode(COMPANY, '016–15–001', [CODE_ATTR], read)).resolves.toEqual({ kind: 'product', id: 'cprod_1' });
  });

  it('🔴 μπαγιάτικη κράτηση (κάτοχος διαγραμμένος) ⇒ ΔΕΝ βρέθηκε — όπως το isLive του διακομιστή', async () => {
    const { read } = store({
      [`CATALOG_UNIQUE_VALUES/${reservationId(CODE_ATTR.id, 'X1')}`]: { holderKind: 'product', holderId: 'cprod_gone' },
      'CATALOG_PRODUCTS/cprod_gone': { isDeleted: true },
    });
    await expect(resolveCatalogCode(COMPANY, 'X1', [CODE_ATTR], read)).resolves.toBeNull();
  });

  it('αριθμητικό unique: ο κωδικός ερμηνεύεται ως κανονικό ποσό (ίδιο κλειδί με τον γραφέα)', async () => {
    const key = uniqueValueKey({ type: 'number', amount: '4006381333931' })!;
    const { read } = store({
      [`CATALOG_UNIQUE_VALUES/${generateDeterministicCatalogUniqueValueId(COMPANY, EAN_ATTR.id, key)}`]: { holderKind: 'product', holderId: 'cprod_ean' },
      'CATALOG_PRODUCTS/cprod_ean': { isDeleted: false },
    });
    await expect(resolveCatalogCode(COMPANY, '4006381333931', [CODE_ATTR, EAN_ATTR], read)).resolves.toEqual({ kind: 'product', id: 'cprod_ean' });
  });

  it('κενό ⇒ καμία ανάγνωση · άγνωστος ⇒ null', async () => {
    const empty = store({});
    await expect(resolveCatalogCode(COMPANY, '   ', [CODE_ATTR], empty.read)).resolves.toBeNull();
    expect(empty.calls).toEqual([]);
    await expect(resolveCatalogCode(COMPANY, 'nope', [CODE_ATTR], empty.read)).resolves.toBeNull();
  });
});
