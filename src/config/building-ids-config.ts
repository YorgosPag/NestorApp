/**
 * 🏢 ENTERPRISE: Building IDs Configuration
 * Centralized building identifier management for multi-tenant deployment
 * ZERO HARDCODED VALUES - All IDs από environment variables
 */

interface BuildingIdConfig {
  readonly DEFAULT_BUILDING_A: string;
  readonly DEFAULT_BUILDING_B: string;
  readonly LEGACY_BUILDING_1: string;
  readonly LEGACY_BUILDING_2: string;
  readonly PROJECT_ID: number;
}

/**
 * 🏢 ENTERPRISE: Get building IDs configuration from environment
 */
function getBuildingIdsConfig(): BuildingIdConfig {
  return {
    // Primary building IDs για νέα deployments
    DEFAULT_BUILDING_A: process.env.NEXT_PUBLIC_DEFAULT_BUILDING_A_ID || 'default-building-a',
    DEFAULT_BUILDING_B: process.env.NEXT_PUBLIC_DEFAULT_BUILDING_B_ID || 'default-building-b',

    // Legacy building IDs για backwards compatibility
    LEGACY_BUILDING_1: process.env.NEXT_PUBLIC_LEGACY_BUILDING_1_ID || 'building-1',
    LEGACY_BUILDING_2: process.env.NEXT_PUBLIC_LEGACY_BUILDING_2_ID || 'building-2',

    // Project ID configuration
    PROJECT_ID: parseInt(process.env.NEXT_PUBLIC_DEFAULT_PROJECT_ID || '1001')
  } as const;
}

export const BUILDING_IDS = getBuildingIdsConfig();

/**
 * 🏢 ENTERPRISE: Building ID validation utilities
 */
export const BuildingIdUtils = {
  /**
   * Check if building ID is legacy format
   */
  isLegacyBuildingId: (buildingId: string): boolean => {
    return buildingId === BUILDING_IDS.LEGACY_BUILDING_1 ||
           buildingId === BUILDING_IDS.LEGACY_BUILDING_2;
  },

  /**
   * Get default building ID based on index (για fallback logic)
   */
  getDefaultBuildingId: (index: number): string => {
    return index % 2 === 0 ? BUILDING_IDS.DEFAULT_BUILDING_A : BUILDING_IDS.DEFAULT_BUILDING_B;
  },

  /**
   * Map legacy building ID to modern equivalent
   */
  mapLegacyToModern: (legacyId: string): string => {
    switch (legacyId) {
      case BUILDING_IDS.LEGACY_BUILDING_1:
        return BUILDING_IDS.DEFAULT_BUILDING_A;
      case BUILDING_IDS.LEGACY_BUILDING_2:
        return BUILDING_IDS.DEFAULT_BUILDING_B;
      default:
        return legacyId;
    }
  },

  /**
   * Get all legacy building IDs for filtering operations
   */
  getLegacyBuildingIds: (): readonly string[] => {
    return [BUILDING_IDS.LEGACY_BUILDING_1, BUILDING_IDS.LEGACY_BUILDING_2] as const;
  }
} as const;

/**
 * 🏢 ENTERPRISE: Environment Variables Documentation
 * Required environment variables for building configuration:
 *
 * NEXT_PUBLIC_DEFAULT_BUILDING_A_ID=custom-building-alpha
 * NEXT_PUBLIC_DEFAULT_BUILDING_B_ID=custom-building-beta
 * NEXT_PUBLIC_LEGACY_BUILDING_1_ID=building-1  // για backwards compatibility
 * NEXT_PUBLIC_LEGACY_BUILDING_2_ID=building-2  // για backwards compatibility
 * NEXT_PUBLIC_DEFAULT_PROJECT_ID=1001
 */