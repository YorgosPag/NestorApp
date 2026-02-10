/**
 * =============================================================================
 * 🔍 GLOBAL SEARCH HOOK
 * =============================================================================
 *
 * React hook for Global Search API integration.
 * Provides debounced search with loading states and error handling.
 *
 * @module hooks/useGlobalSearch
 * @enterprise ADR-029 - Global Search v1
 * @compliance Local_Protocol.txt - ZERO any, Centralization First
 */

"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import {
  SEARCH_CONFIG,
  type SearchResult,
  type SearchEntityType,
} from '@/types/search';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('useGlobalSearch');

// =============================================================================
// TYPES
// =============================================================================

/**
 * Hook configuration options.
 */
interface UseGlobalSearchOptions {
  /** Custom debounce delay (ms). Default: SEARCH_CONFIG.DEBOUNCE_MS */
  debounceMs?: number;

  /** Maximum results per entity type. Default: SEARCH_CONFIG.DEFAULT_LIMIT */
  limit?: number;

  /** Filter by specific entity types */
  types?: SearchEntityType[];

  /** Callback when search completes successfully */
  onSuccess?: (results: SearchResult[]) => void;

  /** Callback when search fails */
  onError?: (error: string) => void;
}

/**
 * Hook return value.
 */
interface UseGlobalSearchReturn {
  /** Current search query */
  query: string;

  /** Set search query (triggers debounced search) */
  setQuery: (query: string) => void;

  /** Search results */
  results: SearchResult[];

  /** Results grouped by entity type */
  groupedResults: Map<SearchEntityType, SearchResult[]>;

  /** Loading state */
  isLoading: boolean;

  /** Error message if any */
  error: string | null;

  /** Execute search immediately (bypass debounce) */
  searchNow: (query: string) => Promise<void>;

  /** Clear search results */
  clear: () => void;

  /** Total result count */
  totalResults: number;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Group search results by entity type.
 */
function groupResultsByType(results: SearchResult[]): Map<SearchEntityType, SearchResult[]> {
  const grouped = new Map<SearchEntityType, SearchResult[]>();

  for (const result of results) {
    const existing = grouped.get(result.entityType) || [];
    grouped.set(result.entityType, [...existing, result]);
  }

  return grouped;
}

/**
 * Build search API query parameters.
 */
function buildSearchParams(
  query: string,
  limit: number,
  types?: SearchEntityType[]
): Record<string, string> {
  const params: Record<string, string> = {
    q: query,
    limit: limit.toString(),
  };

  if (types && types.length > 0) {
    params.types = types.join(',');
  }

  return params;
}

/**
 * Response type from search API (matches canonical format)
 */
interface SearchApiResponse {
  results: SearchResult[];
  query: {
    normalized: string;
    types?: SearchEntityType[];
  };
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * Global Search hook with debouncing, loading states, and error handling.
 *
 * @example
 * ```tsx
 * const { query, setQuery, results, isLoading, error } = useGlobalSearch({
 *   debounceMs: 300,
 *   limit: 10,
 *   onSuccess: (results) => logger.info('Found:', { data: results.length }),
 * });
 *
 * return (
 *   <input
 *     value={query}
 *     onChange={(e) => setQuery(e.target.value)}
 *     placeholder="Search..."
 *   />
 * );
 * ```
 */
export function useGlobalSearch(
  options: UseGlobalSearchOptions = {}
): UseGlobalSearchReturn {
  const {
    debounceMs = SEARCH_CONFIG.DEBOUNCE_MS,
    limit = SEARCH_CONFIG.DEFAULT_LIMIT,
    types,
    onSuccess,
    onError,
  } = options;

  // === State ===
  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // === Refs ===
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRequestRef = useRef<number>(0);

  // === Computed ===
  const groupedResults = groupResultsByType(results);
  const totalResults = results.length;

  /**
   * Execute search API call.
   * Uses enterprise API client with automatic Bearer token injection.
   */
  const executeSearch = useCallback(
    async (searchQuery: string) => {
      // Skip if query too short
      if (searchQuery.length < SEARCH_CONFIG.MIN_QUERY_LENGTH) {
        setResults([]);
        setError(null);
        return;
      }

      // Track this request to handle race conditions
      const requestId = Date.now();
      latestRequestRef.current = requestId;

      setIsLoading(true);
      setError(null);

      try {
        // 🏢 ENTERPRISE: Use apiClient with automatic Bearer token
        const params = buildSearchParams(searchQuery, limit, types);
        const response = await apiClient.get<SearchApiResponse>('/api/search', { params });

        // Check if this is still the latest request (handle race conditions)
        if (latestRequestRef.current !== requestId) {
          return;
        }

        setResults(response.results);
        setError(null);
        onSuccess?.(response.results);
      } catch (err) {
        // Check if this is still the latest request
        if (latestRequestRef.current !== requestId) {
          return;
        }

        // Handle API client errors
        let errorMessage = 'Search failed';
        if (ApiClientError.isApiClientError(err)) {
          errorMessage = err.message;
        } else if (err instanceof Error) {
          errorMessage = err.message;
        }

        setResults([]);
        setError(errorMessage);
        onError?.(errorMessage);
      } finally {
        // Only update loading state if this is the latest request
        if (latestRequestRef.current === requestId) {
          setIsLoading(false);
        }
      }
    },
    [limit, types, onSuccess, onError]
  );

  /**
   * Set query with debouncing.
   */
  const setQuery = useCallback(
    (newQuery: string) => {
      setQueryState(newQuery);

      // Clear previous timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new timer
      debounceTimerRef.current = setTimeout(() => {
        executeSearch(newQuery);
      }, debounceMs);
    },
    [debounceMs, executeSearch]
  );

  /**
   * Execute search immediately (bypass debounce).
   */
  const searchNow = useCallback(
    async (searchQuery: string) => {
      setQueryState(searchQuery);

      // Clear debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      await executeSearch(searchQuery);
    },
    [executeSearch]
  );

  /**
   * Clear search results.
   */
  const clear = useCallback(() => {
    setQueryState('');
    setResults([]);
    setError(null);

    // Clear timer and invalidate pending requests
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    latestRequestRef.current = Date.now(); // Invalidate any pending requests
  }, []);

  // === Cleanup on unmount ===
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      // Invalidate any pending requests on unmount
      latestRequestRef.current = Date.now();
    };
  }, []);

  return {
    query,
    setQuery,
    results,
    groupedResults,
    isLoading,
    error,
    searchNow,
    clear,
    totalResults,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { UseGlobalSearchOptions, UseGlobalSearchReturn };
