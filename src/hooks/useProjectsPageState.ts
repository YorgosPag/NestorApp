'use client';

/**
 * ADR-203: Projects Page State — thin wrapper around useEntityPageState
 *
 * Entity-specific concerns:
 * - URL param: projectId + tab (deep-link)
 * - Sync fields: name, title, status
 * - Filter logic: extensive project-specific filters
 */

import { useCallback } from 'react';
import type { Project } from '@/types/project';
import { defaultProjectFilters, type ProjectFilterState } from '@/components/core/AdvancedFilters';
import { useEntityPageState, type EntityPageStateConfig } from './useEntityPageState';

// ---------------------------------------------------------------------------
// Filter function (extracted from former inline useMemo)
// ---------------------------------------------------------------------------

function filterProjects(projects: Project[], filters: ProjectFilterState): Project[] {
  return projects.filter((project) => {
    // Search filter
    if (filters.searchTerm) {
      const s = filters.searchTerm.toLowerCase();
      const matches =
        project.name.toLowerCase().includes(s) ||
        project.description?.toLowerCase().includes(s) ||
        project.location?.toLowerCase().includes(s) ||
        project.company?.toLowerCase().includes(s) ||
        project.client?.toLowerCase().includes(s);
      if (!matches) return false;
    }

    // Array-based select filters (single-select stored as string[])
    const selectFilters: Array<{ arr: string[] | undefined; field: keyof Project }> = [
      { arr: filters.status, field: 'status' },
      { arr: filters.type, field: 'type' },
      { arr: filters.company, field: 'company' },
      { arr: filters.location, field: 'location' },
      { arr: filters.client, field: 'client' },
      { arr: filters.priority, field: 'priority' },
      { arr: filters.riskLevel, field: 'riskLevel' },
      { arr: filters.complexity, field: 'complexity' },
    ];
    for (const { arr, field } of selectFilters) {
      const val = arr && arr.length > 0 ? arr[0] : null;
      if (val && val !== 'all' && project[field] !== val) return false;
    }

    // Range filters
    const { budgetRange, durationRange, progressRange, yearRange } = filters;

    if (budgetRange?.min !== undefined && project.budget && project.budget < budgetRange.min) return false;
    if (budgetRange?.max !== undefined && project.budget && project.budget > budgetRange.max) return false;

    if (durationRange?.min !== undefined && project.duration && project.duration < durationRange.min) return false;
    if (durationRange?.max !== undefined && project.duration && project.duration > durationRange.max) return false;

    if (progressRange?.min !== undefined && project.progress !== undefined && project.progress < progressRange.min) return false;
    if (progressRange?.max !== undefined && project.progress !== undefined && project.progress > progressRange.max) return false;

    if (yearRange?.min !== undefined && project.startYear && project.startYear < yearRange.min) return false;
    if (yearRange?.max !== undefined && project.startYear && project.startYear > yearRange.max) return false;

    // Date range filter
    if (filters.dateRange?.from && project.startDate) {
      if (new Date(project.startDate) < filters.dateRange.from) return false;
    }
    if (filters.dateRange?.to && project.endDate) {
      if (new Date(project.endDate) > filters.dateRange.to) return false;
    }

    // Boolean feature filters
    if (filters.hasPermits && !project.hasPermits) return false;
    if (filters.hasFinancing && !project.hasFinancing) return false;
    if (filters.isEcological && !project.isEcological) return false;
    if (filters.hasSubcontractors && !project.hasSubcontractors) return false;
    if (filters.isActive && !project.isActive) return false;
    if (filters.hasIssues && !project.hasIssues) return false;

    return true;
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProjectsPageState(initialProjects: Project[]) {
  const stableFilterFn = useCallback(filterProjects, []);

  const config: EntityPageStateConfig<Project, ProjectFilterState> = {
    urlParamName: 'projectId',
    loggerName: 'useProjectsPageState',
    defaultFilters: defaultProjectFilters,
    filterFn: stableFilterFn,
    extraUrlParams: ['tab'],
    syncCompareFields: ['name', 'title', 'status'],
  };

  const {
    selectedItem,
    setSelectedItem,
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    filteredItems,
    filters,
    setFilters,
    extraParams,
  } = useEntityPageState(initialProjects, config);

  return {
    selectedProject: selectedItem,
    setSelectedProject: setSelectedItem,
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    filteredProjects: filteredItems,
    filters,
    setFilters,
    tabFromUrl: extraParams.tab,
  };
}
