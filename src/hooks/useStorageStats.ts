'use client';

import { useMemo } from 'react';
import type { Storage } from '@/types/storage/contracts';

export function useStorageStats(storages: Storage[]) {
  const stats = useMemo(() => {
    // Basic counts
    const totalStorages = storages.length;
    const availableStorages = storages.filter(s => s.status === 'available').length;
    const occupiedStorages = storages.filter(s => s.status === 'occupied').length;
    const maintenanceStorages = storages.filter(s => s.status === 'maintenance').length;
    const reservedStorages = storages.filter(s => s.status === 'reserved').length;

    // Area calculations
    const totalArea = storages.reduce((sum, s) => sum + (s.area || 0), 0);
    const averageArea = totalStorages > 0 ? totalArea / totalStorages : 0;

    // Price calculations
    const totalValue = storages.reduce((sum, s) => sum + (s.price || 0), 0);
    const averagePrice = totalStorages > 0 ? totalValue / totalStorages : 0;

    // Building distribution
    const uniqueBuildings = new Set(storages.map(s => s.building).filter(Boolean)).size;

    // Type distribution
    const storagesByType = storages.reduce((acc, storage) => {
      const type = storage.type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Status distribution
    const storagesByStatus = {
      available: availableStorages,
      occupied: occupiedStorages,
      maintenance: maintenanceStorages,
      reserved: reservedStorages
    };

    // Floor distribution
    const storagesByFloor = storages.reduce((acc, storage) => {
      const floor = storage.floor || 'Άγνωστος';
      acc[floor] = (acc[floor] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Building distribution
    const storagesByBuilding = storages.reduce((acc, storage) => {
      const building = storage.building || 'Άγνωστο';
      acc[building] = (acc[building] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      // Basic metrics
      totalStorages,
      availableStorages,
      occupiedStorages,
      maintenanceStorages,
      reservedStorages,

      // Area metrics
      totalArea,
      averageArea,

      // Price metrics
      totalValue,
      averagePrice,

      // Distribution metrics
      uniqueBuildings,
      storagesByType,
      storagesByStatus,
      storagesByFloor,
      storagesByBuilding,

      // Utilization rate
      utilizationRate: totalStorages > 0 ? Math.round((occupiedStorages / totalStorages) * 100) : 0,

      // Availability rate
      availabilityRate: totalStorages > 0 ? Math.round((availableStorages / totalStorages) * 100) : 0
    };
  }, [storages]);

  return stats;
}