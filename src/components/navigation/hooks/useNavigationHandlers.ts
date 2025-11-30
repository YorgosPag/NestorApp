/**
 * Navigation Handlers Hook
 * Custom hook for managing all navigation event handlers
 */

import { useState } from 'react';
import { useNavigation } from '../core/NavigationContext';

interface UseNavigationHandlersProps {
  onMobileLevelChange?: (level: 'companies' | 'projects' | 'buildings' | 'floors' | 'units' | 'extras') => void;
}

interface UseNavigationHandlersReturn {
  // Mobile navigation
  mobileLevel: 'companies' | 'projects' | 'buildings' | 'floors' | 'units' | 'extras';
  setMobileLevel: (level: 'companies' | 'projects' | 'buildings' | 'floors' | 'units' | 'extras') => void;

  // Navigation handlers
  handleCompanySelect: (companyId: string) => void;
  handleProjectSelect: (projectId: string) => void;
  handleBuildingSelect: (buildingId: string) => void;
  handleFloorSelect: (floorId: string) => void;
  handleNavigateToPage: (type: 'properties' | 'projects' | 'buildings' | 'floorplan') => void;

  // Mobile navigation
  handleMobileBack: () => void;
  getMobileTitle: () => string;

  // Utilities
  isMobile: boolean;
}

export function useNavigationHandlers(props: UseNavigationHandlersProps = {}): UseNavigationHandlersReturn {
  const { onMobileLevelChange } = props;

  const {
    selectedCompany,
    selectedProject,
    selectedBuilding,
    selectedFloor,
    selectCompany,
    selectProject,
    selectBuilding,
    selectFloor,
    navigateToExistingPages
  } = useNavigation();

  // Mobile navigation level state
  const [mobileLevel, setMobileLevelState] = useState<'companies' | 'projects' | 'buildings' | 'floors' | 'units' | 'extras'>('companies');

  // Wrapper για mobile level changes
  const setMobileLevel = (level: 'companies' | 'projects' | 'buildings' | 'floors' | 'units' | 'extras') => {
    setMobileLevelState(level);
    onMobileLevelChange?.(level);
  };

  // Check if mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Navigation handlers
  const handleCompanySelect = (companyId: string) => {
    selectCompany(companyId);
    if (isMobile) setMobileLevel('projects');
  };

  const handleProjectSelect = (projectId: string) => {
    selectProject(projectId);
    if (isMobile) setMobileLevel('buildings');
  };

  const handleBuildingSelect = (buildingId: string) => {
    selectBuilding(buildingId);
    if (isMobile) setMobileLevel('floors');
  };

  const handleFloorSelect = (floorId: string) => {
    selectFloor(floorId);
    if (isMobile) setMobileLevel('units');
  };

  const handleNavigateToPage = (type: 'properties' | 'projects' | 'buildings' | 'floorplan') => {
    navigateToExistingPages(type);
  };

  // Mobile back navigation
  const handleMobileBack = () => {
    switch (mobileLevel) {
      case 'projects':
        setMobileLevel('companies');
        break;
      case 'buildings':
        setMobileLevel('projects');
        break;
      case 'floors':
        setMobileLevel('buildings');
        break;
      case 'units':
        setMobileLevel('floors');
        break;
      case 'extras':
        setMobileLevel('units');
        break;
    }
  };

  // Get current title for mobile
  const getMobileTitle = (): string => {
    switch (mobileLevel) {
      case 'companies': return 'Εταιρείες';
      case 'projects': return selectedCompany?.companyName || 'Έργα';
      case 'buildings': return selectedProject?.name || 'Κτίρια';
      case 'floors': return selectedBuilding?.name || 'Όροφοι';
      case 'units': return selectedFloor?.name || 'Μονάδες';
      case 'extras': return 'Παρκινγκ & Αποθήκες';
    }
  };

  return {
    mobileLevel,
    setMobileLevel,
    handleCompanySelect,
    handleProjectSelect,
    handleBuildingSelect,
    handleFloorSelect,
    handleNavigateToPage,
    handleMobileBack,
    getMobileTitle,
    isMobile
  };
}