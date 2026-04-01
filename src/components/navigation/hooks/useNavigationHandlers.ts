/**
 * Navigation Handlers Hook
 * Custom hook for managing all navigation event handlers
 *
 * 🏢 ENTERPRISE ARCHITECTURE (Επιλογή Α):
 * 'floors' αφαιρέθηκε από navigation levels.
 * Ιεραρχία: Companies → Projects → Buildings → Units → Actions
 */

import { useState } from 'react';
import { useNavigation } from '../core/NavigationContext';

/** 🏢 ENTERPRISE: Mobile Level type χωρίς 'floors' (Επιλογή Α) */
type MobileLevel = 'companies' | 'projects' | 'buildings' | 'properties' | 'actions' | 'extras';

interface UseNavigationHandlersProps {
  onMobileLevelChange?: (level: MobileLevel) => void;
}

interface UseNavigationHandlersReturn {
  // Mobile navigation
  mobileLevel: MobileLevel;
  setMobileLevel: (level: MobileLevel) => void;

  // Navigation handlers
  handleCompanySelect: (companyId: string) => void;
  handleProjectSelect: (projectId: string) => void;
  handleBuildingSelect: (buildingId: string) => void;
  /** @deprecated 🏢 ENTERPRISE: Floors αφαιρέθηκαν από navigation (Επιλογή Α) */
  handleFloorSelect: (floorId: string) => void;
  handlePropertySelect: (propertyId: string) => void;
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
    // 🏢 ENTERPRISE: selectedFloor αφαιρέθηκε - Floors δεν είναι navigation level (Επιλογή Α)
    selectCompany,
    selectProject,
    selectBuilding,
    selectFloor,
    navigateToExistingPages
  } = useNavigation();

  // 🏢 ENTERPRISE: Mobile navigation level state χωρίς 'floors' (Επιλογή Α)
  const [mobileLevel, setMobileLevelState] = useState<MobileLevel>('companies');

  // Wrapper για mobile level changes
  const setMobileLevel = (level: MobileLevel) => {
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

  // 🏢 ENTERPRISE (Επιλογή Α): Building → Units (skip Floors)
  const handleBuildingSelect = (buildingId: string) => {
    selectBuilding(buildingId);
    if (isMobile) setMobileLevel('properties');
  };

  // 🏢 ENTERPRISE: Deprecated - Floors δεν είναι navigation level
  const handleFloorSelect = (floorId: string) => {
    selectFloor(floorId);
    // No-op for mobile level change - floors removed from navigation
  };

  const handlePropertySelect = (_propertyId: string) => {
    if (isMobile) setMobileLevel('actions');
  };

  const handleNavigateToPage = (type: 'properties' | 'projects' | 'buildings' | 'floorplan') => {
    navigateToExistingPages(type);
  };

  // 🏢 ENTERPRISE: Mobile back navigation χωρίς 'floors' (Επιλογή Α)
  const handleMobileBack = () => {
    switch (mobileLevel) {
      case 'projects':
        setMobileLevel('companies');
        break;
      case 'buildings':
        setMobileLevel('projects');
        break;
      // 🏢 ENTERPRISE: 'floors' case αφαιρέθηκε (Επιλογή Α)
      case 'properties':
        setMobileLevel('buildings'); // Back to buildings (skip floors)
        break;
      case 'actions':
        setMobileLevel('properties');
        break;
      case 'extras':
        setMobileLevel('actions');
        break;
    }
  };

  // 🏢 ENTERPRISE: Get current title for mobile χωρίς 'floors' (Επιλογή Α)
  const getMobileTitle = (): string => {
    switch (mobileLevel) {
      case 'companies': return 'Εταιρείες';
      case 'projects': return selectedCompany?.companyName || 'Έργα';
      case 'buildings': return selectedProject?.name || 'Κτίρια';
      // 🏢 ENTERPRISE: 'floors' case αφαιρέθηκε (Επιλογή Α)
      case 'properties': return selectedBuilding?.name || 'Μονάδες';
      case 'actions': return 'Ενέργειες';
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
    handlePropertySelect,
    handleNavigateToPage,
    handleMobileBack,
    getMobileTitle,
    isMobile
  };
}