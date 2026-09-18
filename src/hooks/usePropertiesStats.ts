'use client';

/**
 * Properties Statistics — thin wrapper over useEntityStats
 * Includes enterprise CoverageStats for Πληρότητα dashboard card.
 * @module hooks/usePropertiesStats
 */

import { useMemo } from 'react';
import type { PricedPropertyLike } from '@/lib/properties/price-resolver';
import {
  EMPTY_PRICE_TOTALS,
  totalPriceByRole,
  type PriceTotalsByRole,
} from '@/lib/properties/price-totals';
import { useEntityStats, countBy, rate } from './useEntityStats';

/**
 * Minimal shape required by usePropertiesStats — compatible with Property.
 *
 * Extends `PricedPropertyLike` so the value stats can ask the price SSoT
 * instead of reading the @deprecated flat `price` field (ADR-777 Α6).
 */
interface PropertyStatsInput extends PricedPropertyLike {
  area?: number;
  type?: string;
  propertyCoverage?: { hasPhotos?: boolean; hasFloorplans?: boolean; hasDocuments?: boolean };
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
  /** Αξία **ανά ρόλο** (ADR-777 §8.60.14.13) — ποτέ ένας αριθμός πάνω από ανόμοιες μονάδες. */
  priceTotals: PriceTotalsByRole;
  totalArea: number;
  averageArea: number;
  propertiesByStatus: { [key: string]: number };
  propertiesByType: { [key: string]: number };
  coverage: CoverageStats;
}

const AVAILABLE_STATUSES = ['for-sale', 'for-rent'];
const SOLD_STATUSES = ['sold', 'rented'];

const getArea = (u: PropertyStatsInput): number => u.area || 0;
// ⛔ No `getValue`: a price is NOT a unitless number (ADR-777 §8.60.14.13). The
//    generic `useEntityStats` sum would add sale prices to monthly rents — the
//    value is answered per role by `totalPriceByRole`, below.
const getStatus = (u: PropertyStatsInput): string => u.status || 'unknown';
const getType = (u: PropertyStatsInput): string => u.type || 'unknown';

export function usePropertiesStats(properties: PropertyStatsInput[]): PropertiesStats {
  const base = useEntityStats(properties, { getArea, getStatus, getType });

  const stats = useMemo<PropertiesStats>(() => {
    const total = base.total;

    if (total === 0) {
      return {
        totalProperties: 0,
        availableProperties: 0,
        soldProperties: 0,
        priceTotals: EMPTY_PRICE_TOTALS,
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

    // Coverage stats (backward compatible: missing propertyCoverage → false)
    const propertiesWithPhotos = countBy(properties, u => u.propertyCoverage?.hasPhotos === true);
    const propertiesWithFloorplans = countBy(properties, u => u.propertyCoverage?.hasFloorplans === true);
    const propertiesWithDocuments = countBy(properties, u => u.propertyCoverage?.hasDocuments === true);

    return {
      totalProperties: total,
      availableProperties,
      soldProperties,
      priceTotals: totalPriceByRole(properties),
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
