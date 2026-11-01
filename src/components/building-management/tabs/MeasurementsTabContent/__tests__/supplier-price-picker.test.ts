/**
 * Ο επιλογέας SKU και η φόρμα (ADR-923 §5.12 τμήμα 4): τα σημεία όπου μια αργή απάντηση ή μια ανανέωση θα έσβηνε δουλειά.
 */

import { act, renderHook } from '@testing-library/react';

const mockSearch = jest.fn();
const mockQuote = jest.fn();
const mockApply = jest.fn();
jest.mock('@/services/catalog/supply-api.client', () => ({
  searchForeignSkus: (...args: unknown[]) => mockSearch(...args),
  quoteForeignSku: (...args: unknown[]) => mockQuote(...args),
  applySupplierPriceToLine: (...args: unknown[]) => mockApply(...args),
}));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι γραφείς */
import type { ForeignSkuRow } from '@/subapps/catalog/pricing/foreign-sku-search';
import type { BOQItem, BoqSupplierPriceSource } from '@/types/boq';
import { useBOQEditorState } from '../useBOQEditorState';
import { useSupplierPricePicker } from '../useSupplierPricePicker';
/* eslint-enable import/first */

const ITEM = {
  id: 'boq_1', status: 'draft', scope: 'building', unit: 'pcs', title: 'Γραμμή', categoryCode: 'OIK-1', estimatedQuantity: 12.34567, wasteFactor: 0.1, wastePolicy: 'inherited',
  materialUnitCost: 0, laborUnitCost: 0, equipmentUnitCost: 0, actualQuantity: null,
} as unknown as BOQItem;
const ROW: ForeignSkuRow = { variantId: 'cprod_1', code: 'A-1', label: 'Α', priced: true };
const PRICE = { netAmount: 5000, quantity: 12.346, unitCode: 'pcs' };

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const flush = async (ms = 400) => act(async () => { await jest.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  jest.useFakeTimers();
  mockSearch.mockReset();
  mockQuote.mockReset();
  mockApply.mockReset();
});

afterEach(() => jest.useRealTimers());

describe('useSupplierPricePicker', () => {
  const picker = (onApplied = jest.fn()) => renderHook(() => useSupplierPricePicker(ITEM, onApplied));

  it('🔴 η ποσότητα της τιμής είναι της αποθηκευμένης γραμμής, στα δεκαδικά του επιλυτή', async () => {
    mockQuote.mockResolvedValue({ kind: 'priced', price: PRICE });
    const { result } = picker();
    act(() => result.current.chooseSupplier('srel_1'));
    await act(async () => { await result.current.chooseSku(ROW); });
    expect(mockQuote).toHaveBeenCalledWith('srel_1', 'cprod_1', 12.346);
  });

  it('🔴 η τελευταία πληκτρολόγηση κερδίζει: αργή παλιά απάντηση δεν γράφει πάνω από νεότερη', async () => {
    const old = deferred<{ rows: readonly ForeignSkuRow[] }>();
    mockSearch.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ rows: [ROW] });
    const { result } = picker();
    act(() => result.current.chooseSupplier('srel_1'));
    act(() => result.current.changeTerm('πα'));
    await flush();
    act(() => result.current.changeTerm('παλ'));
    await flush();
    await act(async () => { old.resolve({ rows: [] }); await old.promise; });
    expect(result.current.state.rows).toEqual([ROW]);
  });

  it('🔴 αλλαγή προμηθευτή ρίχνει ό,τι έρχεται από τον προηγούμενο', async () => {
    const old = deferred<{ rows: readonly ForeignSkuRow[] }>();
    mockSearch.mockReturnValueOnce(old.promise);
    const { result } = picker();
    act(() => result.current.chooseSupplier('srel_1'));
    act(() => result.current.changeTerm('πλα'));
    await flush();
    act(() => result.current.chooseSupplier('srel_2'));
    await act(async () => { old.resolve({ rows: [ROW] }); await old.promise; });
    expect(result.current.state).toMatchObject({ relationshipId: 'srel_2', rows: null });
  });

  it('`priced: false` ⇒ καμία ερώτηση τιμής', async () => {
    const { result } = picker();
    act(() => result.current.chooseSupplier('srel_1'));
    await act(async () => { await result.current.chooseSku({ ...ROW, priced: false }); });
    expect(mockQuote).not.toHaveBeenCalled();
    expect(result.current.state.notice).toBe('requestQuote');
  });

  async function offered(onApplied = jest.fn()) {
    mockQuote.mockResolvedValue({ kind: 'priced', price: PRICE });
    const hook = picker(onApplied);
    act(() => hook.result.current.chooseSupplier('srel_1'));
    await act(async () => { await hook.result.current.chooseSku(ROW); });
    return hook;
  }

  it('η εφαρμογή στέλνει ό,τι είδε ο άνθρωπος, και παραδίδει το στιγμιότυπο', async () => {
    const source = { authority: 'supplier' } as BoqSupplierPriceSource;
    mockApply.mockResolvedValue({ kind: 'applied', source });
    const onApplied = jest.fn();
    const { result } = await offered(onApplied);
    await act(async () => { await result.current.apply(); });
    expect(mockApply).toHaveBeenCalledWith('srel_1', { boqItemId: 'boq_1', variantId: 'cprod_1', acknowledged: { netAmount: 5000, quantity: 12.346 }, confirmFence: false });
    expect(onApplied).toHaveBeenCalledWith(source);
    expect(result.current.state.relationshipId).toBeUndefined();
  });

  it('🔴 `priceMoved` ⇒ δείχνει τη νέα τιμή και δεν εφαρμόζει τίποτα', async () => {
    mockApply.mockResolvedValue({ kind: 'priceMoved', price: { ...PRICE, netAmount: 5100 } });
    const onApplied = jest.fn();
    const { result } = await offered(onApplied);
    await act(async () => { await result.current.apply(); });
    expect(result.current.state).toMatchObject({ notice: 'priceMoved', price: { netAmount: 5100 }, busy: false });
    expect(onApplied).not.toHaveBeenCalled();
  });

  it('🔴 `fenceRequired` ⇒ το δεύτερο πάτημα, και μόνο αυτό, επιβεβαιώνει', async () => {
    mockApply.mockResolvedValueOnce({ kind: 'fenceRequired', changeBp: 3000 }).mockResolvedValueOnce({ kind: 'applied', source: {} });
    const { result } = await offered();
    await act(async () => { await result.current.apply(); });
    expect(mockApply.mock.calls[0][1]).toMatchObject({ confirmFence: false });
    expect(result.current.state.notice).toBe('fenceRequired');
    await act(async () => { await result.current.apply(); });
    expect(mockApply.mock.calls[1][1]).toMatchObject({ confirmFence: true });
  });

  it('🔴 Σ7: `unavailable` χωρίς ποσό στην οθόνη', async () => {
    mockApply.mockResolvedValue({ kind: 'unavailable' });
    const { result } = await offered();
    await act(async () => { await result.current.apply(); });
    expect(result.current.state).toMatchObject({ notice: 'unavailable', price: null });
  });
});

describe('useBOQEditorState: η φόρμα μετά από εφαρμογή στον διακομιστή', () => {
  const params = (item: BOQItem) => ({
    open: true, item, categories: [], buildingId: 'b', projectId: 'p', onSave: jest.fn(), onClose: jest.fn(),
  });

  it('🔴 νέο `item` με ίδια ταυτότητα δεν σβήνει ό,τι δεν έχει αποθηκευτεί', () => {
    const { result, rerender } = renderHook((item: BOQItem) => useBOQEditorState(params(item)), { initialProps: ITEM });
    act(() => result.current.updateField('notes', 'γραμμένο, όχι αποθηκευμένο'));
    rerender({ ...ITEM, materialUnitCost: 9 } as BOQItem);
    expect(result.current.form.notes).toBe('γραμμένο, όχι αποθηκευμένο');
  });

  it('🔴 επαναφορά σε πρόχειρο: η κατάσταση ξαναγεμίζει τη φόρμα', () => {
    const submitted = { ...ITEM, status: 'submitted' } as BOQItem;
    const { result, rerender } = renderHook((item: BOQItem) => useBOQEditorState(params(item)), { initialProps: submitted });
    rerender(ITEM);
    expect(result.current.form.status).toBe('draft');
  });

  it('άλλη γραμμή ⇒ άλλη φόρμα', () => {
    const { result, rerender } = renderHook((item: BOQItem) => useBOQEditorState(params(item)), { initialProps: ITEM });
    rerender({ ...ITEM, id: 'boq_2', title: 'Άλλη' } as BOQItem);
    expect(result.current.form.title).toBe('Άλλη');
  });
});
