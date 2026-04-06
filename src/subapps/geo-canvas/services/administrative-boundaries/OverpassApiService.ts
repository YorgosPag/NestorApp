/**
 * OVERPASS API SERVICE — MAIN CLASS
 * Enterprise service for OpenStreetMap Overpass API queries
 * Specialized for Greek administrative boundaries.
 *
 * Query building and data conversion extracted to sibling modules (ADR-065).
 *
 * @module services/administrative-boundaries/OverpassApiService
 */

import { safeJsonParse } from '@/lib/json-utils';
import { isNonEmptyArray } from '@/lib/type-guards';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('OverpassApiService');

import { sleep } from '@/lib/async-utils';
import { adminBoundariesAnalytics } from '../performance/AdminBoundariesPerformanceAnalytics';
import { adminBoundariesCache } from '../cache/AdminBoundariesCacheManager';

import { GreekAdminLevel } from '../../types/administrative-types';
import type {
  OverpassAdminResponse,
  OverpassQueryConfig,
  BoundingBox,
  AdminSearchResult,
} from '../../types/administrative-types';

import { OverpassQueryBuilder } from './overpass-query-builder';
import {
  convertToGeoJSON,
  convertToFeatureCollection,
  convertToSearchResults,
  convertToPostalCodeSearchResults,
} from './overpass-data-converters';

// Re-export for consumers
export { OverpassQueryBuilder } from './overpass-query-builder';

// GeoJSON type aliases
type Feature = GeoJSON.Feature;
type FeatureCollection = GeoJSON.FeatureCollection;

// ============================================================================
// CONFIGURATION
// ============================================================================

const getOverpassEndpoints = (): readonly string[] => {
  const envEndpoints = process.env.NEXT_PUBLIC_OVERPASS_ENDPOINTS_JSON;
  if (envEndpoints) {
    const parsed = safeJsonParse<string[]>(envEndpoints, null as unknown as string[]);
    if (parsed !== null && isNonEmptyArray(parsed)) {
      return parsed as readonly string[];
    }
    if (parsed === null) {
      logger.warn('Invalid OVERPASS_ENDPOINTS_JSON, using fallbacks');
    }
  }

  const endpoints: string[] = [];
  endpoints.push(
    process.env.NEXT_PUBLIC_OVERPASS_PRIMARY_ENDPOINT ||
    process.env.NEXT_PUBLIC_OVERPASS_BASE_URL ||
    'https://overpass-api.de/api/interpreter'
  );
  endpoints.push(process.env.NEXT_PUBLIC_OVERPASS_SECONDARY_ENDPOINT || 'https://overpass.kumi.systems/api/interpreter');
  endpoints.push(process.env.NEXT_PUBLIC_OVERPASS_TERTIARY_ENDPOINT || 'https://overpass.osm.ch/api/interpreter');

  return endpoints as readonly string[];
};

const OVERPASS_ENDPOINTS = getOverpassEndpoints();

const DEFAULT_CONFIG: OverpassQueryConfig = {
  timeout: parseInt(process.env.NEXT_PUBLIC_OVERPASS_TIMEOUT || '30'),
  format: (process.env.NEXT_PUBLIC_OVERPASS_FORMAT as 'json' | 'xml') || 'json',
};

const RATE_LIMIT = {
  maxRequestsPerMinute: parseInt(process.env.NEXT_PUBLIC_OVERPASS_MAX_REQUESTS_PER_MINUTE || '10'),
  delayBetweenRequests: parseInt(process.env.NEXT_PUBLIC_OVERPASS_DELAY_BETWEEN_REQUESTS || '1000'),
};

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

export class OverpassApiService {
  private currentEndpointIndex = 0;
  private requestHistory: number[] = [];
  private cache = new Map<string, { data: OverpassAdminResponse; timestamp: number }>();
  private readonly cacheExpiryMs = parseInt(process.env.NEXT_PUBLIC_OVERPASS_CACHE_EXPIRY_HOURS || '24') * 60 * 60 * 1000;

  // ==========================================================================
  // CORE API
  // ==========================================================================

  async executeQuery(
    query: string,
    config: Partial<OverpassQueryConfig> = {}
  ): Promise<OverpassAdminResponse> {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    const cacheKey = this.getCacheKey(query);
    const requestId = adminBoundariesAnalytics.startOverpassRequest(query);

    // Check advanced cache
    const advancedCacheKey = `overpass:${cacheKey}`;
    const cachedResult = await adminBoundariesCache.get<OverpassAdminResponse>(advancedCacheKey);
    if (cachedResult) {
      console.debug('📦 Overpass: Using advanced cached result');
      adminBoundariesAnalytics.endOverpassRequest(requestId, JSON.stringify(cachedResult).length);
      return cachedResult;
    }

    // Check legacy cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiryMs) {
      console.debug('📦 Overpass: Using legacy cached result');
      adminBoundariesAnalytics.endOverpassRequest(requestId, JSON.stringify(cached.data).length);

      await adminBoundariesCache.set(advancedCacheKey, cached.data, {
        ttl: Math.max(this.cacheExpiryMs - (Date.now() - cached.timestamp), 60000),
        priority: 'high',
        tags: ['overpass_migration', 'legacy_cache'],
      });

      return cached.data;
    }

    await this.enforceRateLimit();

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < OVERPASS_ENDPOINTS.length; attempt++) {
      try {
        const endpoint = OVERPASS_ENDPOINTS[this.currentEndpointIndex];
        console.debug(`🌍 Overpass: Query to ${endpoint} (attempt ${attempt + 1})`);

        const response = await this.makeRequest(endpoint, query, fullConfig);

        this.cache.set(cacheKey, { data: response, timestamp: Date.now() });

        const responseSize = JSON.stringify(response).length;
        await adminBoundariesCache.set(advancedCacheKey, response, {
          ttl: this.calculateApiCacheTTL(response),
          priority: 'high',
          tags: ['overpass_api', 'fresh_data'],
          persistToDisk: responseSize < 1024 * 1024,
        });

        adminBoundariesAnalytics.endOverpassRequest(requestId, responseSize);
        return response;

      } catch (error) {
        lastError = error as Error;
        logger.warn(`Endpoint ${this.currentEndpointIndex} failed`, { error });
        this.currentEndpointIndex = (this.currentEndpointIndex + 1) % OVERPASS_ENDPOINTS.length;
        await sleep(2000);
      }
    }

    adminBoundariesAnalytics.endOverpassRequest(requestId, 0, lastError || undefined);
    throw new Error(`Overpass API failed after ${OVERPASS_ENDPOINTS.length} attempts: ${lastError?.message}`);
  }

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
          'User-Agent': process.env.NEXT_PUBLIC_OVERPASS_USER_AGENT ||
            process.env.NEXT_PUBLIC_APP_USER_AGENT ||
            `${process.env.NEXT_PUBLIC_APP_NAME || 'Enterprise-App'}-Administrative-Boundaries/1.0`,
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const data = await response.json() as OverpassAdminResponse;
      if (!data.elements) throw new Error('Invalid Overpass response: missing elements');

      console.debug(`✅ Overpass: Successfully fetched ${data.elements.length} elements`);
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // ==========================================================================
  // HIGH-LEVEL BOUNDARY METHODS
  // ==========================================================================

  async getMunicipalityBoundary(municipalityName: string): Promise<Feature | null> {
    try {
      console.debug(`🏛️ Fetching municipality boundary: ${municipalityName}`);
      const response = await this.executeQuery(OverpassQueryBuilder.getMunicipalityByName(municipalityName));
      return convertToGeoJSON(response, municipalityName);
    } catch (error) {
      logger.error('Error fetching municipality boundary', { error });
      return null;
    }
  }

  async getRegionBoundary(regionName: string): Promise<Feature | null> {
    try {
      console.debug(`🗺️ Fetching region boundary: ${regionName}`);
      const response = await this.executeQuery(OverpassQueryBuilder.getRegionByName(regionName));
      return convertToGeoJSON(response, regionName);
    } catch (error) {
      logger.error('Error fetching region boundary', { error });
      return null;
    }
  }

  async getMunicipalitiesInRegion(regionName: string): Promise<FeatureCollection | null> {
    try {
      console.debug(`🏛️ Fetching municipalities in region: ${regionName}`);
      const response = await this.executeQuery(OverpassQueryBuilder.getMunicipalitiesInRegion(regionName));
      return convertToFeatureCollection(response);
    } catch (error) {
      logger.error('Error fetching municipalities in region', { error });
      return null;
    }
  }

  async searchAdministrative(searchTerm: string, adminLevel?: GreekAdminLevel): Promise<AdminSearchResult[]> {
    try {
      console.debug(`🔍 Searching administrative: "${searchTerm}" level: ${adminLevel}`);
      const response = await this.executeQuery(OverpassQueryBuilder.searchAdministrative(searchTerm, adminLevel));
      return convertToSearchResults(response, searchTerm);
    } catch (error) {
      logger.error('Error searching administrative', { error });
      return [];
    }
  }

  async getPostalCodeBoundary(postalCode: string): Promise<Feature | null> {
    try {
      console.debug(`📮 Fetching postal code boundary: ${postalCode}`);
      const response = await this.executeQuery(OverpassQueryBuilder.getPostalCodeByNumber(postalCode));
      return convertToGeoJSON(response, postalCode);
    } catch (error) {
      logger.error('Error fetching postal code boundary', { error });
      return null;
    }
  }

  async getPostalCodesInMunicipality(municipalityName: string): Promise<FeatureCollection | null> {
    try {
      console.debug(`📮 Fetching postal codes in municipality: ${municipalityName}`);
      const response = await this.executeQuery(OverpassQueryBuilder.getPostalCodesInMunicipality(municipalityName));
      return convertToFeatureCollection(response);
    } catch (error) {
      logger.error('Error fetching postal codes in municipality', { error });
      return null;
    }
  }

  async searchPostalCodes(searchTerm: string): Promise<AdminSearchResult[]> {
    try {
      console.debug(`📮 Searching postal codes: "${searchTerm}"`);
      const response = await this.executeQuery(OverpassQueryBuilder.searchPostalCodes(searchTerm));
      return convertToPostalCodeSearchResults(response, searchTerm);
    } catch (error) {
      logger.error('Error searching postal codes', { error });
      return [];
    }
  }

  async getPostalCodesInBounds(bounds: BoundingBox): Promise<FeatureCollection | null> {
    try {
      console.debug(`📮 Fetching postal codes in bounds:`, bounds);
      const response = await this.executeQuery(OverpassQueryBuilder.getPostalCodesInBounds(bounds));
      return convertToFeatureCollection(response);
    } catch (error) {
      logger.error('Error fetching postal codes in bounds', { error });
      return null;
    }
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    this.requestHistory = this.requestHistory.filter(time => time > now - 60000);

    if (this.requestHistory.length >= RATE_LIMIT.maxRequestsPerMinute) {
      const waitTime = 60000 - (now - this.requestHistory[0]) + 1000;
      console.debug(`⏱️ Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`);
      await sleep(waitTime);
    }

    this.requestHistory.push(now);

    if (this.requestHistory.length > 1) {
      await sleep(RATE_LIMIT.delayBetweenRequests);
    }
  }

  private getCacheKey(query: string): string {
    return `overpass:${btoa(query.trim()).slice(0, 32)}`;
  }

  clearCache(): void {
    this.cache.clear();
    console.debug('🧹 Overpass cache cleared');
  }

  getCacheStats() {
    const entries = Array.from(this.cache.values());
    const expired = entries.filter(entry => Date.now() - entry.timestamp > this.cacheExpiryMs).length;

    return {
      totalEntries: this.cache.size,
      expiredEntries: expired,
      validEntries: this.cache.size - expired,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : null,
      newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : null,
    };
  }

  private calculateApiCacheTTL(response: OverpassAdminResponse): number {
    const baseTTLHours = parseInt(process.env.NEXT_PUBLIC_OVERPASS_BASE_CACHE_TTL_HOURS || '2');
    let baseTTL = baseTTLHours * 60 * 60 * 1000;

    const elementCount = response.elements ? response.elements.length : 0;

    if (elementCount === 0) {
      baseTTL = parseInt(process.env.NEXT_PUBLIC_OVERPASS_EMPTY_CACHE_TTL_MINUTES || '30') * 60 * 1000;
    } else if (elementCount === 1) {
      baseTTL = parseInt(process.env.NEXT_PUBLIC_OVERPASS_SINGLE_CACHE_TTL_HOURS || '4') * 60 * 60 * 1000;
    } else if (elementCount > parseInt(process.env.NEXT_PUBLIC_OVERPASS_LARGE_DATASET_THRESHOLD || '100')) {
      baseTTL = parseInt(process.env.NEXT_PUBLIC_OVERPASS_LARGE_CACHE_TTL_HOURS || '6') * 60 * 60 * 1000;
    }

    return baseTTL;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

export const overpassApiService = new OverpassApiService();

export default overpassApiService;
