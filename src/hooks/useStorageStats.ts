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
const getValue = (s: Storage): number => s.price || 0;
const getStatus = (s: Storage): string => s.status || 'unknown';
const getType = (s: Storage): string => s.type || 'unknown';

export function useStorageStats(storages: Storage[]) {
  const base = useEntityStats(storages, { getArea, getValue, getStatus, getType });

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
      totalValue: base.totalValue,
      averagePrice: base.averageValue,

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
