'use client';

/**
 * Storage Statistics — thin wrapper over useEntityStats
 * Includes distribution maps (byFloor, byBuilding) and rate calculations.
 * @module hooks/useStorageStats
 */

import { useMemo } from 'react';
import type { Storage } from '@/types/storage/contracts';
import { useEntityStats, groupBy } from './useEntityStats';
import { countSpaceStatuses, spaceAvailabilityBucket } from '@/lib/spaces/space-availability';

const getArea = (s: Storage): number => s.area || 0;
// ⛔ No `getValue` (ADR-777 §8.60.14.13): the page never showed a storage value, and the
//    generic sum would have added sale prices to monthly rents. A future value tile asks
//    `totalPriceByRole` — the per-role answer — not this hook.
// ADR-777 §8.60.20 — η «κατάσταση» των στατιστικών είναι ο κουβάς διάθεσης, όχι το παλιό `status`.
const getStatus = (s: Storage): string => spaceAvailabilityBucket(s);
const getType = (s: Storage): string => s.type || 'unknown';

export function useStorageStats(storages: Storage[]) {
  const base = useEntityStats(storages, { getArea, getStatus, getType });

  const stats = useMemo(() => {
    const total = base.total;

    // ADR-777 §8.60.20 — οι μετρήσεις από το ΕΝΑ SSoT (ίδιες με πίνακες κτιρίου και πωλήσεις).
    const counts = countSpaceStatuses(storages);

    // Distributions
    const uniqueBuildings = new Set(storages.map(s => s.building).filter(Boolean)).size;
    const storagesByFloor = groupBy(storages, s => s.floor || 'Άγνωστος');
    const storagesByBuilding = groupBy(storages, s => s.building || 'Άγνωστο');

    return {
      totalStorages: total,
      /** Στην αγορά. */
      availableStorages: counts.byAvailability.listed,
      /** Με χρήστη (πώληση · μίσθωση) — παραγόμενο, όχι αποθηκευμένο «occupied». */
      inUseStorages: counts.inUse,
      /** Όχι έτοιμες για χρήση (λειτουργική εξαίρεση). */
      notReadyStorages: counts.notReady,
      reservedStorages: counts.byAvailability.reserved,

      totalArea: base.totalArea,
      averageArea: base.averageArea,

      uniqueBuildings,
      storagesByType: base.byType,
      storagesByAvailability: counts.byAvailability,
      storagesByFloor,
      storagesByBuilding,

      utilizationRate: counts.utilizationRate,
      availabilityRate: counts.availabilityRate,
    };
  }, [base, storages]);

  return stats;
}
