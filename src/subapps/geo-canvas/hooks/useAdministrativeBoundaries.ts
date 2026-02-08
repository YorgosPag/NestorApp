/**
 * 🏛️ USE ADMINISTRATIVE BOUNDARIES HOOK - Phase 4.3
 *
 * React hook για εύκολη χρήση των Greek administrative boundaries
 * Centralized state management και caching για boundaries
 *
 * @module hooks/useAdministrativeBoundaries
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { administrativeBoundaryService } from '../services/administrative-boundaries/AdministrativeBoundaryService';
import { searchHistoryService } from '../services/administrative-boundaries/SearchHistoryService';
import { GreekAdminLevel } from '../types/administrative-types';
import type {
  AdminSearchResult,
  AdminSearchQuery,
  AdvancedSearchFilters,
  BoundingBox,
  SearchHistoryEntry,
  SearchAnalytics
} from '../types/administrative-types';

// ✅ ENTERPRISE: GeoJSON type declarations for administrative boundaries

type AdminPosition = [number, number] | [number, number, number];
type AdminCoordinates =
  | AdminPosition
  | AdminPosition[]
  | AdminPosition[][]
  | AdminPosition[][][];

type AdminGeometry = {
  type: string;
  coordinates?: AdminCoordinates;
};

type AdminFeature = {
  type: 'Feature';
  geometry: AdminGeometry | null;
  properties: Record<string, unknown> | null;
  id?: string | number;
};

type AdminFeatureCollection = {
  type: 'FeatureCollection';
  features: AdminFeature[];
};

// ============================================================================
// HOOK TYPES
// ============================================================================

interface UseAdministrativeBoundariesOptions {
  autoPreload?: boolean;           // Preload popular boundaries
  cacheResults?: boolean;          // Cache search results
  debounceMs?: number;             // Search debounce delay
  maxResults?: number;             // Maximum search results
  enableHistory?: boolean;         // Enable search history tracking
  enableHistorySuggestions?: boolean;    // Enable history-based suggestions
}

interface UseAdministrativeBoundariesReturn {
  // State
  isLoading: boolean;
  error: string | null;
  searchResults: AdminSearchResult[];
  currentBoundary: AdminFeature | AdminFeatureCollection | null;
  detectedType: 'municipality' | 'region' | 'general' | null;
  suggestions: string[];
  searchHistory: SearchHistoryEntry[];
  historySuggestions: string[];

  // Actions
  smartSearch: (query: string) => Promise<void>;
  advancedSearch: (query: AdminSearchQuery) => Promise<void>;
  advancedSearchWithFilters: (query: string, filters: AdvancedSearchFilters) => Promise<AdminSearchResult[]>;
  getMunicipalityBoundary: (name: string) => Promise<AdminFeature | null>;
  getRegionBoundary: (name: string) => Promise<AdminFeature | null>;
  getMunicipalitiesInRegion: (regionName: string) => Promise<AdminFeatureCollection | null>;

  // Phase 6: Postal Code Support
  searchPostalCodes: (searchTerm: string) => Promise<AdminSearchResult[]>;
  getPostalCodeBoundary: (postalCode: string) => Promise<AdminFeature | null>;
  getPostalCodesInMunicipality: (municipalityName: string) => Promise<AdminFeatureCollection | null>;
  getPostalCodesInBounds: (bounds: BoundingBox) => Promise<AdminFeatureCollection | null>;

  clearResults: () => void;
  clearCache: () => void;

  // Phase 6: Search History Methods
  selectSearchResult: (result: AdminSearchResult, originalQuery?: string) => void;
  getRecentSearches: (limit?: number) => SearchHistoryEntry[];
  getPopularQueries: (limit?: number) => Array<{ query: string; count: number; lastUsed: number }>;
  clearSearchHistory: () => void;
  exportSearchHistory: () => SearchHistoryExport;
  importSearchHistory: (data: SearchHistoryExport) => { imported: number; skipped: number };

  // Utilities
  isWithinGreece: (lat: number, lng: number) => boolean;
  calculateCenter: (geometry: AdminGeometry) => [number, number] | null;
  getCacheStats: () => CacheStats;
}

/** Cache statistics interface */
interface CacheStats {
  totalEntries: number;
  validEntries: number;
  expiredEntries: number;
  cacheExpiryHours: number;
  searchCacheEntries?: number;
  [key: string]: unknown;
}

/** Search history export format */
interface SearchHistoryExport {
  version: string;
  exportedAt: number;
  history: SearchHistoryEntry[];
  analytics: SearchAnalytics;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useAdministrativeBoundaries(
  options: UseAdministrativeBoundariesOptions = {}
): UseAdministrativeBoundariesReturn {

  const {
    autoPreload = false,
    cacheResults = true,
    debounceMs = 300,
    maxResults = 10,
    enableHistory = true,
    enableHistorySuggestions = true
  } = options;

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<AdminSearchResult[]>([]);
  const [currentBoundary, setCurrentBoundary] = useState<AdminFeature | AdminFeatureCollection | null>(null);
  const [detectedType, setDetectedType] = useState<'municipality' | 'region' | 'general' | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]);
  const [historySuggestions, setHistorySuggestions] = useState<string[]>([]);

  // Refs για debouncing και caching
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const searchCacheRef = useRef<Map<string, {
    results: AdminSearchResult[];
    detectedType: 'municipality' | 'region' | 'general' | null;
    suggestions: string[];
    timestamp: number;
  }>>(new Map());

  // ============================================================================
  // SEARCH METHODS
  // ============================================================================

  /**
   * Smart search με debouncing και caching
   */
  const smartSearch = useCallback(async (query: string): Promise<void> => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setDetectedType(null);
      setSuggestions([]);
      return;
    }

    // Clear previous debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Check cache first (if enabled)
    if (cacheResults) {
      const cached = searchCacheRef.current.get(query.toLowerCase());
      const cacheExpiryMs = 30 * 60 * 1000; // 30 minutes

      if (cached && Date.now() - cached.timestamp < cacheExpiryMs) {
        console.log('📦 Using cached search results:', query);
        setSearchResults(cached.results.slice(0, maxResults));
        setDetectedType(cached.detectedType);
        setSuggestions(cached.suggestions);
        return;
      }
    }

    // Debounced search
    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('🔍 Smart searching:', query);

        const result = await administrativeBoundaryService.smartSearch(query);

        const limitedResults = result.results.slice(0, maxResults);

        setSearchResults(limitedResults);
        setDetectedType(result.detectedType);
        setSuggestions(result.suggestions);

        // Cache results (if enabled)
        if (cacheResults) {
          searchCacheRef.current.set(query.toLowerCase(), {
            results: result.results,
            detectedType: result.detectedType,
            suggestions: result.suggestions,
            timestamp: Date.now()
          });
        }

        console.log(`✅ Found ${limitedResults.length} results, type: ${result.detectedType}`);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Search failed';
        setError(errorMessage);
        console.error('Smart search error:', err);

        setSearchResults([]);
        setDetectedType(null);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);
  }, [cacheResults, debounceMs, maxResults]);

  /**
   * Advanced search με filters
   */
  const advancedSearch = useCallback(async (query: AdminSearchQuery): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🔍 Advanced searching:', query);

      const results = await administrativeBoundaryService.advancedSearch(query);
      const limitedResults = results.slice(0, maxResults);

      setSearchResults(limitedResults);
      setDetectedType(null); // Advanced search doesn't detect type
      setSuggestions([]);

      console.log(`✅ Advanced search found ${limitedResults.length} results`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Advanced search failed';
      setError(errorMessage);
      console.error('Advanced search error:', err);

      setSearchResults([]);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [maxResults]);

  /**
   * Enhanced advanced search με comprehensive filters (Phase 6.3)
   */
  const advancedSearchWithFilters = useCallback(async (
    query: string,
    filters: AdvancedSearchFilters
  ): Promise<AdminSearchResult[]> => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🔍 Enhanced advanced search with filters:', { query, filters });

      const results = await administrativeBoundaryService.advancedSearchWithFilters(query, filters);

      // Update search results state
      setSearchResults(results.slice(0, maxResults));
      setDetectedType(null); // Advanced search doesn't detect type
      setSuggestions([]);

      // Add to search history if enabled
      if (enableHistory && results.length > 0) {
        const searchType: 'address' | 'administrative' | 'postal_code' =
          filters.adminLevels?.includes(GreekAdminLevel.POSTAL_CODE) ? 'postal_code' : 'administrative';

        searchHistoryService.addToHistory(query, searchType, results);

        // Update local history state
        const updatedHistory = searchHistoryService.getRecentSearches(20);
        setSearchHistory(updatedHistory);
      }

      console.log(`✅ Enhanced advanced search found ${results.length} results`);

      return results;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Enhanced advanced search failed';
      setError(errorMessage);
      console.error('Enhanced advanced search error:', err);

      setSearchResults([]);
      setSuggestions([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [maxResults, enableHistory]);

  // ============================================================================
  // BOUNDARY FETCHING METHODS
  // ============================================================================

  /**
   * Get municipality boundary
   */
  const getMunicipalityBoundary = useCallback(async (name: string): Promise<AdminFeature | null> => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🏛️ Fetching municipality boundary:', name);

      const boundary = await administrativeBoundaryService.getMunicipalityBoundary(name);

      if (boundary) {
        setCurrentBoundary(boundary);
        console.log('✅ Municipality boundary loaded:', name);
      } else {
        setError(`Municipality boundary not found: ${name}`);
      }

      return boundary;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch municipality boundary';
      setError(errorMessage);
      console.error('Municipality boundary error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get region boundary
   */
  const getRegionBoundary = useCallback(async (name: string): Promise<AdminFeature | null> => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🗺️ Fetching region boundary:', name);

      const boundary = await administrativeBoundaryService.getRegionBoundary(name);

      if (boundary) {
        setCurrentBoundary(boundary);
        console.log('✅ Region boundary loaded:', name);
      } else {
        setError(`Region boundary not found: ${name}`);
      }

      return boundary;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch region boundary';
      setError(errorMessage);
      console.error('Region boundary error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get municipalities σε region
   */
  const getMunicipalitiesInRegion = useCallback(async (regionName: string): Promise<AdminFeatureCollection | null> => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🏛️ Fetching municipalities in region:', regionName);

      const municipalities = await administrativeBoundaryService.getMunicipalitiesInRegion(regionName);

      if (municipalities) {
        setCurrentBoundary(municipalities);
        console.log(`✅ Loaded ${municipalities.features.length} municipalities in ${regionName}`);
      } else {
        setError(`Municipalities not found for region: ${regionName}`);
      }

      return municipalities;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch municipalities in region';
      setError(errorMessage);
      console.error('Municipalities in region error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================================================
  // PHASE 6: POSTAL CODE METHODS
  // ============================================================================

  /**
   * Search postal codes by partial code (e.g., "151" για all 151XX codes)
   */
  const searchPostalCodes = useCallback(async (searchTerm: string): Promise<AdminSearchResult[]> => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('📮 Searching postal codes:', searchTerm);

      const results = await administrativeBoundaryService.searchPostalCodes(searchTerm);

      console.log(`✅ Found ${results.length} postal code results`);
      return results;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Postal code search failed';
      setError(errorMessage);
      console.error('Postal code search error:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get postal code boundary by 5-digit code
   */
  const getPostalCodeBoundary = useCallback(async (postalCode: string): Promise<AdminFeature | null> => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('📮 Fetching postal code boundary:', postalCode);

      const boundary = await administrativeBoundaryService.getPostalCodeBoundary(postalCode);

      if (boundary) {
        setCurrentBoundary(boundary);
        console.log('✅ Postal code boundary loaded:', postalCode);
      } else {
        setError(`Postal code boundary not found: ${postalCode}`);
      }

      return boundary;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch postal code boundary';
      setError(errorMessage);
      console.error('Postal code boundary error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get all postal codes σε specific municipality
   */
  const getPostalCodesInMunicipality = useCallback(async (municipalityName: string): Promise<AdminFeatureCollection | null> => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('📮 Fetching postal codes in municipality:', municipalityName);

      const postalCodes = await administrativeBoundaryService.getPostalCodesInMunicipality(municipalityName);

      if (postalCodes) {
        setCurrentBoundary(postalCodes);
        console.log(`✅ Loaded ${postalCodes.features.length} postal codes in ${municipalityName}`);
      } else {
        setError(`Postal codes not found for municipality: ${municipalityName}`);
      }

      return postalCodes;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch postal codes in municipality';
      setError(errorMessage);
      console.error('Postal codes in municipality error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get postal codes in geographic bounding box
   */
  const getPostalCodesInBounds = useCallback(async (bounds: BoundingBox): Promise<AdminFeatureCollection | null> => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('📮 Fetching postal codes in bounds:', bounds);

      const postalCodes = await administrativeBoundaryService.getPostalCodesInBounds(bounds);

      if (postalCodes) {
        setCurrentBoundary(postalCodes);
        console.log(`✅ Loaded ${postalCodes.features.length} postal codes in bounding box`);
      } else {
        setError('Postal codes not found in the specified area');
      }

      return postalCodes;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch postal codes in bounds';
      setError(errorMessage);
      console.error('Postal codes in bounds error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Clear search results
   */
  const clearResults = useCallback(() => {
    setSearchResults([]);
    setCurrentBoundary(null);
    setDetectedType(null);
    setSuggestions([]);
    setError(null);

    // Clear search cache
    searchCacheRef.current.clear();

    console.log('🧹 Cleared administrative boundary results');
  }, []);

  /**
   * Clear all caches
   */
  const clearCache = useCallback(() => {
    administrativeBoundaryService.clearCache();
    searchCacheRef.current.clear();
    console.log('🧹 Cleared administrative boundary caches');
  }, []);

  /**
   * Check if coordinates are within Greece
   */
  const isWithinGreece = useCallback((lat: number, lng: number): boolean => {
    return administrativeBoundaryService.isWithinGreece(lat, lng);
  }, []);

  /**
   * Calculate center από boundary geometry
   */
  const calculateCenter = useCallback((geometry: AdminGeometry): [number, number] | null => {
    return administrativeBoundaryService.calculateBoundaryCenter(geometry);
  }, []);

  /**
   * Get cache statistics
   */
  const getCacheStats = useCallback(() => {
    const serviceStats = administrativeBoundaryService.getCacheStats();
    const searchCacheSize = searchCacheRef.current.size;

    return {
      ...serviceStats,
      searchCacheEntries: searchCacheSize,
      totalCacheEntries: serviceStats.totalEntries + searchCacheSize
    };
  }, []);

  // ============================================================================
  // PHASE 6: SEARCH HISTORY METHODS
  // ============================================================================

  /**
   * Select search result and add to history
   */
  const selectSearchResult = useCallback((result: AdminSearchResult, originalQuery?: string) => {
    if (!enableHistory) return;

    const searchType: 'address' | 'administrative' | 'postal_code' =
      result.adminLevel === GreekAdminLevel.POSTAL_CODE ? 'postal_code' : 'administrative';

    const entry = searchHistoryService.addToHistory(
      originalQuery || result.name,
      searchType,
      [result],
      result
    );

    // Update local history state
    const updatedHistory = searchHistoryService.getRecentSearches(20);
    setSearchHistory(updatedHistory);

    console.log(`📚 Selected result added to history: ${result.name}`);
  }, [enableHistory]);

  /**
   * Get recent searches from history
   */
  const getRecentSearches = useCallback((limit = 10): SearchHistoryEntry[] => {
    return searchHistoryService.getRecentSearches(limit);
  }, []);

  /**
   * Get popular queries from history
   */
  const getPopularQueries = useCallback((limit = 5) => {
    return searchHistoryService.getPopularQueries(limit);
  }, []);

  /**
   * Clear all search history
   */
  const clearSearchHistory = useCallback(() => {
    searchHistoryService.clearHistory();
    setSearchHistory([]);
    setHistorySuggestions([]);
    console.log('📚 Search history cleared');
  }, []);

  /**
   * Export search history
   */
  const exportSearchHistory = useCallback(() => {
    return searchHistoryService.exportHistory();
  }, []);

  /**
   * Import search history
   */
  const importSearchHistory = useCallback((data: SearchHistoryExport) => {
    const result = searchHistoryService.importHistory(data);

    // Refresh local state
    const updatedHistory = searchHistoryService.getRecentSearches(20);
    setSearchHistory(updatedHistory);

    return result;
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  /**
   * Initialize search history on mount
   */
  useEffect(() => {
    if (enableHistory) {
      const history = searchHistoryService.getRecentSearches(20);
      setSearchHistory(history);

      if (enableHistorySuggestions) {
        const popular = searchHistoryService.getPopularQueries(5);
        setHistorySuggestions(popular.map(p => p.query));
      }

      console.log('📚 Search history initialized');
    }
  }, [enableHistory, enableHistorySuggestions]);

  /**
   * Auto-preload popular boundaries on mount
   */
  useEffect(() => {
    if (autoPreload) {
      console.log('🚀 Auto-preloading popular boundaries...');
      administrativeBoundaryService.preloadPopularBoundaries().catch(error => {
        console.warn('Preload failed:', error);
      });
    }
  }, [autoPreload]);

  /**
   * Cleanup timeouts on unmount
   */
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Log search results για debugging (development only)
   */
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && searchResults.length > 0) {
      console.log('📊 Administrative search stats:', {
        resultsCount: searchResults.length,
        detectedType,
        suggestionsCount: suggestions.length,
        firstResult: searchResults[0]?.name
      });
    }
  }, [searchResults, detectedType, suggestions]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // State
    isLoading,
    error,
    searchResults,
    currentBoundary,
    detectedType,
    suggestions,
    searchHistory,
    historySuggestions,

    // Actions
    smartSearch,
    advancedSearch,
    advancedSearchWithFilters,
    getMunicipalityBoundary,
    getRegionBoundary,
    getMunicipalitiesInRegion,

    // Phase 6: Postal Code Support
    searchPostalCodes,
    getPostalCodeBoundary,
    getPostalCodesInMunicipality,
    getPostalCodesInBounds,

    clearResults,
    clearCache,

    // Phase 6: Search History Methods
    selectSearchResult,
    getRecentSearches,
    getPopularQueries,
    clearSearchHistory,
    exportSearchHistory,
    importSearchHistory,

    // Utilities
    isWithinGreece,
    calculateCenter,
    getCacheStats
  };
}

// ============================================================================
// CONVENIENCE HOOKS
// ============================================================================

/**
 * Hook για municipality-only search
 */
export function useMunicipalityBoundaries(options: UseAdministrativeBoundariesOptions = {}) {
  const boundaries = useAdministrativeBoundaries(options);

  const searchMunicipalities = useCallback(async (query: string) => {
    return boundaries.advancedSearch({
      query,
      adminLevel: GreekAdminLevel.MUNICIPALITY
    });
  }, [boundaries]);

  return {
    ...boundaries,
    searchMunicipalities,
    getMunicipalityBoundary: boundaries.getMunicipalityBoundary
  };
}

/**
 * Hook για region-only search
 */
export function useRegionBoundaries(options: UseAdministrativeBoundariesOptions = {}) {
  const boundaries = useAdministrativeBoundaries(options);

  const searchRegions = useCallback(async (query: string) => {
    return boundaries.advancedSearch({
      query,
      adminLevel: GreekAdminLevel.REGION
    });
  }, [boundaries]);

  return {
    ...boundaries,
    searchRegions,
    getRegionBoundary: boundaries.getRegionBoundary
  };
}

/**
 * Hook για postal code-only search (Phase 6)
 */
export function usePostalCodeBoundaries(options: UseAdministrativeBoundariesOptions = {}) {
  const boundaries = useAdministrativeBoundaries(options);

  const searchPostalCodesOnly = useCallback(async (query: string) => {
    return boundaries.advancedSearch({
      query,
      adminLevel: GreekAdminLevel.POSTAL_CODE
    });
  }, [boundaries]);

  return {
    ...boundaries,
    searchPostalCodesOnly,
    searchPostalCodes: boundaries.searchPostalCodes,
    getPostalCodeBoundary: boundaries.getPostalCodeBoundary,
    getPostalCodesInMunicipality: boundaries.getPostalCodesInMunicipality,
    getPostalCodesInBounds: boundaries.getPostalCodesInBounds
  };
}

/**
 * Hook για quick boundary access (με preloading)
 */
export function useQuickBoundaries() {
  return useAdministrativeBoundaries({
    autoPreload: true,
    cacheResults: true,
    debounceMs: 200,
    maxResults: 5
  });
}

export default useAdministrativeBoundaries;
