/**
 * ADMINISTRATIVE BOUNDARY SERVICE — MAIN CLASS
 * Smart search orchestration, boundary fetching with caching, and
 * geometry simplification. Delegates utils, suggestions, and filters
 * to extracted modules. Split per ADR-065 SRP pattern.
 */

type Feature = GeoJSON.Feature;
type FeatureCollection = GeoJSON.FeatureCollection;

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('AdministrativeBoundaryService');

import { overpassApiService } from './OverpassApiService';
import { adminBoundariesAnalytics } from '../performance/AdminBoundariesPerformanceAnalytics';
import { adminBoundariesCache } from '../cache/AdminBoundariesCacheManager';
import { geometrySimplificationEngine } from '../geometry/GeometrySimplificationEngine';
import { GreekAdminLevel, MajorGreekMunicipalities, MajorGreekRegions, GREECE_COUNTRY_NAME } from '../../types/administrative-types';
import type { AdminSearchResult, AdminSearchQuery, AdvancedSearchFilters, BoundingBox } from '../../types/administrative-types';
import type { ViewportContext } from '../geometry/GeometrySimplificationEngine';
import { getString, getStringOrNumber } from '@/lib/firestore/field-extractors';

// Extracted modules
import { normalizeSearchTerm, detectAdministrativeType, extractMunicipalityName, extractRegionName } from './admin-boundary-utils';
import { getMunicipalitySuggestions, getRegionSuggestions, getGeneralSuggestions, getEnhancedSuggestions } from './admin-boundary-suggestions';
import { applyAdvancedFilters, filterByBoundingBox, applyFuzzyMatching, sortByRelevance, calculateOptimalTTL, calculateSimplificationStats } from './admin-boundary-filters';

// Re-export utils/suggestions/filters for any direct consumers
export { normalizeSearchTerm, detectAdministrativeType, extractMunicipalityName, extractRegionName, calculateBoundaryCenter, simplifyBoundary, isWithinGreece } from './admin-boundary-utils';
export { getEnhancedSuggestions } from './admin-boundary-suggestions';

export class AdministrativeBoundaryService {
  private boundaryCache = new Map<string, { data: Feature | FeatureCollection; timestamp: number }>();
  private readonly cacheExpiryMs = 24 * 60 * 60 * 1000; // 24 hours

  // --- DRY Cache Helper ---

  private async getCachedBoundary<T extends Feature | FeatureCollection>(
    cacheKey: string,
    fetcher: () => Promise<T | null>,
    label: string
  ): Promise<T | null> {
    const cached = this.boundaryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiryMs) {
      return cached.data as T;
    }

    try {
      const result = await fetcher();
      if (result) {
        this.boundaryCache.set(cacheKey, { data: result, timestamp: Date.now() });
      }
      return result;
    } catch (error) {
      logger.error(`Error fetching ${label}`, { error });
      return null;
    }
  }

  // --- Smart Search ---

  async smartSearch(query: string): Promise<{
    results: AdminSearchResult[];
    detectedType: 'municipality' | 'region' | 'general' | null;
    suggestions: string[];
  }> {
    const searchId = adminBoundariesAnalytics.startSearchTracking(query);

    const cacheKey = `smart_search:${query}`;
    const cachedResult = await adminBoundariesCache.get<{
      results: AdminSearchResult[];
      detectedType: 'municipality' | 'region' | 'general' | null;
      suggestions: string[];
    }>(cacheKey);

    if (cachedResult) {
      adminBoundariesAnalytics.endSearchTracking(searchId, cachedResult.results.length, true);
      return cachedResult;
    }

    const cleanQuery = normalizeSearchTerm(query);
    const detectedType = detectAdministrativeType(cleanQuery);
    let results: AdminSearchResult[] = [];
    let suggestions: string[] = [];

    try {
      if (detectedType === 'municipality') {
        const municipalityName = extractMunicipalityName(cleanQuery);
        const boundary = await this.getMunicipalityBoundary(municipalityName);

        if (boundary) {
          const props = (boundary.properties ?? null) as Record<string, unknown> | null;
          results = [{
            id: getStringOrNumber(props, 'id') ?? 'unknown',
            name: getString(props, 'name') ?? municipalityName,
            nameEn: getString(props, 'nameEn'),
            adminLevel: GreekAdminLevel.MUNICIPALITY,
            hierarchy: { country: GREECE_COUNTRY_NAME, region: getString(props, 'region') ?? 'Unknown', municipality: getString(props, 'name') ?? municipalityName },
            geometry: boundary.geometry ?? undefined,
            confidence: 0.95,
          }];
        }
        suggestions = getMunicipalitySuggestions(municipalityName);

      } else if (detectedType === 'region') {
        const regionName = extractRegionName(cleanQuery);
        const boundary = await this.getRegionBoundary(regionName);

        if (boundary) {
          const props = (boundary.properties ?? null) as Record<string, unknown> | null;
          results = [{
            id: getStringOrNumber(props, 'id') ?? 'unknown',
            name: getString(props, 'name') ?? regionName,
            nameEn: getString(props, 'nameEn'),
            adminLevel: GreekAdminLevel.REGION,
            hierarchy: { country: GREECE_COUNTRY_NAME, region: getString(props, 'name') ?? regionName },
            geometry: boundary.geometry ?? undefined,
            confidence: 0.95,
          }];
        }
        suggestions = getRegionSuggestions(regionName);

      } else {
        results = await overpassApiService.searchAdministrative(cleanQuery);
        suggestions = getGeneralSuggestions(cleanQuery);
      }

      const searchResult = {
        results: results.slice(0, 10),
        detectedType,
        suggestions: suggestions.slice(0, 5),
      };

      const cacheTTL = calculateOptimalTTL(results.length, detectedType);
      await adminBoundariesCache.set(cacheKey, searchResult, {
        ttl: cacheTTL,
        priority: results.length > 0 ? 'high' : 'low',
        tags: ['smart_search', detectedType || 'general'],
        region: results[0]?.hierarchy?.region,
      });

      adminBoundariesAnalytics.endSearchTracking(searchId, results.length, false);
      return searchResult;

    } catch (error) {
      logger.error('Smart search error', { error });
      adminBoundariesAnalytics.endSearchTracking(searchId, 0, false, error as Error);
      return { results: [], detectedType: null, suggestions: [] };
    }
  }

  // --- Advanced Search ---

  async advancedSearch(searchQuery: AdminSearchQuery): Promise<AdminSearchResult[]> {
    try {
      const results = await overpassApiService.searchAdministrative(
        searchQuery.query, searchQuery.adminLevel
      );
      let filteredResults = results;
      if (searchQuery.regionId) {
        filteredResults = results.filter((r) =>
          r.hierarchy.region === searchQuery.regionId || r.id === searchQuery.regionId
        );
      }
      filteredResults.sort((a, b) => b.confidence - a.confidence);
      return filteredResults;
    } catch (error) {
      logger.error('Advanced search error', { error });
      return [];
    }
  }

  async advancedSearchWithFilters(
    query: string, filters: AdvancedSearchFilters
  ): Promise<AdminSearchResult[]> {
    try {
      let results: AdminSearchResult[] = [];
      const adminLevels = filters.adminLevels || [
        GreekAdminLevel.REGION, GreekAdminLevel.MUNICIPALITY,
        GreekAdminLevel.MUNICIPAL_UNIT, GreekAdminLevel.POSTAL_CODE,
      ];

      for (const adminLevel of adminLevels) {
        const levelResults = await overpassApiService.searchAdministrative(query, adminLevel);
        results.push(...levelResults);
      }

      results = applyAdvancedFilters(results, filters);
      if (filters.bbox) results = await filterByBoundingBox(results, filters.bbox);
      if (filters.fuzzyMatch) results = applyFuzzyMatching(results, query);
      results = sortByRelevance(results, query, filters);

      return results;
    } catch (error) {
      logger.error('Enhanced advanced search error', { error });
      return [];
    }
  }

  // --- Boundary Fetching (DRY via getCachedBoundary) ---

  async getMunicipalityBoundary(name: string): Promise<Feature | null> {
    return this.getCachedBoundary(`municipality:${name}`,
      () => overpassApiService.getMunicipalityBoundary(name), `municipality ${name}`);
  }

  async getRegionBoundary(name: string): Promise<Feature | null> {
    return this.getCachedBoundary(`region:${name}`,
      () => overpassApiService.getRegionBoundary(name), `region ${name}`);
  }

  async getMunicipalitiesInRegion(regionName: string): Promise<FeatureCollection | null> {
    return this.getCachedBoundary(`municipalities:${regionName}`,
      () => overpassApiService.getMunicipalitiesInRegion(regionName), `municipalities in ${regionName}`);
  }

  async searchPostalCodes(searchTerm: string): Promise<AdminSearchResult[]> {
    try {
      return await overpassApiService.searchPostalCodes(searchTerm);
    } catch (error) {
      logger.error('Postal codes search error', { error });
      return [];
    }
  }

  async getPostalCodeBoundary(postalCode: string): Promise<Feature | null> {
    return this.getCachedBoundary(`postal:${postalCode}`,
      () => overpassApiService.getPostalCodeBoundary(postalCode), `postal ${postalCode}`);
  }

  async getPostalCodesInMunicipality(name: string): Promise<FeatureCollection | null> {
    return this.getCachedBoundary(`postal-municipality:${name}`,
      () => overpassApiService.getPostalCodesInMunicipality(name), `postal codes in ${name}`);
  }

  async getPostalCodesInBounds(bounds: BoundingBox): Promise<FeatureCollection | null> {
    const key = `postal-bounds:${bounds.north}-${bounds.south}-${bounds.east}-${bounds.west}`;
    return this.getCachedBoundary(key,
      () => overpassApiService.getPostalCodesInBounds(bounds), 'postal codes in bounds');
  }

  // --- Enhanced Suggestions (delegates to module) ---

  async getEnhancedSuggestions(
    partialQuery: string,
    context?: {
      adminLevel?: GreekAdminLevel;
      region?: string;
      searchType?: 'address' | 'administrative' | 'postal_code';
      userLocation?: { lat: number; lng: number };
      includeHistory?: boolean;
      includePostalCodes?: boolean;
      limit?: number;
    }
  ) {
    return getEnhancedSuggestions(partialQuery, context);
  }

  // --- Cache Management ---

  getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [, value] of Array.from(this.boundaryCache.entries())) {
      if (now - value.timestamp < this.cacheExpiryMs) validEntries++;
      else expiredEntries++;
    }

    return {
      totalEntries: this.boundaryCache.size, validEntries, expiredEntries,
      cacheExpiryHours: this.cacheExpiryMs / (1000 * 60 * 60),
    };
  }

  clearCache(): void {
    this.boundaryCache.clear();
    overpassApiService.clearCache();
  }

  async preloadPopularBoundaries(): Promise<void> {
    const municipalityPromises = [
      MajorGreekMunicipalities.ATHENS, MajorGreekMunicipalities.THESSALONIKI,
      MajorGreekMunicipalities.PATRAS, MajorGreekMunicipalities.PIRAEUS,
    ].map((name) => this.getMunicipalityBoundary(name).catch(() => null));

    const regionPromises = [
      MajorGreekRegions.ATTICA, MajorGreekRegions.CENTRAL_MACEDONIA, MajorGreekRegions.THESSALY,
    ].map((name) => this.getRegionBoundary(name).catch(() => null));

    await Promise.all([...municipalityPromises, ...regionPromises]);
  }

  // --- Geometry Simplification Integration ---

  public async getSimplifiedBoundaries(
    boundaries: AdminSearchResult[], viewport?: ViewportContext
  ): Promise<AdminSearchResult[]> {
    if (!boundaries.length) return [];

    try {
      const simplifiedBoundaries = await Promise.all(
        boundaries.map(async (boundary) => {
          if (!boundary.geometry) return boundary;

          const result = geometrySimplificationEngine.simplifyBoundary(boundary, viewport);
          if (result) {
            return {
              ...boundary,
              geometry: result.simplifiedGeometry,
              simplification: {
                originalPoints: result.originalPoints,
                simplifiedPoints: result.simplifiedPoints,
                reductionRatio: result.reductionRatio,
                optimizationLevel: result.optimizationLevel,
                qualityScore: result.qualityScore,
              },
            };
          }
          return boundary;
        })
      );
      return simplifiedBoundaries;
    } catch (error) {
      logger.error('Batch simplification error', { error });
      return boundaries;
    }
  }

  public async smartSearchWithSimplification(
    query: string, viewport?: ViewportContext
  ): Promise<{
    results: AdminSearchResult[];
    detectedType: 'municipality' | 'region' | 'general' | null;
    suggestions: string[];
    simplificationStats?: { totalBoundaries: number; simplifiedBoundaries: number; averageReduction: number; processingTime: number };
  }> {
    const searchResult = await this.smartSearch(query);

    if (searchResult.results.length > 0 && viewport) {
      const startTime = performance.now();
      const simplifiedResults = await this.getSimplifiedBoundaries(searchResult.results, viewport);
      const simplificationStats = calculateSimplificationStats(
        searchResult.results, simplifiedResults, performance.now() - startTime
      );
      return { ...searchResult, results: simplifiedResults, simplificationStats };
    }

    return searchResult;
  }
}

// Singleton
export const administrativeBoundaryService = new AdministrativeBoundaryService();
export default administrativeBoundaryService;
