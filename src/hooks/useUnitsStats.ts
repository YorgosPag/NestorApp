'use client';

/**
 * Units Statistics — thin wrapper over useEntityStats
 * Includes enterprise CoverageStats for Πληρότητα dashboard card.
 * @module hooks/useUnitsStats
 */

import { useMemo } from 'react';
import { useEntityStats, countBy, rate } from './useEntityStats';

/** Minimal shape required by useUnitsStats — compatible with UnitStatsInput and Unit */
interface UnitStatsInput {
  area?: number;
  price?: number;
  status?: string;
  type?: string;
  unitCoverage?: { hasPhotos?: boolean; hasFloorplans?: boolean; hasDocuments?: boolean };
}

/**
 * Unit documentation coverage stats
 * Used for Πληρότητα dashboard card
 */
export interface CoverageStats {
  totalUnits: number;
  unitsWithPhotos: number;
  unitsWithFloorplans: number;
  unitsWithDocuments: number;
  photosPercentage: number;
  floorplansPercentage: number;
  documentsPercentage: number;
}

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
  coverage: CoverageStats;
}

const AVAILABLE_STATUSES = ['for-sale', 'for-rent'];
const SOLD_STATUSES = ['sold', 'rented'];

const getArea = (u: UnitStatsInput): number => u.area || 0;
const getValue = (u: UnitStatsInput): number => u.price || 0;
const getStatus = (u: UnitStatsInput): string => u.status || 'unknown';
const getType = (u: UnitStatsInput): string => u.type || 'unknown';

export function useUnitsStats(units: UnitStatsInput[]): UnitsStats {
  const base = useEntityStats(units, { getArea, getValue, getStatus, getType });

  const stats = useMemo<UnitsStats>(() => {
    const total = base.total;

    if (total === 0) {
      return {
        totalUnits: 0,
        availableUnits: 0,
        soldUnits: 0,
        totalValue: 0,
        averageValue: 0,
        totalArea: 0,
        averageArea: 0,
        unitsByStatus: {},
        unitsByType: {},
        coverage: {
          totalUnits: 0,
          unitsWithPhotos: 0,
          unitsWithFloorplans: 0,
          unitsWithDocuments: 0,
          photosPercentage: 0,
          floorplansPercentage: 0,
          documentsPercentage: 0,
        },
      };
    }

    const availableUnits = countBy(units, u => !!u.status && AVAILABLE_STATUSES.includes(u.status));
    const soldUnits = countBy(units, u => !!u.status && SOLD_STATUSES.includes(u.status));

    // Coverage stats (backward compatible: missing unitCoverage → false)
    const unitsWithPhotos = countBy(units, u => u.unitCoverage?.hasPhotos === true);
    const unitsWithFloorplans = countBy(units, u => u.unitCoverage?.hasFloorplans === true);
    const unitsWithDocuments = countBy(units, u => u.unitCoverage?.hasDocuments === true);

    return {
      totalUnits: total,
      availableUnits,
      soldUnits,
      totalValue: base.totalValue,
      averageValue: base.averageValue,
      totalArea: base.totalArea,
      averageArea: base.averageArea,
      unitsByStatus: base.byStatus,
      unitsByType: base.byType,
      coverage: {
        totalUnits: total,
        unitsWithPhotos,
        unitsWithFloorplans,
        unitsWithDocuments,
        photosPercentage: rate(unitsWithPhotos, total),
        floorplansPercentage: rate(unitsWithFloorplans, total),
        documentsPercentage: rate(unitsWithDocuments, total),
      },
    };
  }, [base, units]);

  return stats;
}
