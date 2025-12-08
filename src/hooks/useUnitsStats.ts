'use client';

import { useMemo } from 'react';
import type { Property } from '@/types/property-viewer';

export interface UnitsStats {
  totalUnits: number;
  availableUnits: number;
  soldUnits: number;
  totalValue: number;
  averageValue: number;
  totalArea: number;
  averageArea: number;
  unitsByStatus: { [key: string]: number };
  unitsByType: { [key: string]: number };
}

export function useUnitsStats(units: Property[]): UnitsStats {
  const stats = useMemo(() => {
    if (!units || units.length === 0) {
      return {
        totalUnits: 0,
        availableUnits: 0,
        soldUnits: 0,
        totalValue: 0,
        averageValue: 0,
        totalArea: 0,
        averageArea: 0,
        unitsByStatus: {},
        unitsByType: {}
      };
    }

    const availableStatuses = ['for-sale', 'for-rent'];
    const soldStatuses = ['sold', 'rented'];

    const totalUnits = units.length;
    const availableUnits = units.filter(unit =>
      unit.status && availableStatuses.includes(unit.status)
    ).length;
    const soldUnits = units.filter(unit =>
      unit.status && soldStatuses.includes(unit.status)
    ).length;

    const totalValue = units.reduce((sum, unit) => sum + (unit.price || 0), 0);
    const averageValue = totalUnits > 0 ? totalValue / totalUnits : 0;

    const totalArea = units.reduce((sum, unit) => sum + (unit.area || 0), 0);
    const averageArea = totalUnits > 0 ? totalArea / totalUnits : 0;

    // Group by status
    const unitsByStatus = units.reduce((acc, unit) => {
      const status = unit.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    // Group by type
    const unitsByType = units.reduce((acc, unit) => {
      const type = unit.type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    return {
      totalUnits,
      availableUnits,
      soldUnits,
      totalValue,
      averageValue,
      totalArea,
      averageArea,
      unitsByStatus,
      unitsByType
    };
  }, [units]);

  return stats;
}