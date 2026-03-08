/**
 * =============================================================================
 * 🏢 ENTERPRISE ADDRESS HELPERS
 * =============================================================================
 *
 * Utility functions for project address management
 * Pattern: SAP Real Estate, Salesforce CPQ, Microsoft Dynamics
 *
 * Features:
 * - Primary address extraction
 * - Address formatting (Greek standards)
 * - Legacy migration (backward compatibility)
 * - Building address inheritance resolution
 *
 * @file address-helpers.ts
 * @created 2026-02-02
 */

import type {
  ProjectAddress,
  BuildingAddressReference,
  BlockSideDirection,
  ProjectAddressType
} from './addresses';
import type { StructuredGeocodingQuery } from '@/lib/geocoding/geocoding-service';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('address-helpers');

// =============================================================================
// PRIMARY ADDRESS EXTRACTION
// =============================================================================

/**
 * Get primary address from array
 * Enterprise pattern: Always return the first primary, or first address as fallback
 *
 * @param addresses - Array of project addresses
 * @returns Primary address or undefined
 */
export function getPrimaryAddress(
  addresses?: ProjectAddress[]
): ProjectAddress | undefined {
  if (!addresses || addresses.length === 0) {
    return undefined;
  }

  // Find first primary address
  const primary = addresses.find(addr => addr.isPrimary);
  if (primary) {
    return primary;
  }

  // Fallback: return first address
  return addresses[0];
}

// =============================================================================
// ADDRESS FORMATTING
// =============================================================================

/**
 * Format address for display (Greek format)
 * Pattern: "Οδός Αριθμός, Πόλη ΤΚ"
 *
 * @param address - Project address to format
 * @returns Formatted string
 */
export function formatAddressLine(address: ProjectAddress): string {
  const parts: string[] = [];

  // Street + Number
  if (address.street) {
    parts.push(address.street);
    if (address.number) {
      parts[parts.length - 1] = `${parts[parts.length - 1]} ${address.number}`;
    }
  }

  // City
  if (address.city) {
    parts.push(address.city);
  }

  // Postal Code
  if (address.postalCode) {
    parts.push(address.postalCode);
  }

  return parts.join(', ');
}

/**
 * Format block side for display (Greek)
 *
 * @param side - Block side direction
 * @param locale - Language (currently only 'el' supported)
 * @returns Formatted string
 */
export function formatBlockSide(
  side: BlockSideDirection | undefined,
  locale: string = 'el'
): string {
  if (!side) {
    return '';
  }

  const labels: Record<BlockSideDirection, string> = {
    north: 'Βόρεια',
    south: 'Νότια',
    east: 'Ανατολική',
    west: 'Δυτική',
    northeast: 'Βορειοανατολική',
    northwest: 'Βορειοδυτική',
    southeast: 'Νοτιοανατολική',
    southwest: 'Νοτιοδυτική',
    corner: 'Γωνία',
    internal: 'Εσωτερική'
  };

  return labels[side] || '';
}

/**
 * Format address type for display (Greek)
 *
 * @param type - Address type
 * @param locale - Language (currently only 'el' supported)
 * @returns Formatted string
 */
export function formatAddressType(
  type: ProjectAddressType,
  locale: string = 'el'
): string {
  const labels: Record<ProjectAddressType, string> = {
    site: 'Εργοτάξιο',
    entrance: 'Είσοδος',
    delivery: 'Παράδοση',
    legal: 'Νομική Έδρα',
    postal: 'Ταχυδρομείο',
    billing: 'Τιμολόγηση',
    correspondence: 'Αλληλογραφία',
    other: 'Άλλο'
  };

  return labels[type];
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create new ProjectAddress with defaults
 * Enterprise pattern: Factory function with sensible defaults
 *
 * @param data - Partial address data
 * @returns Complete ProjectAddress
 */
export function createProjectAddress(
  data: Partial<ProjectAddress> & { city: string }
): ProjectAddress {
  // 🏢 ENTERPRISE: Use conditional spread to avoid undefined values
  // Firestore REJECTS undefined — omit optional fields entirely if not provided
  return {
    id: data.id || crypto.randomUUID(),
    street: data.street || '',
    city: data.city,
    postalCode: data.postalCode || '',
    country: data.country || GEOGRAPHIC_CONFIG.DEFAULT_COUNTRY,
    type: data.type || 'site',
    isPrimary: data.isPrimary ?? false,
    sortOrder: data.sortOrder ?? 0,
    // Optional fields: only include if defined (Firestore rejects undefined)
    ...(data.number ? { number: data.number } : {}),
    ...(data.region ? { region: data.region } : {}),
    ...(data.regionalUnit ? { regionalUnit: data.regionalUnit } : {}),
    ...(data.label ? { label: data.label } : {}),
    ...(data.blockSide ? { blockSide: data.blockSide } : {}),
    ...(data.blockSideDescription ? { blockSideDescription: data.blockSideDescription } : {}),
    ...(data.cadastralCode ? { cadastralCode: data.cadastralCode } : {}),
    ...(data.municipality ? { municipality: data.municipality } : {}),
    ...(data.neighborhood ? { neighborhood: data.neighborhood } : {}),
    ...(data.coordinates ? { coordinates: data.coordinates } : {}),
  };
}

// =============================================================================
// LEGACY MIGRATION
// =============================================================================

/**
 * Convert legacy single address to new format
 * Enterprise pattern: Backward compatibility migration
 *
 * @param legacyAddress - Old "address" string field
 * @param legacyCity - Old "city" string field
 * @returns ProjectAddress array (single primary address)
 */
export function migrateLegacyAddress(legacy: { address?: string; city?: string }): ProjectAddress[];
export function migrateLegacyAddress(legacyAddress: string, legacyCity: string): ProjectAddress[];
export function migrateLegacyAddress(
  legacyAddressOrData: string | { address?: string; city?: string },
  legacyCity?: string
): ProjectAddress[] {
  const legacyAddress = typeof legacyAddressOrData === 'string'
    ? legacyAddressOrData
    : legacyAddressOrData.address || '';
  const city = typeof legacyAddressOrData === 'string'
    ? legacyCity || ''
    : legacyAddressOrData.city || '';

  if (!legacyAddress || !city) {
    return [];
  }

  // Parse street and number from legacy address
  // Pattern: "Σαμοθράκης 16" → street: "Σαμοθράκης", number: "16"
  const match = legacyAddress.match(/^(.+?)\s+(\d+[Α-Ωα-ω]?)$/);

  const street = match ? match[1].trim() : legacyAddress;
  const number = match ? match[2].trim() : undefined;

  return [
    createProjectAddress({
      id: `proj_${crypto.randomUUID()}`,
      street,
      number,
      city,
      postalCode: '', // Unknown in legacy
      country: GEOGRAPHIC_CONFIG.DEFAULT_COUNTRY,
      type: 'site',
      isPrimary: true,
      sortOrder: 0
    })
  ];
}

/**
 * Extract legacy fields from new address array (for backward compatibility)
 * Enterprise pattern: Bidirectional compatibility
 *
 * @param addresses - New address array
 * @returns Legacy { address, city } object
 */
export function extractLegacyFields(
  addresses: ProjectAddress[]
): { address: string; city: string } {
  const primary = getPrimaryAddress(addresses);

  if (!primary) {
    return { address: '', city: '' };
  }

  // Format legacy address: "Street Number"
  const legacyAddress = primary.number
    ? `${primary.street} ${primary.number}`
    : primary.street;

  return {
    address: legacyAddress,
    city: primary.city
  };
}

// =============================================================================
// BUILDING ADDRESS INHERITANCE
// =============================================================================

/**
 * Resolve building address reference (inheritance from project)
 * Enterprise pattern: Parent-child relationship resolution
 *
 * @param ref - Building address reference
 * @param projectAddresses - Parent project addresses
 * @returns Resolved address or undefined
 */
export function resolveBuildingAddress(
  ref: BuildingAddressReference,
  projectAddresses: ProjectAddress[]
): ProjectAddress | undefined {
  // No inheritance - building has custom address
  if (!ref.inheritFromProject) {
    return undefined;
  }

  // Find specified project address
  let baseAddress: ProjectAddress | undefined;

  if (ref.projectAddressId) {
    baseAddress = projectAddresses.find(addr => addr.id === ref.projectAddressId);
  } else {
    // Default: use primary address
    baseAddress = getPrimaryAddress(projectAddresses);
  }

  if (!baseAddress) {
    return undefined;
  }

  // Apply overrides (e.g., different floor/unit number)
  if (ref.override) {
    return {
      ...baseAddress,
      ...ref.override
    };
  }

  return baseAddress;
}

/**
 * Resolve building addresses from references
 * Enterprise pattern: Bulk resolution with graceful fallback
 *
 * @param refs - Building address references
 * @param projectAddresses - Parent project addresses
 * @returns Resolved addresses (or project addresses if no refs)
 */
export function resolveBuildingAddresses(
  refs: BuildingAddressReference[] | undefined,
  projectAddresses: ProjectAddress[]
): ProjectAddress[] {
  if (!refs || refs.length === 0) {
    return projectAddresses;
  }

  return refs
    .map(ref => resolveBuildingAddress(ref, projectAddresses))
    .filter((address): address is ProjectAddress => Boolean(address));
}

/**
 * Resolve primary building address from references
 * Enterprise pattern: Primary address selection with fallback
 *
 * @param refs - Building address references
 * @param projectAddresses - Parent project addresses
 * @returns Primary resolved address or undefined
 */
export function getBuildingPrimaryAddress(
  refs: BuildingAddressReference[] | undefined,
  projectAddresses: ProjectAddress[]
): ProjectAddress | undefined {
  const resolved = resolveBuildingAddresses(refs, projectAddresses);
  return getPrimaryAddress(resolved);
}

/**
 * Resolve primary building address with legacy compatibility
 * Enterprise pattern: Support direct primary address IDs + reference overrides
 *
 * @param primaryProjectAddressId - Explicit primary project address ID
 * @param refs - Building address references
 * @param projectAddresses - Parent project addresses
 * @returns Resolved primary address or undefined
 */
export function resolveBuildingPrimaryAddress(
  primaryProjectAddressId: string | undefined,
  refs: BuildingAddressReference[] | undefined,
  projectAddresses: ProjectAddress[]
): ProjectAddress | undefined {
  if (!projectAddresses || projectAddresses.length === 0) {
    return undefined;
  }

  if (primaryProjectAddressId) {
    const match = projectAddresses.find(addr => addr.id === primaryProjectAddressId);
    if (!match) {
      logger.warn(`Primary project address not found: ${primaryProjectAddressId}`);
      return getPrimaryAddress(projectAddresses);
    }

    if (refs && refs.length > 0) {
      const ref = refs.find(item => item.projectAddressId === primaryProjectAddressId);
      if (ref) {
        return resolveBuildingAddress(ref, projectAddresses) || match;
      }
    }

    return match;
  }

  const resolved = resolveBuildingAddresses(refs, projectAddresses);
  return getPrimaryAddress(resolved) || getPrimaryAddress(projectAddresses);
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate address data
 * Enterprise pattern: Data integrity checks
 *
 * @param address - Address to validate
 * @returns Validation errors or null if valid
 */
export function validateAddress(
  address: Partial<ProjectAddress>
): string[] {
  const errors: string[] = [];

  // Required fields — city is always required, street is optional for settlements/villages
  if (!address.city?.trim()) {
    errors.push('Η πόλη/οικισμός είναι υποχρεωτικός');
  }

  if (!address.postalCode?.trim()) {
    errors.push('Ο Τ.Κ. είναι υποχρεωτικός');
  }

  // Postal code format (Greek: 5 digits)
  if (address.postalCode && !/^\d{5}$/.test(address.postalCode)) {
    errors.push('Ο Τ.Κ. πρέπει να είναι 5 ψηφία');
  }

  return errors;
}

/**
 * Check if address array has exactly one primary
 * Enterprise pattern: Data consistency validation
 *
 * @param addresses - Address array to validate
 * @returns Validation error or null
 */
export function validatePrimaryAddressUniqueness(
  addresses: ProjectAddress[]
): string | null {
  const primaryCount = addresses.filter(addr => addr.isPrimary).length;

  if (primaryCount === 0) {
    return 'Πρέπει να υπάρχει μία κύρια διεύθυνση';
  }

  if (primaryCount > 1) {
    return 'Μόνο μία διεύθυνση μπορεί να είναι κύρια';
  }

  return null;
}

// =============================================================================
// SORTING & ORDERING
// =============================================================================

/**
 * Sort addresses: primary first, then by sortOrder
 * Enterprise pattern: Predictable ordering
 *
 * @param addresses - Addresses to sort
 * @returns Sorted array (does not mutate original)
 */
export function sortAddresses(addresses: ProjectAddress[]): ProjectAddress[] {
  return [...addresses].sort((a, b) => {
    // Primary addresses first
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;

    // Then by sortOrder
    const orderA = a.sortOrder ?? 999;
    const orderB = b.sortOrder ?? 999;
    return orderA - orderB;
  });
}

// =============================================================================
// GEOCODING HELPERS
// =============================================================================

/**
 * Check if address has valid coordinates
 * Enterprise pattern: Data completeness validation
 *
 * @param address - Address to check
 * @returns True if coordinates are valid
 */
export function hasCoordinates(address: ProjectAddress): boolean {
  return !!(
    address.coordinates &&
    typeof address.coordinates.lat === 'number' &&
    typeof address.coordinates.lng === 'number' &&
    isFinite(address.coordinates.lat) &&
    isFinite(address.coordinates.lng)
  );
}

/**
 * Format address for geocoding API — structured query object.
 * Uses Nominatim structured search fields for accurate results.
 *
 * @param address - Address to format
 * @returns Structured geocoding query for /api/geocoding
 */
/**
 * Strip Greek administrative prefixes for geocoding.
 * Nominatim doesn't understand "ΔΗΜΟΣ ΛΑΓΚΑΔΑ" — it needs just "ΛΑΓΚΑΔΑ".
 */
export function stripAdminPrefix(name: string | undefined): string | undefined {
  if (!name) return undefined;
  return name
    .replace(/^ΔΗΜΟΣ\s+/i, '')
    .replace(/^ΔΗΜΟΤΙΚΗ\s+ΕΝΟΤΗΤΑ\s+/i, '')
    .replace(/^ΔΗΜΟΤΙΚΗ\s+ΚΟΙΝΟΤΗΤΑ\s+/i, '')
    .replace(/^ΤΟΠΙΚΗ\s+ΚΟΙΝΟΤΗΤΑ\s+/i, '')
    .replace(/^ΠΕΡΙΦΕΡΕΙΑΚΗ\s+ΕΝΟΤΗΤΑ\s+/i, '')
    .replace(/^ΠΕΡΙΦΕΡΕΙΑ\s+/i, '')
    .replace(/^ΑΠΟΚΕΝΤΡΩΜΕΝΗ\s+ΔΙΟΙΚΗΣΗ\s+/i, '')
    .trim() || undefined;
}

export function formatAddressForGeocoding(address: ProjectAddress): StructuredGeocodingQuery {
  const streetParts = [address.street, address.number].filter(Boolean);

  return {
    street: streetParts.length > 0 ? streetParts.join(' ') : undefined,
    city: address.city || undefined,
    neighborhood: address.neighborhood || undefined,
    postalCode: address.postalCode || undefined,
    county: stripAdminPrefix(address.regionalUnit),
    municipality: stripAdminPrefix(address.municipality),
    region: stripAdminPrefix(address.region),
    country: address.country || GEOGRAPHIC_CONFIG.DEFAULT_COUNTRY,
  };
}

/**
 * Filter addresses that can be geocoded
 * Enterprise pattern: Data readiness filtering
 *
 * Accepts addresses with:
 * - city (settlements/villages/cities)
 * - street + postalCode (urban addresses without explicit city)
 *
 * @param addresses - Addresses to filter
 * @returns Geocodable addresses
 */
export function getGeocodableAddresses(addresses: ProjectAddress[]): ProjectAddress[] {
  return addresses.filter(addr =>
    addr.city?.trim() || (addr.street?.trim() && addr.postalCode?.trim())
  );
}
