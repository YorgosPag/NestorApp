'use client';

/**
 * Parking Statistics — thin wrapper over useEntityStats
 * Includes distribution maps (byFloor, byBuilding) and rate calculations.
 * @module hooks/useParkingStats
 */

import { useMemo } from 'react';
import type { ParkingSpot } from './useFirestoreParkingSpots';
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
  totalValue: number;
  averagePrice: number;

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
const getValue = (p: ParkingSpot): number => p.price || 0;
const getStatus = (p: ParkingSpot): string => p.status || 'unknown';
const getType = (p: ParkingSpot): string => p.type || 'unknown';

export function useParkingStats(parkingSpots: ParkingSpot[]): ParkingStats {
  const base = useEntityStats(parkingSpots, { getArea, getValue, getStatus, getType });

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
      totalValue: base.totalValue,
      averagePrice: base.averageValue,

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
