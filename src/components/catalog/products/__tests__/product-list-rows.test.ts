/**
 * ADR-923 §5.10.4 Β2 — οι γραμμές του ενιαίου πλέγματος: ένωση με μέτωπο, πληρότητα, «ταιριάζουν», μπαγιατίλα.
 */
import type { ProductModelRecord, ProductRecord } from '@/services/catalog/catalog-api.client';
import { MFP_ATTRIBUTE_MAP, MFP_FAMILY } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil.fixture';
import { MFP_SETTINGS } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil-products.fixture';
import { completenessInputsHash } from '@/subapps/catalog/completeness/inputs-hash';

import {
  listRowComparator,
  mergeListRows,
  modelRow,
  productRow,
  rowCompleteness,
  rowIdentifier,
  rowMatches,
  rowPassesFacets,
  rowStaleReason,
  rowVariantCount,
} from '../product-list-rows';

const meta = { companyId: 'c', isDeleted: false, createdAt: '', createdBy: '', updatedBy: '', deletedAt: null, deletedBy: null };
const descendant = (facetKeys: string[], completeChannels: string[] = []) => ({ kind: 'product' as const, parentId: 'm', axisKey: null, completeChannels, facetKeys });

function model(id: string, over: { updatedAt?: string; sortKey?: string; descendants?: Record<string, ReturnType<typeof descendant>> } = {}): ProductModelRecord {
  return {
    ...meta, id, revision: 1, updatedAt: over.updatedAt ?? '2026-10-26T10:00:00.000Z',
    code: id, familyId: 'fam', variantSchemeCode: 'by_size', parentId: null, values: {}, noValueReasons: {}, categoryIds: [],
    derived: {
      valueAttributeIds: [], valueLocales: [], assetIds: [], uniqueKeys: {}, standardAmounts: {}, warnings: [],
      rootModelId: null, label: null, sortKey: over.sortKey ?? id, descendants: over.descendants ?? {},
      summary: { print: { el: { complete: 5, total: 7 } }, storefront: { el: { complete: 7, total: 7 } }, portal: { el: { complete: 0, total: 7 } }, quote: { el: { complete: 0, total: 0 } } },
      facetKeys: [], findings: [],
    },
  } as ProductModelRecord;
}

function product(id: string, over: { updatedAt?: string; sortKey?: string | undefined; hash?: string; revision?: number } = {}): ProductRecord {
  const derived: Record<string, unknown> = {
    valueAttributeIds: [], valueLocales: [], assetIds: [], uniqueKeys: {}, standardAmounts: {}, warnings: [],
    rootModelId: null, label: null, identifier: '016-15-001', facetKeys: ['size=s1'],
    completeness: { print: { el: { required: 4, filled: 3, missing: [] } } }, completenessHash: over.hash ?? 'c1:x', completeChannels: [],
  };
  if ('sortKey' in over ? over.sortKey !== undefined : true) derived.sortKey = over.sortKey ?? id;
  return { ...meta, id, revision: over.revision ?? 1, updatedAt: over.updatedAt ?? '2026-10-26T10:00:00.000Z', modelId: null, familyId: 'fam', values: {}, noValueReasons: {}, categoryIds: [], derived } as unknown as ProductRecord;
}

describe('ένωση + σειρά', () => {
  it('«ετικέτα»: sortKey αύξουσα, μοντέλα και SKU ανακατεμένα · ισοπαλία με id', () => {
    const merged = mergeListRows(
      { items: [model('cpmod_b', { sortKey: 'b' })], complete: true },
      { items: [product('cprod_a', { sortKey: 'a' }), product('cprod_c', { sortKey: 'c' })], complete: true },
      'label',
    );
    expect(merged.items.map((row) => row.id)).toEqual(['cprod_a', 'cpmod_b', 'cprod_c']);
  });

  it('«ενημέρωση»: φθίνουσα (Akeneo «Updated on»), ισοπαλία με id φθίνον (όπως το έμμεσο __name__)', () => {
    const cmp = listRowComparator('updated');
    const older = productRow(product('cprod_1', { updatedAt: '2026-10-25T00:00:00.000Z' }));
    const newer = modelRow(model('cpmod_1', { updatedAt: '2026-10-26T00:00:00.000Z' }));
    expect([older, newer].sort(cmp).map((row) => row.id)).toEqual(['cpmod_1', 'cprod_1']);
  });
});

describe('στήλες', () => {
  it('κωδικός: του μοντέλου · αναγνωριστικό του SKU', () => {
    expect(rowIdentifier(modelRow(model('mfp_tm')))).toBe('mfp_tm');
    expect(rowIdentifier(productRow(product('cprod_x')))).toBe('016-15-001');
  });

  it('πληρότητα: μοντέλο «5/7» με τόνο · SKU ποσοστό (3/4 = 75%) · κανάλι χωρίς τη γλώσσα ⇒ null', () => {
    expect(rowCompleteness(modelRow(model('m')), 'print', 'el')).toEqual({ kind: 'summary', complete: 5, total: 7, tone: 'partial' });
    expect(rowCompleteness(modelRow(model('m')), 'storefront', 'el')?.tone).toBe('complete');
    expect(rowCompleteness(modelRow(model('m')), 'portal', 'el')?.tone).toBe('empty');
    expect(rowCompleteness(productRow(product('p')), 'print', 'el')).toEqual({ kind: 'percent', percent: 75, tone: 'partial' });
    expect(rowCompleteness(productRow(product('p')), 'print', 'en')).toBeNull();
  });

  it('🏆 «ταιριάζουν 2/3» από το ευρετήριο της ρίζας · παραλλαγές', () => {
    const row = modelRow(model('m', { descendants: { a: descendant(['h=1', 'c=x']), b: descendant(['h=1']), c: descendant(['h=1', 'c=x']) } }));
    expect(rowMatches(row, ['h=1', 'c=x'])).toEqual({ matching: 2, total: 3 });
    expect(rowVariantCount(row)).toBe(3);
    expect(rowPassesFacets(row, ['h=9'])).toBe(false);
    expect(rowMatches(row, [])).toBeNull();
  });
});

describe('μπαγιατίλα αποδείξιμη στην ανάγνωση (Δ7)', () => {
  const input = { family: MFP_FAMILY, attributes: MFP_ATTRIBUTE_MAP, settings: MFP_SETTINGS, scheme: null };

  it('έγγραφο ΧΩΡΙΣ sortKey (πριν το Β2) ⇒ «sortKey» — το orderBy θα το έκρυβε', () => {
    expect(rowStaleReason(productRow(product('p', { sortKey: undefined })), input)).toBe('sortKey');
  });

  it('απλό SKU: ίδιο αποτύπωμα ⇒ φρέσκο · άλλη αναθεώρηση/ρυθμίσεις ⇒ «completeness»', () => {
    const hash = completenessInputsHash({ ...input, chain: [{ id: 'p', kind: 'product', revision: 3 }] });
    expect(rowStaleReason(productRow(product('p', { hash, revision: 3 })), input)).toBeNull();
    expect(rowStaleReason(productRow(product('p', { hash, revision: 4 })), input)).toBe('completeness');
    const settings = { channelLocales: { ...MFP_SETTINGS.channelLocales, print: ['el', 'en'] as const } };
    expect(rowStaleReason(productRow(product('p', { hash, revision: 3 })), { ...input, settings })).toBe('completeness');
  });

  it('μοντέλα: η αλυσίδα θέλει τους απογόνους ⇒ δεν κρίνονται στη λίστα (δηλωμένο όριο)', () => {
    expect(rowStaleReason(modelRow(model('m')), input)).toBeNull();
  });
});
