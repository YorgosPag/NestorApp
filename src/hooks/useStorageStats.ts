'use client';

/**
 * Storage Statistics — thin wrapper over useEntityStats
 * Includes distribution maps (byFloor, byBuilding) and rate calculations.
 * @module hooks/useStorageStats
 */

import { useMemo } from 'react';
import type { Storage } from '@/types/storage/contracts';
import { useEntityStats, countBy, groupBy, rate } from './useEntityStats';

const getArea = (s: Storage): number => s.area || 0;
// ⛔ No `getValue` (ADR-777 §8.60.14.13): the page never showed a storage value, and the
//    generic sum would have added sale prices to monthly rents. A future value tile asks
//    `totalPriceByRole` — the per-role answer — not this hook.
const getStatus = (s: Storage): string => s.status || 'unknown';
const getType = (s: Storage): string => s.type || 'unknown';

export function useStorageStats(storages: Storage[]) {
  const base = useEntityStats(storages, { getArea, getStatus, getType });

  const stats = useMemo(() => {
    const total = base.total;

    // Status counts
    const available = countBy(storages, s => s.status === 'available');
    const occupied = countBy(storages, s => s.status === 'occupied');
    const maintenance = countBy(storages, s => s.status === 'maintenance');
    const reserved = countBy(storages, s => s.status === 'reserved');

    // Distributions
    const uniqueBuildings = new Set(storages.map(s => s.building).filter(Boolean)).size;
    const storagesByFloor = groupBy(storages, s => s.floor || 'Άγνωστος');
    const storagesByBuilding = groupBy(storages, s => s.building || 'Άγνωστο');

    return {
      totalStorages: total,
      availableStorages: available,
      occupiedStorages: occupied,
      maintenanceStorages: maintenance,
      reservedStorages: reserved,

      totalArea: base.totalArea,
      averageArea: base.averageArea,

      uniqueBuildings,
      storagesByType: base.byType,
      storagesByStatus: {
        available,
        occupied,
        maintenance,
        reserved,
      },
      storagesByFloor,
      storagesByBuilding,

      utilizationRate: rate(occupied, total),
      availabilityRate: rate(available, total),
    };
  }, [base, storages]);

  return stats;
}
