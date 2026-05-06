/**
 * parking-tab-config — Types, column definitions, and constants for ParkingTabContent
 *
 * Extracted from ParkingTabContent.tsx for SRP compliance (ADR-184).
 *
 * @module components/building-management/tabs/parking-tab-config
 * @see ADR-184 (Building Spaces Tabs)
 */

import type { ParkingSpot, ParkingSpotStatus } from '@/types/parking';
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

// ============================================================================
// STATUS BADGE COLOR MAP
// ============================================================================

/* eslint-disable design-system/enforce-semantic-colors */
export const PARKING_STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  occupied: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  reserved: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  sold: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  maintenance: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};
/* eslint-enable design-system/enforce-semantic-colors */

/**
 * Returns the Tailwind classes for a parking spot status badge.
 */
export function getStatusBadgeClasses(status: ParkingSpotStatus | undefined): string {
  const s = status || 'available';
  return PARKING_STATUS_COLORS[s] || PARKING_STATUS_COLORS.available;
}
