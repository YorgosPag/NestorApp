/**
 * @module hooks/reports/useReportBuilder
 * @enterprise ADR-268 — Dynamic Report Builder State Management Hook
 *
 * Central hook managing domain, columns, filters, execution, AI, URL state,
 * and Phase 2 grouping (via useReportGrouping composition).
 */

'use client';

import { useState, useCallback, useRef, useMemo, useEffect, type Dispatch, type SetStateAction } from 'react';
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
import type { SavedReport, SavedReportConfig } from '@/types/reports/saved-report';
import { useReportGrouping, type UseReportGroupingReturn } from './useReportGrouping';

// ============================================================================
// Types
// ============================================================================

export interface UseReportBuilderReturn extends UseReportGroupingReturn {
  domain: BuilderDomainId | null;
  domainDefinition: DomainDefinition | null;
  setDomain: (id: BuilderDomainId) => void;
  columns: string[];
  setColumns: (columns: string[]) => void;
  toggleColumn: (fieldKey: string) => void;
  reorderColumns: (fromIndex: number, toIndex: number) => void;
  filters: ReportBuilderFilter[];
  addFilter: (filter: Omit<ReportBuilderFilter, 'id'>) => void;
  removeFilter: (filterId: string) => void;
  updateFilter: (filterId: string, updates: Partial<Omit<ReportBuilderFilter, 'id'>>) => void;
  clearFilters: () => void;
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
  setSort: (field: string, direction: 'asc' | 'desc') => void;
  limit: number;
  setLimit: (limit: number) => void;
  results: BuilderQueryResponse | null;
  loading: boolean;
  error: string | null;
  executeQuery: () => Promise<void>;
  refetch: () => void;
  aiLoading: boolean;
  aiResult: AITranslatedQuery | null;
  submitAIQuery: (query: string) => Promise<void>;
  shareUrl: string;
  activeSavedReport: SavedReport | null;
  hasUnsavedChanges: boolean;
  loadSavedReport: (report: SavedReport) => void;
  clearSavedReport: () => void;
  getCurrentConfig: () => SavedReportConfig;
  setActiveSavedReport: Dispatch<SetStateAction<SavedReport | null>>;
}

// ============================================================================
// Cache
// ============================================================================

const CACHE_TTL = 5 * 60 * 1000;

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

  const initialState = useMemo(() => {
    if (!searchParams) return {};
    return decodeBuilderState(searchParams);
    // eslint-disable-next-line
  }, []);

  // State
  const [domain, setDomainState] = useState<BuilderDomainId | null>(initialState.domain ?? null);
  const [columns, setColumnsState] = useState<string[]>(initialState.columns ?? []);
  const [filters, setFilters] = useState<ReportBuilderFilter[]>(initialState.filters ?? []);
  const [sortField, setSortField] = useState<string | null>(initialState.sortField ?? null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialState.sortDirection ?? 'asc');
  const [limit, setLimitState] = useState<number>(initialState.limit ?? BUILDER_LIMITS.DEFAULT_ROW_LIMIT);
  const [results, setResults] = useState<BuilderQueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AITranslatedQuery | null>(null);

  const cacheRef = useRef<CachedResult | null>(null);

  // Saved report tracking
  const [activeSavedReport, setActiveSavedReport] = useState<SavedReport | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const configSnapshotRef = useRef<string | null>(null);

  const domainDefinition = useMemo(
    () => (domain ? getDomainDefinition(domain) : null),
    [domain],
  );

  // Phase 2 — Grouping (composed hook)
  const grouping = useReportGrouping({
    results,
    domainDefinition,
    domain,
    columns,
    initialGroupByConfig: initialState.groupByConfig,
  });

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
    grouping.resetGrouping();

    const def = getDomainDefinition(id);
    setSortField(def.defaultSortField);
    setSortDirection(def.defaultSortDirection);
  }, [grouping.resetGrouping]);

  // ========================================================================
  // Columns
  // ========================================================================

  const setColumns = useCallback((cols: string[]) => { setColumnsState(cols); }, []);

  const toggleColumn = useCallback((fieldKey: string) => {
    setColumnsState(prev =>
      prev.includes(fieldKey) ? prev.filter(c => c !== fieldKey) : [...prev, fieldKey],
    );
  }, []);

  const reorderColumns = useCallback((fromIndex: number, toIndex: number) => {
    setColumnsState(prev => {
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
      setFilters(prev => [...prev, { ...filter, id: generateTempId() }]);
    },
    [filters.length],
  );

  const removeFilter = useCallback((filterId: string) => {
    setFilters(prev => prev.filter(f => f.id !== filterId));
  }, []);

  const updateFilter = useCallback(
    (filterId: string, updates: Partial<Omit<ReportBuilderFilter, 'id'>>) => {
      setFilters(prev => prev.map(f => (f.id === filterId ? { ...f, ...updates } : f)));
    },
    [],
  );

  const clearFilters = useCallback(() => { setFilters([]); }, []);

  // ========================================================================
  // Sort & Limit
  // ========================================================================

  const setSort = useCallback((field: string, direction: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(direction);
  }, []);

  const setLimit = useCallback((newLimit: number) => {
    setLimitState(Math.min(Math.max(1, newLimit), BUILDER_LIMITS.MAX_ROW_LIMIT));
  }, []);

  // ========================================================================
  // Query Execution
  // ========================================================================

  const buildCacheKey = useCallback(
    () => JSON.stringify({ domain, filters, columns, sortField, sortDirection, limit }),
    [domain, filters, columns, sortField, sortDirection, limit],
  );

  const executeQuery = useCallback(async () => {
    if (!domain || columns.length === 0) return;

    const cacheKey = buildCacheKey();
    if (cacheRef.current?.key === cacheKey && Date.now() - cacheRef.current.timestamp < CACHE_TTL) {
      setResults(cacheRef.current.data);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const request: BuilderQueryRequest = {
        domain, filters, columns,
        sortField: sortField ?? undefined, sortDirection, limit,
      };
      const response = await apiClient.post<BuilderQueryResponse>('/api/reports/builder', request);
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
      const result = await apiClient.post<AITranslatedQuery>('/api/reports/builder/ai', { query, locale: 'el' });
      setAiResult(result);
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
  // Saved Report Integration
  // ========================================================================

  const getCurrentConfig = useCallback((): SavedReportConfig => ({
    domain: domain!,
    columns,
    filters,
    sortField,
    sortDirection,
    limit,
    groupByConfig: grouping.groupByConfig,
    dateRange: null,
  }), [domain, columns, filters, sortField, sortDirection, limit, grouping.groupByConfig]);

  const loadSavedReport = useCallback((report: SavedReport) => {
    const { config } = report;
    setDomainState(config.domain);
    setColumnsState(config.columns);
    setFilters(config.filters);
    setSortField(config.sortField);
    setSortDirection(config.sortDirection);
    setLimitState(config.limit);
    if (config.groupByConfig) {
      grouping.setGroupByConfig(config.groupByConfig);
    } else {
      grouping.resetGrouping();
    }
    setResults(null);
    setError(null);
    setAiResult(null);
    setActiveSavedReport(report);
    configSnapshotRef.current = JSON.stringify(config);
    setHasUnsavedChanges(false);
  }, [grouping]);

  const clearSavedReport = useCallback(() => {
    setActiveSavedReport(null);
    configSnapshotRef.current = null;
    setHasUnsavedChanges(false);
  }, []);

  // Detect unsaved changes
  useEffect(() => {
    if (!activeSavedReport || !configSnapshotRef.current || !domain) return;
    const currentSerialized = JSON.stringify(getCurrentConfig());
    setHasUnsavedChanges(currentSerialized !== configSnapshotRef.current);
  }, [domain, columns, filters, sortField, sortDirection, limit, grouping.groupByConfig, activeSavedReport, getCurrentConfig]);

  // ========================================================================
  // URL State Sync
  // ========================================================================

  const shareUrl = useMemo(() => {
    if (!domain) return '';
    const qs = encodeBuilderState(
      domain, filters, columns, sortField ?? undefined, sortDirection, limit, grouping.groupByConfig,
    );
    if (typeof window === 'undefined') return `?${qs}`;
    return `${window.location.origin}${window.location.pathname}?${qs}`;
  }, [domain, filters, columns, sortField, sortDirection, limit, grouping.groupByConfig]);

  useEffect(() => {
    if (!domain || typeof window === 'undefined') return;
    const qs = encodeBuilderState(
      domain, filters, columns, sortField ?? undefined, sortDirection, limit, grouping.groupByConfig,
    );
    window.history.replaceState(null, '', `?${qs}`);
  }, [domain, filters, columns, sortField, sortDirection, limit, grouping.groupByConfig]);

  // ========================================================================
  // Return
  // ========================================================================

  return {
    domain, domainDefinition, setDomain,
    columns, setColumns, toggleColumn, reorderColumns,
    filters, addFilter, removeFilter, updateFilter, clearFilters,
    sortField, sortDirection, setSort,
    limit, setLimit,
    results, loading, error,
    executeQuery, refetch,
    aiLoading, aiResult, submitAIQuery,
    shareUrl,
    activeSavedReport, setActiveSavedReport,
    hasUnsavedChanges,
    loadSavedReport, clearSavedReport, getCurrentConfig,
    ...grouping,
  };
}
