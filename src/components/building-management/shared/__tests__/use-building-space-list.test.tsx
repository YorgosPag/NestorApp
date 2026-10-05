/**
 * ADR-898 §21.6 Ε2β — **«δεν φόρτωσε» ≠ «δεν υπάρχει καμία»**. Η καρτέλα αποθηκών σε αποτυχημένη ανάγνωση έκανε
 * `setUnits([])` και έδειχνε «Αποθήκες — 0». Ο κοινός μηχανισμός δίνει ρητή κατάσταση και κρατά την τελευταία γνωστή λίστα.
 */

import { act, renderHook } from '@testing-library/react';

import { createStaleCache } from '@/lib/stale-cache';

import { useBuildingSpaceList } from '../useBuildingSpaceList';

jest.mock('@/lib/telemetry', () => ({
  ...jest.requireActual('@/lib/telemetry'),
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

interface Unit {
  readonly id: string;
}

/** Η ανάγνωση περνά από περισσότερα του ενός microtask (αρίθμηση αναγνώσεων) — άδειασε ολόκληρη την ουρά. */
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

function setup(loader: jest.Mock<Promise<Unit[]>, [string]>, buildingId = 'bld_A') {
  const cache = createStaleCache<Unit[]>('test');
  const view = renderHook(({ id }: { id: string }) => useBuildingSpaceList(id, cache, loader), { initialProps: { id: buildingId } });
  return { cache, ...view };
}

describe('useBuildingSpaceList', () => {
  it('πρώτη ανάγνωση: `loading` χωρίς γνωστή λίστα ⇒ `ready` με ό,τι είπε ο server', async () => {
    const loader = jest.fn(async () => [{ id: 's1' }]);
    const { result } = setup(loader);
    expect(result.current).toMatchObject({ status: 'loading', known: false, items: [] });
    await settle();
    expect(result.current).toMatchObject({ status: 'ready', known: true, items: [{ id: 's1' }] });
    expect(loader).toHaveBeenCalledWith('bld_A');
  });

  it('🔴 αποτυχία ⇒ `error`, ΟΧΙ «έτοιμη κενή λίστα» — κανείς δεν μπορεί να τη διαβάσει ως «καμία αποθήκη»', async () => {
    const { result } = setup(jest.fn(async () => { throw new Error('503'); }));
    await settle();
    expect(result.current.status).toBe('error');
    expect(result.current.known).toBe(false);
  });

  it('ο server απαντά «καμία» ⇒ `ready` ΚΑΙ `known`: το άδειο είναι αληθινό', async () => {
    const { result } = setup(jest.fn(async () => []));
    await settle();
    expect(result.current).toMatchObject({ status: 'ready', known: true, items: [] });
  });

  it('αποτυχία ΜΕΤΑ από επιτυχία ⇒ η τελευταία γνωστή λίστα μένει δίπλα στο σφάλμα', async () => {
    const loader = jest.fn<Promise<Unit[]>, [string]>(async () => [{ id: 's1' }]);
    const { result } = setup(loader);
    await settle();
    loader.mockRejectedValueOnce(new Error('503'));
    await act(async () => { await result.current.refetch(); });
    expect(result.current).toMatchObject({ status: 'error', known: true, items: [{ id: 's1' }] });
  });

  it('επανάληψη μετά από αποτυχία ⇒ `ready`', async () => {
    const loader = jest.fn<Promise<Unit[]>, [string]>(async () => [{ id: 's1' }]);
    loader.mockRejectedValueOnce(new Error('503'));
    const { result } = setup(loader);
    await settle();
    expect(result.current.status).toBe('error');
    await act(async () => { await result.current.refetch(); });
    expect(result.current).toMatchObject({ status: 'ready', items: [{ id: 's1' }] });
  });

  it('άλλο κτίριο ⇒ ποτέ η λίστα του προηγούμενου, ούτε για ένα render', async () => {
    const loader = jest.fn(async (id: string) => [{ id: `of-${id}` }]);
    const { result, rerender } = setup(loader);
    await settle();
    rerender({ id: 'bld_B' });
    expect(result.current).toMatchObject({ status: 'loading', known: false, items: [] });
    await settle();
    expect(result.current.items).toEqual([{ id: 'of-bld_B' }]);
  });

  it('επιστροφή σε κτίριο που έχει ήδη φορτώσει (cache ADR-300) ⇒ καμία φάση `loading`', async () => {
    const loader = jest.fn(async (id: string) => [{ id: `of-${id}` }]);
    const { result, rerender } = setup(loader);
    await settle();
    rerender({ id: 'bld_B' });
    await settle();
    rerender({ id: 'bld_A' });
    expect(result.current).toMatchObject({ status: 'ready', known: true, items: [{ id: 'of-bld_A' }] });
    await settle();
  });
});
