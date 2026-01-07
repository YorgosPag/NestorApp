'use client';

/**
 * 🅿️ ENTERPRISE PARKING HOOK
 *
 * React hook για Firestore parking spots data
 * Ακολουθεί το exact pattern από useFirestoreStorages.ts
 *
 * ΑΡΧΙΤΕΚΤΟΝΙΚΗ (local_4.log):
 * - Parking ανήκει στο Building context
 * - Είναι parallel category με Units/Storage
 * - Δεν είναι children των Units
 *
 * USAGE:
 * ```tsx
 * // Get parking for specific building
 * const { parkingSpots, loading, error } = useFirestoreParkingSpots({ buildingId: 'bldg_xxx' });
 *
 * // Get all parking spots
 * const { parkingSpots, loading, error } = useFirestoreParkingSpots();
 * ```
 */

import { useState, useEffect, useCallback } from 'react';

// =============================================================================
// 🅿️ TYPE DEFINITIONS
// =============================================================================

/**
 * Parking spot type options
 */
export type ParkingSpotType = 'standard' | 'handicapped' | 'motorcycle' | 'electric' | 'visitor';

/**
 * Parking spot status options
 */
export type ParkingSpotStatus = 'available' | 'occupied' | 'reserved' | 'sold' | 'maintenance';

/**
 * Enterprise parking spot interface
 * Matches Firestore document structure
 */
export interface ParkingSpot {
  id: string;
  number: string;
  buildingId: string;
  type?: ParkingSpotType;
  status?: ParkingSpotStatus;
  floor?: string;
  location?: string;
  area?: number;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Hook options
 */
interface UseFirestoreParkingOptions {
  /** Filter by building ID (RECOMMENDED per local_4.log architecture) */
  buildingId?: string;
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
}

/**
 * Hook return type
 */
interface UseFirestoreParkingReturn {
  /** Array of parking spots */
  parkingSpots: ParkingSpot[];
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Manual refetch function */
  refetch: () => Promise<void>;
  /** Whether data was loaded from cache */
  cached: boolean;
}

// =============================================================================
// 🅿️ HOOK IMPLEMENTATION
// =============================================================================

/**
 * useFirestoreParkingSpots
 *
 * Enterprise-grade hook για parking spots data
 * Supports filtering by buildingId (per local_4.log architecture)
 */
export function useFirestoreParkingSpots(
  options: UseFirestoreParkingOptions = {}
): UseFirestoreParkingReturn {
  const { buildingId, autoFetch = true } = options;

  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  const fetchParkingSpots = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build API URL με optional buildingId filter
      const url = buildingId
        ? `/api/parking?buildingId=${encodeURIComponent(buildingId)}`
        : '/api/parking';

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch parking spots: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setParkingSpots(data.parkingSpots);
        setCached(data.cached ?? false);

        if (buildingId) {
          console.log(`🅿️ Hook: Loaded ${data.parkingSpots.length} parking spots for building ${buildingId}`);
        } else {
          console.log(`🅿️ Hook: Loaded ${data.parkingSpots.length} parking spots`);
        }
      } else {
        throw new Error(data.error || 'Failed to fetch parking spots');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ Error fetching parking spots:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [buildingId]);

  // Auto-fetch on mount and when buildingId changes
  useEffect(() => {
    if (autoFetch) {
      fetchParkingSpots();
    }
  }, [fetchParkingSpots, autoFetch]);

  return {
    parkingSpots,
    loading,
    error,
    refetch: fetchParkingSpots,
    cached
  };
}

// =============================================================================
// 🅿️ CONVENIENCE EXPORTS
// =============================================================================

/**
 * Get parking spots for a specific building
 * Shorthand για common use case per local_4.log architecture
 */
export function useBuildingParkingSpots(buildingId: string): UseFirestoreParkingReturn {
  return useFirestoreParkingSpots({ buildingId });
}

export default useFirestoreParkingSpots;
