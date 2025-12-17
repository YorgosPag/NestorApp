'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_PROJECT_HIERARCHY = false;

import React, { createContext, useContext, useState, useEffect } from 'react';

// Import existing services
import { getProjectsByCompanyId, getProjectStructure } from '../../../services/projects.service';
import { getAllActiveCompanies } from '../../../services/companies.service';
import type { CompanyContact } from '../../../types/contacts';

// Mock function για getBuildingsByProjectId (προσωρινά)
const getBuildingsByProjectId = async (projectId: string) => {
  // Προσωρινή implementation - θα αντικατασταθεί με πραγματικό service

  return [];
};

export interface Unit {
  id: string;
  name: string;
  type: 'studio' | 'apartment' | 'maisonette' | 'commercial';
  floor: number;
  area: number;
  status: 'owner' | 'sold' | 'forRent' | 'forSale' | 'reserved';
}

export interface Floor {
  id: string;
  number: number;
  name: string;
  units: Unit[];
}

export interface Building {
  id: string;
  name: string;
  floors: Floor[];
  storageAreas?: Unit[]; // Αποθήκες (συνήθως υπόγεια)
}

export interface Project {
  id: string;
  name: string;
  company: string;
  buildings: Building[];
  parkingSpots?: ParkingSpot[];
}

export interface ParkingSpot {
  id: string;
  number: string;
  type: 'standard' | 'disabled' | 'electric';
  status: 'owner' | 'sold' | 'forRent' | 'forSale' | 'reserved';
  location: 'ground' | 'basement' | 'pilotis';
}

export interface ProjectHierarchy {
  companies: CompanyContact[];
  selectedCompany: CompanyContact | null;
  projects: Project[];
  selectedProject: Project | null;
  selectedBuilding: Building | null;
  selectedFloor: Floor | null;
  loading: boolean;
  error: string | null;
}

export interface ProjectHierarchyActions {
  loadCompanies: () => Promise<void>;
  selectCompany: (companyId: string) => void;
  loadProjects: () => Promise<void>;
  loadProjectsForCompany: (companyId: string) => Promise<void>;
  selectProject: (projectId: string) => void;
  selectBuilding: (buildingId: string) => void;
  selectFloor: (floorId: string) => void;
  getAvailableDestinations: () => DestinationOption[];
}

export interface DestinationOption {
  id: string;
  label: string;
  type: 'project' | 'building' | 'floor' | 'unit' | 'storage' | 'parking';
  parentId?: string;
  metadata?: {
    floorNumber?: number;
    category?: 'parking' | 'storage' | 'general';
  };
}

interface ProjectHierarchyContextType extends ProjectHierarchy, ProjectHierarchyActions {}

const ProjectHierarchyContext = createContext<ProjectHierarchyContextType | null>(null);

export function ProjectHierarchyProvider({ children }: { children: React.ReactNode }) {
  const [hierarchy, setHierarchy] = useState<ProjectHierarchy>({
    companies: [],
    selectedCompany: null,
    projects: [],
    selectedProject: null,
    selectedBuilding: null,
    selectedFloor: null,
    loading: false,
    error: null
  });

  // Ref to track if companies are already loading/loaded to prevent duplicate calls
  const companiesLoadingRef = React.useRef(false);
  const companiesLoadedRef = React.useRef(false);

  // Load companies first
  const loadCompanies = async () => {
    // Prevent duplicate loading
    if (companiesLoadingRef.current || companiesLoadedRef.current) {

      return;
    }

    companiesLoadingRef.current = true;
    setHierarchy(prev => ({ ...prev, loading: true, error: null }));
    
    try {

      const companies = await getAllActiveCompanies();

      // Remove duplicates by id AND by companyName (multiple deduplication strategies)
      const uniqueCompanies = companies.reduce((unique, company) => {
        // Check for duplicate by ID
        const duplicateById = unique.find(c => c.id === company.id);
        // Check for duplicate by company name
        const duplicateByName = unique.find(c => c.companyName === company.companyName);
        
        if (!duplicateById && !duplicateByName) {
          unique.push(company);
        } else {
          if (duplicateById) {
            console.warn(`🏢 Duplicate company by ID found: ${company.companyName} (${company.id})`);
          }
          if (duplicateByName) {
            // Only log first occurrence to reduce noise
            if (!unique.some(u => u.companyName === company.companyName)) {
              console.warn(`🏢 Duplicate company by NAME found: ${company.companyName}`);
            }
          }
        }
        return unique;
      }, [] as typeof companies);

      setHierarchy(prev => ({
        ...prev,
        companies: uniqueCompanies,
        loading: false
      }));

      // Mark as successfully loaded
      companiesLoadedRef.current = true;

    } catch (error) {
      console.error('Error loading companies from Firestore:', error);
      setHierarchy(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load companies from Firestore',
        loading: false
      }));
    } finally {
      companiesLoadingRef.current = false;
    }
  };

  // Select company and load its projects
  const selectCompany = (companyId: string) => {
    const company = hierarchy.companies.find(c => c.id === companyId);
    setHierarchy(prev => ({
      ...prev,
      selectedCompany: company || null,
      selectedProject: null,
      selectedBuilding: null,
      selectedFloor: null
    }));
    
    // Auto-load projects for selected company
    if (company) {
      loadProjectsForCompany(company.id!);
    }
  };

  const loadProjectsForCompany = async (companyId: string) => {
    setHierarchy(prev => ({ ...prev, loading: true, error: null }));
    
    try {

      // Find the company details for better logging
      const company = hierarchy.companies.find(c => c.id === companyId);

      // Load projects using API endpoint instead of server action

      const response = await fetch(`/api/projects/by-company/${companyId}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load projects from API');
      }

      // Fix: API επιστρέφει data στο result.data.projects, όχι result.projects
      const projectsData = result.data?.projects || [];

      // Transform to our structure with buildings data
      const projects: Project[] = projectsData.map((project) => {

        // Transform buildings if they exist in the project data
        const buildings: Building[] = (project.buildings || []).map((building: { id: string; name: string; floors?: unknown[] }) => ({
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

      setHierarchy(prev => ({
        ...prev,
        projects,
        loading: false
      }));

    } catch (error) {
      console.error('Error loading projects from Firestore:', error);
      setHierarchy(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load projects from Firestore',
        loading: false
      }));
    }
  };

  // Backward compatibility: load projects - now just loads companies
  const loadProjects = async () => {
    // Just load companies, don't auto-select any company
    await loadCompanies();
  };

  const selectProject = (projectId: string) => {
    const project = hierarchy.projects.find(p => p.id === projectId);
    setHierarchy(prev => ({
      ...prev,
      selectedProject: project || null,
      selectedBuilding: null,
      selectedFloor: null
    }));
  };

  const selectBuilding = (buildingId: string) => {
    if (!hierarchy.selectedProject) return;
    
    const building = hierarchy.selectedProject.buildings.find(b => b.id === buildingId);
    setHierarchy(prev => ({
      ...prev,
      selectedBuilding: building || null,
      selectedFloor: null
    }));
  };

  const selectFloor = (floorId: string) => {
    if (!hierarchy.selectedBuilding) return;
    
    const floor = hierarchy.selectedBuilding.floors.find(f => f.id === floorId);
    setHierarchy(prev => ({
      ...prev,
      selectedFloor: floor || null
    }));
  };

  const getAvailableDestinations = (): DestinationOption[] => {
    const destinations: DestinationOption[] = [];

    hierarchy.projects.forEach(project => {
      // Project level destinations
      destinations.push({
        id: project.id,
        label: `${project.name} - Γενική Κάτοψη`,
        type: 'project'
      });

      if (project.parkingSpots && project.parkingSpots.length > 0) {
        destinations.push({
          id: `${project.id}_parking`,
          label: `${project.name} - Θέσεις Στάθμευσης`,
          type: 'parking',
          parentId: project.id
        });
      }

      // Building level destinations
      project.buildings.forEach(building => {
        destinations.push({
          id: building.id,
          label: `${project.name} → ${building.name}`,
          type: 'building',
          parentId: project.id
        });

        // Floor level destinations
        building.floors.forEach(floor => {
          destinations.push({
            id: floor.id,
            label: `${project.name} → ${building.name} → ${floor.name}`,
            type: 'floor',
            parentId: building.id,
            metadata: { floorNumber: floor.number }
          });
        });

        // Storage destinations
        if (building.storageAreas && building.storageAreas.length > 0) {
          destinations.push({
            id: `${building.id}_storage`,
            label: `${project.name} → ${building.name} → Αποθήκες`,
            type: 'storage',
            parentId: building.id,
            metadata: { category: 'storage' }
          });
        }
      });
    });

    return destinations;
  };

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const contextValue: ProjectHierarchyContextType = {
    ...hierarchy,
    loadCompanies,
    selectCompany,
    loadProjects,
    loadProjectsForCompany,
    selectProject,
    selectBuilding,
    selectFloor,
    getAvailableDestinations
  };

  return (
    <ProjectHierarchyContext.Provider value={contextValue}>
      {children}
    </ProjectHierarchyContext.Provider>
  );
}

export function useProjectHierarchy() {
  const context = useContext(ProjectHierarchyContext);
  if (!context) {
    throw new Error('useProjectHierarchy must be used within ProjectHierarchyProvider');
  }
  return context;
}

export default ProjectHierarchyContext;