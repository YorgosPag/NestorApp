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

export const PARKING_STATUS_COLORS: Record<string, string> = {
  available: 'bg-[hsl(var(--bg-success))]/10 text-[hsl(var(--text-success))]',
  occupied: 'bg-[hsl(var(--bg-info))]/20 text-primary',
  reserved: 'bg-[hsl(var(--bg-warning))]/40 text-[hsl(var(--text-warning))]',
  sold: 'bg-accent text-primary',
  maintenance: 'bg-destructive/10 text-destructive',
};

/**
 * Returns the Tailwind classes for a parking spot status badge.
 */
export function getStatusBadgeClasses(status: ParkingSpotStatus | undefined): string {
  const s = status || 'available';
  return PARKING_STATUS_COLORS[s] || PARKING_STATUS_COLORS.available;
}
