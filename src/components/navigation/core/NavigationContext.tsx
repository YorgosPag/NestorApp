'use client';

/**
 * Centralized Navigation Context
 * Extracted and generalized from ProjectHierarchyContext for global navigation
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAllActiveCompanies } from '@/services/companies.service';
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
  const router = useRouter();

  const [state, setState] = useState<NavigationState>({
    companies: [],
    selectedCompany: null,
    projects: [],
    selectedProject: null,
    selectedBuilding: null,
    selectedFloor: null,
    currentLevel: 'companies',
    loading: false,
    error: null
  });

  // Ref to track loading state to prevent duplicate calls
  const companiesLoadingRef = React.useRef(false);
  const companiesLoadedRef = React.useRef(false);

  // Load companies
  const loadCompanies = async () => {
    if (companiesLoadingRef.current || companiesLoadedRef.current) {
      return;
    }

    companiesLoadingRef.current = true;
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const companies = await getAllActiveCompanies();

      // Remove duplicates by id AND by companyName
      const uniqueCompanies = companies.reduce((unique, company) => {
        const duplicateById = unique.find(c => c.id === company.id);
        const duplicateByName = unique.find(c => c.companyName === company.companyName);

        if (!duplicateById && !duplicateByName) {
          unique.push(company);
        }
        return unique;
      }, [] as typeof companies);

      // Filter companies that have projects
      const companiesWithProjects = uniqueCompanies.filter(company => {
        const projectCompatibleId = getProjectCompatibleCompanyId(company.id!, company.companyName);

        // Show companies that we can map to project IDs
        const hasProjects = projectCompatibleId === 'pagonis' ||
                           company.companyName.includes('ΠΑΓΩΝΗΣ') ||
                           company.companyName.includes('Παγώνης');


        return hasProjects;
      });


      setState(prev => ({
        ...prev,
        companies: companiesWithProjects,
        loading: false,
        currentLevel: 'companies'
      }));

      companiesLoadedRef.current = true;

    } catch (error) {
      console.error('Error loading companies:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load companies',
        loading: false
      }));
    } finally {
      companiesLoadingRef.current = false;
    }
  };

  // Select company and load its projects
  const selectCompany = (companyId: string) => {
    const company = state.companies.find(c => c.id === companyId);
    setState(prev => ({
      ...prev,
      selectedCompany: company || null,
      selectedProject: null,
      selectedBuilding: null,
      selectedFloor: null,
      currentLevel: 'projects'
    }));

    if (company) {
      loadProjectsForCompany(company.id!);
    }
  };

  // Company ID mapping: Firestore ID → Project companyId
  const getProjectCompatibleCompanyId = (firestoreCompanyId: string, companyName: string): string => {
    // Known mapping for main company
    const companyMappings: Record<string, string> = {
      // Firestore ID → Project companyId
      '5djayaxc0X33wsE8T2uY': 'pagonis',  // Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.
    };

    // Check if we have a known mapping
    if (companyMappings[firestoreCompanyId]) {
      return companyMappings[firestoreCompanyId];
    }

    // Fallback: try to generate slug from company name
    if (companyName.includes('ΠΑΓΩΝΗΣ') || companyName.includes('Παγώνης')) {
      return 'pagonis';
    }


    // Default: use original ID (for backwards compatibility)
    return firestoreCompanyId;
  };

  // Load projects for selected company
  const loadProjectsForCompany = async (companyId: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Find the company to get its name
      const selectedCompany = state.companies.find(c => c.id === companyId);
      const projectCompatibleId = getProjectCompatibleCompanyId(
        companyId,
        selectedCompany?.companyName || ''
      );


      const response = await fetch(`/api/projects/by-company/${projectCompatibleId}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load projects');
      }

      const projectsData = result.projects;

      const projects: NavigationProject[] = projectsData.map((project: any) => {
        const buildings = (project.buildings || []).map((building: any) => ({
          id: building.id,
          name: building.name,
          floors: building.floors || []
        }));

        return {
          id: project.id.toString(),
          name: project.name,
          company: project.company || 'Unknown',
          buildings: buildings,
          parkingSpots: []
        };
      });

      setState(prev => ({
        ...prev,
        projects,
        loading: false
      }));

    } catch (error) {
      console.error('Error loading projects:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load projects',
        loading: false
      }));
    }
  };

  // Select project
  const selectProject = (projectId: string) => {
    const project = state.projects.find(p => p.id === projectId);
    setState(prev => ({
      ...prev,
      selectedProject: project || null,
      selectedBuilding: null,
      selectedFloor: null,
      currentLevel: 'buildings'
    }));
  };

  // Select building
  const selectBuilding = (buildingId: string) => {
    if (!state.selectedProject) return;

    const building = state.selectedProject.buildings.find(b => b.id === buildingId);
    setState(prev => ({
      ...prev,
      selectedBuilding: building || null,
      selectedFloor: null,
      currentLevel: 'floors'
    }));
  };

  // Select floor
  const selectFloor = (floorId: string) => {
    if (!state.selectedBuilding) return;

    const floor = state.selectedBuilding.floors.find(f => f.id === floorId);
    setState(prev => ({
      ...prev,
      selectedFloor: floor || null,
      currentLevel: 'units'
    }));
  };

  // Navigate to specific level
  const navigateToLevel = (level: NavigationLevel) => {
    setState(prev => ({ ...prev, currentLevel: level }));
  };

  // Reset navigation state
  const reset = () => {
    setState(prev => ({
      ...prev,
      selectedCompany: null,
      selectedProject: null,
      selectedBuilding: null,
      selectedFloor: null,
      currentLevel: 'companies'
    }));
  };

  // Navigate to existing pages with filters
  const navigateToExistingPages = (type: 'properties' | 'projects' | 'buildings' | 'floorplan', filters?: any) => {
    const baseFilters = {
      company: state.selectedCompany?.companyName,
      project: state.selectedProject?.name,
      building: state.selectedBuilding?.name,
      floor: state.selectedFloor?.name,
      ...filters
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
    const url = `/${type}${queryString ? '?' + queryString : ''}`;

    router.push(url);
  };

  // Load companies on mount
  useEffect(() => {
    // Reset refs for fresh start
    companiesLoadingRef.current = false;
    companiesLoadedRef.current = false;

    loadCompanies();
  }, []);

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