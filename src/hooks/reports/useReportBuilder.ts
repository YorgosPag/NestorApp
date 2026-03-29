/**
 * @module hooks/reports/useReportBuilder
 * @enterprise ADR-268 — Dynamic Report Builder State Management Hook
 *
 * Central hook managing domain, columns, filters, execution, AI, and URL state.
 * Follows the established pattern from useFinancialReport/useSalesReport.
 */

'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { getErrorMessage } from '@/lib/error-utils';
import {
  getDomainDefinition,
  getDefaultColumns,
} from '@/config/report-builder/domain-definitions';
import { generateTempId } from '@/services/enterprise-id.service';
import {
  BUILDER_LIMITS,
  encodeBuilderState,
  decodeBuilderState,
  type BuilderDomainId,
  type BuilderQueryRequest,
  type BuilderQueryResponse,
  type AITranslatedQuery,
  type ReportBuilderFilter,
  type DomainDefinition,
} from '@/config/report-builder/report-builder-types';

// ============================================================================
// Types
// ============================================================================

export interface UseReportBuilderReturn {
  // Domain
  domain: BuilderDomainId | null;
  domainDefinition: DomainDefinition | null;
  setDomain: (id: BuilderDomainId) => void;

  // Columns
  columns: string[];
  setColumns: (columns: string[]) => void;
  toggleColumn: (fieldKey: string) => void;
  reorderColumns: (fromIndex: number, toIndex: number) => void;

  // Filters
  filters: ReportBuilderFilter[];
  addFilter: (filter: Omit<ReportBuilderFilter, 'id'>) => void;
  removeFilter: (filterId: string) => void;
  updateFilter: (filterId: string, updates: Partial<Omit<ReportBuilderFilter, 'id'>>) => void;
  clearFilters: () => void;

  // Sort
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
  setSort: (field: string, direction: 'asc' | 'desc') => void;

  // Limit
  limit: number;
  setLimit: (limit: number) => void;

  // Results
  results: BuilderQueryResponse | null;
  loading: boolean;
  error: string | null;

  // Execution
  executeQuery: () => Promise<void>;
  refetch: () => void;

  // AI
  aiLoading: boolean;
  aiResult: AITranslatedQuery | null;
  submitAIQuery: (query: string) => Promise<void>;

  // URL sharing
  shareUrl: string;
}

// ============================================================================
// Cache
// ============================================================================

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CachedResult {
  key: string;
  data: BuilderQueryResponse;
  timestamp: number;
}

// ============================================================================
// Hook
// ============================================================================

export function useReportBuilder(): UseReportBuilderReturn {
  const searchParams = useSearchParams();

  // Restore from URL on mount
  // Initial decode from URL — intentionally runs only on mount
  const initialState = useMemo(() => {
    if (!searchParams) return {};
    return decodeBuilderState(searchParams);
    // eslint-disable-next-line
  }, []);

  // State
  const [domain, setDomainState] = useState<BuilderDomainId | null>(
    initialState.domain ?? null,
  );
  const [columns, setColumnsState] = useState<string[]>(
    initialState.columns ?? [],
  );
  const [filters, setFilters] = useState<ReportBuilderFilter[]>(
    initialState.filters ?? [],
  );
  const [sortField, setSortField] = useState<string | null>(
    initialState.sortField ?? null,
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(
    initialState.sortDirection ?? 'asc',
  );
  const [limit, setLimitState] = useState<number>(
    initialState.limit ?? BUILDER_LIMITS.DEFAULT_ROW_LIMIT,
  );
  const [results, setResults] = useState<BuilderQueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AITranslatedQuery | null>(null);

  // Cache
  const cacheRef = useRef<CachedResult | null>(null);

  // Domain definition
  const domainDefinition = useMemo(
    () => (domain ? getDomainDefinition(domain) : null),
    [domain],
  );

  // ========================================================================
  // Domain
  // ========================================================================

  const setDomain = useCallback((id: BuilderDomainId) => {
    setDomainState(id);
    setColumnsState(getDefaultColumns(id));
    setFilters([]);
    setResults(null);
    setError(null);
    setAiResult(null);

    const def = getDomainDefinition(id);
    setSortField(def.defaultSortField);
    setSortDirection(def.defaultSortDirection);
  }, []);

  // ========================================================================
  // Columns
  // ========================================================================

  const setColumns = useCallback((cols: string[]) => {
    setColumnsState(cols);
  }, []);

  const toggleColumn = useCallback((fieldKey: string) => {
    setColumnsState((prev) =>
      prev.includes(fieldKey)
        ? prev.filter((c) => c !== fieldKey)
        : [...prev, fieldKey],
    );
  }, []);

  const reorderColumns = useCallback((fromIndex: number, toIndex: number) => {
    setColumnsState((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  // ========================================================================
  // Filters
  // ========================================================================

  const addFilter = useCallback(
    (filter: Omit<ReportBuilderFilter, 'id'>) => {
      if (filters.length >= BUILDER_LIMITS.MAX_ACTIVE_FILTERS) return;
      setFilters((prev) => [
        ...prev,
        { ...filter, id: generateTempId() },
      ]);
    },
    [filters.length],
  );

  const removeFilter = useCallback((filterId: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== filterId));
  }, []);

  const updateFilter = useCallback(
    (filterId: string, updates: Partial<Omit<ReportBuilderFilter, 'id'>>) => {
      setFilters((prev) =>
        prev.map((f) => (f.id === filterId ? { ...f, ...updates } : f)),
      );
    },
    [],
  );

  const clearFilters = useCallback(() => {
    setFilters([]);
  }, []);

  // ========================================================================
  // Sort & Limit
  // ========================================================================

  const setSort = useCallback((field: string, direction: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(direction);
  }, []);

  const setLimit = useCallback((newLimit: number) => {
    setLimitState(
      Math.min(Math.max(1, newLimit), BUILDER_LIMITS.MAX_ROW_LIMIT),
    );
  }, []);

  // ========================================================================
  // Query Execution
  // ========================================================================

  const buildCacheKey = useCallback((): string => {
    return JSON.stringify({ domain, filters, columns, sortField, sortDirection, limit });
  }, [domain, filters, columns, sortField, sortDirection, limit]);

  const executeQuery = useCallback(async () => {
    if (!domain || columns.length === 0) return;

    // Check cache
    const cacheKey = buildCacheKey();
    if (cacheRef.current && cacheRef.current.key === cacheKey) {
      if (Date.now() - cacheRef.current.timestamp < CACHE_TTL) {
        setResults(cacheRef.current.data);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const request: BuilderQueryRequest = {
        domain,
        filters,
        columns,
        sortField: sortField ?? undefined,
        sortDirection,
        limit,
      };

      const response = await apiClient.post<BuilderQueryResponse>(
        '/api/reports/builder',
        request,
      );

      setResults(response);
      cacheRef.current = { key: cacheKey, data: response, timestamp: Date.now() };
    } catch (err) {
      setError(getErrorMessage(err));
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, [domain, filters, columns, sortField, sortDirection, limit, buildCacheKey]);

  const refetch = useCallback(() => {
    cacheRef.current = null;
    executeQuery();
  }, [executeQuery]);

  // ========================================================================
  // AI Query
  // ========================================================================

  const submitAIQuery = useCallback(async (query: string) => {
    setAiLoading(true);
    setAiResult(null);
    setError(null);

    try {
      const result = await apiClient.post<AITranslatedQuery>(
        '/api/reports/builder/ai',
        { query, locale: 'el' },
      );

      setAiResult(result);

      // Auto-populate builder state
      setDomainState(result.domain);
      setColumnsState(result.columns);
      setFilters(result.filters);

      const def = getDomainDefinition(result.domain);
      setSortField(def.defaultSortField);
      setSortDirection(def.defaultSortDirection);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setAiLoading(false);
    }
  }, []);

  // ========================================================================
  // URL State Sync
  // ========================================================================

  const shareUrl = useMemo(() => {
    if (!domain) return '';
    const qs = encodeBuilderState(
      domain, filters, columns, sortField ?? undefined, sortDirection, limit,
    );
    if (typeof window === 'undefined') return `?${qs}`;
    return `${window.location.origin}${window.location.pathname}?${qs}`;
  }, [domain, filters, columns, sortField, sortDirection, limit]);

  // Sync URL on state change (without navigation)
  useEffect(() => {
    if (!domain || typeof window === 'undefined') return;
    const qs = encodeBuilderState(
      domain, filters, columns, sortField ?? undefined, sortDirection, limit,
    );
    window.history.replaceState(null, '', `?${qs}`);
  }, [domain, filters, columns, sortField, sortDirection, limit]);

  // ========================================================================
  // Return
  // ========================================================================

  return {
    domain,
    domainDefinition,
    setDomain,
    columns,
    setColumns,
    toggleColumn,
    reorderColumns,
    filters,
    addFilter,
    removeFilter,
    updateFilter,
    clearFilters,
    sortField,
    sortDirection,
    setSort,
    limit,
    setLimit,
    results,
    loading,
    error,
    executeQuery,
    refetch,
    aiLoading,
    aiResult,
    submitAIQuery,
    shareUrl,
  };
}
