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
    projectsLoading: false,
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
      // Now we'll use the companies service to determine which companies have projects
      const companiesWithProjects = uniqueCompanies;


      setState(prev => ({
        ...prev,
        companies: companiesWithProjects,
        loading: false,
        currentLevel: 'companies'
      }));

      companiesLoadedRef.current = true;

      // Load projects for all companies immediately after companies are loaded
      console.log('🎯 NavigationContext: Companies loaded, now loading projects...');
      loadAllProjects(companiesWithProjects);

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
    // Now that we've updated the Firestore projects to use the correct Firebase IDs,
    // we directly return the Firebase company ID (no more hardcoded mapping)
    return firestoreCompanyId;
  };

  // Load projects for selected company
  const loadProjectsForCompany = async (companyId: string) => {
    // Don't replace all projects! Just set loading state
    setState(prev => ({ ...prev, loading: true, error: null }));

    console.log(`🔄 NavigationContext: Selected company ${companyId}, keeping all projects for warnings`);

    // For navigation purposes, we just filter the existing projects
    // We don't need to fetch again since loadAllProjects already loaded everything
    const companyProjects = state.projects.filter(p => p.companyId === companyId);

    console.log(`📋 NavigationContext: Company ${companyId} has ${companyProjects.length} projects from cached data`);

    // Just update the loading state, keep all projects intact
    setState(prev => ({
      ...prev,
      loading: false
    }));

    // Note: We keep all projects in state.projects so that the warning badges work correctly
    // The navigation UI can filter projects by selectedCompany when displaying the projects view
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

  // Load all projects for all companies
  const loadAllProjects = async (companies: NavigationCompany[] = state.companies) => {
    if (companies.length === 0) return;

    console.log('🚀 NavigationContext: Loading all projects for companies:', companies.map(c => c.companyName));
    setState(prev => ({ ...prev, projectsLoading: true }));

    try {
      const allProjects: NavigationProject[] = [];

      // Φορτώνουμε τα projects όλων των εταιρειών παράλληλα
      const projectPromises = companies.map(async (company) => {
        try {
          console.log(`🔍 NavigationContext: Fetching projects for company ${company.id} (${company.companyName})`);
          const response = await fetch(`/api/projects/by-company/${company.id}`);
          const result = await response.json();

          console.log(`📊 NavigationContext: Company ${company.companyName} returned:`, result);

          if (result.success) {
            return result.projects.map((project: any) => {
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
                parkingSpots: [],
                companyId: project.companyId || company.id // Ensure companyId is set
              };
            });
          }
          return [];
        } catch (error) {
          console.error(`Error loading projects for company ${company.id}:`, error);
          return [];
        }
      });

      const projectsResults = await Promise.all(projectPromises);

      // Flatten όλα τα projects
      projectsResults.forEach(projects => {
        allProjects.push(...projects);
      });

      console.log(`✅ NavigationContext: Loaded ${allProjects.length} total projects:`, allProjects);

      setState(prev => ({
        ...prev,
        projects: allProjects,
        projectsLoading: false
      }));

    } catch (error) {
      console.error('Error loading all projects:', error);
      setState(prev => ({ ...prev, projectsLoading: false }));
    }
  };

  // Load companies on mount
  useEffect(() => {
    // Reset refs for fresh start
    companiesLoadingRef.current = false;
    companiesLoadedRef.current = false;

    loadCompanies();
  }, []);

  // Load all projects when companies are loaded
  useEffect(() => {
    if (state.companies.length > 0) {
      console.log('🎯 NavigationContext: Companies loaded, triggering loadAllProjects');
      loadAllProjects();
    }
  }, [state.companies.length]);

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