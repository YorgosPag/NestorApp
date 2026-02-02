// 🏢 ENTERPRISE: Project Address Helper Functions
// ADR-167: Single source of truth for address operations

import type { ProjectAddress, BuildingAddressReference } from './addresses';
import { ADDRESS_CONFIG, AddressUtils } from '@/config/address-config';

/**
 * Get the primary address from an array
 * Enterprise invariant: exactly ONE isPrimary=true per project
 *
 * @param addresses - Array of project addresses
 * @returns Primary address or undefined if not found
 */
export function getPrimaryAddress(addresses?: ProjectAddress[]): ProjectAddress | undefined {
  if (!addresses || addresses.length === 0) return undefined;
  return addresses.find((addr) => addr.isPrimary);
}

/**
 * Format address for display
 * Pattern: "Street Number, City PostalCode"
 *
 * @param address - Project address
 * @returns Formatted address string
 */
export function formatAddressLine(address: ProjectAddress): string {
  const parts: string[] = [];

  // Street + Number
  if (address.street) {
    parts.push(address.number ? `${address.street} ${address.number}` : address.street);
  }

  // City + Postal Code
  if (address.city) {
    const cityPart = address.postalCode
      ? `${address.city} ${address.postalCode}`
      : address.city;
    parts.push(cityPart);
  }

  return parts.join(', ');
}

/**
 * Format block side for display (localized)
 * @param side - Block side direction
 * @param locale - i18n locale (default: 'el')
 * @returns Formatted block side string
 */
export function formatBlockSide(side: string, locale: string = 'el'): string {
  // This will use i18n in actual implementation
  // For now, return the key (i18n will handle translation)
  return side;
}

/**
 * Create a new ProjectAddress with defaults
 * Factory pattern for consistent address creation
 *
 * 🏢 ENTERPRISE: Uses centralized config (NO hardcoded values)
 *
 * @param data - Partial address data
 * @returns Complete ProjectAddress with defaults
 */
export function createProjectAddress(
  data: Partial<ProjectAddress> & Pick<ProjectAddress, 'id' | 'street' | 'city' | 'postalCode' | 'country'>
): ProjectAddress {
  const defaults = AddressUtils.getNewAddressDefaults();
  return {
    type: defaults.type,
    isPrimary: defaults.isPrimary,
    sortOrder: defaults.sortOrder,
    ...data,
  };
}

/**
 * Migrate legacy single address to new multi-address format
 * Backward compatibility helper
 *
 * 🏢 ENTERPRISE: Uses centralized config + enterprise ID generation (NO hardcoded values)
 *
 * @param legacy - Legacy address/city strings
 * @returns ProjectAddress array with single site address
 */
export function migrateLegacyAddress(legacy: {
  address?: string;
  city?: string;
  id?: string;
}): ProjectAddress[] {
  // If no legacy data, return empty array
  if (!legacy.address && !legacy.city) {
    return [];
  }

  // Get defaults from centralized config
  const defaults = AddressUtils.getLegacyDefaults();

  // Create a single "site" address from legacy data
  const address: ProjectAddress = {
    id: legacy.id || AddressUtils.generateAddressId(), // Enterprise ID generation (NOT Date.now()!)
    street: legacy.address || '',
    city: legacy.city || '',
    postalCode: defaults.postalCode, // From centralized config
    country: defaults.country,       // From geographic-config (NOT 'GR'!)
    type: defaults.type,             // From address-config
    isPrimary: defaults.isPrimary,   // Legacy addresses are always primary
    label: defaults.label,           // From address-config
  };

  return [address];
}

/**
 * Resolve building addresses from references
 * SINGLE SOURCE OF TRUTH for building address resolution
 *
 * Enterprise pattern: Always use this function for building address display
 * Never compute addresses inline - prevents duplicates and inconsistencies
 *
 * @param buildingConfigs - Building address configurations (references)
 * @param projectAddresses - Source project addresses
 * @returns Resolved addresses with overrides applied
 */
export function resolveBuildingAddresses(
  buildingConfigs: BuildingAddressReference[] | undefined,
  projectAddresses: ProjectAddress[] | undefined
): ProjectAddress[] {
  // No configs = inherit all project addresses
  if (!buildingConfigs || buildingConfigs.length === 0) {
    return projectAddresses || [];
  }

  // No project addresses available
  if (!projectAddresses || projectAddresses.length === 0) {
    return [];
  }

  const resolved: ProjectAddress[] = [];

  for (const config of buildingConfigs) {
    if (!config.inheritFromProject) {
      // Not inheriting - skip (should not happen in Phase 1)
      continue;
    }

    if (!config.projectAddressId) {
      // Invalid config - skip (Zod should catch this)
      continue;
    }

    // Find the referenced project address
    const projectAddress = projectAddresses.find((addr) => addr.id === config.projectAddressId);
    if (!projectAddress) {
      // Referenced address not found - skip
      continue;
    }

    // Apply overrides if any
    const resolvedAddress: ProjectAddress = {
      ...projectAddress,
      ...(config.override || {}),
    };

    resolved.push(resolvedAddress);
  }

  return resolved;
}

/**
 * Get building primary address (first in configs or primary from resolved)
 * @param buildingConfigs - Building address configurations
 * @param projectAddresses - Source project addresses
 * @returns Primary building address or undefined
 */
export function getBuildingPrimaryAddress(
  buildingConfigs: BuildingAddressReference[] | undefined,
  projectAddresses: ProjectAddress[] | undefined
): ProjectAddress | undefined {
  const resolved = resolveBuildingAddresses(buildingConfigs, projectAddresses);
  if (resolved.length === 0) return undefined;

  // Return first primary, or first address if no primary
  return resolved.find((addr) => addr.isPrimary) || resolved[0];
}

/**
 * Resolve building primary address using primaryProjectAddressId
 * 🏢 ENTERPRISE: Authoritative primary address resolver
 *
 * This function respects the Building.primaryProjectAddressId field,
 * which is the single source of truth for which address is primary.
 *
 * @param primaryProjectAddressId - Building's primary address ID
 * @param buildingConfigs - Building address configurations
 * @param projectAddresses - Source project addresses
 * @returns Primary address or fallback to first resolved address
 */
export function resolveBuildingPrimaryAddress(
  primaryProjectAddressId: string | undefined,
  buildingConfigs: BuildingAddressReference[] | undefined,
  projectAddresses: ProjectAddress[] | undefined
): ProjectAddress | undefined {
  // If no primaryProjectAddressId specified, fallback to legacy behavior
  if (!primaryProjectAddressId) {
    return getBuildingPrimaryAddress(buildingConfigs, projectAddresses);
  }

  // ENTERPRISE INVARIANT: primaryProjectAddressId MUST exist in project addresses
  if (!projectAddresses || projectAddresses.length === 0) {
    console.warn(
      `[ADR-167] Building has primaryProjectAddressId="${primaryProjectAddressId}" but no project addresses available`
    );
    return undefined;
  }

  // Find the primary address by ID
  const primaryAddress = projectAddresses.find((addr) => addr.id === primaryProjectAddressId);

  if (!primaryAddress) {
    console.warn(
      `[ADR-167] Building primaryProjectAddressId="${primaryProjectAddressId}" not found in project addresses`
    );
    // Fallback to legacy behavior
    return getBuildingPrimaryAddress(buildingConfigs, projectAddresses);
  }

  // Check if building has configs - if yes, apply overrides
  if (buildingConfigs && buildingConfigs.length > 0) {
    const config = buildingConfigs.find((c) => c.projectAddressId === primaryProjectAddressId);
    if (config && config.override) {
      // Apply overrides to primary address
      return {
        ...primaryAddress,
        ...config.override,
      };
    }
  }

  // Return primary address as-is (no overrides)
  return primaryAddress;
}
