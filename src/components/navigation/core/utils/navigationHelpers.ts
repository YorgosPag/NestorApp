/**
 * Navigation Helper Functions
 * Utility functions for navigation operations
 */

import type { NavigationState, NavigationLevel } from '../types';

/**
 * Build URL with navigation filters
 */
export function buildNavigationUrl(
  type: 'properties' | 'projects' | 'buildings' | 'floorplan',
  state: NavigationState,
  additionalFilters?: Record<string, any>
): string {
  const baseFilters = {
    company: state.selectedCompany?.companyName,
    project: state.selectedProject?.name,
    building: state.selectedBuilding?.name,
    floor: state.selectedFloor?.name,
    ...additionalFilters
  };

  // Remove undefined values
  const cleanFilters = Object.fromEntries(
    Object.entries(baseFilters).filter(([_, value]) => value !== undefined && value !== null)
  );

  const searchParams = new URLSearchParams();
  Object.entries(cleanFilters).forEach(([key, value]) => {
    if (value) searchParams.append(key, value.toString());
  });

  const queryString = searchParams.toString();
  return `/${type}${queryString ? '?' + queryString : ''}`;
}

/**
 * Reset navigation state to initial values
 */
export function resetNavigationState(state: NavigationState): Partial<NavigationState> {
  return {
    selectedCompany: null,
    selectedProject: null,
    selectedBuilding: null,
    selectedFloor: null,
    currentLevel: 'companies'
  };
}

/**
 * Update navigation level and clear dependent selections
 */
export function updateNavigationLevel(
  currentState: NavigationState,
  level: NavigationLevel
): Partial<NavigationState> {
  const updates: Partial<NavigationState> = {
    currentLevel: level
  };

  // Clear dependent selections based on level
  switch (level) {
    case 'companies':
      updates.selectedCompany = null;
      updates.selectedProject = null;
      updates.selectedBuilding = null;
      updates.selectedFloor = null;
      break;
    case 'projects':
      updates.selectedProject = null;
      updates.selectedBuilding = null;
      updates.selectedFloor = null;
      break;
    case 'buildings':
      updates.selectedBuilding = null;
      updates.selectedFloor = null;
      break;
    case 'floors':
      updates.selectedFloor = null;
      break;
    // 'units' level doesn't clear anything
  }

  return updates;
}

/**
 * Company ID mapping compatibility function
 * @deprecated Use direct Firebase IDs instead
 */
export function getProjectCompatibleCompanyId(firestoreCompanyId: string, companyName: string): string {
  // Now that we've updated the Firestore projects to use the correct Firebase IDs,
  // we directly return the Firebase company ID (no more hardcoded mapping)
  return firestoreCompanyId;
}