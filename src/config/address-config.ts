/**
 * 🏢 ENTERPRISE: Address Configuration
 * Centralized configuration για Project Address System (ADR-167)
 * ZERO HARDCODED ADDRESS VALUES - All data από environment variables + centralized config
 *
 * @see docs/centralized-systems/reference/adrs/ADR-167-enterprise-project-address-system.md
 */

import { GEOGRAPHIC_CONFIG } from './geographic-config';
import { generateProjectId } from '@/services/enterprise-id.service';
import type { ProjectAddressType } from '@/types/project/addresses';

/**
 * Address configuration interface
 */
interface AddressConfig {
  readonly DEFAULT_TYPE: ProjectAddressType;
  readonly DEFAULT_IS_PRIMARY: boolean;
  readonly DEFAULT_SORT_ORDER: number;
  readonly LEGACY_LABEL: string;
  readonly DEFAULT_POSTAL_CODE: string;
}

/**
 * 🏢 ENTERPRISE: Get address configuration from environment
 */
function getAddressConfig(): AddressConfig {
  return {
    // Default address type για new addresses
    DEFAULT_TYPE: (process.env.NEXT_PUBLIC_DEFAULT_ADDRESS_TYPE || 'site') as ProjectAddressType,

    // Default primary flag (new addresses are NOT primary by default)
    DEFAULT_IS_PRIMARY: process.env.NEXT_PUBLIC_DEFAULT_IS_PRIMARY === 'true' || false,

    // Default sort order for new addresses
    DEFAULT_SORT_ORDER: parseInt(process.env.NEXT_PUBLIC_DEFAULT_SORT_ORDER || '0', 10),

    // Legacy migration label (Greek default)
    LEGACY_LABEL: process.env.NEXT_PUBLIC_LEGACY_ADDRESS_LABEL || 'Κύρια διεύθυνση (legacy)',

    // Default postal code for migration (empty string when unknown)
    DEFAULT_POSTAL_CODE: process.env.NEXT_PUBLIC_DEFAULT_POSTAL_CODE || '',
  } as const;
}

/**
 * Exported address configuration constant
 */
export const ADDRESS_CONFIG = getAddressConfig();

/**
 * 🏢 ENTERPRISE: Address utilities
 */
export const AddressUtils = {
  /**
   * Generate secure address ID using enterprise ID service
   * Uses crypto-secure UUID generation (NOT Date.now()!)
   *
   * @returns Address ID in format: proj_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateAddressId: (): string => {
    // Reuse project ID format for address IDs (both are project-scoped entities)
    return generateProjectId();
  },

  /**
   * Get default country for addresses
   * Uses centralized geographic config
   *
   * @returns Country name (e.g., 'Ελλάδα')
   */
  getDefaultCountry: (): string => {
    return GEOGRAPHIC_CONFIG.DEFAULT_COUNTRY;
  },

  /**
   * Get default city for addresses
   * Uses centralized geographic config
   *
   * @returns City name (e.g., 'Αθήνα')
   */
  getDefaultCity: (): string => {
    return GEOGRAPHIC_CONFIG.DEFAULT_CITY;
  },

  /**
   * Get default region for addresses
   * Uses centralized geographic config
   *
   * @returns Region name (e.g., 'Αττική')
   */
  getDefaultRegion: (): string => {
    return GEOGRAPHIC_CONFIG.DEFAULT_REGION;
  },

  /**
   * Get complete defaults for legacy address migration
   *
   * @returns Object with all legacy migration defaults
   */
  getLegacyDefaults: () => ({
    type: ADDRESS_CONFIG.DEFAULT_TYPE,
    isPrimary: true, // Legacy addresses are ALWAYS primary (single source of truth)
    label: ADDRESS_CONFIG.LEGACY_LABEL,
    country: GEOGRAPHIC_CONFIG.DEFAULT_COUNTRY,
    postalCode: ADDRESS_CONFIG.DEFAULT_POSTAL_CODE,
    sortOrder: ADDRESS_CONFIG.DEFAULT_SORT_ORDER,
  }),

  /**
   * Get defaults for new address creation
   *
   * @returns Object with all new address defaults
   */
  getNewAddressDefaults: () => ({
    type: ADDRESS_CONFIG.DEFAULT_TYPE,
    isPrimary: ADDRESS_CONFIG.DEFAULT_IS_PRIMARY,
    sortOrder: ADDRESS_CONFIG.DEFAULT_SORT_ORDER,
    country: GEOGRAPHIC_CONFIG.DEFAULT_COUNTRY,
  }),

  /**
   * Validate address type
   *
   * @param type - Address type to validate
   * @returns True if valid address type
   */
  isValidAddressType: (type: string): type is ProjectAddressType => {
    const validTypes: ProjectAddressType[] = [
      'site', 'entrance', 'delivery', 'legal',
      'postal', 'billing', 'correspondence', 'other'
    ];
    return validTypes.includes(type as ProjectAddressType);
  },
} as const;

/**
 * 🏢 ENTERPRISE: Environment Variables Documentation
 *
 * Address configuration (all optional with safe defaults):
 *
 * NEXT_PUBLIC_DEFAULT_ADDRESS_TYPE=site
 * NEXT_PUBLIC_DEFAULT_IS_PRIMARY=false
 * NEXT_PUBLIC_DEFAULT_SORT_ORDER=0
 * NEXT_PUBLIC_LEGACY_ADDRESS_LABEL=Κύρια διεύθυνση (legacy)
 * NEXT_PUBLIC_DEFAULT_POSTAL_CODE=
 *
 * ⚡ DYNAMIC FALLBACK: If no env vars provided, uses enterprise-safe defaults
 * 🔗 INTEGRATES WITH: geographic-config.ts, enterprise-id.service.ts
 */
