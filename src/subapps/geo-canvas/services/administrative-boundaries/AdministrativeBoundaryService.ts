/**
 * 🏛️ ADMINISTRATIVE BOUNDARY SERVICE - Phase 3.1
 *
 * Enterprise service για Greek administrative boundaries management
 * High-level interface για διοικητικά όρια, smart search, και caching
 *
 * @module services/administrative-boundaries/AdministrativeBoundaryService
 */

// ✅ ENTERPRISE FIX: Define GeoJSON types locally to avoid module dependency

/** GeoJSON coordinate types - supports all geometry types */
type GeoJSONPosition = [number, number] | [number, number, number];
type GeoJSONCoordinates =
  | GeoJSONPosition                           // Point
  | GeoJSONPosition[]                         // LineString, MultiPoint
  | GeoJSONPosition[][]                       // Polygon, MultiLineString
  | GeoJSONPosition[][][];                    // MultiPolygon

interface Geometry {
  type: string;
  coordinates?: GeoJSONCoordinates;
}

interface Feature {
  type: 'Feature';
  properties: Record<string, unknown> | null;
  geometry: Geometry | null;
}

/** Categories for search suggestions */
interface SuggestionCategories {
  history: string[];
  municipalities: string[];
  regions: string[];
  postalCodes: string[];
  contextual: string[];
}

interface FeatureCollection {
  type: 'FeatureCollection';
  features: Feature[];
}
import { overpassApiService } from './OverpassApiService';
import { adminBoundariesAnalytics } from '../performance/AdminBoundariesPerformanceAnalytics';
import { adminBoundariesCache } from '../cache/AdminBoundariesCacheManager';
import { geometrySimplificationEngine } from '../geometry/GeometrySimplificationEngine';
// ✅ ENTERPRISE FIX: Import enums/constants as values, types as types
import {
  GreekAdminLevel,
  MajorGreekRegions,
  MajorGreekMunicipalities
} from '../../types/administrative-types';
import type {
  AdminSearchResult,
  AdminSearchQuery,
  AdvancedSearchFilters,
  BoundingBox
} from '../../types/administrative-types';
import type { ViewportContext } from '../geometry/GeometrySimplificationEngine';

// ============================================================================
// ADMINISTRATIVE BOUNDARY SERVICE
// ============================================================================

/**
 * Main Administrative Boundary Service
 * High-level interface για όλες τις administrative boundary operations
 */
export class AdministrativeBoundaryService {

  private boundaryCache = new Map<string, {
    data: Feature | FeatureCollection;
    timestamp: number;
  }>();

  private readonly cacheExpiryMs = 24 * 60 * 60 * 1000; // 24 hours

  // ============================================================================
  // SMART SEARCH METHODS
  // ============================================================================

  /**
   * Smart administrative search με automatic detection
   * Αυτόματα καταλαβαίνει αν ψάχνουμε για δήμο, περιφέρεια, κτλ.
   */
  async smartSearch(query: string): Promise<{
    results: AdminSearchResult[];
    detectedType: 'municipality' | 'region' | 'general' | null;
    suggestions: string[];
  }> {
    console.log(`🧠 Smart search: "${query}"`);

    // 🚀 Phase 7.1: Start performance tracking
    const searchId = adminBoundariesAnalytics.startSearchTracking(query);

    // 🚀 Phase 7.2: Check advanced cache first
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

    // Clean και normalize το query
    const cleanQuery = this.normalizeSearchTerm(query);
    const detectedType = this.detectAdministrativeType(cleanQuery);

    let results: AdminSearchResult[] = [];
    let suggestions: string[] = [];
    let cacheHit = false;

    try {
      // Εάν εντοπίσαμε συγκεκριμένο τύπο, κάνουμε targeted search
      if (detectedType === 'municipality') {
        const municipalityName = this.extractMunicipalityName(cleanQuery);
        const boundary = await this.getMunicipalityBoundary(municipalityName);

        if (boundary) {
          results = [{
            id: boundary.properties?.id || 'unknown',
            name: boundary.properties?.name || municipalityName,
            nameEn: boundary.properties?.nameEn,
            adminLevel: GreekAdminLevel.MUNICIPALITY,
            hierarchy: {
              country: 'Ελλάδα',
              region: boundary.properties?.region || 'Unknown',
              municipality: boundary.properties?.name || municipalityName
            },
            geometry: boundary.geometry,
            confidence: 0.95
          }];
        }

        suggestions = this.getMunicipalitySuggestions(municipalityName);

      } else if (detectedType === 'region') {
        const regionName = this.extractRegionName(cleanQuery);
        const boundary = await this.getRegionBoundary(regionName);

        if (boundary) {
          results = [{
            id: boundary.properties?.id || 'unknown',
            name: boundary.properties?.name || regionName,
            nameEn: boundary.properties?.nameEn,
            adminLevel: GreekAdminLevel.REGION,
            hierarchy: {
              country: 'Ελλάδα',
              region: boundary.properties?.name || regionName
            },
            geometry: boundary.geometry,
            confidence: 0.95
          }];
        }

        suggestions = this.getRegionSuggestions(regionName);

      } else {
        // General search σε όλα τα admin levels
        results = await overpassApiService.searchAdministrative(cleanQuery);
        suggestions = this.getGeneralSuggestions(cleanQuery);
      }

      console.log(`✅ Smart search found ${results.length} results, type: ${detectedType}`);

      // 🚀 Phase 7.2: Cache successful results
      const searchResult = {
        results: results.slice(0, 10), // Limit to 10 results
        detectedType,
        suggestions: suggestions.slice(0, 5) // Limit to 5 suggestions
      };

      // Cache με intelligent TTL based on result quality
      const cacheTTL = this.calculateOptimalTTL(results.length, detectedType);
      await adminBoundariesCache.set(cacheKey, searchResult, {
        ttl: cacheTTL,
        priority: results.length > 0 ? 'high' : 'low',
        tags: ['smart_search', detectedType || 'general'],
        region: results[0]?.hierarchy?.region
      });

      // 🚀 Phase 7.1: End performance tracking (success)
      adminBoundariesAnalytics.endSearchTracking(searchId, results.length, cacheHit);

      return searchResult;

    } catch (error) {
      console.error('Smart search error:', error);

      // 🚀 Phase 7.1: End performance tracking (error)
      adminBoundariesAnalytics.endSearchTracking(searchId, 0, cacheHit, error as Error);

      return {
        results: [],
        detectedType: null,
        suggestions: []
      };
    }
  }

  /**
   * Advanced search με filters (Enhanced - Phase 6.3)
   */
  async advancedSearch(searchQuery: AdminSearchQuery): Promise<AdminSearchResult[]> {
    console.log(`🔍 Advanced search:`, searchQuery);

    try {
      const results = await overpassApiService.searchAdministrative(
        searchQuery.query,
        searchQuery.adminLevel
      );

      // Filter by region if specified
      let filteredResults = results;
      if (searchQuery.regionId) {
        filteredResults = results.filter(result =>
          result.hierarchy.region === searchQuery.regionId ||
          result.id === searchQuery.regionId
        );
      }

      // Sort by confidence
      filteredResults.sort((a, b) => b.confidence - a.confidence);

      return filteredResults;

    } catch (error) {
      console.error('Advanced search error:', error);
      return [];
    }
  }

  /**
   * Enhanced advanced search με comprehensive filters (Phase 6.3)
   */
  async advancedSearchWithFilters(
    query: string,
    filters: AdvancedSearchFilters
  ): Promise<AdminSearchResult[]> {
    console.log(`🔍 Enhanced advanced search with filters:`, { query, filters });

    try {
      let results: AdminSearchResult[] = [];

      // Step 1: Get base results based on admin levels
      const adminLevels = filters.adminLevels || [
        GreekAdminLevel.REGION,
        GreekAdminLevel.MUNICIPALITY,
        GreekAdminLevel.MUNICIPAL_UNIT,
        GreekAdminLevel.POSTAL_CODE
      ];

      // Search each admin level
      for (const adminLevel of adminLevels) {
        const levelResults = await overpassApiService.searchAdministrative(query, adminLevel);
        results.push(...levelResults);
      }

      // Step 2: Apply filters
      results = this.applyAdvancedFilters(results, filters);

      // Step 3: Handle spatial bounding box filter
      if (filters.bbox) {
        results = await this.filterByBoundingBox(results, filters.bbox);
      }

      // Step 4: Apply fuzzy matching if enabled
      if (filters.fuzzyMatch) {
        results = this.applyFuzzyMatching(results, query);
      }

      // Step 5: Sort by relevance and confidence
      results = this.sortByRelevance(results, query, filters);

      console.log(`✅ Enhanced advanced search found ${results.length} results`);

      return results;

    } catch (error) {
      console.error('Enhanced advanced search error:', error);
      return [];
    }
  }

  // ============================================================================
  // BOUNDARY FETCHING METHODS
  // ============================================================================

  /**
   * Get municipality boundary με caching
   */
  async getMunicipalityBoundary(municipalityName: string): Promise<Feature | null> {
    const cacheKey = `municipality:${municipalityName}`;

    // Check cache
    const cached = this.boundaryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiryMs) {
      console.log(`📦 Using cached municipality boundary: ${municipalityName}`);
      return cached.data as Feature;
    }

    try {
      const boundary = await overpassApiService.getMunicipalityBoundary(municipalityName);

      if (boundary) {
        // Cache the result
        this.boundaryCache.set(cacheKey, {
          data: boundary,
          timestamp: Date.now()
        });

        console.log(`✅ Fetched municipality boundary: ${municipalityName}`);
      }

      return boundary;

    } catch (error) {
      console.error(`Error fetching municipality boundary for ${municipalityName}:`, error);
      return null;
    }
  }

  /**
   * Get region boundary με caching
   */
  async getRegionBoundary(regionName: string): Promise<Feature | null> {
    const cacheKey = `region:${regionName}`;

    // Check cache
    const cached = this.boundaryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiryMs) {
      console.log(`📦 Using cached region boundary: ${regionName}`);
      return cached.data as Feature;
    }

    try {
      const boundary = await overpassApiService.getRegionBoundary(regionName);

      if (boundary) {
        // Cache the result
        this.boundaryCache.set(cacheKey, {
          data: boundary,
          timestamp: Date.now()
        });

        console.log(`✅ Fetched region boundary: ${regionName}`);
      }

      return boundary;

    } catch (error) {
      console.error(`Error fetching region boundary for ${regionName}:`, error);
      return null;
    }
  }

  /**
   * Get all municipalities σε region
   */
  async getMunicipalitiesInRegion(regionName: string): Promise<FeatureCollection | null> {
    const cacheKey = `municipalities:${regionName}`;

    // Check cache
    const cached = this.boundaryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiryMs) {
      console.log(`📦 Using cached municipalities for region: ${regionName}`);
      return cached.data as FeatureCollection;
    }

    try {
      const municipalities = await overpassApiService.getMunicipalitiesInRegion(regionName);

      if (municipalities) {
        // Cache the result
        this.boundaryCache.set(cacheKey, {
          data: municipalities,
          timestamp: Date.now()
        });

        console.log(`✅ Fetched ${municipalities.features.length} municipalities in ${regionName}`);
      }

      return municipalities;

    } catch (error) {
      console.error(`Error fetching municipalities in ${regionName}:`, error);
      return null;
    }
  }

  // ============================================================================
  // PHASE 6: POSTAL CODE METHODS
  // ============================================================================

  /**
   * Search postal codes by partial code (e.g., "151" για all 151XX codes)
   */
  async searchPostalCodes(searchTerm: string): Promise<AdminSearchResult[]> {
    console.log(`📮 Postal codes search: "${searchTerm}"`);

    try {
      const results = await overpassApiService.searchPostalCodes(searchTerm);
      console.log(`✅ Found ${results.length} postal code results`);
      return results;

    } catch (error) {
      console.error('Postal codes search error:', error);
      return [];
    }
  }

  /**
   * Get postal code boundary με caching
   */
  async getPostalCodeBoundary(postalCode: string): Promise<Feature | null> {
    const cacheKey = `postal:${postalCode}`;

    // Check cache
    const cached = this.boundaryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiryMs) {
      console.log(`📦 Using cached postal code boundary: ${postalCode}`);
      return cached.data as Feature;
    }

    try {
      const boundary = await overpassApiService.getPostalCodeBoundary(postalCode);

      if (boundary) {
        // Cache the result
        this.boundaryCache.set(cacheKey, {
          data: boundary,
          timestamp: Date.now()
        });

        console.log(`✅ Fetched postal code boundary: ${postalCode}`);
      }

      return boundary;

    } catch (error) {
      console.error(`Error fetching postal code boundary for ${postalCode}:`, error);
      return null;
    }
  }

  /**
   * Get all postal codes σε specific municipality
   */
  async getPostalCodesInMunicipality(municipalityName: string): Promise<FeatureCollection | null> {
    const cacheKey = `postal-municipality:${municipalityName}`;

    // Check cache
    const cached = this.boundaryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiryMs) {
      console.log(`📦 Using cached postal codes for municipality: ${municipalityName}`);
      return cached.data as FeatureCollection;
    }

    try {
      const postalCodes = await overpassApiService.getPostalCodesInMunicipality(municipalityName);

      if (postalCodes) {
        // Cache the result
        this.boundaryCache.set(cacheKey, {
          data: postalCodes,
          timestamp: Date.now()
        });

        console.log(`✅ Fetched ${postalCodes.features.length} postal codes in ${municipalityName}`);
      }

      return postalCodes;

    } catch (error) {
      console.error(`Error fetching postal codes in ${municipalityName}:`, error);
      return null;
    }
  }

  /**
   * Get postal codes in geographic bounding box
   */
  async getPostalCodesInBounds(bounds: BoundingBox): Promise<FeatureCollection | null> {
    const cacheKey = `postal-bounds:${bounds.north}-${bounds.south}-${bounds.east}-${bounds.west}`;

    // Check cache
    const cached = this.boundaryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiryMs) {
      console.log(`📦 Using cached postal codes for bounds`);
      return cached.data as FeatureCollection;
    }

    try {
      const postalCodes = await overpassApiService.getPostalCodesInBounds(bounds);

      if (postalCodes) {
        // Cache the result
        this.boundaryCache.set(cacheKey, {
          data: postalCodes,
          timestamp: Date.now()
        });

        console.log(`✅ Fetched ${postalCodes.features.length} postal codes in bounding box`);
      }

      return postalCodes;

    } catch (error) {
      console.error(`Error fetching postal codes in bounds:`, error);
      return null;
    }
  }

  // ============================================================================
  // SMART DETECTION METHODS
  // ============================================================================

  /**
   * Detect administrative type από search query
   */
  private detectAdministrativeType(query: string): 'municipality' | 'region' | 'general' | null {
    const queryLower = query.toLowerCase();

    // Municipality indicators
    const municipalityKeywords = [
      'δήμος', 'δημος', 'municipality', 'δ.', 'δήμ.'
    ];

    // Region indicators
    const regionKeywords = [
      'περιφέρεια', 'περιφερεια', 'region', 'περιφ.', 'π.'
    ];

    // Check for municipality
    for (const keyword of municipalityKeywords) {
      if (queryLower.includes(keyword)) {
        return 'municipality';
      }
    }

    // Check for region
    for (const keyword of regionKeywords) {
      if (queryLower.includes(keyword)) {
        return 'region';
      }
    }

    // Check known municipalities και regions
    if (this.isKnownMunicipality(query)) {
      return 'municipality';
    }

    if (this.isKnownRegion(query)) {
      return 'region';
    }

    return 'general';
  }

  /**
   * Extract municipality name από query
   */
  private extractMunicipalityName(query: string): string {
    let name = query
      .replace(/δήμος\s*/gi, '')
      .replace(/δημος\s*/gi, '')
      .replace(/municipality\s*/gi, '')
      .replace(/δ\.\s*/gi, '')
      .trim();

    // Add "Δήμος" prefix if not present
    if (!name.toLowerCase().startsWith('δήμος')) {
      name = `Δήμος ${name}`;
    }

    return name;
  }

  /**
   * Extract region name από query
   */
  private extractRegionName(query: string): string {
    return query
      .replace(/περιφέρεια\s*/gi, '')
      .replace(/περιφερεια\s*/gi, '')
      .replace(/region\s*/gi, '')
      .replace(/περιφ\.\s*/gi, '')
      .replace(/π\.\s*/gi, '')
      .trim();
  }

  /**
   * Check if query matches known municipality
   */
  private isKnownMunicipality(query: string): boolean {
    const queryLower = query.toLowerCase();
    const knownMunicipalities = Object.values(MajorGreekMunicipalities).map(m => m.toLowerCase());

    return knownMunicipalities.some(m =>
      queryLower.includes(m.toLowerCase()) ||
      m.toLowerCase().includes(queryLower)
    );
  }

  /**
   * Check if query matches known region
   */
  private isKnownRegion(query: string): boolean {
    const queryLower = query.toLowerCase();
    const knownRegions = Object.values(MajorGreekRegions).map(r => r.toLowerCase());

    return knownRegions.some(r =>
      queryLower.includes(r.toLowerCase()) ||
      r.toLowerCase().includes(queryLower)
    );
  }

  // ============================================================================
  // SUGGESTION METHODS
  // ============================================================================

  /**
   * Get municipality suggestions
   */
  private getMunicipalitySuggestions(partialName: string): string[] {
    const suggestions = Object.values(MajorGreekMunicipalities)
      .filter(name => name.toLowerCase().includes(partialName.toLowerCase()))
      .slice(0, 5);

    return suggestions;
  }

  /**
   * Get region suggestions
   */
  private getRegionSuggestions(partialName: string): string[] {
    const suggestions = Object.values(MajorGreekRegions)
      .filter(name => name.toLowerCase().includes(partialName.toLowerCase()))
      .slice(0, 5);

    return suggestions;
  }

  /**
   * Get general suggestions
   */
  private getGeneralSuggestions(query: string): string[] {
    const allSuggestions = [
      ...Object.values(MajorGreekMunicipalities),
      ...Object.values(MajorGreekRegions)
    ];

    return allSuggestions
      .filter(name => name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5);
  }

  /**
   * Enhanced smart suggestions με multiple sources (Phase 6.4)
   * Combines history, static data, και contextual suggestions
   */
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
  ): Promise<{
    suggestions: string[];
    categories: {
      history: string[];
      municipalities: string[];
      regions: string[];
      postalCodes: string[];
      contextual: string[];
    };
    metadata: {
      source: string;
      confidence: number;
      totalSources: number;
    };
  }> {
    const {
      adminLevel,
      region,
      searchType,
      userLocation,
      includeHistory = true,
      includePostalCodes = true,
      limit = 8
    } = context || {};

    console.log(`🔍 Enhanced suggestions for: "${partialQuery}"`);

    const suggestions = new Set<string>();
    const categories = {
      history: [] as string[],
      municipalities: [] as string[],
      regions: [] as string[],
      postalCodes: [] as string[],
      contextual: [] as string[]
    };

    let totalSources = 0;
    const queryLower = partialQuery.toLowerCase().trim();

    try {
      // 1. History-based suggestions (highest priority)
      if (includeHistory) {
        const { searchHistoryService } = await import('./SearchHistoryService');
        const historySuggestions = searchHistoryService.getSmartSuggestions(
          partialQuery,
          searchType,
          Math.ceil(limit * 0.4)
        );

        categories.history = historySuggestions;
        historySuggestions.forEach(s => suggestions.add(s));
        totalSources++;
      }

      // 2. Static municipality suggestions
      const municipalitySuggestions = this.getEnhancedMunicipalitySuggestions(
        queryLower,
        region,
        Math.ceil(limit * 0.25)
      );
      categories.municipalities = municipalitySuggestions;
      municipalitySuggestions.forEach(s => suggestions.add(s));
      totalSources++;

      // 3. Static region suggestions
      const regionSuggestions = this.getEnhancedRegionSuggestions(
        queryLower,
        Math.ceil(limit * 0.2)
      );
      categories.regions = regionSuggestions;
      regionSuggestions.forEach(s => suggestions.add(s));
      totalSources++;

      // 4. Postal code suggestions
      if (includePostalCodes && (searchType === 'postal_code' || !searchType)) {
        const postalSuggestions = await this.getPostalCodeSuggestions(
          queryLower,
          Math.ceil(limit * 0.15)
        );
        categories.postalCodes = postalSuggestions;
        postalSuggestions.forEach(s => suggestions.add(s));
        totalSources++;
      }

      // 5. Contextual suggestions based on user location
      if (userLocation) {
        const contextualSuggestions = await this.getLocationBasedSuggestions(
          queryLower,
          userLocation,
          Math.ceil(limit * 0.1)
        );
        categories.contextual = contextualSuggestions;
        contextualSuggestions.forEach(s => suggestions.add(s));
        totalSources++;
      }

      // Convert to array and prioritize
      const finalSuggestions = this.prioritizeSuggestions(
        Array.from(suggestions),
        partialQuery,
        categories
      ).slice(0, limit);

      const confidence = this.calculateSuggestionConfidence(finalSuggestions, partialQuery);

      console.log(`✅ Enhanced suggestions: ${finalSuggestions.length} from ${totalSources} sources`);

      return {
        suggestions: finalSuggestions,
        categories,
        metadata: {
          source: 'enhanced-multi-source',
          confidence,
          totalSources
        }
      };

    } catch (error) {
      console.error('Enhanced suggestions error:', error);

      // Fallback to basic suggestions
      const basicSuggestions = this.getGeneralSuggestions(partialQuery);

      return {
        suggestions: basicSuggestions,
        categories: {
          history: [],
          municipalities: basicSuggestions.filter(s =>
            (Object.values(MajorGreekMunicipalities) as string[]).includes(s)
          ),
          regions: basicSuggestions.filter(s =>
            (Object.values(MajorGreekRegions) as string[]).includes(s)
          ),
          postalCodes: [],
          contextual: []
        },
        metadata: {
          source: 'fallback-basic',
          confidence: 0.5,
          totalSources: 1
        }
      };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Normalize search term για consistent processing
   */
  private normalizeSearchTerm(term: string): string {
    return term
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[άα]/g, 'α')
      .replace(/[έε]/g, 'ε')
      .replace(/[ήη]/g, 'η')
      .replace(/[ίι]/g, 'ι')
      .replace(/[όο]/g, 'ο')
      .replace(/[ύυ]/g, 'υ')
      .replace(/[ώω]/g, 'ω');
  }

  /**
   * Get cached boundary count
   */
  getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    // ✅ ENTERPRISE FIX: Use Array.from to avoid downlevelIteration requirement
    for (const [key, value] of Array.from(this.boundaryCache.entries())) {
      if (now - value.timestamp < this.cacheExpiryMs) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: this.boundaryCache.size,
      validEntries,
      expiredEntries,
      cacheExpiryHours: this.cacheExpiryMs / (1000 * 60 * 60)
    };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.boundaryCache.clear();
    overpassApiService.clearCache();
    console.log('🧹 Administrative boundary cache cleared');
  }

  /**
   * Preload popular boundaries για performance
   */
  async preloadPopularBoundaries(): Promise<void> {
    console.log('🚀 Preloading popular boundaries...');

    const popularMunicipalities = [
      MajorGreekMunicipalities.ATHENS,
      MajorGreekMunicipalities.THESSALONIKI,
      MajorGreekMunicipalities.PATRAS,
      MajorGreekMunicipalities.PIRAEUS
    ];

    const popularRegions = [
      MajorGreekRegions.ATTICA,
      MajorGreekRegions.CENTRAL_MACEDONIA,
      MajorGreekRegions.THESSALY
    ];

    // Preload municipalities (parallel)
    const municipalityPromises = popularMunicipalities.map(name =>
      this.getMunicipalityBoundary(name).catch(error => {
        console.warn(`Failed to preload municipality ${name}:`, error);
        return null;
      })
    );

    // Preload regions (parallel)
    const regionPromises = popularRegions.map(name =>
      this.getRegionBoundary(name).catch(error => {
        console.warn(`Failed to preload region ${name}:`, error);
        return null;
      })
    );

    // Wait for all preloads
    await Promise.all([...municipalityPromises, ...regionPromises]);

    console.log('✅ Popular boundaries preloaded');
  }

  /**
   * Check if coordinates are within Greece
   */
  isWithinGreece(lat: number, lng: number): boolean {
    // Rough bounding box για Ελλάδα
    return lat >= 34.5 && lat <= 42.0 && lng >= 19.0 && lng <= 29.5;
  }

  /**
   * Calculate center point από boundary geometry
   */
  calculateBoundaryCenter(geometry: Geometry): [number, number] | null {
    if (geometry.type === 'Polygon') {
      const coordinates = geometry.coordinates[0]; // First ring
      if (coordinates.length === 0) return null;

      const lngs = coordinates.map(coord => coord[0]);
      const lats = coordinates.map(coord => coord[1]);

      const centerLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;
      const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;

      return [centerLng, centerLat];
    }

    return null;
  }

  /**
   * Simplify boundary geometry για performance
   */
  simplifyBoundary(geometry: Geometry, tolerance = 0.001): Geometry {
    // Simple Douglas-Peucker-style simplification
    if (geometry.type === 'Polygon') {
      const simplified = geometry.coordinates.map(ring =>
        this.simplifyRing(ring, tolerance)
      );

      return {
        ...geometry,
        coordinates: simplified
      };
    }

    return geometry;
  }

  /**
   * Simplify coordinate ring
   */
  private simplifyRing(ring: number[][], tolerance: number): number[][] {
    if (ring.length <= 2) return ring;

    const simplified = [ring[0]]; // Always keep first point

    for (let i = 1; i < ring.length - 1; i++) {
      const prev = ring[i - 1];
      const current = ring[i];
      const next = ring[i + 1];

      // Calculate distance από line between prev and next
      const distance = this.pointToLineDistance(current, prev, next);

      if (distance > tolerance) {
        simplified.push(current);
      }
    }

    simplified.push(ring[ring.length - 1]); // Always keep last point

    return simplified;
  }

  /**
   * Calculate distance από point to line
   */
  private pointToLineDistance(
    point: number[],
    lineStart: number[],
    lineEnd: number[]
  ): number {
    const [x, y] = point;
    const [x1, y1] = lineStart;
    const [x2, y2] = lineEnd;

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) return Math.sqrt(A * A + B * B);

    const param = dot / lenSq;
    let xx: number, yy: number;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;

    return Math.sqrt(dx * dx + dy * dy);
  }

  // ============================================================================
  // PHASE 6.3: ADVANCED FILTER HELPER METHODS
  // ============================================================================

  /**
   * Apply advanced filters to search results
   */
  private applyAdvancedFilters(
    results: AdminSearchResult[],
    filters: AdvancedSearchFilters
  ): AdminSearchResult[] {
    let filteredResults = [...results];

    // Filter by specific regions
    if (filters.regions && filters.regions.length > 0) {
      filteredResults = filteredResults.filter(result =>
        filters.regions!.some(region =>
          result.hierarchy.region?.toLowerCase().includes(region.toLowerCase())
        )
      );
    }

    // Filter by postal code ranges
    if (filters.postalCodes && filters.postalCodes.length > 0) {
      filteredResults = filteredResults.filter(result => {
        if (result.adminLevel !== GreekAdminLevel.POSTAL_CODE) return true;

        return filters.postalCodes!.some(postalCodePattern =>
          result.name.includes(postalCodePattern) ||
          result.id.includes(postalCodePattern)
        );
      });
    }

    // Filter by population range
    if (filters.population) {
      filteredResults = filteredResults.filter(result => {
        // This would require population data in the results
        // For now, we'll just pass through all results
        // In a full implementation, we'd need population data from OSM or other sources
        return true;
      });
    }

    // Filter by area range
    if (filters.area) {
      filteredResults = filteredResults.filter(result => {
        // This would require area calculation from geometry
        // For now, we'll just pass through all results
        // In a full implementation, we'd calculate area from geometry
        return true;
      });
    }

    // Exclude historical boundaries if not requested
    if (!filters.includeHistorical) {
      filteredResults = filteredResults.filter(result => {
        // Filter out historical boundaries based on tags or properties
        // This would require historical data markers
        return true; // For now, assume all are current
      });
    }

    return filteredResults;
  }

  /**
   * Filter results by bounding box
   */
  private async filterByBoundingBox(
    results: AdminSearchResult[],
    bbox: BoundingBox
  ): Promise<AdminSearchResult[]> {
    return results.filter(result => {
      if (!result.bounds) return true; // Keep if no bounds to check

      // Check if result bounds intersect with filter bbox
      return !(
        result.bounds.east < bbox.west ||
        result.bounds.west > bbox.east ||
        result.bounds.north < bbox.south ||
        result.bounds.south > bbox.north
      );
    });
  }

  /**
   * Apply fuzzy matching to improve search results
   */
  private applyFuzzyMatching(
    results: AdminSearchResult[],
    query: string
  ): AdminSearchResult[] {
    const queryLower = query.toLowerCase();

    // Enhanced scoring with fuzzy matching
    return results.map(result => {
      const nameLower = result.name.toLowerCase();
      let fuzzyScore = result.confidence;

      // Boost exact matches
      if (nameLower === queryLower) {
        fuzzyScore = Math.min(fuzzyScore * 1.5, 1.0);
      }
      // Boost starts with matches
      else if (nameLower.startsWith(queryLower)) {
        fuzzyScore = Math.min(fuzzyScore * 1.3, 1.0);
      }
      // Boost word boundary matches
      else if (nameLower.includes(` ${queryLower}`)) {
        fuzzyScore = Math.min(fuzzyScore * 1.2, 1.0);
      }
      // Apply Levenshtein distance for fuzzy matching
      else {
        const distance = this.calculateLevenshteinDistance(nameLower, queryLower);
        const similarity = 1 - (distance / Math.max(nameLower.length, queryLower.length));
        if (similarity > 0.6) { // Only keep reasonably similar results
          fuzzyScore = Math.min(fuzzyScore * similarity, 1.0);
        } else {
          fuzzyScore = 0; // Filter out very dissimilar results
        }
      }

      return {
        ...result,
        confidence: fuzzyScore
      };
    }).filter(result => result.confidence > 0);
  }

  /**
   * Sort results by relevance and confidence
   */
  private sortByRelevance(
    results: AdminSearchResult[],
    query: string,
    filters: AdvancedSearchFilters
  ): AdminSearchResult[] {
    return results.sort((a, b) => {
      // Primary sort: confidence
      if (Math.abs(a.confidence - b.confidence) > 0.1) {
        return b.confidence - a.confidence;
      }

      // Secondary sort: admin level preference (more specific levels first)
      const adminLevelPriority = {
        [GreekAdminLevel.POSTAL_CODE]: 4,
        [GreekAdminLevel.COMMUNITY]: 3,
        [GreekAdminLevel.MUNICIPAL_UNIT]: 2,
        [GreekAdminLevel.MUNICIPALITY]: 1,
        [GreekAdminLevel.REGION]: 0
      };

      const aPriority = adminLevelPriority[a.adminLevel] || 0;
      const bPriority = adminLevelPriority[b.adminLevel] || 0;

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      // Tertiary sort: name length (shorter names often more specific)
      return a.name.length - b.name.length;
    });
  }

  /**
   * Calculate Levenshtein distance για fuzzy matching
   */
  private calculateLevenshteinDistance(str1: string, str2: string): number {
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

  // ============================================================================
  // PHASE 6.4: ENHANCED SUGGESTION HELPER METHODS
  // ============================================================================

  /**
   * Enhanced municipality suggestions με region filtering
   */
  private getEnhancedMunicipalitySuggestions(
    query: string,
    regionFilter?: string,
    limit = 5
  ): string[] {
    let municipalities = Object.values(MajorGreekMunicipalities);

    // Apply region filtering if specified
    if (regionFilter) {
      // In a full implementation, we'd filter by actual region data
      // For now, we'll just use all municipalities
    }

    return municipalities
      .filter(name => {
        const nameLower = name.toLowerCase();
        return nameLower.includes(query) ||
               nameLower.startsWith(query) ||
               this.fuzzyMatch(nameLower, query, 0.7);
      })
      .sort((a, b) => {
        // Prefer exact matches and prefix matches
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();

        const aExact = aLower === query;
        const bExact = bLower === query;
        if (aExact !== bExact) return aExact ? -1 : 1;

        const aStarts = aLower.startsWith(query);
        const bStarts = bLower.startsWith(query);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;

        return a.length - b.length; // Prefer shorter names
      })
      .slice(0, limit);
  }

  /**
   * Enhanced region suggestions
   */
  private getEnhancedRegionSuggestions(query: string, limit = 5): string[] {
    return Object.values(MajorGreekRegions)
      .filter(name => {
        const nameLower = name.toLowerCase();
        return nameLower.includes(query) ||
               nameLower.startsWith(query) ||
               this.fuzzyMatch(nameLower, query, 0.7);
      })
      .sort((a, b) => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();

        const aExact = aLower === query;
        const bExact = bLower === query;
        if (aExact !== bExact) return aExact ? -1 : 1;

        const aStarts = aLower.startsWith(query);
        const bStarts = bLower.startsWith(query);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;

        return a.length - b.length;
      })
      .slice(0, limit);
  }

  /**
   * Postal code suggestions
   */
  private async getPostalCodeSuggestions(query: string, limit = 3): Promise<string[]> {
    // For postal codes, we look for numeric patterns
    const numericQuery = query.replace(/\D/g, ''); // Remove non-digits

    if (numericQuery.length === 0) {
      return [];
    }

    // Generate suggestions for common Greek postal code patterns
    const suggestions: string[] = [];

    // Major city postal codes that start with the query
    const majorCityPrefixes = ['10', '11', '12', '15', '20', '21', '22', '23', '24', '25', '26', '54', '55', '56'];

    for (const prefix of majorCityPrefixes) {
      if (prefix.startsWith(numericQuery)) {
        suggestions.push(`Τ.Κ. ${prefix}XXX`);
      }
    }

    // If query is longer, suggest specific ranges
    if (numericQuery.length >= 3) {
      const baseCode = numericQuery.padEnd(5, 'X');
      suggestions.push(`Τ.Κ. ${baseCode}`);
    }

    return suggestions.slice(0, limit);
  }

  /**
   * Location-based contextual suggestions
   */
  private async getLocationBasedSuggestions(
    query: string,
    location: { lat: number; lng: number },
    limit = 2
  ): Promise<string[]> {
    // In a full implementation, we'd use spatial queries to find nearby boundaries
    // For now, we'll provide some contextual suggestions based on Greek geography

    const suggestions: string[] = [];

    // Check if location is in major metropolitan areas
    if (this.isInAthenMetropolitanArea(location)) {
      if ('αθήνα'.includes(query) || 'athens'.includes(query)) {
        suggestions.push('Δήμος Αθηναίων', 'Αττική');
      }
    } else if (this.isInThessalonikiArea(location)) {
      if ('θεσσαλονίκη'.includes(query) || 'thessaloniki'.includes(query)) {
        suggestions.push('Δήμος Θεσσαλονίκης', 'Κεντρική Μακεδονία');
      }
    }

    return suggestions.slice(0, limit);
  }

  /**
   * Prioritize suggestions based on relevance
   */
  private prioritizeSuggestions(
    suggestions: string[],
    query: string,
    categories: SuggestionCategories
  ): string[] {
    return suggestions.sort((a, b) => {
      const queryLower = query.toLowerCase();
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();

      // 1. Exact matches first
      const aExact = aLower === queryLower;
      const bExact = bLower === queryLower;
      if (aExact !== bExact) return aExact ? -1 : 1;

      // 2. Prefix matches
      const aPrefix = aLower.startsWith(queryLower);
      const bPrefix = bLower.startsWith(queryLower);
      if (aPrefix !== bPrefix) return aPrefix ? -1 : 1;

      // 3. History items get priority
      const aHistory = categories.history.includes(a);
      const bHistory = categories.history.includes(b);
      if (aHistory !== bHistory) return aHistory ? -1 : 1;

      // 4. Shorter names (often more specific)
      return a.length - b.length;
    });
  }

  /**
   * Calculate suggestion confidence score
   */
  private calculateSuggestionConfidence(suggestions: string[], query: string): number {
    if (suggestions.length === 0) return 0;

    let totalScore = 0;
    const queryLower = query.toLowerCase();

    for (const suggestion of suggestions) {
      const suggestionLower = suggestion.toLowerCase();

      if (suggestionLower === queryLower) {
        totalScore += 1.0;
      } else if (suggestionLower.startsWith(queryLower)) {
        totalScore += 0.8;
      } else if (suggestionLower.includes(queryLower)) {
        totalScore += 0.6;
      } else {
        totalScore += 0.3;
      }
    }

    return totalScore / suggestions.length;
  }

  /**
   * Simple fuzzy matching
   */
  private fuzzyMatch(text: string, query: string, threshold = 0.8): boolean {
    const distance = this.calculateLevenshteinDistance(text, query);
    const similarity = 1 - (distance / Math.max(text.length, query.length));
    return similarity >= threshold;
  }

  /**
   * Check if location is in Athens metropolitan area
   */
  private isInAthenMetropolitanArea(location: { lat: number; lng: number }): boolean {
    // Athens metropolitan area rough bounds
    return location.lat >= 37.8 && location.lat <= 38.2 &&
           location.lng >= 23.5 && location.lng <= 24.1;
  }

  /**
   * Check if location is in Thessaloniki area
   */
  private isInThessalonikiArea(location: { lat: number; lng: number }): boolean {
    // Thessaloniki area rough bounds
    return location.lat >= 40.5 && location.lat <= 40.7 &&
           location.lng >= 22.8 && location.lng <= 23.2;
  }

  // ============================================================================
  // PHASE 7.2: CACHE OPTIMIZATION HELPERS
  // ============================================================================

  /**
   * Calculate optimal TTL for cache entry based on result quality και search type
   */
  private calculateOptimalTTL(
    resultCount: number,
    searchType: 'municipality' | 'region' | 'general' | null
  ): number {
    // Base TTL: 30 minutes
    let baseTTL = 30 * 60 * 1000;

    // Adjust based on result quality
    if (resultCount === 0) {
      // No results - shorter TTL (might be temporary issue)
      baseTTL = 10 * 60 * 1000; // 10 minutes
    } else if (resultCount === 1) {
      // Perfect match - longer TTL
      baseTTL = 120 * 60 * 1000; // 2 hours
    } else if (resultCount <= 5) {
      // Good results - standard TTL
      baseTTL = 60 * 60 * 1000; // 1 hour
    }

    // Adjust based on search type specificity
    if (searchType === 'municipality' || searchType === 'region') {
      // Specific searches are more stable - longer TTL
      baseTTL *= 1.5;
    }

    return baseTTL;
  }

  // ============================================================================
  // PHASE 7.3: GEOMETRY SIMPLIFICATION INTEGRATION
  // ============================================================================

  /**
   * Get simplified boundaries optimized για viewport και performance
   */
  public async getSimplifiedBoundaries(
    boundaries: AdminSearchResult[],
    viewport?: ViewportContext
  ): Promise<AdminSearchResult[]> {
    if (!boundaries.length) return [];

    const startTime = performance.now();

    try {
      const simplifiedBoundaries = await Promise.all(
        boundaries.map(async (boundary) => {
          if (!boundary.geometry) return boundary;

          // Apply geometry simplification
          const simplificationResult = geometrySimplificationEngine.simplifyBoundary(
            boundary,
            viewport
          );

          if (simplificationResult) {
            return {
              ...boundary,
              geometry: simplificationResult.simplifiedGeometry,
              // Add simplification metadata
              simplification: {
                originalPoints: simplificationResult.originalPoints,
                simplifiedPoints: simplificationResult.simplifiedPoints,
                reductionRatio: simplificationResult.reductionRatio,
                optimizationLevel: simplificationResult.optimizationLevel,
                qualityScore: simplificationResult.qualityScore
              }
            };
          }

          return boundary;
        })
      );

      const processingTime = performance.now() - startTime;

      console.log(
        `🔧 Batch simplification: ${boundaries.length} boundaries in ${processingTime.toFixed(1)}ms`
      );

      return simplifiedBoundaries;

    } catch (error) {
      console.error('Batch simplification error:', error);
      return boundaries; // Return original on error
    }
  }

  /**
   * Smart search με automatic geometry simplification
   */
  public async smartSearchWithSimplification(
    query: string,
    viewport?: ViewportContext
  ): Promise<{
    results: AdminSearchResult[];
    detectedType: 'municipality' | 'region' | 'general' | null;
    suggestions: string[];
    simplificationStats?: {
      totalBoundaries: number;
      simplifiedBoundaries: number;
      averageReduction: number;
      processingTime: number;
    };
  }> {
    // First get regular search results
    const searchResult = await this.smartSearch(query);

    // Apply simplification if we have results και viewport
    if (searchResult.results.length > 0 && viewport) {
      const startTime = performance.now();
      const simplifiedResults = await this.getSimplifiedBoundaries(
        searchResult.results,
        viewport
      );

      // Calculate simplification statistics
      const simplificationStats = this.calculateSimplificationStats(
        searchResult.results,
        simplifiedResults,
        performance.now() - startTime
      );

      return {
        ...searchResult,
        results: simplifiedResults,
        simplificationStats
      };
    }

    return searchResult;
  }

  /**
   * Calculate simplification statistics για reporting
   */
  private calculateSimplificationStats(
    original: AdminSearchResult[],
    simplified: AdminSearchResult[],
    processingTime: number
  ) {
    let totalOriginalPoints = 0;
    let totalSimplifiedPoints = 0;
    let simplifiedCount = 0;

    for (let i = 0; i < original.length; i++) {
      const orig = original[i];
      const simp = simplified[i];

      if (orig.geometry && simp.simplification) {
        totalOriginalPoints += simp.simplification.originalPoints;
        totalSimplifiedPoints += simp.simplification.simplifiedPoints;
        simplifiedCount++;
      }
    }

    const averageReduction = totalOriginalPoints > 0
      ? ((totalOriginalPoints - totalSimplifiedPoints) / totalOriginalPoints) * 100
      : 0;

    return {
      totalBoundaries: original.length,
      simplifiedBoundaries: simplifiedCount,
      averageReduction: Math.round(averageReduction),
      processingTime: Math.round(processingTime)
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Singleton Administrative Boundary Service instance
 */
export const administrativeBoundaryService = new AdministrativeBoundaryService();

export default administrativeBoundaryService;