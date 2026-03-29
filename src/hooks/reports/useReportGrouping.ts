/**
 * @module hooks/reports/useReportGrouping
 * @enterprise ADR-268 Phase 2 — Grouping state and computed values
 *
 * Extracted from useReportBuilder for Google SRP (<500 lines per file).
 * Manages: groupBy config, expand/collapse, chart type, cross-filter,
 * sort by subtotal, percent of total, KPI generation.
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  type BuilderChartType,
  type BuilderDomainId,
  type GroupByConfig,
  type GroupingResult,
  type ChartCrossFilter,
  type GroupedRow,
  type DomainDefinition,
  type BuilderQueryResponse,
} from '@/config/report-builder/report-builder-types';
import type { ReportKPI } from '@/components/reports/core/ReportKPIGrid';
import {
  groupRows,
  sortGroupsByAggregate,
  computePercentOfTotal,
  suggestChartType,
  generateKPIs,
} from '@/services/report-engine/grouping-engine';

// ============================================================================
// Types
// ============================================================================

export interface UseReportGroupingReturn {
  groupByConfig: GroupByConfig | null;
  setGroupByConfig: (config: GroupByConfig | null) => void;
  groupingResult: GroupingResult | null;
  expandedGroups: Set<string>;
  toggleGroupExpanded: (groupKey: string) => void;
  expandAllGroups: () => void;
  collapseAllGroups: () => void;
  showPercentOfTotal: boolean;
  togglePercentOfTotal: () => void;
  percentOfTotal: Map<string, number> | null;
  activeChartType: BuilderChartType | null;
  suggestedChartType: BuilderChartType | null;
  setChartType: (type: BuilderChartType | null) => void;
  chartCrossFilter: ChartCrossFilter | null;
  applyChartCrossFilter: (filter: ChartCrossFilter | null) => void;
  clearChartCrossFilter: () => void;
  groupSortKey: string | null;
  groupSortDirection: 'asc' | 'desc';
  setGroupSort: (key: string, direction: 'asc' | 'desc') => void;
  kpis: ReportKPI[];
  filteredGroups: GroupedRow[] | null;
  resetGrouping: () => void;
}

interface UseReportGroupingParams {
  results: BuilderQueryResponse | null;
  domainDefinition: DomainDefinition | null;
  domain: BuilderDomainId | null;
  columns: string[];
  initialGroupByConfig?: GroupByConfig | null;
}

// ============================================================================
// Hook
// ============================================================================

export function useReportGrouping({
  results,
  domainDefinition,
  domain,
  columns,
  initialGroupByConfig,
}: UseReportGroupingParams): UseReportGroupingReturn {
  // State
  const [groupByConfigState, setGroupByConfigState] = useState<GroupByConfig | null>(
    initialGroupByConfig ?? null,
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showPercentOfTotal, setShowPercentOfTotal] = useState(false);
  const [chartTypeState, setChartTypeState] = useState<BuilderChartType | null>(null);
  const [chartCrossFilter, setChartCrossFilter] = useState<ChartCrossFilter | null>(null);
  const [groupSortKey, setGroupSortKey] = useState<string | null>(null);
  const [groupSortDirection, setGroupSortDirection] = useState<'asc' | 'desc'>('desc');

  // ========================================================================
  // Computed Values
  // ========================================================================

  const groupingResult = useMemo((): GroupingResult | null => {
    if (!results || !groupByConfigState || !domainDefinition) return null;
    const result = groupRows(results.rows, groupByConfigState, domainDefinition.fields);
    if (groupSortKey) {
      sortGroupsByAggregate(result.groups, groupSortKey, groupSortDirection);
    }
    return result;
  }, [results, groupByConfigState, domainDefinition, groupSortKey, groupSortDirection]);

  const suggestedChartTypeValue = useMemo((): BuilderChartType | null => {
    if (!groupByConfigState || !domainDefinition || !groupingResult) return null;
    const field = domainDefinition.fields.find(f => f.key === groupByConfigState.level1);
    if (!field) return null;
    return suggestChartType(field.type, groupingResult.groups.length);
  }, [groupByConfigState, domainDefinition, groupingResult]);

  const activeChartType = chartTypeState ?? suggestedChartTypeValue;

  const kpis = useMemo((): ReportKPI[] => {
    if (!groupingResult || !groupByConfigState || !domain || !domainDefinition) return [];
    return generateKPIs(groupingResult, groupByConfigState, domain, columns, domainDefinition.fields);
  }, [groupingResult, groupByConfigState, domain, columns, domainDefinition]);

  const percentOfTotal = useMemo((): Map<string, number> | null => {
    if (!groupingResult || !showPercentOfTotal) return null;
    return computePercentOfTotal(groupingResult.groups, groupingResult.totalRowCount);
  }, [groupingResult, showPercentOfTotal]);

  const filteredGroups = useMemo((): GroupedRow[] | null => {
    if (!groupingResult) return null;
    if (!chartCrossFilter) return groupingResult.groups;
    return groupingResult.groups.filter(g => g.groupKey === chartCrossFilter.value);
  }, [groupingResult, chartCrossFilter]);

  // ========================================================================
  // Callbacks
  // ========================================================================

  const setGroupByConfig = useCallback((config: GroupByConfig | null) => {
    setGroupByConfigState(config);
    setExpandedGroups(new Set());
    setChartCrossFilter(null);
    setChartTypeState(null);
    setGroupSortKey(null);
  }, []);

  const toggleGroupExpanded = useCallback((groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }, []);

  const expandAllGroups = useCallback(() => {
    if (!groupingResult) return;
    setExpandedGroups(new Set(groupingResult.groups.map(g => g.groupKey)));
  }, [groupingResult]);

  const collapseAllGroups = useCallback(() => {
    setExpandedGroups(new Set());
  }, []);

  const setChartType = useCallback((type: BuilderChartType | null) => {
    setChartTypeState(type);
  }, []);

  const applyChartCrossFilter = useCallback((filter: ChartCrossFilter | null) => {
    setChartCrossFilter(filter);
  }, []);

  const clearChartCrossFilter = useCallback(() => {
    setChartCrossFilter(null);
  }, []);

  const setGroupSort = useCallback((key: string, direction: 'asc' | 'desc') => {
    setGroupSortKey(key);
    setGroupSortDirection(direction);
  }, []);

  const togglePercentOfTotal = useCallback(() => {
    setShowPercentOfTotal(prev => !prev);
  }, []);

  const resetGrouping = useCallback(() => {
    setGroupByConfigState(null);
    setExpandedGroups(new Set());
    setShowPercentOfTotal(false);
    setChartTypeState(null);
    setChartCrossFilter(null);
    setGroupSortKey(null);
  }, []);

  return {
    groupByConfig: groupByConfigState,
    setGroupByConfig,
    groupingResult,
    expandedGroups,
    toggleGroupExpanded,
    expandAllGroups,
    collapseAllGroups,
    showPercentOfTotal,
    togglePercentOfTotal,
    percentOfTotal,
    activeChartType,
    suggestedChartType: suggestedChartTypeValue,
    setChartType,
    chartCrossFilter,
    applyChartCrossFilter,
    clearChartCrossFilter,
    groupSortKey,
    groupSortDirection,
    setGroupSort,
    kpis,
    filteredGroups,
    resetGrouping,
  };
}
