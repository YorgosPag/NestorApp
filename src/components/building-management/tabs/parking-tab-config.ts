/**
 * parking-tab-config — Types, column definitions, and constants for ParkingTabContent
 *
 * Extracted from ParkingTabContent.tsx for SRP compliance (ADR-184).
 *
 * @module components/building-management/tabs/parking-tab-config
 * @see ADR-184 (Building Spaces Tabs)
 */

import type { ParkingSpot } from '@/types/parking';
export type { ParkingApiData } from '@/types/api/building-spaces.api.types';

// ============================================================================
// TYPES
// ============================================================================

export type ParkingConfirmAction =
  | { type: 'delete'; item: ParkingSpot }
  | { type: 'unlink'; item: ParkingSpot };

/** POST /api/parking returns { parkingSpotId } via apiSuccess (unwrapped by apiClient) */
export interface ParkingCreateResult {
  parkingSpotId: string;
}

/** PATCH/DELETE /api/parking/[id] returns { id } via apiSuccess */
export interface ParkingMutationResult {
  id: string;
}

export interface ParkingTabContentProps {
  building: {
    id: string;
    projectId: string;
  };
}

// 🧹 Εδώ ζούσε ο χάρτης χρωμάτων `PARKING_STATUS_COLORS` πάνω στο παλιό ανάμεικτο `status`.
// Το σήμα κατάστασης το ζωγραφίζει πλέον το `SpaceStatusBadges` (ADR-777 §8.60.20).
