/**
 * ADR-923 §5.10.4 Β2 — η ενιαία λίστα: δύο παράθυρα → μία λίστα, facets μέσα στο παράθυρο, «περισσότερα» μόνο όταν
 * έχει νόημα (σφάλμα που φάνηκε ζωντανά: «Περισσότερα» δίπλα σε «Η λίστα δεν φορτώθηκε»).
 */
import { renderHook } from '@testing-library/react';

import type { ProductModelRecord, ProductRecord } from '@/services/catalog/catalog-api.client';

import { useProductList } from '../use-product-list';

type Window = { state: 'loading' | 'ready' | 'failed'; items: unknown[]; complete: boolean; grow: jest.Mock };
const windows: Record<string, Window> = {};
jest.mock('@/hooks/catalog/useCatalogLiveWindow', () => ({
  useCatalogLiveWindow: (key: string) => windows[key],
}));

const derived = { sortKey: 'a', facetKeys: ['h=1'], descendants: {}, identifier: null, label: null };
const model = (id: string, facetKeys: string[]) => ({ id, familyId: 'fam', updatedAt: '2026-10-26T10:00:00.000Z', revision: 1, derived: { ...derived, descendants: { v: { kind: 'product', facetKeys } } } }) as unknown as ProductModelRecord;
const product = (id: string) => ({ id, familyId: 'other', modelId: null, updatedAt: '2026-10-25T10:00:00.000Z', revision: 1, derived }) as unknown as ProductRecord;

function setWindows(models: Window, products: Window) {
  windows.CATALOG_PRODUCT_MODELS = models;
  windows.CATALOG_PRODUCTS = products;
}

const inputs = (facets: string[][] = []) => ({
  filter: { familyId: null, facets, sort: 'updated' as const },
  families: new Map(),
  attributes: new Map(),
  settings: { channelLocales: { print: ['el'], storefront: ['el'], portal: ['el'], quote: ['el'] } } as never,
});

describe('useProductList', () => {
  it('🔴 αποτυχία ανάγνωσης ⇒ «failed» ΧΩΡΙΣ «περισσότερα»', () => {
    setWindows({ state: 'failed', items: [], complete: false, grow: jest.fn() }, { state: 'failed', items: [], complete: false, grow: jest.fn() });
    const { result } = renderHook(() => useProductList(inputs()));
    expect(result.current.state).toBe('failed');
    expect(result.current.hasMore).toBe(false);
  });

  it('ένωση μοντέλων + απλών · η επιλογή κρίνεται μέσα στο παράθυρο · «περισσότερα» μεγαλώνει μόνο τα ανοιχτά', () => {
    const models = { state: 'ready' as const, items: [model('cpmod_a', ['h=1', 'c=x']), model('cpmod_b', ['h=1'])], complete: false, grow: jest.fn() };
    const products = { state: 'ready' as const, items: [product('cprod_a')], complete: true, grow: jest.fn() };
    setWindows(models, products);
    const { result } = renderHook(() => useProductList(inputs([['h=1'], ['c=x']])));
    expect(result.current.rows.map((row) => row.id)).toEqual(['cpmod_a']);
    expect(result.current.hasMore).toBe(true);
    result.current.grow();
    expect(models.grow).toHaveBeenCalledTimes(1);
    expect(products.grow).not.toHaveBeenCalled();
  });

  it('μπαγιατίλα: απλό SKU ΧΩΡΙΣ γνωστή οικογένεια δεν κρίνεται ψευδώς μπαγιάτικο', () => {
    setWindows({ state: 'ready', items: [], complete: true, grow: jest.fn() }, { state: 'ready', items: [product('cprod_a')], complete: true, grow: jest.fn() });
    const { result } = renderHook(() => useProductList(inputs()));
    expect(result.current.staleCount).toBe(0);
  });
});
