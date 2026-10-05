/**
 * @fileoverview Η ανάγνωση της λίστας αποθηκών ενός κτιρίου για την καρτέλα «Αποθήκες» (ADR-184 · ADR-300).
 * @module components/building-management/StorageTab/storage-tab-load
 *
 * Βγήκε από το `useStorageTabState` (N.7.1) μαζί με το Ε2β του ADR-898 §21.6: η ανάγνωση **πετά** σε αποτυχία — και σε
 * απάντηση χωρίς λίστα — ώστε ο καταναλωτής (`useBuildingSpaceList`) να δείξει «δεν φόρτωσε», ποτέ «καμία αποθήκη».
 */

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { createStaleCache } from '@/lib/stale-cache';
import type { StoragesApiData } from '@/types/api/building-spaces.api.types';
import type { StorageType, StorageUnit } from '@/types/storage';

// ADR-300: Module-level cache — keyed by buildingId, survives re-navigation
export const buildingStorageCache = createStaleCache<StorageUnit[]>('building-storage-tab');

type StorageRecord = StoragesApiData['storages'][number];

function toStorageUnit(s: StorageRecord, buildingName: string): StorageUnit {
  return {
    id: s.id,
    code: s.name || s.code || `S-${s.id.substring(0, 6)}`,
    type: (s.type || 'small') as StorageType,
    // ADR-777 §8.60.20 — κάδος · λειτουργία (ο ΕΝΑΣ αναγνώστης τα έλυσε ήδη στον mapper).
    status: s.status,
    operationalStatus: s.operationalStatus,
    floorId: s.floorId ?? null,
    floor: s.floor ?? null,
    floorKind: s.floorKind ?? null,
    area: typeof s.area === 'number' ? s.area : 0,
    price: typeof s.price === 'number' ? s.price : 0,
    // ADR-777 §8.60.18 — χωρίς αυτά ο επιλυτής έβλεπε ΜΟΝΟ το @deprecated `price`:
    // η στήλη «Τιμή» της καρτέλας αποθηκών δεν μπορούσε να δείξει ποτέ ενοίκιο.
    commercialStatus: s.commercialStatus,
    commercial: s.commercial,
    description: s.description || '',
    building: s.building || buildingName,
    project: '',        // mapStorageDoc does not expose this field
    company: '',        // mapStorageDoc does not expose this field
    linkedProperty: null,    // mapStorageDoc does not expose this field
    features: [],            // mapStorageDoc does not expose this field
    coordinates: { x: 0, y: 0 },  // mapStorageDoc does not expose this field
  };
}

/** @throws όταν η ανάγνωση αποτύχει ή η απάντηση δεν φέρει λίστα. */
export async function loadBuildingStorageUnits(buildingId: string, buildingName: string): Promise<StorageUnit[]> {
  const result = await apiClient.get<StoragesApiData>(`${API_ROUTES.STORAGES.LIST}?buildingId=${buildingId}`);
  if (!result?.storages) throw new Error('Storages response carried no list');
  return result.storages.map((storage) => toStorageUnit(storage, buildingName));
}
