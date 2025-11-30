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

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface GreekAddress {
  street: string;           // π.χ. "Λεωφόρος Κηφισίας"
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
   * Batch resolve multiple addresses
   */
  async resolveMultiple(addresses: (GreekAddress | string)[]): Promise<(GeocodingResult | null)[]> {
    const results = await Promise.all(
      addresses.map(addr => this.resolveAddress(addr))
    );
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
    const cleaned = addressString
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/,\s*/g, ', ');

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

    // Detect common area names
    result.area = this.extractArea(cleaned);
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
   * Detect municipality from area
   */
  private detectMunicipality(area?: string): string | undefined {
    if (!area) return undefined;

    const municipalityMap: Record<string, string> = {
      'Μαρούσι': 'Αμαρουσίου',
      'Κηφισιά': 'Κηφισιάς',
      'Χαλάνδρι': 'Χαλανδρίου',
      'Γλυφάδα': 'Γλυφάδας',
      'Πειραιάς': 'Πειραιώς'
      // ... more mappings
    };

    return municipalityMap[area];
  }

  /**
   * Detect region from municipality or area
   */
  private detectRegion(location?: string): string {
    // Simplified - most προς πώληση are in Attica
    return 'Αττική';
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
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&countrycodes=gr&limit=1`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'GEO-ALERT-System/1.0'
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
   * Resolve area center coordinates
   */
  private async resolveAreaCenter(area: string): Promise<GeocodingResult | null> {
    // Hardcoded popular Greek areas για quick lookup
    const areaCoordinates: Record<string, [number, number]> = {
      'Μαρούσι': [38.0568, 23.8081],
      'Κηφισιά': [38.0739, 23.8105],
      'Χαλάνδρι': [38.0214, 23.7981],
      'Γλυφάδα': [37.8656, 23.7550],
      'Κολωνάκι': [37.9797, 23.7428],
      'Παγκράτι': [37.9688, 23.7503],
      'Πειραιάς': [37.9485, 23.6436],
      // ... more areas
    };

    const coords = areaCoordinates[area];
    if (coords) {
      return {
        lat: coords[0],
        lng: coords[1],
        accuracy: 'center',
        confidence: 0.5,
        provider: 'cache',
        address: {
          area,
          country: 'Greece'
        }
      };
    }

    // Fallback to Nominatim για unknown areas
    return this.geocodeWithNominatim({ area, country: 'Greece' });
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
   */
  private determineAccuracy(result: any): GeocodingResult['accuracy'] {
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
   * Calculate confidence score
   */
  private calculateConfidence(result: any, address: GreekAddress): number {
    let confidence = 0.5;

    // Check if street και number match
    if (address.street && result.display_name?.includes(address.street)) {
      confidence += 0.2;
    }
    if (address.number && result.display_name?.includes(address.number)) {
      confidence += 0.2;
    }
    if (address.area && result.display_name?.includes(address.area)) {
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
   * Generate cache key
   */
  private getCacheKey(address: GreekAddress): string {
    return `${address.street}_${address.number}_${address.area}_${address.postalCode}`.toLowerCase();
  }

  /**
   * Save cache to localStorage
   */
  private saveCacheToLocalStorage(): void {
    try {
      const cacheData = Array.from(this.cache.entries());
      localStorage.setItem('geo_alert_address_cache', JSON.stringify(cacheData));
    } catch (error) {
      // Warning logging removed //('Failed to save cache:', error);
    }
  }

  /**
   * Load cache από localStorage
   */
  private loadCacheFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem('geo_alert_address_cache');
      if (stored) {
        const cacheData: [string, GeocodingResult][] = JSON.parse(stored);
        this.cache = new Map(cacheData);
        // Debug logging removed //(`📍 Loaded ${this.cache.size} cached addresses`);
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
    localStorage.removeItem('geo_alert_address_cache');
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