'use client';

import { useState, useMemo } from 'react';
import type { Project } from '@/types/project';
import { defaultProjectFilters, type ProjectFilterState } from '@/components/core/AdvancedFilters';

export function useProjectsPageState(initialProjects: Project[]) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(
    initialProjects.length > 0 ? initialProjects[0] : null
  );
  const [viewMode, setViewMode] = useState<'list' | 'byType' | 'byStatus'>('list');
  const [showDashboard, setShowDashboard] = useState(false);

  // Use centralized filter state
  const [filters, setFilters] = useState<ProjectFilterState>(defaultProjectFilters);

  const filteredProjects = useMemo(() => {
    return initialProjects.filter(project => {
      // Search filter - εκτεταμένη αναζήτηση
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesSearch = project.name.toLowerCase().includes(searchLower) ||
                             project.description?.toLowerCase().includes(searchLower) ||
                             project.location?.toLowerCase().includes(searchLower) ||
                             project.company?.toLowerCase().includes(searchLower) ||
                             project.client?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Status filter
      const statusFilter = filters.status && filters.status.length > 0 ? filters.status[0] : null;
      if (statusFilter && statusFilter !== 'all' && project.status !== statusFilter) {
        return false;
      }

      // Type filter
      const typeFilter = filters.type && filters.type.length > 0 ? filters.type[0] : null;
      if (typeFilter && typeFilter !== 'all' && project.type !== typeFilter) {
        return false;
      }

      // Company filter
      const companyFilter = filters.company && filters.company.length > 0 ? filters.company[0] : null;
      if (companyFilter && companyFilter !== 'all' && project.company !== companyFilter) {
        return false;
      }

      // Location filter
      const locationFilter = filters.location && filters.location.length > 0 ? filters.location[0] : null;
      if (locationFilter && locationFilter !== 'all' && project.location !== locationFilter) {
        return false;
      }

      // Client filter
      const clientFilter = filters.client && filters.client.length > 0 ? filters.client[0] : null;
      if (clientFilter && clientFilter !== 'all' && project.client !== clientFilter) {
        return false;
      }

      // Priority filter
      const priorityFilter = filters.priority && filters.priority.length > 0 ? filters.priority[0] : null;
      if (priorityFilter && priorityFilter !== 'all' && project.priority !== priorityFilter) {
        return false;
      }

      // Risk Level filter
      const riskLevelFilter = filters.riskLevel && filters.riskLevel.length > 0 ? filters.riskLevel[0] : null;
      if (riskLevelFilter && riskLevelFilter !== 'all' && project.riskLevel !== riskLevelFilter) {
        return false;
      }

      // Complexity filter
      const complexityFilter = filters.complexity && filters.complexity.length > 0 ? filters.complexity[0] : null;
      if (complexityFilter && complexityFilter !== 'all' && project.complexity !== complexityFilter) {
        return false;
      }

      // Budget range filter
      const budgetRange = filters.budgetRange;
      if (budgetRange?.min !== undefined && project.budget && project.budget < budgetRange.min) {
        return false;
      }
      if (budgetRange?.max !== undefined && project.budget && project.budget > budgetRange.max) {
        return false;
      }

      // Duration range filter
      const durationRange = filters.durationRange;
      if (durationRange?.min !== undefined && project.duration && project.duration < durationRange.min) {
        return false;
      }
      if (durationRange?.max !== undefined && project.duration && project.duration > durationRange.max) {
        return false;
      }

      // Progress range filter
      const progressRange = filters.progressRange;
      if (progressRange?.min !== undefined && project.progress !== undefined && project.progress < progressRange.min) {
        return false;
      }
      if (progressRange?.max !== undefined && project.progress !== undefined && project.progress > progressRange.max) {
        return false;
      }

      // Year range filter
      const yearRange = filters.yearRange;
      if (yearRange?.min !== undefined && project.startYear && project.startYear < yearRange.min) {
        return false;
      }
      if (yearRange?.max !== undefined && project.startYear && project.startYear > yearRange.max) {
        return false;
      }

      // Date range filter
      if (filters.dateRange?.from && project.startDate) {
        const projectStartDate = new Date(project.startDate);
        if (projectStartDate < filters.dateRange.from) {
          return false;
        }
      }
      if (filters.dateRange?.to && project.endDate) {
        const projectEndDate = new Date(project.endDate);
        if (projectEndDate > filters.dateRange.to) {
          return false;
        }
      }

      // Boolean feature filters
      if (filters.hasPermits && !project.hasPermits) {
        return false;
      }
      if (filters.hasFinancing && !project.hasFinancing) {
        return false;
      }
      if (filters.isEcological && !project.isEcological) {
        return false;
      }
      if (filters.hasSubcontractors && !project.hasSubcontractors) {
        return false;
      }
      if (filters.isActive && !project.isActive) {
        return false;
      }
      if (filters.hasIssues && !project.hasIssues) {
        return false;
      }

      return true;
    });
  }, [initialProjects, filters]);

  return {
    selectedProject,
    setSelectedProject,
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    filteredProjects,
    // New centralized filter state
    filters,
    setFilters,
  };
}