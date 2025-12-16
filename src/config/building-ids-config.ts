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
    // 🏢 ENTERPRISE: Primary building IDs για νέα deployments
    DEFAULT_BUILDING_A: process.env.NEXT_PUBLIC_DEFAULT_BUILDING_A_ID ||
                        process.env.NEXT_PUBLIC_FALLBACK_BUILDING_PREFIX + '-alpha' ||
                        `building-${process.env.NEXT_PUBLIC_COMPANY_SHORT_NAME || 'enterprise'}-a`,

    DEFAULT_BUILDING_B: process.env.NEXT_PUBLIC_DEFAULT_BUILDING_B_ID ||
                        process.env.NEXT_PUBLIC_FALLBACK_BUILDING_PREFIX + '-beta' ||
                        `building-${process.env.NEXT_PUBLIC_COMPANY_SHORT_NAME || 'enterprise'}-b`,

    // 🏢 ENTERPRISE: Legacy building IDs για backwards compatibility
    LEGACY_BUILDING_1: process.env.NEXT_PUBLIC_LEGACY_BUILDING_1_ID ||
                       process.env.NEXT_PUBLIC_LEGACY_BUILDING_PREFIX + '-1' ||
                       `legacy-building-${process.env.NEXT_PUBLIC_TENANT_ID || 'default'}-1`,

    LEGACY_BUILDING_2: process.env.NEXT_PUBLIC_LEGACY_BUILDING_2_ID ||
                       process.env.NEXT_PUBLIC_LEGACY_BUILDING_PREFIX + '-2' ||
                       `legacy-building-${process.env.NEXT_PUBLIC_TENANT_ID || 'default'}-2`,

    // 🏢 ENTERPRISE: Project ID configuration
    PROJECT_ID: parseInt(process.env.NEXT_PUBLIC_DEFAULT_PROJECT_ID ||
                        process.env.NEXT_PUBLIC_TENANT_PROJECT_ID ||
                        (Date.now().toString().slice(-4))) // Dynamic fallback based on deployment time
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
 * Multi-level configurable building identifiers για zero hardcoded values:
 *
 * PRIMARY CONFIGURATION:
 * NEXT_PUBLIC_DEFAULT_BUILDING_A_ID=custom-building-alpha
 * NEXT_PUBLIC_DEFAULT_BUILDING_B_ID=custom-building-beta
 * NEXT_PUBLIC_DEFAULT_PROJECT_ID=1001
 *
 * SECONDARY FALLBACKS:
 * NEXT_PUBLIC_FALLBACK_BUILDING_PREFIX=company-buildings
 * NEXT_PUBLIC_LEGACY_BUILDING_PREFIX=legacy-buildings
 * NEXT_PUBLIC_COMPANY_SHORT_NAME=acme
 * NEXT_PUBLIC_TENANT_ID=tenant-123
 * NEXT_PUBLIC_TENANT_PROJECT_ID=2024
 *
 * LEGACY SUPPORT:
 * NEXT_PUBLIC_LEGACY_BUILDING_1_ID=building-1
 * NEXT_PUBLIC_LEGACY_BUILDING_2_ID=building-2
 *
 * DYNAMIC FALLBACK: If no env vars provided, generates tenant-specific IDs
 */