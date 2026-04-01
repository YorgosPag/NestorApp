'use client';

/**
 * Refactored Navigation Context
 * Clean separation of concerns using services and hooks
 *
 * Realtime subscriptions extracted to hooks/useNavigationSubscriptions.ts
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigationData } from './hooks/useNavigationData';
import { useNavigationActions } from './hooks/useNavigationActions';
import { useNavigationSubscriptions } from './hooks/useNavigationSubscriptions';
import { useRealtimeBuildings, useRealtimeProperties } from '@/services/realtime';
import { NavigationApiService } from './services/navigationApi';
import { useAuth } from '@/auth/hooks/useAuth';
import { clientSafeFireAndForget } from '@/lib/safe-fire-and-forget';
import type {
  NavigationState,
  NavigationActions,
  NavigationCompany,
  NavigationProject,
  NavigationBuilding,
  NavigationLevel,
  NavigationFilters,
  RealtimeBuildingRef,
  NavigationSelectedProperty
} from './types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('NavigationContext');

interface NavigationContextType extends NavigationState, NavigationActions {}

const NavigationContext = createContext<NavigationContextType | null>(null);

// Module-level initialization guard (must be module-level for React Strict Mode)
let navigationInitialized = false;

/**
 * Reset navigation initialization flag.
 * Call this on logout to ensure fresh bootstrap on next login.
 */
export function resetNavigationState(): void {
  logger.info('Resetting navigation state (logout/cleanup)');
  navigationInitialized = false;
}

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();

  const [state, setState] = useState<NavigationState>({
    companies: [],
    selectedCompany: null,
    projects: [],
    selectedProject: null,
    selectedBuilding: null,
    selectedProperty: null,
    selectedFloor: null,
    currentLevel: 'companies',
    loading: false,
    projectsLoading: false,
    error: null
  });

  const dataHook = useNavigationData();
  const actions = useNavigationActions();

  const isAuthReady = !!user && !authLoading;

  const {
    getBuildingCount,
    getBuildingsForProject,
  } = useRealtimeBuildings(isAuthReady);

  const {
    getPropertyCount,
    getPropertiesForBuilding,
  } = useRealtimeProperties(isAuthReady);

  const updateState = (updates: Partial<NavigationState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  // Bootstrap: load companies + projects on mount
  useEffect(() => {
    if (authLoading) {
      logger.info('Waiting for auth state...');
      return;
    }

    if (!user) {
      logger.info('No authenticated user - skipping bootstrap');
      updateState({ loading: false, projectsLoading: false });
      return;
    }

    if (navigationInitialized && state.companies.length > 0) {
      logger.info('Already initialized with data (module-level guard)');
      return;
    }

    if (navigationInitialized && state.companies.length === 0) {
      logger.info('Flag was set but no data - resetting for retry...');
      navigationInitialized = false;
    }

    navigationInitialized = true;
    logger.info('Initializing navigation (user authenticated)...');

    const initializeNavigation = async () => {
      try {
        updateState({ loading: true, projectsLoading: true, error: null });
        const { companies, projects } = await dataHook.loadViaBootstrap();
        logger.info('Bootstrap complete', { companiesCount: companies.length, projectsCount: projects.length });
        updateState({ companies, projects, loading: false, projectsLoading: false, currentLevel: 'companies' });
      } catch (error) {
        logger.error('Bootstrap failed', { error });
        navigationInitialized = false;
        updateState({
          error: error instanceof Error ? error.message : 'Failed to load navigation data',
          loading: false,
          projectsLoading: false
        });
      }
    };

    initializeNavigation();
  }, [authLoading, user]);

  // Full navigation refresh (clears ALL caches)
  const refreshNavigation = useCallback(async () => {
    logger.info('Refreshing navigation data...');
    try {
      NavigationApiService.clearCompaniesCache();
      (dataHook as ReturnType<typeof useNavigationData> & { clearAllClientCaches: () => void }).clearAllClientCaches();
      updateState({ loading: true, projectsLoading: true, error: null });
      const { companies, projects } = await dataHook.loadViaBootstrap();
      updateState({ companies, projects, loading: false, projectsLoading: false });
      logger.info('Navigation data refreshed', { companies: companies.length, projects: projects.length });
    } catch (error) {
      logger.error('Failed to refresh', { error });
      updateState({
        error: error instanceof Error ? error.message : 'Failed to refresh navigation',
        loading: false,
        projectsLoading: false
      });
    }
  }, [dataHook]);

  // Realtime subscriptions (extracted to separate hook)
  useNavigationSubscriptions(refreshNavigation, setState);

  // ── Action wrappers ──

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
    clientSafeFireAndForget(dataHook.loadProjectsForCompany(companyId), 'Navigation.loadProjects');
  };

  const loadProjectsForCompany = async (companyId: string) => {
    updateState({ loading: true, error: null });
    const _companyProjects = state.projects.filter(p => p.companyId === companyId);
    updateState({ loading: false });
  };

  const selectProject = (projectId: string) => {
    actions.selectProject(projectId, state, updateState).catch(error => {
      logger.error('Failed to select project', { error });
      updateState({
        error: `Failed to load project details: ${error.message}`,
        projectsLoading: false
      });
    });
  };

  const selectBuilding = (buildingId: string) => {
    if (!state.selectedProject) {
      logger.warn('selectBuilding called with no project selected');
      return;
    }

    const realtimeBuildings = getBuildingsForProject(state.selectedProject.id);
    const realtimeBuildingRef = realtimeBuildings.find(b => b.id === buildingId);

    if (!realtimeBuildingRef) {
      logger.warn('Building not found in realtime data', { buildingId });
      updateState({ selectedBuilding: null, selectedFloor: null, selectedProperty: null, currentLevel: 'properties' });
      return;
    }

    const building: NavigationBuilding = {
      id: realtimeBuildingRef.id,
      name: realtimeBuildingRef.name,
      floors: [],
      properties: []
    };

    logger.info('Building selected', { name: building.name, buildingId });
    updateState({ selectedBuilding: building, selectedFloor: null, selectedProperty: null, currentLevel: 'properties' });
  };

  const selectProperty = (property: NavigationSelectedProperty | null) => {
    updateState({ selectedProperty: property, currentLevel: 'properties' });
  };

  const syncBreadcrumb = useCallback((params: import('./types').BreadcrumbSyncParams) => {
    const { company, project, building, property, space, currentLevel } = params;

    const selectedCompany: NavigationCompany = { id: company.id, companyName: company.name };
    const selectedProject: NavigationProject = {
      id: project.id, name: project.name,
      company: company.name, companyId: company.id, buildings: []
    };
    const selectedBuilding: NavigationBuilding | null = building
      ? { id: building.id, name: building.name, floors: [] }
      : null;
    const selectedProperty: NavigationSelectedProperty | null = property
      ? { id: property.id, name: property.name, type: property.type }
      : space
        ? { id: space.id, name: space.name, type: space.type }
        : null;

    updateState({ selectedCompany, selectedProject, selectedBuilding, selectedProperty, currentLevel });
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

  const getBuildingsForProjectTyped = (projectId: string): RealtimeBuildingRef[] => {
    const buildings = getBuildingsForProject(projectId);
    return buildings.map(b => ({ id: b.id, name: b.name, projectId: b.projectId }));
  };

  const getBuildingCountOptimized = useCallback((projectId: string): number => {
    const project = state.projects.find(p => p.id === projectId);
    if (project?.buildingCount !== undefined) {
      return project.buildingCount;
    }
    return getBuildingCount(projectId);
  }, [state.projects, getBuildingCount]);

  const contextValue: NavigationContextType = {
    ...state,
    loadCompanies,
    selectCompany,
    loadProjectsForCompany,
    selectProject,
    selectBuilding,
    selectProperty,
    syncBreadcrumb,
    selectFloor,
    navigateToLevel,
    reset,
    navigateToExistingPages,
    getBuildingCount: getBuildingCountOptimized,
    getBuildingsForProject: getBuildingsForProjectTyped,
    getPropertyCount,
    getPropertiesForBuilding
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
