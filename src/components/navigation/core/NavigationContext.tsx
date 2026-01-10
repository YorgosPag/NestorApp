'use client';

/**
 * Refactored Navigation Context
 * Clean separation of concerns using services and hooks
 *
 * 🏢 ENTERPRISE UPDATE: Added real-time building counts via useRealtimeBuildings
 */
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigationData } from './hooks/useNavigationData';
import { useNavigationActions } from './hooks/useNavigationActions';
import { useRealtimeBuildings, useRealtimeUnits, REALTIME_EVENTS } from '@/services/realtime';
import { NavigationApiService } from './services/navigationApi';
import type {
  NavigationState,
  NavigationActions,
  NavigationCompany,
  NavigationProject,
  NavigationLevel,
  NavigationFilters,
  RealtimeBuildingRef,
  NavigationSelectedUnit
} from './types';

interface NavigationContextType extends NavigationState, NavigationActions {}

const NavigationContext = createContext<NavigationContextType | null>(null);

// 🏢 ENTERPRISE: Module-level initialization guard
// This MUST be module-level (not useRef) because React Strict Mode creates new component instances
// With useRef, each mount gets a fresh ref → guard fails → double bootstrap
// With module-level flag, ALL mounts share the same flag → guard works
let navigationInitialized = false;

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  // Core navigation state
  const [state, setState] = useState<NavigationState>({
    companies: [],
    selectedCompany: null,
    projects: [],
    selectedProject: null,
    selectedBuilding: null,
    selectedUnit: null,  // 🏢 ENTERPRISE: For breadcrumb display
    selectedFloor: null,
    currentLevel: 'companies',
    loading: false,
    projectsLoading: false,
    error: null
  });

  // Custom hooks for data loading and actions
  const dataHook = useNavigationData();
  const actions = useNavigationActions();

  // 🏢 ENTERPRISE: Real-time buildings for live counts
  const {
    buildingsByProject,
    getBuildingCount,
    getBuildingsForProject,
    loading: realtimeBuildingsLoading,
  } = useRealtimeBuildings();

  // 🏢 ENTERPRISE: Real-time units for live counts per building
  const {
    unitsByBuilding,
    getUnitCount,
    getUnitsForBuilding,
    loading: realtimeUnitsLoading,
  } = useRealtimeUnits();

  // Helper to update state
  const updateState = (updates: Partial<NavigationState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  // Load companies on mount - SINGLE bootstrap call
  useEffect(() => {
    // 🏢 ENTERPRISE: Module-level guard prevents double initialization
    // This works with React Strict Mode because the flag persists across component remounts
    if (navigationInitialized) {
      console.log('⚡ [NavigationContext] Already initialized (module-level guard)');
      return;
    }
    navigationInitialized = true;
    console.log('🚀 [NavigationContext] Initializing navigation...');

    const initializeNavigation = async () => {
      try {
        updateState({ loading: true, projectsLoading: true, error: null });

        // 🏢 ENTERPRISE: Single bootstrap call for BOTH companies AND projects
        // Combined with promise de-duplication in useNavigationData
        const { companies, projects } = await dataHook.loadViaBootstrap();

        console.log(`✅ [NavigationContext] Bootstrap complete: ${companies.length} companies, ${projects.length} projects`);

        updateState({
          companies,
          projects,
          loading: false,
          projectsLoading: false,
          currentLevel: 'companies'
        });

      } catch (error) {
        console.error('❌ [NavigationContext] Bootstrap failed:', error);
        // Reset flag on error so retry is possible
        navigationInitialized = false;
        updateState({
          error: error instanceof Error ? error.message : 'Failed to load navigation data',
          loading: false,
          projectsLoading: false
        });
      }
    };

    initializeNavigation();
  }, []);

  // Internal function to load all projects
  const loadAllProjectsInternal = async (companies: NavigationCompany[] = state.companies) => {
    if (companies.length === 0) return;

    try {
      updateState({ projectsLoading: true });

      const projects = await dataHook.loadAllProjects(companies);

      updateState({
        projects,
        projectsLoading: false
      });

    } catch (error) {
      updateState({ projectsLoading: false });
    }
  };

  // 🏢 ENTERPRISE: Full navigation refresh (clears cache and reloads)
  const refreshNavigation = useCallback(async () => {
    console.log('🔄 [NavigationContext] Refreshing navigation data...');

    try {
      // Clear the companies cache to force fresh data
      NavigationApiService.clearCompaniesCache();

      updateState({ loading: true, projectsLoading: true, error: null });

      // Reload companies
      const companies = await dataHook.loadCompanies();
      updateState({ companies, loading: false });

      // Reload all projects with fresh data
      if (companies.length > 0) {
        const projects = await dataHook.loadAllProjects(companies);
        updateState({ projects, projectsLoading: false });
      } else {
        updateState({ projectsLoading: false });
      }

      console.log('✅ [NavigationContext] Navigation data refreshed');
    } catch (error) {
      console.error('❌ [NavigationContext] Failed to refresh:', error);
      updateState({
        error: error instanceof Error ? error.message : 'Failed to refresh navigation',
        loading: false,
        projectsLoading: false
      });
    }
  }, [dataHook]);

  // 🏢 ENTERPRISE: Listen for NAVIGATION_REFRESH events
  useEffect(() => {
    const handleNavigationRefresh = () => {
      console.log('📡 [NavigationContext] Received NAVIGATION_REFRESH event');
      refreshNavigation();
    };

    window.addEventListener(REALTIME_EVENTS.NAVIGATION_REFRESH, handleNavigationRefresh);

    return () => {
      window.removeEventListener(REALTIME_EVENTS.NAVIGATION_REFRESH, handleNavigationRefresh);
    };
  }, [refreshNavigation]);

  // Wrapped action functions with state management
  const loadCompanies = async () => {
    try {
      updateState({ loading: true, error: null });
      const companies = await dataHook.loadCompanies();
      updateState({ companies, loading: false });
    } catch (error) {
      updateState({
        error: error instanceof Error ? error.message : 'Failed to load companies',
        loading: false
      });
    }
  };

  const selectCompany = (companyId: string) => {
    actions.selectCompany(companyId, state, updateState);
    // Load projects for this specific company (optional, as we already have all projects)
    dataHook.loadProjectsForCompany(companyId).catch(() => {});
  };

  const loadProjectsForCompany = async (companyId: string) => {
    // For navigation purposes, we just filter the existing projects
    // We don't need to fetch again since loadAllProjects already loaded everything
    updateState({ loading: true, error: null });


    const companyProjects = state.projects.filter(p => p.companyId === companyId);

    // Just update the loading state, keep all projects intact
    updateState({ loading: false });

    // Note: We keep all projects in state.projects so that the warning badges work correctly
    // The navigation UI can filter projects by selectedCompany when displaying the projects view
  };

  const selectProject = (projectId: string) => {
    actions.selectProject(projectId, state, updateState).catch(error => {
      console.error('Failed to select project:', error);
      updateState({
        error: `Failed to load project details: ${error.message}`,
        projectsLoading: false
      });
    });
  };

  const selectBuilding = (buildingId: string) => {
    actions.selectBuilding(buildingId, state, updateState);
    // 🏢 ENTERPRISE: Clear selected unit when building changes
    updateState({ selectedUnit: null });
  };

  // 🏢 ENTERPRISE: Select unit for breadcrumb display
  const selectUnit = (unit: NavigationSelectedUnit | null) => {
    updateState({ selectedUnit: unit, currentLevel: 'units' });
  };

  /**
   * 🏢 ENTERPRISE: Atomic breadcrumb sync from entity pages
   *
   * Sets the navigation display hierarchy in a single atomic state update.
   * Accepts names directly from pages - no fallback lookups needed.
   *
   * ⚠️ CRITICAL CONTRACT:
   * - Updates DISPLAY-ONLY navigation selection for breadcrumb/UI context
   * - The resulting selected* objects are NOT full domain entities
   * - Nested arrays (`buildings`, `floors`) MAY BE EMPTY
   * - MUST NOT be used for business logic or data fetching
   *
   * @see BreadcrumbSyncParams - Full documentation in types.ts
   */
  const syncBreadcrumb = useCallback((params: import('./types').BreadcrumbSyncParams) => {
    const { company, project, building, unit, space, currentLevel } = params;

    // Build the navigation hierarchy objects from provided names
    const selectedCompany: NavigationCompany = {
      id: company.id,
      companyName: company.name
    };

    const selectedProject: NavigationProject = {
      id: project.id,
      name: project.name,
      company: company.name,
      companyId: company.id,
      buildings: []
    };

    const selectedBuilding: NavigationBuilding | null = building
      ? { id: building.id, name: building.name, floors: [] }
      : null;

    const selectedUnit: NavigationSelectedUnit | null = unit
      ? { id: unit.id, name: unit.name, type: unit.type }
      : space
        ? { id: space.id, name: space.name, type: space.type }
        : null;

    // Single atomic state update - no race conditions
    updateState({
      selectedCompany,
      selectedProject,
      selectedBuilding,
      selectedUnit,
      currentLevel
    });
  }, []);

  const selectFloor = (floorId: string) => {
    actions.selectFloor(floorId, state, updateState);
  };

  const navigateToLevel = (level: NavigationLevel) => {
    actions.navigateToLevel(level, updateState);
  };

  const reset = () => {
    actions.reset(updateState);
  };

  const navigateToExistingPages = (
    type: 'properties' | 'projects' | 'buildings' | 'floorplan',
    filters?: NavigationFilters
  ) => {
    actions.navigateToExistingPages(type, state, filters);
  };

  // 🏢 ENTERPRISE: Wrapper for real-time getBuildingsForProject with proper typing
  const getBuildingsForProjectTyped = (projectId: string): RealtimeBuildingRef[] => {
    const buildings = getBuildingsForProject(projectId);
    return buildings.map(b => ({
      id: b.id,
      name: b.name,
      projectId: b.projectId
    }));
  };

  // Context value with all state and actions
  const contextValue: NavigationContextType = {
    ...state,
    loadCompanies,
    selectCompany,
    loadProjectsForCompany,
    selectProject,
    selectBuilding,
    selectUnit,  // 🏢 ENTERPRISE: For breadcrumb display
    syncBreadcrumb,  // 🏢 ENTERPRISE: Atomic sync for entity pages
    selectFloor,
    navigateToLevel,
    reset,
    navigateToExistingPages,
    // 🏢 ENTERPRISE: Real-time building functions
    getBuildingCount,
    getBuildingsForProject: getBuildingsForProjectTyped,
    // 🏢 ENTERPRISE: Real-time unit functions
    getUnitCount,
    getUnitsForBuilding
  };

  return (
    <NavigationContext.Provider value={contextValue}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
}

export default NavigationContext;