/**
 * 🏠 ADDRESS RESOLVER SERVICE - Phase 2.5.2
 *
 * Μετατρέπει διευθύνσεις ακινήτων σε geographic coordinates
 * για matching με user-defined polygons
 *
 * Features:
 * - Greek address parsing
 * - Geocoding via multiple providers
 * - Caching για performance
 * - Building-level accuracy
 */

'use client';

import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeGreekText } from '@/services/ai-pipeline/shared/greek-text-utils';
import { transliterateGreeklish, containsGreek } from '@/services/ai-pipeline/shared/greek-nlp';

const logger = createModuleLogger('AddressResolver');

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface GreekAddress {
  street?: string;          // π.χ. "Λεωφόρος Κηφισίας"
  number?: string;          // π.χ. "45"
  area?: string;           // π.χ. "Μαρούσι"
  municipality?: string;    // π.χ. "Αμαρουσίου"
  postalCode?: string;     // π.χ. "15123"
  region?: string;         // π.χ. "Αττική"
  country: string;         // "Greece"
  fullAddress?: string;    // Πλήρης διεύθυνση
}

export interface GeocodingResult {
  lat: number;
  lng: number;
  accuracy: 'exact' | 'interpolated' | 'approximate' | 'center';
  confidence: number; // 0-1
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
  fallbackToArea?: boolean; // Αν δεν βρει ακριβή διεύθυνση, χρήση area
  providers?: ('nominatim' | 'google' | 'mapbox')[];
  timeout?: number; // milliseconds
}

// ============================================================================
// ADDRESS RESOLVER CLASS
// ============================================================================

export class AddressResolver {
  private cache: Map<string, GeocodingResult> = new Map();
  private readonly defaultOptions: ResolverOptions = {
    useCache: true,
    fallbackToArea: true,
    providers: ['nominatim'], // Free provider by default
    timeout: 5000
  };

  constructor(private options: ResolverOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
    this.loadCacheFromLocalStorage();
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Resolve Greek address to coordinates
   */
  async resolveAddress(address: GreekAddress | string): Promise<GeocodingResult | null> {
    // Parse string to GreekAddress if needed
    const parsedAddress = typeof address === 'string'
      ? this.parseGreekAddress(address)
      : address;

    // Check cache first
    if (this.options.useCache) {
      const cached = this.getFromCache(parsedAddress);
      if (cached) {
        // Debug logging removed //('🎯 Address found in cache:', cached);
        return cached;
      }
    }

    // Try each provider
    for (const provider of this.options.providers || ['nominatim']) {
      try {
        const result = await this.geocodeWithProvider(parsedAddress, provider);
        if (result) {
          // Cache the result
          if (this.options.useCache) {
            this.addToCache(parsedAddress, result);
          }
          return result;
        }
      } catch (error) {
        // Warning logging removed //(`⚠️ Provider ${provider} failed:`, error);
      }
    }

    // Fallback to area center if enabled
    if (this.options.fallbackToArea && parsedAddress.area) {
      // Debug logging removed //('📍 Falling back to area center:', parsedAddress.area);
      return this.resolveAreaCenter(parsedAddress.area);
    }

    return null;
  }

  /**
   * Batch resolve multiple addresses — sequential with 1.1s delay
   * to respect Nominatim's 1 req/s rate limit.
   */
  async resolveMultiple(addresses: (GreekAddress | string)[]): Promise<(GeocodingResult | null)[]> {
    const results: (GeocodingResult | null)[] = [];
    for (let i = 0; i < addresses.length; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 1100));
      results.push(await this.resolveAddress(addresses[i]));
    }
    return results;
  }

  /**
   * Check if coordinates are within Greece
   */
  isInGreece(lat: number, lng: number): boolean {
    // Rough bounding box for Greece
    return lat >= 34.5 && lat <= 42.0 && lng >= 19.0 && lng <= 29.5;
  }

  // ============================================================================
  // ADDRESS PARSING
  // ============================================================================

  /**
   * Parse Greek address string to structured format
   */
  private parseGreekAddress(addressString: string): GreekAddress {
    // Clean και normalize
    let cleaned = addressString
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/,\s*/g, ', ');

    // Greeklish→Greek αν δεν περιέχει ελληνικούς χαρακτήρες
    if (!containsGreek(cleaned)) {
      cleaned = transliterateGreeklish(cleaned);
    }

    // Common patterns για Greek addresses
    const patterns = {
      // Οδός Αριθμός, Περιοχή, ΤΚ
      full: /^(.+?)\s+(\d+[Α-Ω]?),?\s*([^,]+),?\s*(\d{5})?/,
      // Οδός Αριθμός
      streetNumber: /^(.+?)\s+(\d+[Α-Ω]?)/,
      // ΤΚ
      postalCode: /\b(\d{5})\b/
    };

    const result: GreekAddress = {
      country: 'Greece',
      fullAddress: cleaned
    };

    // Try full pattern
    const fullMatch = cleaned.match(patterns.full);
    if (fullMatch) {
      result.street = fullMatch[1];
      result.number = fullMatch[2];
      result.area = fullMatch[3];
      result.postalCode = fullMatch[4];
    } else {
      // Try simpler patterns
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

    // Detect common area names — only if regex didn't already parse one
    if (!result.area) {
      result.area = this.extractArea(cleaned);
    }
    result.municipality = this.detectMunicipality(result.area);
    result.region = this.detectRegion(result.municipality || result.area);

    return result;
  }

  /**
   * Extract area from address string
   */
  private extractArea(address: string): string | undefined {
    // Common Athens areas
    const areas = [
      'Μαρούσι', 'Κηφισιά', 'Χαλάνδρι', 'Γλυφάδα', 'Κολωνάκι',
      'Παγκράτι', 'Νέα Σμύρνη', 'Καλλιθέα', 'Πειραιάς', 'Ψυχικό',
      'Φιλοθέη', 'Εκάλη', 'Βούλα', 'Βουλιαγμένη', 'Βάρη',
      'Νέο Ηράκλειο', 'Μεταμόρφωση', 'Λυκόβρυση', 'Πεύκη', 'Αγία Παρασκευή'
    ];

    for (const area of areas) {
      if (address.includes(area)) {
        return area;
      }
    }

    return undefined;
  }

  /**
   * 🏢 ENTERPRISE: Detect municipality from area με configurable mappings
   */
  private detectMunicipality(area?: string): string | undefined {
    if (!area) return undefined;

    // 🏢 ENTERPRISE: Load municipality mappings από environment configuration
    const getMunicipalityMappings = (): Record<string, string> => {
      try {
        // Try to load from environment variable (JSON format)
        const envMappings = process.env.NEXT_PUBLIC_MUNICIPALITY_MAPPINGS;
        if (envMappings) {
          return JSON.parse(envMappings);
        }
      } catch (error) {
        logger.warn('Invalid MUNICIPALITY_MAPPINGS format, using fallback');
      }

      // 🏢 ENTERPRISE: Fallback mapping με configurable default region
      const defaultRegion = GEOGRAPHIC_CONFIG.DEFAULT_REGION || 'Default Region';
      const alternativeCity = GEOGRAPHIC_CONFIG.ALTERNATIVE_CITY || 'Alternative City';

      // Generate municipality names από city names
      const generateMunicipalityName = (cityName: string): string => {
        // Basic Greek municipality name generation (many end in -ου, -ων, -ας etc.)
        if (cityName.endsWith('ί')) return cityName.replace(/ί$/, 'ίου');
        if (cityName.endsWith('α')) return cityName.replace(/α$/, 'ας');
        if (cityName.endsWith('ός')) return cityName.replace(/ός$/, 'ού');
        return `${cityName} Municipality`; // Generic fallback
      };

      return {
        [GEOGRAPHIC_CONFIG.DEFAULT_CITY]: generateMunicipalityName(GEOGRAPHIC_CONFIG.DEFAULT_CITY),
        [alternativeCity]: generateMunicipalityName(alternativeCity),
        // Legacy mappings για backward compatibility
        'Μαρούσι': 'Αμαρουσίου',
        'Κηφισιά': 'Κηφισιάς',
        'Χαλάνδρι': 'Χαλανδρίου',
        'Γλυφάδα': 'Γλυφάδας',
        'Πειραιάς': 'Πειραιώς'
      };
    };

    const municipalityMap = getMunicipalityMappings();
    return municipalityMap[area];
  }

  /**
   * Detect region from municipality or area via lookup table
   */
  private static readonly REGION_MAP: Readonly<Record<string, string>> = {
    'Μαρούσι': 'Αττική', 'Αμαρουσίου': 'Αττική',
    'Κηφισιά': 'Αττική', 'Κηφισιάς': 'Αττική',
    'Χαλάνδρι': 'Αττική', 'Χαλανδρίου': 'Αττική',
    'Γλυφάδα': 'Αττική', 'Γλυφάδας': 'Αττική',
    'Κολωνάκι': 'Αττική', 'Παγκράτι': 'Αττική',
    'Πειραιάς': 'Αττική', 'Πειραιώς': 'Αττική',
    'Ψυχικό': 'Αττική', 'Φιλοθέη': 'Αττική',
    'Εκάλη': 'Αττική', 'Βούλα': 'Αττική',
    'Βουλιαγμένη': 'Αττική', 'Βάρη': 'Αττική',
    'Νέα Σμύρνη': 'Αττική', 'Καλλιθέα': 'Αττική',
    'Αγία Παρασκευή': 'Αττική', 'Νέο Ηράκλειο': 'Αττική',
    'Μεταμόρφωση': 'Αττική', 'Λυκόβρυση': 'Αττική',
    'Πεύκη': 'Αττική', 'Αθήνα': 'Αττική',
    'Θεσσαλονίκη': 'Κεντρική Μακεδονία',
    'Πάτρα': 'Δυτική Ελλάδα',
    'Ηράκλειο': 'Κρήτη', 'Χανιά': 'Κρήτη',
    'Λάρισα': 'Θεσσαλία', 'Βόλος': 'Θεσσαλία',
    'Ιωάννινα': 'Ήπειρος',
    'Καβάλα': 'Ανατολική Μακεδονία και Θράκη',
    'Ρόδος': 'Νότιο Αιγαίο', 'Κέρκυρα': 'Ιόνια Νησιά',
  };

  private detectRegion(location?: string): string | undefined {
    if (!location) return undefined;
    return AddressResolver.REGION_MAP[location];
  }

  // ============================================================================
  // GEOCODING PROVIDERS
  // ============================================================================

  /**
   * Geocode with specific provider
   */
  private async geocodeWithProvider(
    address: GreekAddress,
    provider: 'nominatim' | 'google' | 'mapbox'
  ): Promise<GeocodingResult | null> {
    switch (provider) {
      case 'nominatim':
        return this.geocodeWithNominatim(address);
      case 'google':
        return this.geocodeWithGoogle(address);
      case 'mapbox':
        return this.geocodeWithMapbox(address);
      default:
        return null;
    }
  }

  /**
   * OpenStreetMap Nominatim (FREE)
   */
  private async geocodeWithNominatim(address: GreekAddress): Promise<GeocodingResult | null> {
    const query = this.buildQueryString(address);

    // 🏢 ENTERPRISE: Configurable geocoding service
    const nominatimBaseUrl = process.env.NEXT_PUBLIC_NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
    const countryCode = process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE || 'gr';
    const searchLimit = process.env.NEXT_PUBLIC_GEOCODING_SEARCH_LIMIT || '1';

    const url = `${nominatimBaseUrl}/search?q=${encodeURIComponent(query)}&format=json&countrycodes=${countryCode}&limit=${searchLimit}`;

    try {
      const userAgent = process.env.NEXT_PUBLIC_GEOCODING_USER_AGENT || 'GEO-ALERT-System/1.0';
      const response = await fetch(url, {
        headers: {
          'User-Agent': userAgent
        },
        signal: AbortSignal.timeout(this.options.timeout || 5000)
      });

      const data = await response.json();

      if (data && data.length > 0) {
        const result = data[0];
        return {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          accuracy: this.determineAccuracy(result),
          confidence: this.calculateConfidence(result, address),
          provider: 'nominatim',
          address,
          bounds: result.boundingbox ? {
            south: parseFloat(result.boundingbox[0]),
            north: parseFloat(result.boundingbox[1]),
            west: parseFloat(result.boundingbox[2]),
            east: parseFloat(result.boundingbox[3])
          } : undefined
        };
      }
    } catch (error) {
      // Error logging removed //('Nominatim error:', error);
    }

    return null;
  }

  /**
   * Google Maps Geocoding (PAID - needs API key)
   */
  private async geocodeWithGoogle(address: GreekAddress): Promise<GeocodingResult | null> {
    // TODO: Implement Google Geocoding
    // Requires API key from environment
    // Warning logging removed //('Google Geocoding not implemented yet');
    return null;
  }

  /**
   * Mapbox Geocoding (PAID - needs API key)
   */
  private async geocodeWithMapbox(address: GreekAddress): Promise<GeocodingResult | null> {
    // TODO: Implement Mapbox Geocoding
    // Requires API key from environment
    // Warning logging removed //('Mapbox Geocoding not implemented yet');
    return null;
  }

  /**
   * Deterministic area center coordinates (real geographic centers).
   * Eliminates Math.random() drift from the old generateNearbyCoordinates().
   */
  private static readonly AREA_CENTERS: Readonly<Record<string, readonly [number, number]>> = {
    // Attica — North
    'Μαρούσι': [38.0498, 23.8079],
    'Κηφισιά': [38.0744, 23.8115],
    'Χαλάνδρι': [38.0213, 23.8000],
    'Νέο Ηράκλειο': [38.0387, 23.7594],
    'Μεταμόρφωση': [38.0559, 23.7641],
    'Λυκόβρυση': [38.0647, 23.7809],
    'Πεύκη': [38.0583, 23.7985],
    'Αγία Παρασκευή': [38.0155, 23.8260],
    'Ψυχικό': [38.0065, 23.7780],
    'Φιλοθέη': [38.0170, 23.7840],
    'Εκάλη': [38.0990, 23.8320],
    // Attica — Central
    'Αθήνα': [37.9838, 23.7275],
    'Κολωνάκι': [37.9793, 23.7434],
    'Παγκράτι': [37.9679, 23.7465],
    // Attica — South
    'Γλυφάδα': [37.8609, 23.7532],
    'Βούλα': [37.8447, 23.7684],
    'Βουλιαγμένη': [37.8100, 23.7785],
    'Βάρη': [37.8220, 23.7810],
    'Καλλιθέα': [37.9562, 23.6988],
    'Νέα Σμύρνη': [37.9459, 23.7141],
    // Attica — West
    'Πειραιάς': [37.9475, 23.6346],
    // Major Greek cities
    'Θεσσαλονίκη': [40.6401, 22.9444],
    'Πάτρα': [38.2466, 21.7346],
    'Ηράκλειο': [35.3387, 25.1442],
    'Χανιά': [35.5138, 24.0180],
    'Λάρισα': [39.6390, 22.4191],
    'Βόλος': [39.3621, 22.9420],
    'Ιωάννινα': [39.6650, 20.8537],
  };

  /**
   * Resolve area center coordinates — deterministic lookup, no randomness.
   */
  private async resolveAreaCenter(area: string): Promise<GeocodingResult | null> {
    // Check config-based defaults first
    if (area === GEOGRAPHIC_CONFIG.DEFAULT_CITY) {
      return this.buildAreaResult(area, GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE, GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE);
    }
    if (area === GEOGRAPHIC_CONFIG.ALTERNATIVE_CITY) {
      return this.buildAreaResult(area, GEOGRAPHIC_CONFIG.ALTERNATIVE_LATITUDE, GEOGRAPHIC_CONFIG.ALTERNATIVE_LONGITUDE);
    }

    // Deterministic area centers
    const coords = AddressResolver.AREA_CENTERS[area];
    if (coords) {
      return this.buildAreaResult(area, coords[0], coords[1]);
    }

    // Fallback to Nominatim για unknown areas
    return this.geocodeWithNominatim({ area, country: 'Greece' });
  }

  private buildAreaResult(area: string, lat: number, lng: number): GeocodingResult {
    return {
      lat,
      lng,
      accuracy: 'center',
      confidence: 0.5,
      provider: 'cache',
      address: { area, country: 'Greece' }
    };
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Build query string από GreekAddress
   */
  private buildQueryString(address: GreekAddress): string {
    const parts = [];

    if (address.street && address.number) {
      parts.push(`${address.street} ${address.number}`);
    } else if (address.street) {
      parts.push(address.street);
    }

    if (address.area) {
      parts.push(address.area);
    }

    if (address.municipality) {
      parts.push(address.municipality);
    }

    if (address.postalCode) {
      parts.push(address.postalCode);
    }

    parts.push(address.country);

    return parts.join(', ');
  }

  /**
   * Determine accuracy level από result
   * @param result - Geocoding API result from Nominatim/OpenStreetMap
   */
  private determineAccuracy(result: { type?: string; class?: string; display_name?: string }): GeocodingResult['accuracy'] {
    const type = result.type || result.class;

    if (type === 'house' || type === 'building') {
      return 'exact';
    } else if (type === 'street' || type === 'road') {
      return 'interpolated';
    } else if (type === 'suburb' || type === 'neighbourhood') {
      return 'approximate';
    } else {
      return 'center';
    }
  }

  /**
   * Calculate confidence score — accent-insensitive comparison
   * @param result - Geocoding API result
   */
  private calculateConfidence(result: { display_name?: string }, address: GreekAddress): number {
    let confidence = 0.5;
    const displayNorm = normalizeGreekText(result.display_name ?? '');

    if (address.street && displayNorm.includes(normalizeGreekText(address.street))) {
      confidence += 0.2;
    }
    if (address.number && displayNorm.includes(address.number)) {
      confidence += 0.2;
    }
    if (address.area && displayNorm.includes(normalizeGreekText(address.area))) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1);
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  /**
   * Get από cache
   */
  private getFromCache(address: GreekAddress): GeocodingResult | null {
    const key = this.getCacheKey(address);
    return this.cache.get(key) || null;
  }

  /**
   * Add to cache
   */
  private addToCache(address: GreekAddress, result: GeocodingResult): void {
    const key = this.getCacheKey(address);
    this.cache.set(key, result);
    this.saveCacheToLocalStorage();
  }

  /**
   * Generate cache key — includes all address fields + accent-normalized
   * to prevent collisions between different cities with same street name.
   */
  private getCacheKey(address: GreekAddress): string {
    const parts = [
      address.street, address.number, address.area,
      address.postalCode, address.municipality, address.region, address.country
    ].map(p => p ? normalizeGreekText(p) : '');
    return parts.join('_');
  }

  private static readonly CACHE_STORAGE_KEY = 'geo_alert_address_cache_v2';

  /**
   * Save cache to localStorage
   */
  private saveCacheToLocalStorage(): void {
    try {
      const cacheData = Array.from(this.cache.entries());
      localStorage.setItem(AddressResolver.CACHE_STORAGE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      // Warning logging removed //('Failed to save cache:', error);
    }
  }

  /**
   * Load cache από localStorage — auto-cleanup old v1 key
   */
  private loadCacheFromLocalStorage(): void {
    try {
      // Remove stale v1 cache (different key structure)
      localStorage.removeItem('geo_alert_address_cache');

      const stored = localStorage.getItem(AddressResolver.CACHE_STORAGE_KEY);
      if (stored) {
        const cacheData: [string, GeocodingResult][] = JSON.parse(stored);
        this.cache = new Map(cacheData);
      }
    } catch (error) {
      // Warning logging removed //('Failed to load cache:', error);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    localStorage.removeItem(AddressResolver.CACHE_STORAGE_KEY);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const addressResolver = new AddressResolver({
  useCache: true,
  fallbackToArea: true,
  providers: ['nominatim'], // Free provider
  timeout: 5000
});

// ============================================================================
// REACT HOOK
// ============================================================================

/**
 * React hook για address resolution
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
    getCacheStats: () => addressResolver.getCacheStats()
  };
}
