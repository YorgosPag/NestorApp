'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Project } from '@/types/project';
import { defaultProjectFilters, type ProjectFilterState } from '@/components/core/AdvancedFilters';

export function useProjectsPageState(initialProjects: Project[]) {
  // 🏢 ENTERPRISE: URL parameter handling for contextual navigation
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get('projectId');
  // 🏢 ENTERPRISE: Deep-link tab param (building → project addresses navigation)
  const tabFromUrl = searchParams.get('tab');


  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  // 🏢 ENTERPRISE: Added 'grid' view mode for card grid layout (PR: Projects Grid View)
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'byType' | 'byStatus'>('list');
  const [showDashboard, setShowDashboard] = useState(false);

  // Use centralized filter state
  const [filters, setFilters] = useState<ProjectFilterState>(defaultProjectFilters);

  // 🏢 ENTERPRISE: Auto-selection from URL parameter (contextual navigation)
  useEffect(() => {
    if (!initialProjects.length) return;

    if (projectIdFromUrl) {
      // URL parameter has priority - find and select the project
      const found = initialProjects.find(p => p.id === projectIdFromUrl);
      if (found) {
        console.log('📋 [useProjectsPageState] Auto-selecting project from URL:', found.name);
        setSelectedProject(found);
        return;
      }
    }

    // Default: select first project if none selected
    if (!selectedProject && initialProjects.length > 0) {
      setSelectedProject(initialProjects[0]);
    }
  }, [initialProjects, projectIdFromUrl]);

  // 🏢 ENTERPRISE: Sync selectedProject with updated data from initialProjects
  // Pattern: Local State Synchronization (instant UI update after project save)
  // This ensures selectedProject stays in sync when projects array is updated
  useEffect(() => {
    if (!selectedProject || !initialProjects.length) return;

    // Find the updated version of the selected project
    const updatedProject = initialProjects.find(p => p.id === selectedProject.id);

    if (updatedProject) {
      // Check if data actually changed to avoid unnecessary re-renders
      const hasChanged =
        updatedProject.name !== selectedProject.name ||
        updatedProject.title !== selectedProject.title ||
        updatedProject.status !== selectedProject.status;

      if (hasChanged) {
        console.log('🔄 [useProjectsPageState] Syncing selectedProject with updated data:', updatedProject.name);
        setSelectedProject(updatedProject);
      }
    }
  }, [initialProjects]);

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
    // 🏢 ENTERPRISE: Deep-link tab param for contextual navigation
    tabFromUrl,
  };
}