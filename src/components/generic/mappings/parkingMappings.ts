/**
 * 🏢 ENTERPRISE: Domain-scoped Parking Component Mapping
 *
 * Contains ONLY parking-related components.
 * This file is the ONLY mapping import needed for parking detail pages.
 *
 * RATIONALE: Splitting from master barrel eliminates transitive imports
 * of project/unit/contact/storage/building components from parking pages,
 * significantly reducing module graph.
 *
 * NOTE: These mappings are IDENTICAL to those in index.ts.
 * This is NOT duplication - it's domain scoping.
 * The index.ts will be kept for legacy/backward compatibility.
 *
 * @module components/generic/mappings/parkingMappings
 */

// ============================================================================
// PARKING-SPECIFIC COMPONENTS
// ============================================================================

import { ParkingGeneralTab } from '@/components/space-management/ParkingPage/ParkingDetails/tabs/ParkingGeneralTab';

// ============================================================================
// SHARED COMPONENTS (reused from their original locations)
// ============================================================================

import PlaceholderTab from '@/components/building-management/tabs/PlaceholderTab';

// ============================================================================
// PARKING COMPONENT MAPPING
// ============================================================================

export const PARKING_COMPONENT_MAPPING = {
  'ParkingGeneralTab': ParkingGeneralTab,
  'ParkingStatsTab': PlaceholderTab,
  'ParkingDocumentsTab': PlaceholderTab,
  'ParkingPhotosTab': PlaceholderTab,
  'ParkingHistoryTab': PlaceholderTab,
  'PlaceholderTab': PlaceholderTab,
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ParkingComponentName = keyof typeof PARKING_COMPONENT_MAPPING;
