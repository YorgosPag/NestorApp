'use client';

import { useMemo } from 'react';
import type { Property } from '@/types/property-viewer';

/**
 * ✅ ENTERPRISE: Unit documentation coverage stats
 * Used for Πληρότητα dashboard card
 * @since PR1.2 - Coverage/Completeness implementation
 */
export interface CoverageStats {
  /** Total units evaluated for coverage */
  totalUnits: number;
  /** Units with photos */
  unitsWithPhotos: number;
  /** Units with floorplans */
  unitsWithFloorplans: number;
  /** Units with documents */
  unitsWithDocuments: number;
  /** % with photos (0-100) */
  photosPercentage: number;
  /** % with floorplans (0-100) */
  floorplansPercentage: number;
  /** % with documents (0-100) */
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
  /** ✅ ENTERPRISE: Coverage stats for Πληρότητα card */
  coverage: CoverageStats;
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
        unitsByType: {},
        coverage: {
          totalUnits: 0,
          unitsWithPhotos: 0,
          unitsWithFloorplans: 0,
          unitsWithDocuments: 0,
          photosPercentage: 0,
          floorplansPercentage: 0,
          documentsPercentage: 0,
        }
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

    // =========================================================================
    // ✅ ENTERPRISE: Calculate coverage statistics
    // =========================================================================

    // ⚠️ BACKWARD COMPATIBILITY: Handle missing unitCoverage until backfill completes
    // Units without coverage data are treated as "missing" (false) for all categories
    const unitsWithPhotos = units.filter(unit => unit.unitCoverage?.hasPhotos === true).length;
    const unitsWithFloorplans = units.filter(unit => unit.unitCoverage?.hasFloorplans === true).length;
    const unitsWithDocuments = units.filter(unit => unit.unitCoverage?.hasDocuments === true).length;

    const coverage: CoverageStats = {
      totalUnits,
      unitsWithPhotos,
      unitsWithFloorplans,
      unitsWithDocuments,
      photosPercentage: totalUnits > 0 ? Math.round((unitsWithPhotos / totalUnits) * 100) : 0,
      floorplansPercentage: totalUnits > 0 ? Math.round((unitsWithFloorplans / totalUnits) * 100) : 0,
      documentsPercentage: totalUnits > 0 ? Math.round((unitsWithDocuments / totalUnits) * 100) : 0,
    };

    return {
      totalUnits,
      availableUnits,
      soldUnits,
      totalValue,
      averageValue,
      totalArea,
      averageArea,
      unitsByStatus,
      unitsByType,
      coverage
    };
  }, [units]);

  return stats;
}