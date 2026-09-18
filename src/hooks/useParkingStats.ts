'use client';

/**
 * Parking Statistics — thin wrapper over useEntityStats
 * Includes distribution maps (byFloor, byBuilding) and rate calculations.
 * @module hooks/useParkingStats
 */

import { useMemo } from 'react';
import type { ParkingSpot } from './useFirestoreParkingSpots';
import {
  EMPTY_PRICE_TOTALS,
  totalPriceByRole,
  type PriceTotalsByRole,
} from '@/lib/properties/price-totals';
import { useEntityStats, countBy, groupBy, rate } from './useEntityStats';

export interface ParkingStats {
  // Basic metrics
  totalParkingSpots: number;
  availableParkingSpots: number;
  occupiedParkingSpots: number;
  reservedParkingSpots: number;
  soldParkingSpots: number;
  maintenanceParkingSpots: number;

  // Area metrics
  totalArea: number;
  averageArea: number;

  // Price metrics
  /** Αξία **ανά ρόλο** (ADR-777 §8.60.14.13) — ποτέ ένας αριθμός πάνω από ανόμοιες μονάδες. */
  priceTotals: PriceTotalsByRole;

  // Distribution metrics
  uniqueBuildings: number;
  parkingByType: Record<string, number>;
  parkingByStatus: Record<string, number>;
  parkingByFloor: Record<string, number>;
  parkingByBuilding: Record<string, number>;

  // Rates
  utilizationRate: number;
  availabilityRate: number;
  salesRate: number;
}

const getArea = (p: ParkingSpot): number => p.area || 0;
// ⛔ No `getValue` (ADR-777 §8.60.14.13): a price is not a unitless number — the value
//    is answered per role by `totalPriceByRole` (which also keeps Α5: priceless spots
//    are named, never entered as zero).
const getStatus = (p: ParkingSpot): string => p.status || 'unknown';
const getType = (p: ParkingSpot): string => p.type || 'unknown';

export function useParkingStats(parkingSpots: ParkingSpot[]): ParkingStats {
  const base = useEntityStats(parkingSpots, { getArea, getStatus, getType });

  const stats = useMemo<ParkingStats>(() => {
    const total = base.total;

    // Status counts
    const available = countBy(parkingSpots, p => p.status === 'available');
    const occupied = countBy(parkingSpots, p => p.status === 'occupied');
    const reserved = countBy(parkingSpots, p => p.status === 'reserved');
    const sold = countBy(parkingSpots, p => p.status === 'sold');
    const maintenance = countBy(parkingSpots, p => p.status === 'maintenance');

    // Distributions
    const uniqueBuildings = new Set(parkingSpots.map(p => p.buildingId).filter(Boolean)).size;
    const parkingByFloor = groupBy(parkingSpots, p => p.floor || 'Άγνωστος');
    const parkingByBuilding = groupBy(parkingSpots, p => p.buildingId || 'Άγνωστο');

    return {
      totalParkingSpots: total,
      availableParkingSpots: available,
      occupiedParkingSpots: occupied,
      reservedParkingSpots: reserved,
      soldParkingSpots: sold,
      maintenanceParkingSpots: maintenance,

      totalArea: base.totalArea,
      averageArea: base.averageArea,
      priceTotals: total > 0 ? totalPriceByRole(parkingSpots) : EMPTY_PRICE_TOTALS,

      uniqueBuildings,
      parkingByType: base.byType,
      parkingByStatus: {
        available,
        occupied,
        reserved,
        sold,
        maintenance,
      },
      parkingByFloor,
      parkingByBuilding,

      utilizationRate: rate(occupied, total),
      availabilityRate: rate(available, total),
      salesRate: rate(sold, total),
    };
  }, [base, parkingSpots]);

  return stats;
}
