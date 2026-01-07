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
import { useRealtimeBuildings, REALTIME_EVENTS } from '@/services/realtime';
import { NavigationApiService } from './services/navigationApi';
import type {
  NavigationState,
  NavigationActions,
  NavigationCompany,
  NavigationProject,
  NavigationLevel,
  NavigationFilters,
  RealtimeBuildingRef
} from './types';

interface NavigationContextType extends NavigationState, NavigationActions {}

const NavigationContext = createContext<NavigationContextType | null>(null);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  // Core navigation state
  const [state, setState] = useState<NavigationState>({
    companies: [],
    selectedCompany: null,
    projects: [],
    selectedProject: null,
    selectedBuilding: null,
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

  // Helper to update state
  const updateState = (updates: Partial<NavigationState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  // Load companies on mount
  useEffect(() => {
    const initializeNavigation = async () => {
      try {
        updateState({ loading: true, error: null });

        const companies = await dataHook.loadCompanies();
        updateState({
          companies,
          loading: false,
          currentLevel: 'companies'
        });

        // Load all projects immediately after companies are loaded
        if (companies.length > 0) {
          await loadAllProjectsInternal(companies);
        }

      } catch (error) {
        updateState({
          error: error instanceof Error ? error.message : 'Failed to load navigation data',
          loading: false
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
  };

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
    selectFloor,
    navigateToLevel,
    reset,
    navigateToExistingPages,
    // 🏢 ENTERPRISE: Real-time building functions
    getBuildingCount,
    getBuildingsForProject: getBuildingsForProjectTyped
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