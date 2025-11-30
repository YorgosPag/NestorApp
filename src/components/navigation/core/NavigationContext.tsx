'use client';

/**
 * Refactored Navigation Context
 * Clean separation of concerns using services and hooks
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigationData } from './hooks/useNavigationData';
import { useNavigationActions } from './hooks/useNavigationActions';
import type {
  NavigationState,
  NavigationActions,
  NavigationCompany,
  NavigationProject,
  NavigationLevel
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
          console.log('🎯 NavigationContext: Companies loaded, now loading projects...');
          await loadAllProjectsInternal(companies);
        }

      } catch (error) {
        console.error('NavigationContext: Error initializing:', error);
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
      console.error('NavigationContext: Error loading projects:', error);
      updateState({ projectsLoading: false });
    }
  };

  // Wrapped action functions with state management
  const loadCompanies = async () => {
    try {
      updateState({ loading: true, error: null });
      const companies = await dataHook.loadCompanies();
      updateState({ companies, loading: false });
    } catch (error) {
      console.error('NavigationContext: Error loading companies:', error);
      updateState({
        error: error instanceof Error ? error.message : 'Failed to load companies',
        loading: false
      });
    }
  };

  const selectCompany = (companyId: string) => {
    actions.selectCompany(companyId, state, updateState);
    // Load projects for this specific company (optional, as we already have all projects)
    dataHook.loadProjectsForCompany(companyId).catch(console.error);
  };

  const loadProjectsForCompany = async (companyId: string) => {
    // For navigation purposes, we just filter the existing projects
    // We don't need to fetch again since loadAllProjects already loaded everything
    updateState({ loading: true, error: null });

    console.log(`🔄 NavigationContext: Selected company ${companyId}, keeping all projects for warnings`);

    const companyProjects = state.projects.filter(p => p.companyId === companyId);
    console.log(`📋 NavigationContext: Company ${companyId} has ${companyProjects.length} projects from cached data`);

    // Just update the loading state, keep all projects intact
    updateState({ loading: false });

    // Note: We keep all projects in state.projects so that the warning badges work correctly
    // The navigation UI can filter projects by selectedCompany when displaying the projects view
  };

  const selectProject = (projectId: string) => {
    actions.selectProject(projectId, state, updateState);
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
    filters?: any
  ) => {
    actions.navigateToExistingPages(type, state, filters);
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
    navigateToExistingPages
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