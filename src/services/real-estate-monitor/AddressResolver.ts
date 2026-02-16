/**
 * =============================================================================
 * 🏠 ADDRESS RESOLVER SERVICE — Enterprise Geocoding Facade
 * =============================================================================
 *
 * Facade over the geocoding-service that provides:
 * - Greek address parsing (text → structured GreekAddress)
 * - Backward-compatible resolveAddress / resolveMultiple API
 * - In-memory cache (delegated to geocoding-service)
 *
 * All actual geocoding is delegated to the server-side /api/geocoding
 * endpoint via geocoding-service.ts. No hardcoded coordinates or
 * direct Nominatim calls.
 *
 * @module services/real-estate-monitor/AddressResolver
 * @see lib/geocoding/geocoding-service.ts (actual geocoding)
 * @see app/api/geocoding/route.ts (server-side Nominatim proxy)
 */

import { createModuleLogger } from '@/lib/telemetry';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import {
  geocodeAddress,
  geocodeAddressBatch,
  clearGeocodingCache,
  getGeocodingCacheStats,
  type StructuredGeocodingQuery,
  type GeocodingServiceResult,
} from '@/lib/geocoding/geocoding-service';
import { transliterateGreeklish, containsGreek } from '@/services/ai-pipeline/shared/greek-nlp';

const logger = createModuleLogger('AddressResolver');

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface GreekAddress {
  street?: string;
  number?: string;
  area?: string;
  municipality?: string;
  postalCode?: string;
  region?: string;
  country: string;
  fullAddress?: string;
}

export interface GeocodingResult {
  lat: number;
  lng: number;
  accuracy: 'exact' | 'interpolated' | 'approximate' | 'center';
  confidence: number;
  provider: 'nominatim' | 'google' | 'mapbox' | 'cache';
  address: GreekAddress;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface ResolverOptions {
  useCache?: boolean;
  fallbackToArea?: boolean;
  providers?: ('nominatim' | 'google' | 'mapbox')[];
  timeout?: number;
}

// =============================================================================
// ADDRESS RESOLVER CLASS
// =============================================================================

export class AddressResolver {
  constructor(private options: ResolverOptions = {}) {
    // Options kept for backward compatibility, but actual caching
    // is handled by geocoding-service.
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Resolve Greek address to coordinates.
   * Delegates to the server-side geocoding service.
   */
  async resolveAddress(address: GreekAddress | string): Promise<GeocodingResult | null> {
    const parsedAddress = typeof address === 'string'
      ? this.parseGreekAddress(address)
      : address;

    const query = this.toStructuredQuery(parsedAddress);
    const result = await geocodeAddress(query);

    if (result) {
      return this.wrapResult(result, parsedAddress);
    }

    return null;
  }

  /**
   * Batch resolve multiple addresses — sequential with delay
   * to respect Nominatim's 1 req/s rate limit.
   */
  async resolveMultiple(addresses: (GreekAddress | string)[]): Promise<(GeocodingResult | null)[]> {
    const parsedAddresses = addresses.map(addr =>
      typeof addr === 'string' ? this.parseGreekAddress(addr) : addr
    );

    const queries = parsedAddresses.map(addr => this.toStructuredQuery(addr));
    const results = await geocodeAddressBatch(queries);

    return results.map((result, i) =>
      result ? this.wrapResult(result, parsedAddresses[i]) : null
    );
  }

  /**
   * Check if coordinates are within configured country bounding box
   */
  isInCountry(lat: number, lng: number): boolean {
    const bbox = GEOGRAPHIC_CONFIG.COUNTRY_BOUNDING_BOX;
    return lat >= bbox.minLat && lat <= bbox.maxLat && lng >= bbox.minLng && lng <= bbox.maxLng;
  }

  /**
   * Clear geocoding cache
   */
  clearCache(): void {
    clearGeocodingCache();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return getGeocodingCacheStats();
  }

  // ==========================================================================
  // ADDRESS PARSING
  // ==========================================================================

  /**
   * Parse Greek address string to structured format.
   * Handles Greeklish input by transliterating to Greek.
   */
  private parseGreekAddress(addressString: string): GreekAddress {
    let cleaned = addressString
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/,\s*/g, ', ');

    // Greeklish→Greek if no Greek characters
    if (!containsGreek(cleaned)) {
      cleaned = transliterateGreeklish(cleaned);
    }

    const patterns = {
      // Οδός Αριθμός, Περιοχή, ΤΚ
      full: /^(.+?)\s+(\d+[Α-Ω]?),?\s*([^,]+),?\s*(\d{5})?/,
      // Οδός Αριθμός
      streetNumber: /^(.+?)\s+(\d+[Α-Ω]?)/,
      // ΤΚ
      postalCode: /\b(\d{5})\b/,
    };

    const result: GreekAddress = {
      country: GEOGRAPHIC_CONFIG.DEFAULT_COUNTRY_EN,
      fullAddress: cleaned,
    };

    const fullMatch = cleaned.match(patterns.full);
    if (fullMatch) {
      result.street = fullMatch[1];
      result.number = fullMatch[2];
      result.area = fullMatch[3]?.trim();
      result.postalCode = fullMatch[4];
    } else {
      const streetMatch = cleaned.match(patterns.streetNumber);
      if (streetMatch) {
        result.street = streetMatch[1];
        result.number = streetMatch[2];
      }

      const postalMatch = cleaned.match(patterns.postalCode);
      if (postalMatch) {
        result.postalCode = postalMatch[1];
      }
    }

    return result;
  }

  // ==========================================================================
  // INTERNAL HELPERS
  // ==========================================================================

  /**
   * Convert GreekAddress to StructuredGeocodingQuery for the geocoding service.
   */
  private toStructuredQuery(address: GreekAddress): StructuredGeocodingQuery {
    const streetParts = [address.street, address.number].filter(Boolean);

    return {
      street: streetParts.length > 0 ? streetParts.join(' ') : undefined,
      city: address.area || address.municipality || undefined,
      postalCode: address.postalCode || undefined,
      region: address.region || undefined,
      country: address.country || GEOGRAPHIC_CONFIG.DEFAULT_COUNTRY_EN,
    };
  }

  /**
   * Wrap a GeocodingServiceResult into the full GeocodingResult format
   * for backward compatibility with consumers like AddressSearchPanel.
   */
  private wrapResult(
    serviceResult: GeocodingServiceResult,
    address: GreekAddress
  ): GeocodingResult {
    return {
      lat: serviceResult.lat,
      lng: serviceResult.lng,
      accuracy: serviceResult.accuracy,
      confidence: serviceResult.confidence,
      provider: 'nominatim',
      address,
    };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const addressResolver = new AddressResolver({
  useCache: true,
  fallbackToArea: true,
  providers: ['nominatim'],
  timeout: GEOGRAPHIC_CONFIG.GEOCODING.RESOLVER_TIMEOUT_MS,
});

// =============================================================================
// REACT HOOK
// =============================================================================

/**
 * React hook for address resolution
 */
export function useAddressResolver() {
  const resolve = async (address: string | GreekAddress) => {
    return addressResolver.resolveAddress(address);
  };

  const resolveMultiple = async (addresses: (string | GreekAddress)[]) => {
    return addressResolver.resolveMultiple(addresses);
  };

  const clearCache = () => {
    addressResolver.clearCache();
  };

  return {
    resolve,
    resolveMultiple,
    clearCache,
    getCacheStats: () => addressResolver.getCacheStats(),
  };
}
