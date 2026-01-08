'use client';

/**
 * 🅿️ ENTERPRISE PARKING STATISTICS HOOK
 *
 * Υπολογισμός στατιστικών για θέσεις στάθμευσης
 * Ακολουθεί το exact pattern από useStorageStats.ts
 *
 * ΑΡΧΙΤΕΚΤΟΝΙΚΗ (REAL_ESTATE_HIERARCHY_DOCUMENTATION.md):
 * - Parking είναι παράλληλη κατηγορία με Units/Storage μέσα στο Building
 * - ΟΧΙ children των Units
 * - Ισότιμη οντότητα στην πλοήγηση
 */

import { useMemo } from 'react';
import type { ParkingSpot } from './useFirestoreParkingSpots';

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

export function useParkingStats(parkingSpots: ParkingSpot[]): ParkingStats {
  const stats = useMemo(() => {
    // Basic counts
    const totalParkingSpots = parkingSpots.length;
    const availableParkingSpots = parkingSpots.filter(p => p.status === 'available').length;
    const occupiedParkingSpots = parkingSpots.filter(p => p.status === 'occupied').length;
    const reservedParkingSpots = parkingSpots.filter(p => p.status === 'reserved').length;
    const soldParkingSpots = parkingSpots.filter(p => p.status === 'sold').length;
    const maintenanceParkingSpots = parkingSpots.filter(p => p.status === 'maintenance').length;

    // Area calculations
    const totalArea = parkingSpots.reduce((sum, p) => sum + (p.area || 0), 0);
    const averageArea = totalParkingSpots > 0 ? totalArea / totalParkingSpots : 0;

    // Price calculations
    const totalValue = parkingSpots.reduce((sum, p) => sum + (p.price || 0), 0);
    const averagePrice = totalParkingSpots > 0 ? totalValue / totalParkingSpots : 0;

    // Building distribution
    const uniqueBuildings = new Set(parkingSpots.map(p => p.buildingId).filter(Boolean)).size;

    // Type distribution
    const parkingByType = parkingSpots.reduce((acc, parking) => {
      const type = parking.type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Status distribution
    const parkingByStatus = {
      available: availableParkingSpots,
      occupied: occupiedParkingSpots,
      reserved: reservedParkingSpots,
      sold: soldParkingSpots,
      maintenance: maintenanceParkingSpots
    };

    // Floor distribution
    const parkingByFloor = parkingSpots.reduce((acc, parking) => {
      const floor = parking.floor || 'Άγνωστος';
      acc[floor] = (acc[floor] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Building distribution
    const parkingByBuilding = parkingSpots.reduce((acc, parking) => {
      const buildingId = parking.buildingId || 'Άγνωστο';
      acc[buildingId] = (acc[buildingId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      // Basic metrics
      totalParkingSpots,
      availableParkingSpots,
      occupiedParkingSpots,
      reservedParkingSpots,
      soldParkingSpots,
      maintenanceParkingSpots,

      // Area metrics
      totalArea,
      averageArea,

      // Price metrics
      totalValue,
      averagePrice,

      // Distribution metrics
      uniqueBuildings,
      parkingByType,
      parkingByStatus,
      parkingByFloor,
      parkingByBuilding,

      // Utilization rate (occupied / total)
      utilizationRate: totalParkingSpots > 0
        ? Math.round((occupiedParkingSpots / totalParkingSpots) * 100)
        : 0,

      // Availability rate (available / total)
      availabilityRate: totalParkingSpots > 0
        ? Math.round((availableParkingSpots / totalParkingSpots) * 100)
        : 0,

      // Sales rate (sold / total)
      salesRate: totalParkingSpots > 0
        ? Math.round((soldParkingSpots / totalParkingSpots) * 100)
        : 0
    };
  }, [parkingSpots]);

  return stats;
}
