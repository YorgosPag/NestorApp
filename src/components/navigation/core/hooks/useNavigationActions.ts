/**
 * Navigation Actions Hook
 * Handles navigation actions and state updates
 */

import { useRouter } from 'next/navigation';
import { buildNavigationUrl, resetNavigationState, updateNavigationLevel } from '../utils/navigationHelpers';
import type { NavigationState, NavigationLevel } from '../types';

interface UseNavigationActionsReturn {
  selectCompany: (companyId: string, state: NavigationState, setState: (updates: Partial<NavigationState>) => void) => void;
  selectProject: (projectId: string, state: NavigationState, setState: (updates: Partial<NavigationState>) => void) => void;
  selectBuilding: (buildingId: string, state: NavigationState, setState: (updates: Partial<NavigationState>) => void) => void;
  selectFloor: (floorId: string, state: NavigationState, setState: (updates: Partial<NavigationState>) => void) => void;
  navigateToLevel: (level: NavigationLevel, setState: (updates: Partial<NavigationState>) => void) => void;
  reset: (setState: (updates: Partial<NavigationState>) => void) => void;
  navigateToExistingPages: (
    type: 'properties' | 'projects' | 'buildings' | 'floorplan',
    state: NavigationState,
    filters?: any
  ) => void;
}

export function useNavigationActions(): UseNavigationActionsReturn {
  const router = useRouter();

  const selectCompany = (
    companyId: string,
    state: NavigationState,
    setState: (updates: Partial<NavigationState>) => void
  ) => {
    const company = state.companies.find(c => c.id === companyId);

    setState({
      selectedCompany: company || null,
      selectedProject: null,
      selectedBuilding: null,
      selectedFloor: null,
      currentLevel: 'projects'
    });

  };

  const selectProject = (
    projectId: string,
    state: NavigationState,
    setState: (updates: Partial<NavigationState>) => void
  ) => {
    const project = state.projects.find(p => p.id === projectId);

    setState({
      selectedProject: project || null,
      selectedBuilding: null,
      selectedFloor: null,
      currentLevel: 'buildings'
    });

  };

  const selectBuilding = (
    buildingId: string,
    state: NavigationState,
    setState: (updates: Partial<NavigationState>) => void
  ) => {
    if (!state.selectedProject) return;

    const building = state.selectedProject.buildings.find(b => b.id === buildingId);

    setState({
      selectedBuilding: building || null,
      selectedFloor: null,
      currentLevel: 'floors'
    });

  };

  const selectFloor = (
    floorId: string,
    state: NavigationState,
    setState: (updates: Partial<NavigationState>) => void
  ) => {
    if (!state.selectedBuilding) return;

    const floor = state.selectedBuilding.floors.find(f => f.id === floorId);

    setState({
      selectedFloor: floor || null,
      currentLevel: 'units'
    });

  };

  const navigateToLevel = (
    level: NavigationLevel,
    setState: (updates: Partial<NavigationState>) => void
  ) => {
    const updates = { currentLevel: level };
    setState(updates);

    console.log(`🧭 NavigationActions: Navigate to level ${level}`);
  };

  const reset = (setState: (updates: Partial<NavigationState>) => void) => {
    const resetUpdates = {
      selectedCompany: null,
      selectedProject: null,
      selectedBuilding: null,
      selectedFloor: null,
      currentLevel: 'companies' as NavigationLevel
    };

    setState(resetUpdates);

    console.log('🔄 NavigationActions: Reset navigation state');
  };

  const navigateToExistingPages = (
    type: 'properties' | 'projects' | 'buildings' | 'floorplan',
    state: NavigationState,
    filters?: any
  ) => {
    const url = buildNavigationUrl(type, state, filters);
    router.push(url);

    console.log(`🔗 NavigationActions: Navigate to ${url}`);
  };

  return {
    selectCompany,
    selectProject,
    selectBuilding,
    selectFloor,
    navigateToLevel,
    reset,
    navigateToExistingPages
  };
}