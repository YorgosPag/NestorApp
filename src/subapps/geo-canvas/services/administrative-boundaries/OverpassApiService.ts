/**
 * 🗺️ OVERPASS API SERVICE - Phase 2.1
 *
 * Enterprise service για OpenStreetMap Overpass API queries
 * Specialized στα Ελληνικά διοικητικά όρια και boundaries
 *
 * @module services/administrative-boundaries/OverpassApiService
 */

import { adminBoundariesAnalytics } from '../performance/AdminBoundariesPerformanceAnalytics';
import { adminBoundariesCache } from '../cache/AdminBoundariesCacheManager';
import type {
  GreekAdminLevel,
  OverpassAdminResponse,
  OverpassQueryConfig,
  BoundingBox,
  AdminSearchResult,
  Coordinate
} from '../../types/administrative-types';

// ============================================================================
// OVERPASS API CONFIGURATION
// ============================================================================

/**
 * Overpass API Endpoints (με fallbacks)
 */
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.osm.ch/api/interpreter'
] as const;

/**
 * Default configuration για Overpass queries
 */
const DEFAULT_CONFIG: OverpassQueryConfig = {
  timeout: 30,
  format: 'json'
};

/**
 * Rate limiting configuration
 */
const RATE_LIMIT = {
  maxRequestsPerMinute: 10,
  delayBetweenRequests: 1000 // 1 second
};

// ============================================================================
// OVERPASS QUERY BUILDER
// ============================================================================

/**
 * Overpass Query Builder για Greek Administrative Boundaries
 */
export class OverpassQueryBuilder {

  /**
   * Build query για specific municipality by name
   */
  static getMunicipalityByName(municipalityName: string): string {
    return `
      [out:json][timeout:25];
      area["ISO3166-1"="GR"]->.greece;
      (
        rel(area.greece)[boundary=administrative][admin_level=8]["name"="${municipalityName}"];
        rel(area.greece)[boundary=administrative][admin_level=8]["name:el"="${municipalityName}"];
        rel(area.greece)[boundary=administrative][admin_level=8]["alt_name"~"${municipalityName}"];
      );
      out geom;
    `.trim();
  }

  /**
   * Build query για specific region by name
   */
  static getRegionByName(regionName: string): string {
    return `
      [out:json][timeout:25];
      area["ISO3166-1"="GR"]->.greece;
      (
        rel(area.greece)[boundary=administrative][admin_level=4]["name"="${regionName}"];
        rel(area.greece)[boundary=administrative][admin_level=4]["name:el"="${regionName}"];
        rel(area.greece)[boundary=administrative][admin_level=4]["name:en"="${regionName}"];
      );
      out geom;
    `.trim();
  }

  /**
   * Build query για all municipalities σε specific region
   */
  static getMunicipalitiesInRegion(regionName: string): string {
    return `
      [out:json][timeout:30];
      area["ISO3166-1"="GR"]->.greece;
      area(area.greece)["name"="${regionName}"][admin_level=4]->.region;
      (
        rel(area.region)[boundary=administrative][admin_level=8];
      );
      out geom;
    `.trim();
  }

  /**
   * Build query για all regions in Greece
   */
  static getAllRegions(): string {
    return `
      [out:json][timeout:30];
      area["ISO3166-1"="GR"]->.greece;
      rel(area.greece)[boundary=administrative][admin_level=4];
      out geom;
    `.trim();
  }

  /**
   * Build query για all municipalities in Greece
   */
  static getAllMunicipalities(): string {
    return `
      [out:json][timeout:60];
      area["ISO3166-1"="GR"]->.greece;
      rel(area.greece)[boundary=administrative][admin_level=8];
      out geom;
    `.trim();
  }

  /**
   * Build query για specific admin level in bounding box
   */
  static getAdminLevelInBounds(
    adminLevel: GreekAdminLevel,
    bounds: BoundingBox
  ): string {
    const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
    return `
      [out:json][timeout:25][bbox:${bbox}];
      (
        rel[boundary=administrative][admin_level=${adminLevel}]["ISO3166-1"="GR"];
      );
      out geom;
    `.trim();
  }

  /**
   * Build search query για administrative entities
   */
  static searchAdministrative(searchTerm: string, adminLevel?: GreekAdminLevel): string {
    const levelFilter = adminLevel ? `[admin_level=${adminLevel}]` : '';
    return `
      [out:json][timeout:25];
      area["ISO3166-1"="GR"]->.greece;
      (
        rel(area.greece)[boundary=administrative]${levelFilter}[~"name"~"${searchTerm}",i];
        rel(area.greece)[boundary=administrative]${levelFilter}[~"name:el"~"${searchTerm}",i];
        rel(area.greece)[boundary=administrative]${levelFilter}[~"alt_name"~"${searchTerm}",i];
      );
      out geom;
    `.trim();
  }

  /**
   * Build query για specific postal code by 5-digit code
   * Searches για postal_code boundaries (admin_level=12)
   */
  static getPostalCodeByNumber(postalCode: string): string {
    return `
      [out:json][timeout:25];
      area["ISO3166-1"="GR"]->.greece;
      (
        rel(area.greece)[boundary=administrative][admin_level=12]["postal_code"="${postalCode}"];
        rel(area.greece)[boundary=postal_code]["postal_code"="${postalCode}"];
        way(area.greece)[postal_code="${postalCode}"][boundary];
        node(area.greece)[postal_code="${postalCode}"];
      );
      out geom;
    `.trim();
  }

  /**
   * Build query για all postal codes σε specific municipality
   */
  static getPostalCodesInMunicipality(municipalityName: string): string {
    return `
      [out:json][timeout:30];
      area["ISO3166-1"="GR"]->.greece;
      area(area.greece)["name"="${municipalityName}"][admin_level=8]->.municipality;
      (
        rel(area.municipality)[boundary=administrative][admin_level=12];
        rel(area.municipality)[boundary=postal_code];
        way(area.municipality)[postal_code][boundary];
        node(area.municipality)[postal_code];
      );
      out geom;
    `.trim();
  }

  /**
   * Build query για postal codes search by partial code
   */
  static searchPostalCodes(searchTerm: string): string {
    return `
      [out:json][timeout:25];
      area["ISO3166-1"="GR"]->.greece;
      (
        rel(area.greece)[boundary~"(administrative|postal_code)"][admin_level=12][postal_code~"^${searchTerm}"];
        way(area.greece)[postal_code~"^${searchTerm}"][boundary];
        node(area.greece)[postal_code~"^${searchTerm}"];
      );
      out geom;
    `.trim();
  }

  /**
   * Build query για postal codes in geographic bounds
   */
  static getPostalCodesInBounds(bounds: BoundingBox): string {
    const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
    return `
      [out:json][timeout:25][bbox:${bbox}];
      (
        rel[boundary~"(administrative|postal_code)"][admin_level=12]["ISO3166-1"="GR"];
        way[postal_code][boundary];
        node[postal_code];
      );
      out geom;
    `.trim();
  }
}

// ============================================================================
// MAIN OVERPASS API SERVICE
// ============================================================================

/**
 * Enterprise Overpass API Service
 */
export class OverpassApiService {

  private currentEndpointIndex = 0;
  private requestHistory: number[] = [];
  private cache = new Map<string, { data: OverpassAdminResponse; timestamp: number }>();
  private readonly cacheExpiryMs = 24 * 60 * 60 * 1000; // 24 hours

  // ============================================================================
  // CORE API METHODS
  // ============================================================================

  /**
   * Execute Overpass query με automatic retry και rate limiting
   */
  async executeQuery(
    query: string,
    config: Partial<OverpassQueryConfig> = {}
  ): Promise<OverpassAdminResponse> {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    const cacheKey = this.getCacheKey(query);

    // 🚀 Phase 7.1: Start API performance tracking
    const requestId = adminBoundariesAnalytics.startOverpassRequest(query);

    // 🚀 Phase 7.2: Check advanced cache first
    const advancedCacheKey = `overpass:${cacheKey}`;
    const cachedResult = await adminBoundariesCache.get<OverpassAdminResponse>(advancedCacheKey);
    if (cachedResult) {
      console.log('📦 Overpass: Using advanced cached result');
      adminBoundariesAnalytics.endOverpassRequest(requestId, JSON.stringify(cachedResult).length);
      return cachedResult;
    }

    // Check legacy cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiryMs) {
      console.log('📦 Overpass: Using legacy cached result');
      // End tracking for cache hit
      adminBoundariesAnalytics.endOverpassRequest(requestId, JSON.stringify(cached.data).length);

      // Migrate to advanced cache
      await adminBoundariesCache.set(advancedCacheKey, cached.data, {
        ttl: Math.max(this.cacheExpiryMs - (Date.now() - cached.timestamp), 60000), // At least 1 minute
        priority: 'high',
        tags: ['overpass_migration', 'legacy_cache']
      });

      return cached.data;
    }

    // Rate limiting
    await this.enforceRateLimit();

    // Try each endpoint
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < OVERPASS_ENDPOINTS.length; attempt++) {
      try {
        const endpoint = OVERPASS_ENDPOINTS[this.currentEndpointIndex];
        console.log(`🌍 Overpass: Query to ${endpoint} (attempt ${attempt + 1})`);

        const response = await this.makeRequest(endpoint, query, fullConfig);

        // Cache successful response (legacy)
        this.cache.set(cacheKey, {
          data: response,
          timestamp: Date.now()
        });

        // 🚀 Phase 7.2: Cache in advanced cache system
        const responseSize = JSON.stringify(response).length;
        await adminBoundariesCache.set(advancedCacheKey, response, {
          ttl: this.calculateApiCacheTTL(response),
          priority: 'high',
          tags: ['overpass_api', 'fresh_data'],
          persistToDisk: responseSize < 1024 * 1024 // Only persist if < 1MB
        });

        // 🚀 Phase 7.1: End API performance tracking (success)
        adminBoundariesAnalytics.endOverpassRequest(requestId, responseSize);

        return response;

      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️ Overpass: Endpoint ${this.currentEndpointIndex} failed:`, error);
        this.currentEndpointIndex = (this.currentEndpointIndex + 1) % OVERPASS_ENDPOINTS.length;

        // Wait before retry
        await this.delay(2000);
      }
    }

    // 🚀 Phase 7.1: End API performance tracking (final error)
    adminBoundariesAnalytics.endOverpassRequest(requestId, 0, lastError || undefined);

    throw new Error(`Overpass API failed after ${OVERPASS_ENDPOINTS.length} attempts: ${lastError?.message}`);
  }

  /**
   * Make HTTP request to Overpass API
   */
  private async makeRequest(
    endpoint: string,
    query: string,
    config: OverpassQueryConfig
  ): Promise<OverpassAdminResponse> {

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout * 1000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'GEO-ALERT-Administrative-Boundaries/1.0'
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as OverpassAdminResponse;

      if (!data.elements) {
        throw new Error('Invalid Overpass response: missing elements');
      }

      console.log(`✅ Overpass: Successfully fetched ${data.elements.length} elements`);
      return data;

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // ============================================================================
  // HIGH-LEVEL BOUNDARY METHODS
  // ============================================================================

  /**
   * Get municipality boundary by name
   */
  async getMunicipalityBoundary(municipalityName: string): Promise<GeoJSON.Feature | null> {
    try {
      console.log(`🏛️ Fetching municipality boundary: ${municipalityName}`);

      const query = OverpassQueryBuilder.getMunicipalityByName(municipalityName);
      const response = await this.executeQuery(query);

      return this.convertToGeoJSON(response, municipalityName);

    } catch (error) {
      console.error('Error fetching municipality boundary:', error);
      return null;
    }
  }

  /**
   * Get region boundary by name
   */
  async getRegionBoundary(regionName: string): Promise<GeoJSON.Feature | null> {
    try {
      console.log(`🗺️ Fetching region boundary: ${regionName}`);

      const query = OverpassQueryBuilder.getRegionByName(regionName);
      const response = await this.executeQuery(query);

      return this.convertToGeoJSON(response, regionName);

    } catch (error) {
      console.error('Error fetching region boundary:', error);
      return null;
    }
  }

  /**
   * Get all municipalities σε specific region
   */
  async getMunicipalitiesInRegion(regionName: string): Promise<GeoJSON.FeatureCollection | null> {
    try {
      console.log(`🏛️ Fetching municipalities in region: ${regionName}`);

      const query = OverpassQueryBuilder.getMunicipalitiesInRegion(regionName);
      const response = await this.executeQuery(query);

      return this.convertToFeatureCollection(response);

    } catch (error) {
      console.error('Error fetching municipalities in region:', error);
      return null;
    }
  }

  /**
   * Search administrative boundaries
   */
  async searchAdministrative(
    searchTerm: string,
    adminLevel?: GreekAdminLevel
  ): Promise<AdminSearchResult[]> {
    try {
      console.log(`🔍 Searching administrative: "${searchTerm}" level: ${adminLevel}`);

      const query = OverpassQueryBuilder.searchAdministrative(searchTerm, adminLevel);
      const response = await this.executeQuery(query);

      return this.convertToSearchResults(response, searchTerm);

    } catch (error) {
      console.error('Error searching administrative:', error);
      return [];
    }
  }

  /**
   * Get postal code boundary by 5-digit postal code
   */
  async getPostalCodeBoundary(postalCode: string): Promise<GeoJSON.Feature | null> {
    try {
      console.log(`📮 Fetching postal code boundary: ${postalCode}`);

      const query = OverpassQueryBuilder.getPostalCodeByNumber(postalCode);
      const response = await this.executeQuery(query);

      return this.convertToGeoJSON(response, postalCode);

    } catch (error) {
      console.error('Error fetching postal code boundary:', error);
      return null;
    }
  }

  /**
   * Get all postal codes σε specific municipality
   */
  async getPostalCodesInMunicipality(municipalityName: string): Promise<GeoJSON.FeatureCollection | null> {
    try {
      console.log(`📮 Fetching postal codes in municipality: ${municipalityName}`);

      const query = OverpassQueryBuilder.getPostalCodesInMunicipality(municipalityName);
      const response = await this.executeQuery(query);

      return this.convertToFeatureCollection(response);

    } catch (error) {
      console.error('Error fetching postal codes in municipality:', error);
      return null;
    }
  }

  /**
   * Search postal codes by partial code (e.g., "151" για all 151XX codes)
   */
  async searchPostalCodes(searchTerm: string): Promise<AdminSearchResult[]> {
    try {
      console.log(`📮 Searching postal codes: "${searchTerm}"`);

      const query = OverpassQueryBuilder.searchPostalCodes(searchTerm);
      const response = await this.executeQuery(query);

      return this.convertToPostalCodeSearchResults(response, searchTerm);

    } catch (error) {
      console.error('Error searching postal codes:', error);
      return [];
    }
  }

  /**
   * Get postal codes in geographic bounding box
   */
  async getPostalCodesInBounds(bounds: BoundingBox): Promise<GeoJSON.FeatureCollection | null> {
    try {
      console.log(`📮 Fetching postal codes in bounds:`, bounds);

      const query = OverpassQueryBuilder.getPostalCodesInBounds(bounds);
      const response = await this.executeQuery(query);

      return this.convertToFeatureCollection(response);

    } catch (error) {
      console.error('Error fetching postal codes in bounds:', error);
      return null;
    }
  }

  // ============================================================================
  // DATA CONVERSION METHODS
  // ============================================================================

  /**
   * Convert Overpass response to GeoJSON Feature
   */
  private convertToGeoJSON(response: OverpassAdminResponse, name: string): GeoJSON.Feature | null {
    if (!response.elements || response.elements.length === 0) {
      console.warn('No boundary data found for:', name);
      return null;
    }

    const relation = response.elements[0];

    if (!relation.geometry || relation.geometry.length === 0) {
      console.warn('No geometry found for:', name);
      return null;
    }

    // Convert Overpass geometry to GeoJSON coordinates
    const coordinates = relation.geometry.map(point => [point.lon, point.lat]);

    // Close polygon if needed
    if (coordinates.length > 0) {
      const first = coordinates[0];
      const last = coordinates[coordinates.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        coordinates.push([first[0], first[1]]);
      }
    }

    return {
      type: 'Feature',
      properties: {
        id: relation.id.toString(),
        name: relation.tags?.name || relation.tags?.['name:el'] || name,
        nameEn: relation.tags?.['name:en'],
        adminLevel: parseInt(relation.tags?.admin_level || '0'),
        tags: relation.tags || {},
        source: 'OpenStreetMap',
        timestamp: Date.now()
      },
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates]
      }
    };
  }

  /**
   * Convert Overpass response to GeoJSON FeatureCollection
   */
  private convertToFeatureCollection(response: OverpassAdminResponse): GeoJSON.FeatureCollection | null {
    if (!response.elements || response.elements.length === 0) {
      return null;
    }

    const features: GeoJSON.Feature[] = [];

    for (const element of response.elements) {
      if (element.geometry && element.geometry.length > 0) {
        const coordinates = element.geometry.map(point => [point.lon, point.lat]);

        // Close polygon
        if (coordinates.length > 0) {
          const first = coordinates[0];
          const last = coordinates[coordinates.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) {
            coordinates.push([first[0], first[1]]);
          }
        }

        const feature: GeoJSON.Feature = {
          type: 'Feature',
          properties: {
            id: element.id.toString(),
            name: element.tags?.name || element.tags?.['name:el'] || 'Unknown',
            nameEn: element.tags?.['name:en'],
            adminLevel: parseInt(element.tags?.admin_level || '0'),
            tags: element.tags || {},
            source: 'OpenStreetMap',
            timestamp: Date.now()
          },
          geometry: {
            type: 'Polygon',
            coordinates: [coordinates]
          }
        };

        features.push(feature);
      }
    }

    return {
      type: 'FeatureCollection',
      features
    };
  }

  /**
   * Convert Overpass response to search results
   */
  private convertToSearchResults(response: OverpassAdminResponse, searchTerm: string): AdminSearchResult[] {
    if (!response.elements || response.elements.length === 0) {
      return [];
    }

    return response.elements
      .filter(element => element.tags && element.geometry)
      .map(element => {
        const tags = element.tags!;
        const name = tags.name || tags['name:el'] || 'Unknown';
        const adminLevel = parseInt(tags.admin_level || '0') as GreekAdminLevel;

        // Calculate simple confidence based on name matching
        const confidence = this.calculateSearchConfidence(name, searchTerm);

        // Build hierarchy path
        const hierarchy = {
          country: 'Ελλάδα',
          region: this.extractRegionFromTags(tags),
          municipality: adminLevel === GreekAdminLevel.MUNICIPALITY ? name : undefined
        };

        // Create bounding box from geometry
        let bounds: BoundingBox | undefined;
        if (element.geometry && element.geometry.length > 0) {
          const lats = element.geometry.map(p => p.lat);
          const lngs = element.geometry.map(p => p.lon);
          bounds = {
            north: Math.max(...lats),
            south: Math.min(...lats),
            east: Math.max(...lngs),
            west: Math.min(...lngs)
          };
        }

        return {
          id: element.id.toString(),
          name,
          nameEn: tags['name:en'],
          adminLevel,
          hierarchy,
          confidence,
          bounds
        };
      })
      .sort((a, b) => b.confidence - a.confidence); // Sort by confidence
  }

  /**
   * Convert Overpass response to postal code search results
   */
  private convertToPostalCodeSearchResults(response: OverpassAdminResponse, searchTerm: string): AdminSearchResult[] {
    if (!response.elements || response.elements.length === 0) {
      return [];
    }

    return response.elements
      .filter(element => element.tags)
      .map(element => {
        const tags = element.tags!;
        const postalCode = tags.postal_code || tags['addr:postcode'] || 'Unknown';
        const name = `Τ.Κ. ${postalCode}`;
        const adminLevel = GreekAdminLevel.POSTAL_CODE;

        // Calculate confidence based on postal code matching
        const confidence = this.calculatePostalCodeConfidence(postalCode, searchTerm);

        // Build hierarchy path for postal code
        const hierarchy = {
          country: 'Ελλάδα',
          region: this.extractRegionFromTags(tags),
          municipality: tags.municipality || tags['is_in:municipality'] || tags.city,
          community: tags.suburb || tags.neighbourhood
        };

        // Create bounding box from geometry
        let bounds: BoundingBox | undefined;
        if (element.geometry && element.geometry.length > 0) {
          const lats = element.geometry.map(p => p.lat);
          const lngs = element.geometry.map(p => p.lon);
          bounds = {
            north: Math.max(...lats),
            south: Math.min(...lats),
            east: Math.max(...lngs),
            west: Math.min(...lngs)
          };
        } else if (element.type === 'node' && 'lat' in element && 'lon' in element) {
          // For point postal code locations
          bounds = {
            north: element.lat + 0.001,
            south: element.lat - 0.001,
            east: element.lon + 0.001,
            west: element.lon - 0.001
          };
        }

        return {
          id: `postal-${element.id}`,
          name,
          nameEn: `Postal Code ${postalCode}`,
          adminLevel,
          hierarchy,
          confidence,
          bounds
        };
      })
      .sort((a, b) => b.confidence - a.confidence); // Sort by confidence
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Rate limiting enforcement
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove old requests
    this.requestHistory = this.requestHistory.filter(time => time > oneMinuteAgo);

    // Check if we're over the limit
    if (this.requestHistory.length >= RATE_LIMIT.maxRequestsPerMinute) {
      const waitTime = 60000 - (now - this.requestHistory[0]) + 1000;
      console.log(`⏱️ Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`);
      await this.delay(waitTime);
    }

    // Add current request
    this.requestHistory.push(now);

    // Minimum delay between requests
    if (this.requestHistory.length > 1) {
      await this.delay(RATE_LIMIT.delayBetweenRequests);
    }
  }

  /**
   * Generate cache key for query
   */
  private getCacheKey(query: string): string {
    return `overpass:${btoa(query.trim()).slice(0, 32)}`;
  }

  /**
   * Calculate search confidence score
   */
  private calculateSearchConfidence(name: string, searchTerm: string): number {
    const nameLower = name.toLowerCase();
    const termLower = searchTerm.toLowerCase();

    if (nameLower === termLower) return 1.0;
    if (nameLower.includes(termLower)) return 0.8;
    if (nameLower.startsWith(termLower)) return 0.9;

    // Simple fuzzy matching
    const distance = this.levenshteinDistance(nameLower, termLower);
    const maxLen = Math.max(nameLower.length, termLower.length);
    return Math.max(0, 1 - distance / maxLen);
  }

  /**
   * Calculate postal code search confidence score
   * Special scoring για 5-digit Greek postal codes
   */
  private calculatePostalCodeConfidence(postalCode: string, searchTerm: string): number {
    const codeStr = postalCode.toString();
    const termStr = searchTerm.toString();

    // Exact match = highest confidence
    if (codeStr === termStr) return 1.0;

    // Prefix match (e.g., "151" matches "15124")
    if (codeStr.startsWith(termStr)) {
      return 0.9 - (codeStr.length - termStr.length) * 0.1;
    }

    // Partial match within the code
    if (codeStr.includes(termStr)) {
      return 0.7;
    }

    // Similar codes (Levenshtein distance)
    const distance = this.levenshteinDistance(codeStr, termStr);
    const maxLen = Math.max(codeStr.length, termStr.length);
    return Math.max(0, 0.6 - distance / maxLen);
  }

  /**
   * Levenshtein distance για fuzzy matching
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Extract region from OSM tags
   */
  private extractRegionFromTags(tags: Record<string, string>): string {
    return tags['is_in:state'] || tags['is_in:region'] || tags.state || 'Unknown';
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 Overpass cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const entries = Array.from(this.cache.values());
    const expired = entries.filter(entry => Date.now() - entry.timestamp > this.cacheExpiryMs).length;

    return {
      totalEntries: this.cache.size,
      expiredEntries: expired,
      validEntries: this.cache.size - expired,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : null,
      newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : null
    };
  }

  // ============================================================================
  // PHASE 7.2: ADVANCED CACHE OPTIMIZATION
  // ============================================================================

  /**
   * Calculate optimal TTL για API responses based on data characteristics
   */
  private calculateApiCacheTTL(response: OverpassAdminResponse): number {
    // Base TTL: 2 hours for administrative data (quite stable)
    let baseTTL = 2 * 60 * 60 * 1000;

    // Check response characteristics
    const elementCount = response.elements ? response.elements.length : 0;

    if (elementCount === 0) {
      // Empty responses might be temporary - shorter cache
      baseTTL = 30 * 60 * 1000; // 30 minutes
    } else if (elementCount === 1) {
      // Single element responses (specific queries) - longer cache
      baseTTL = 4 * 60 * 60 * 1000; // 4 hours
    } else if (elementCount > 100) {
      // Large datasets - longer cache (expensive to fetch)
      baseTTL = 6 * 60 * 60 * 1000; // 6 hours
    }

    return baseTTL;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Singleton Overpass API Service instance
 */
export const overpassApiService = new OverpassApiService();

export default overpassApiService;