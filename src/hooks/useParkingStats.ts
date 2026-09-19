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
import { useEntityStats, groupBy, rate } from './useEntityStats';
import {
  countSpaceStatuses,
  spaceAvailabilityBucket,
  type SpaceAvailabilityBucket,
} from '@/lib/spaces/space-availability';

export interface ParkingStats {
  // Basic metrics — ADR-777 §8.60.20: ΟΛΑ από το `commercialStatus` (+ η λειτουργική εξαίρεση)
  totalParkingSpots: number;
  /** Στην αγορά (προς πώληση · ενοικίαση · και τα δύο). */
  availableParkingSpots: number;
  reservedParkingSpots: number;
  soldParkingSpots: number;
  rentedParkingSpots: number;
  /** Με χρήστη (πώληση · μίσθωση) — η «κατοίκηση», παραγόμενη. */
  inUseParkingSpots: number;
  /** Όχι έτοιμες για χρήση (λειτουργική εξαίρεση). */
  notReadyParkingSpots: number;

  // Area metrics
  totalArea: number;
  averageArea: number;

  // Price metrics
  /** Αξία **ανά ρόλο** (ADR-777 §8.60.14.13) — ποτέ ένας αριθμός πάνω από ανόμοιες μονάδες. */
  priceTotals: PriceTotalsByRole;

  // Distribution metrics
  uniqueBuildings: number;
  parkingByType: Record<string, number>;
  /** Κατανομή ανά κουβά διάθεσης (`lib/spaces/space-availability`). */
  parkingByAvailability: Readonly<Record<SpaceAvailabilityBucket, number>>;
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
// ADR-777 §8.60.20 — η «κατάσταση» των στατιστικών είναι ο κουβάς διάθεσης, όχι το παλιό `status`.
const getStatus = (p: ParkingSpot): string => spaceAvailabilityBucket(p);
const getType = (p: ParkingSpot): string => p.type || 'unknown';

export function useParkingStats(parkingSpots: ParkingSpot[]): ParkingStats {
  const base = useEntityStats(parkingSpots, { getArea, getStatus, getType });

  const stats = useMemo<ParkingStats>(() => {
    const total = base.total;

    // ADR-777 §8.60.20 — οι μετρήσεις από το ΕΝΑ SSoT (ίδιες με πίνακες κτιρίου και πωλήσεις).
    const counts = countSpaceStatuses(parkingSpots);

    // Distributions
    const uniqueBuildings = new Set(parkingSpots.map(p => p.buildingId).filter(Boolean)).size;
    const parkingByFloor = groupBy(parkingSpots, p => p.floor || 'Άγνωστος');
    const parkingByBuilding = groupBy(parkingSpots, p => p.buildingId || 'Άγνωστο');

    return {
      totalParkingSpots: total,
      availableParkingSpots: counts.byAvailability.listed,
      reservedParkingSpots: counts.byAvailability.reserved,
      soldParkingSpots: counts.byAvailability.sold,
      rentedParkingSpots: counts.byAvailability.rented,
      inUseParkingSpots: counts.inUse,
      notReadyParkingSpots: counts.notReady,

      totalArea: base.totalArea,
      averageArea: base.averageArea,
      priceTotals: total > 0 ? totalPriceByRole(parkingSpots) : EMPTY_PRICE_TOTALS,

      uniqueBuildings,
      parkingByType: base.byType,
      parkingByAvailability: counts.byAvailability,
      parkingByFloor,
      parkingByBuilding,

      utilizationRate: counts.utilizationRate,
      availabilityRate: counts.availabilityRate,
      salesRate: rate(counts.byAvailability.sold, total),
    };
  }, [base, parkingSpots]);

  return stats;
}
