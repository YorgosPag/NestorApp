'use client';

/**
 * Refactored Navigation Context
 * Clean separation of concerns using services and hooks
 *
 * 🏢 ENTERPRISE UPDATE: Added real-time building counts via useRealtimeBuildings
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigationData } from './hooks/useNavigationData';
import { useNavigationActions } from './hooks/useNavigationActions';
import { useRealtimeBuildings, useRealtimeUnits, REALTIME_EVENTS, RealtimeService, type ProjectUpdatedPayload } from '@/services/realtime';
import { NavigationApiService } from './services/navigationApi';
// 🔐 ENTERPRISE: Auth hook for bootstrap gating
import { useAuth } from '@/auth/hooks/useAuth';
import type {
  NavigationState,
  NavigationActions,
  NavigationCompany,
  NavigationProject,
  NavigationBuilding,
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

/**
 * 🔄 Reset navigation initialization flag
 * Call this on logout to ensure fresh bootstrap on next login
 */
export function resetNavigationState(): void {
  console.log('🔄 [NavigationContext] Resetting navigation state (logout/cleanup)');
  navigationInitialized = false;
}

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  // 🔐 ENTERPRISE: Auth-ready gating - wait for authentication before bootstrap
  const { user, loading: authLoading } = useAuth();

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
  // 🔐 ENTERPRISE: Auth-ready gating - waits for authentication before bootstrap
  useEffect(() => {
    // 🔐 STEP 1: Wait for auth to be ready before attempting bootstrap
    if (authLoading) {
      console.log('⏳ [NavigationContext] Waiting for auth state...');
      return; // Will re-run when authLoading becomes false
    }

    if (!user) {
      console.log('⏳ [NavigationContext] No authenticated user - skipping bootstrap');
      updateState({ loading: false, projectsLoading: false });
      return; // Will re-run when user becomes available
    }

    // 🏢 ENTERPRISE: Module-level guard prevents double initialization
    // This works with React Strict Mode because the flag persists across component remounts
    // ALSO check if we already have data (handles Fast Refresh in development)
    if (navigationInitialized && state.companies.length > 0) {
      console.log('⚡ [NavigationContext] Already initialized with data (module-level guard)');
      return;
    }

    // If flag is true but no data, reset and try again (Fast Refresh recovery)
    if (navigationInitialized && state.companies.length === 0) {
      console.log('🔄 [NavigationContext] Flag was set but no data - resetting for retry...');
      navigationInitialized = false;
    }

    navigationInitialized = true;
    console.log('🚀 [NavigationContext] Initializing navigation (user authenticated)...');

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
  }, [authLoading, user]); // 🔐 Re-run when auth state changes

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

  // 🏢 ENTERPRISE: Centralized Real-time Service (ZERO DUPLICATES)
  // Uses RealtimeService.subscribeToProjectUpdates() for cross-page sync
  useEffect(() => {
    const handleProjectUpdate = (payload: ProjectUpdatedPayload) => {
      console.log('🔄 [NavigationContext] Applying update for project:', payload.projectId);

      setState(prev => ({
        ...prev,
        projects: prev.projects.map(project =>
          project.id === payload.projectId
            ? { ...project, ...payload.updates }
            : project
        ),
        // Also update selectedProject if it's the one being updated
        selectedProject: prev.selectedProject?.id === payload.projectId
          ? { ...prev.selectedProject, ...payload.updates }
          : prev.selectedProject
      }));
    };

    // Subscribe to project updates (same-page + cross-page)
    // Note: checkPendingOnMount=false to avoid interference with initial data load
    const unsubscribe = RealtimeService.subscribeToProjectUpdates(handleProjectUpdate, {
      checkPendingOnMount: false
    });

    return unsubscribe;
  }, []);

  // 🏢 ENTERPRISE: Listen for auth:logout event to reset navigation state
  useEffect(() => {
    const handleLogout = () => {
      console.log('📡 [NavigationContext] Received auth:logout event - resetting state');
      resetNavigationState();
      // Also reset local state
      setState({
        companies: [],
        selectedCompany: null,
        projects: [],
        selectedProject: null,
        selectedBuilding: null,
        selectedUnit: null,
        selectedFloor: null,
        currentLevel: 'companies',
        loading: false,
        projectsLoading: false,
        error: null
      });
    };

    window.addEventListener('auth:logout', handleLogout);

    return () => {
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, []);

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

  /**
   * 🏢 ENTERPRISE: Select building using realtime data
   *
   * FIX: Buildings come from useRealtimeBuildings hook, NOT from state.selectedProject.buildings
   * The bootstrap only loads buildingCount, not full buildings array.
   * So we must find the building in the realtime data.
   */
  const selectBuilding = (buildingId: string) => {
    if (!state.selectedProject) {
      console.warn('⚠️ [selectBuilding] No project selected');
      return;
    }

    // 🏢 ENTERPRISE: Get buildings from realtime hook, NOT from project.buildings
    const realtimeBuildings = getBuildingsForProject(state.selectedProject.id);
    const realtimeBuildingRef = realtimeBuildings.find(b => b.id === buildingId);

    if (!realtimeBuildingRef) {
      console.warn(`⚠️ [selectBuilding] Building ${buildingId} not found in realtime data`);
      updateState({
        selectedBuilding: null,
        selectedFloor: null,
        selectedUnit: null,
        currentLevel: 'units'
      });
      return;
    }

    // 🏢 ENTERPRISE: Create NavigationBuilding from realtime ref
    // floors/units are loaded on-demand by BuildingSpacesTabs
    const building: NavigationBuilding = {
      id: realtimeBuildingRef.id,
      name: realtimeBuildingRef.name,
      floors: [], // Loaded on-demand
      units: []   // Loaded on-demand via useRealtimeUnits
    };

    console.log(`📍 [selectBuilding] Selected: ${building.name} (${buildingId})`);

    updateState({
      selectedBuilding: building,
      selectedFloor: null,
      selectedUnit: null,
      currentLevel: 'units'
    });
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

  // 🏢 PERF-001: Use bootstrap buildingCount first, fallback to realtime
  const getBuildingCountOptimized = useCallback((projectId: string): number => {
    // First, try to get count from bootstrap data (stored in project)
    const project = state.projects.find(p => p.id === projectId);
    if (project?.buildingCount !== undefined) {
      return project.buildingCount;
    }
    // Fallback to realtime count (if realtime hooks are active)
    return getBuildingCount(projectId);
  }, [state.projects, getBuildingCount]);

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
    // 🏢 PERF-001: Use bootstrap counts first, fallback to realtime
    getBuildingCount: getBuildingCountOptimized,
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