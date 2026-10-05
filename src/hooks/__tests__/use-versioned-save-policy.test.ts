/**
 * ADR-898 §21.6 Ε6 — **άρνηση πολιτικής δεν είναι σύγκρουση έκδοσης**. Το `useVersionedSave` ξαναδοκίμαζε χωρίς `_v`
 * κάθε 409· ένα 409 με κωδικό του μητρώου πολιτικής (π.χ. «κτίριο άλλου έργου») θα ρωτούσε τον server δύο φορές το ίδιο.
 */

import { act, renderHook } from '@testing-library/react';

import { useVersionedSave } from '../useVersionedSave';

jest.mock('@/lib/telemetry', () => ({
  ...jest.requireActual('@/lib/telemetry'),
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

type Payload = Record<string, unknown>;

function setup(saveFn: jest.Mock) {
  return renderHook(() => useVersionedSave<Payload>({ initialVersion: 7, entityId: 'park_1', saveFn }));
}

describe('useVersionedSave — 409', () => {
  it('🔴 409 με κωδικό πολιτικής ⇒ ΜΙΑ κλήση, και το σφάλμα φτάνει ακέραιο στον καλούντα', async () => {
    const refusal = Object.assign(new Error('conflict'), { statusCode: 409, errorCode: 'POLICY_SPACE_BUILDING_OTHER_PROJECT' });
    const saveFn = jest.fn(async () => { throw refusal; });
    const { result } = setup(saveFn);

    await act(async () => {
      await expect(result.current.save({ buildingId: 'bld_Z' })).rejects.toBe(refusal);
    });
    expect(saveFn).toHaveBeenCalledTimes(1);
  });

  it('σκέτο 409 (σύγκρουση έκδοσης) ⇒ σιωπηλή επανάληψη ΧΩΡΙΣ `_v` — η συμπεριφορά SPEC-256A μένει', async () => {
    const conflict = Object.assign(new Error('VERSION_CONFLICT'), { statusCode: 409 });
    const saveFn = jest.fn<Promise<{ success: boolean; _v?: number }>, [Payload]>(async () => ({ success: true, _v: 9 }));
    saveFn.mockRejectedValueOnce(conflict);
    const { result } = setup(saveFn);

    await act(async () => { await result.current.save({ number: 'Π-5' }); });
    expect(saveFn).toHaveBeenCalledTimes(2);
    expect(saveFn.mock.calls[0][0]).toEqual({ number: 'Π-5', _v: 7 });
    expect(saveFn.mock.calls[1][0]).toEqual({ number: 'Π-5' });
  });

  it('σύγκρουση που έρχεται ως ΑΠΟΤΕΛΕΣΜΑ (όχι εξαίρεση) ⇒ ο ίδιος δρόμος επανάληψης· δεύτερη αποτυχία ⇒ πετά', async () => {
    const saveFn = jest.fn<Promise<{ success: boolean; error?: string; _v?: number }>, [Payload]>(async () => ({ success: true, _v: 9 }));
    saveFn.mockResolvedValueOnce({ success: false, error: 'VERSION_CONFLICT' });
    const { result } = setup(saveFn);
    await act(async () => { await result.current.save({ number: 'Π-5' }); });
    expect(saveFn.mock.calls.map(([payload]) => payload)).toEqual([{ number: 'Π-5', _v: 7 }, { number: 'Π-5' }]);

    saveFn.mockResolvedValueOnce({ success: false, error: 'VERSION_CONFLICT' }).mockResolvedValueOnce({ success: false, error: 'boom' });
    await act(async () => { await expect(result.current.save({ number: 'Π-6' })).rejects.toThrow('boom'); });
  });
});
