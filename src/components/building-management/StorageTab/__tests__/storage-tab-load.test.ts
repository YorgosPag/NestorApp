/**
 * ADR-898 §21.6 Ε2β — η ανάγνωση των αποθηκών **πετά** όταν δεν έχει λίστα να δώσει. Το παλιό `catch` την έκανε `[]`,
 * και η καρτέλα έδειχνε «Αποθήκες — 0» για κτίριο που είχε αποθήκες.
 */

import { loadBuildingStorageUnits } from '../storage-tab-load';

const get = jest.fn();
jest.mock('@/lib/api/enterprise-api-client', () => ({ apiClient: { get: (...args: unknown[]) => get(...args) } }));

beforeEach(() => get.mockReset());

describe('loadBuildingStorageUnits', () => {
  it('ρωτά το κτίριο που ζητήθηκε και δίνει τις αποθήκες του', async () => {
    get.mockResolvedValue({ storages: [{ id: 'stor_1', name: 'Α-1', type: 'storage', area: 6 }], count: 1, cached: false });
    const units = await loadBuildingStorageUnits('bld_A', 'Κτήριο Α');
    expect(get.mock.calls[0][0]).toContain('buildingId=bld_A');
    expect(units).toMatchObject([{ id: 'stor_1', code: 'Α-1', area: 6, building: 'Κτήριο Α' }]);
  });

  it('ο server απαντά «καμία» ⇒ κενός πίνακας (αληθινό άδειο)', async () => {
    get.mockResolvedValue({ storages: [], count: 0, cached: false });
    await expect(loadBuildingStorageUnits('bld_A', 'Κτήριο Α')).resolves.toEqual([]);
  });

  it('🔴 αποτυχία αιτήματος ⇒ πετά — ΟΧΙ κενός πίνακας', async () => {
    get.mockRejectedValue(new Error('503'));
    await expect(loadBuildingStorageUnits('bld_A', 'Κτήριο Α')).rejects.toThrow('503');
  });

  it('🔴 απάντηση χωρίς λίστα ⇒ πετά — ΟΧΙ κενός πίνακας', async () => {
    get.mockResolvedValue(null);
    await expect(loadBuildingStorageUnits('bld_A', 'Κτήριο Α')).rejects.toThrow();
  });
});
