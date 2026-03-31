'use client';

/**
 * Properties Statistics — thin wrapper over useEntityStats
 * Includes enterprise CoverageStats for Πληρότητα dashboard card.
 * @module hooks/usePropertiesStats
 */

import { useMemo } from 'react';
import { useEntityStats, countBy, rate } from './useEntityStats';

/** Minimal shape required by usePropertiesStats — compatible with PropertyStatsInput and Property */
interface PropertyStatsInput {
  area?: number;
  price?: number;
  status?: string;
  type?: string;
  unitCoverage?: { hasPhotos?: boolean; hasFloorplans?: boolean; hasDocuments?: boolean };
}

/**
 * Property documentation coverage stats
 * Used for Πληρότητα dashboard card
 */
export interface CoverageStats {
  totalProperties: number;
  propertiesWithPhotos: number;
  propertiesWithFloorplans: number;
  propertiesWithDocuments: number;
  photosPercentage: number;
  floorplansPercentage: number;
  documentsPercentage: number;
}

export interface PropertiesStats {
  totalProperties: number;
  availableProperties: number;
  soldProperties: number;
  totalValue: number;
  averageValue: number;
  totalArea: number;
  averageArea: number;
  propertiesByStatus: { [key: string]: number };
  propertiesByType: { [key: string]: number };
  coverage: CoverageStats;
}

const AVAILABLE_STATUSES = ['for-sale', 'for-rent'];
const SOLD_STATUSES = ['sold', 'rented'];

const getArea = (u: PropertyStatsInput): number => u.area || 0;
const getValue = (u: PropertyStatsInput): number => u.price || 0;
const getStatus = (u: PropertyStatsInput): string => u.status || 'unknown';
const getType = (u: PropertyStatsInput): string => u.type || 'unknown';

export function usePropertiesStats(properties: PropertyStatsInput[]): PropertiesStats {
  const base = useEntityStats(properties, { getArea, getValue, getStatus, getType });

  const stats = useMemo<PropertiesStats>(() => {
    const total = base.total;

    if (total === 0) {
      return {
        totalProperties: 0,
        availableProperties: 0,
        soldProperties: 0,
        totalValue: 0,
        averageValue: 0,
        totalArea: 0,
        averageArea: 0,
        propertiesByStatus: {},
        propertiesByType: {},
        coverage: {
          totalProperties: 0,
          propertiesWithPhotos: 0,
          propertiesWithFloorplans: 0,
          propertiesWithDocuments: 0,
          photosPercentage: 0,
          floorplansPercentage: 0,
          documentsPercentage: 0,
        },
      };
    }

    const availableProperties = countBy(properties, u => !!u.status && AVAILABLE_STATUSES.includes(u.status));
    const soldProperties = countBy(properties, u => !!u.status && SOLD_STATUSES.includes(u.status));

    // Coverage stats (backward compatible: missing unitCoverage → false)
    const propertiesWithPhotos = countBy(properties, u => u.unitCoverage?.hasPhotos === true);
    const propertiesWithFloorplans = countBy(properties, u => u.unitCoverage?.hasFloorplans === true);
    const propertiesWithDocuments = countBy(properties, u => u.unitCoverage?.hasDocuments === true);

    return {
      totalProperties: total,
      availableProperties,
      soldProperties,
      totalValue: base.totalValue,
      averageValue: base.averageValue,
      totalArea: base.totalArea,
      averageArea: base.averageArea,
      propertiesByStatus: base.byStatus,
      propertiesByType: base.byType,
      coverage: {
        totalProperties: total,
        propertiesWithPhotos,
        propertiesWithFloorplans,
        propertiesWithDocuments,
        photosPercentage: rate(propertiesWithPhotos, total),
        floorplansPercentage: rate(propertiesWithFloorplans, total),
        documentsPercentage: rate(propertiesWithDocuments, total),
      },
    };
  }, [base, properties]);

  return stats;
}
