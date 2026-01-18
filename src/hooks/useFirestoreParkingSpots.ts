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
 * 🏢 ENTERPRISE: Uses centralized apiClient for automatic authentication
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
import { useAuth } from '@/auth/hooks/useAuth';
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';

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
// 🅿️ ENTERPRISE API RESPONSE TYPE
// =============================================================================

/**
 * 🏢 ENTERPRISE: Response data type (apiClient returns unwrapped data)
 */
interface ParkingApiResponse {
  parkingSpots: ParkingSpot[];
  count?: number;
  cached?: boolean;
}

// =============================================================================
// 🅿️ HOOK IMPLEMENTATION
// =============================================================================

/**
 * useFirestoreParkingSpots
 *
 * Enterprise-grade hook για parking spots data
 * Supports filtering by buildingId (per local_4.log architecture)
 *
 * 🏢 ENTERPRISE: Uses apiClient for automatic authentication
 */
export function useFirestoreParkingSpots(
  options: UseFirestoreParkingOptions = {}
): UseFirestoreParkingReturn {
  const { buildingId, autoFetch = true } = options;

  // 🔐 ENTERPRISE: Auth-ready gating - wait for user to be authenticated
  const { user, loading: authLoading } = useAuth();

  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  const fetchParkingSpots = useCallback(async () => {
    // 🔐 ENTERPRISE: Wait for auth before fetching
    if (authLoading) {
      console.log('⏳ [ParkingSpots] Waiting for auth state...');
      return;
    }

    if (!user) {
      console.log('⏳ [ParkingSpots] User not authenticated, skipping fetch');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log(`🅿️ [ParkingSpots] Fetching parking spots...`);

      // Build API URL με optional buildingId filter
      const url = buildingId
        ? `/api/parking?buildingId=${encodeURIComponent(buildingId)}`
        : '/api/parking';

      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      const data = await apiClient.get<ParkingApiResponse>(url);

      setParkingSpots(data?.parkingSpots || []);
      setCached(data?.cached ?? false);

      if (buildingId) {
        console.log(`✅ [ParkingSpots] Loaded ${data?.parkingSpots?.length || 0} parking spots for building ${buildingId}`);
      } else {
        console.log(`✅ [ParkingSpots] Loaded ${data?.parkingSpots?.length || 0} parking spots`);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ [ParkingSpots] Error fetching parking spots:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [buildingId, user, authLoading]);

  // Auto-fetch on mount and when buildingId/auth changes
  useEffect(() => {
    if (autoFetch && !authLoading && user) {
      fetchParkingSpots();
    }
  }, [fetchParkingSpots, autoFetch, authLoading, user]);

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
