/**
 * 🗺️ USE ADMINISTRATIVE BOUNDARIES HOOK - Phase 4.3
 *
 * React hook για αναζήτηση/φόρτωση ελληνικών διοικητικών ορίων
 * με caching, smart suggestions και enterprise analytics.
 *
 * @module hooks/useAdministrativeBoundaries
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { administrativeBoundaryService } from '../services/administrative-boundaries/AdministrativeBoundaryService';
import { searchHistoryService } from '../services/administrative-boundaries/SearchHistoryService';
import { adminBoundariesCache } from '../services/cache/AdminBoundariesCacheManager';
import type {
  AdminSearchResult,
  AdminSearchQuery,
  AdvancedSearchFilters,
  BoundingBox,
  SearchHistoryEntry,
  SearchAnalytics
} from '../types/administrative-types';

type AdminBoundary = GeoJSON.Feature | GeoJSON.FeatureCollection;

export interface UseAdministrativeBoundariesOptions {
  autoPreload?: boolean;
  cacheResults?: boolean;
  maxResults?: number;
}

export interface UseAdministrativeBoundariesReturn {
  isLoading: boolean;
  error: string | null;
  searchResults: AdminSearchResult[];
  currentBoundary: AdminBoundary | null;
  detectedType: 'municipality' | 'region' | 'general' | null;
  suggestions: string[];

  smartSearch: (query: string) => Promise<void>;
  getMunicipalityBoundary: (name: string) => Promise<AdminBoundary | null>;
  getRegionBoundary: (name: string) => Promise<AdminBoundary | null>;
  advancedSearch: (query: AdminSearchQuery) => Promise<void>;
  advancedSearchWithFilters: (query: string, filters: AdvancedSearchFilters) => Promise<void>;
  searchPostalCodes: (query: string) => Promise<void>;
  getPostalCodeBoundary: (code: string) => Promise<AdminBoundary | null>;
  getPostalCodesInBounds: (bbox: BoundingBox) => Promise<AdminBoundary | null>;

  clearResults: () => void;
  getCacheStats: () => ReturnType<typeof adminBoundariesCache.getStatistics>;
  getHistory: () => SearchHistoryEntry[];
  getAnalytics: () => SearchAnalytics;
}

export function useAdministrativeBoundaries(
  options: UseAdministrativeBoundariesOptions = {}
): UseAdministrativeBoundariesReturn {
  const { autoPreload = false, cacheResults = true, maxResults = 10 } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<AdminSearchResult[]>([]);
  const [currentBoundary, setCurrentBoundary] = useState<AdminBoundary | null>(null);
  const [detectedType, setDetectedType] = useState<'municipality' | 'region' | 'general' | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const lastQueryRef = useRef<string>('');

  useEffect(() => {
    if (!autoPreload) return;
    void administrativeBoundaryService.preloadPopularBoundaries();
  }, [autoPreload]);

  const updateSuggestions = useCallback((query: string, fallback: string[] = []) => {
    const historySuggestions = searchHistoryService.getSmartSuggestions(
      query,
      'administrative',
      Math.max(0, maxResults)
    );
    const merged = [...historySuggestions, ...fallback]
      .filter((item, index, arr) => arr.indexOf(item) === index)
      .slice(0, maxResults);
    setSuggestions(merged);
  }, [maxResults]);

  const smartSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      clearResults();
      return;
    }

    setIsLoading(true);
    setError(null);
    lastQueryRef.current = trimmed;

    try {
      const result = await administrativeBoundaryService.smartSearch(trimmed);
      const limitedResults = result.results.slice(0, maxResults);

      setSearchResults(limitedResults);
      setDetectedType(result.detectedType);
      updateSuggestions(trimmed, result.suggestions);

      if (cacheResults) {
        searchHistoryService.addToHistory(
          trimmed,
          'administrative',
          limitedResults[0] ?? null
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setSearchResults([]);
      setDetectedType(null);
      updateSuggestions(trimmed, []);
    } finally {
      setIsLoading(false);
    }
  }, [cacheResults, maxResults, updateSuggestions]);

  const getMunicipalityBoundary = useCallback(async (name: string) => {
    if (!name.trim()) return null;
    setIsLoading(true);
    setError(null);
    try {
      const boundary = await administrativeBoundaryService.getMunicipalityBoundary(name);
      setCurrentBoundary(boundary);
      return boundary;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getRegionBoundary = useCallback(async (name: string) => {
    if (!name.trim()) return null;
    setIsLoading(true);
    setError(null);
    try {
      const boundary = await administrativeBoundaryService.getRegionBoundary(name);
      setCurrentBoundary(boundary);
      return boundary;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const advancedSearch = useCallback(async (query: AdminSearchQuery) => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await administrativeBoundaryService.advancedSearch(query);
      setSearchResults(results.slice(0, maxResults));
      updateSuggestions(query.query, []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [maxResults, updateSuggestions]);

  const advancedSearchWithFilters = useCallback(async (query: string, filters: AdvancedSearchFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await administrativeBoundaryService.advancedSearchWithFilters(query, filters);
      setSearchResults(results.slice(0, maxResults));
      updateSuggestions(query, []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [maxResults, updateSuggestions]);

  const searchPostalCodes = useCallback(async (query: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await administrativeBoundaryService.searchPostalCodes(query);
      setSearchResults(results.slice(0, maxResults));
      updateSuggestions(query, []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [maxResults, updateSuggestions]);

  const getPostalCodeBoundary = useCallback(async (code: string) => {
    if (!code.trim()) return null;
    setIsLoading(true);
    setError(null);
    try {
      const boundary = await administrativeBoundaryService.getPostalCodeBoundary(code);
      setCurrentBoundary(boundary);
      return boundary;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getPostalCodesInBounds = useCallback(async (bbox: BoundingBox) => {
    setIsLoading(true);
    setError(null);
    try {
      const boundary = await administrativeBoundaryService.getPostalCodesInBounds(bbox);
      setCurrentBoundary(boundary);
      return boundary;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setSearchResults([]);
    setDetectedType(null);
    setSuggestions([]);
    setError(null);
  }, []);

  const getCacheStats = useCallback(() => adminBoundariesCache.getStatistics(), []);
  const getHistory = useCallback(() => searchHistoryService.getHistory(), []);
  const getAnalytics = useCallback(() => searchHistoryService.getAnalytics(), []);

  return {
    isLoading,
    error,
    searchResults,
    currentBoundary,
    detectedType,
    suggestions,
    smartSearch,
    getMunicipalityBoundary,
    getRegionBoundary,
    advancedSearch,
    advancedSearchWithFilters,
    searchPostalCodes,
    getPostalCodeBoundary,
    getPostalCodesInBounds,
    clearResults,
    getCacheStats,
    getHistory,
    getAnalytics
  };
}

export default useAdministrativeBoundaries;
