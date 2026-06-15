'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_PROJECT_HIERARCHY = false;

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// 🏢 ENTERPRISE: Centralized debug system
import { dlog, dwarn, derr } from '../debug';
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { CompanyContact } from '../../../types/contacts';
// 🔐 ENTERPRISE: Auth hook for authentication-ready gating
import { useAuth } from '@/auth/hooks/useAuth';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatBuildingLabel } from '@/lib/entity-formatters';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService, type ProjectUpdatedPayload, type ContactCreatedPayload } from '@/services/realtime';
import { isFloorKind } from '@/utils/floor-naming';
import type {
  Floor,
  Building,
  Project,
  ProjectHierarchy,
  DestinationOption,
  ProjectHierarchyContextType,
} from './project-hierarchy-types';

// Public hierarchy types live in `project-hierarchy-types.ts` (file-size split).
// Re-export ΟΛΟΥΣ για back-compat — εξωτερικοί consumers τους εισάγουν από εδώ.
export type {
  Unit,
  Floor,
  Building,
  Project,
  ParkingSpot,
  ProjectHierarchy,
  ProjectHierarchyActions,
  DestinationOption,
} from './project-hierarchy-types';
import { applyUpdates } from '@/lib/utils';

const ProjectHierarchyContext = createContext<ProjectHierarchyContextType | null>(null);

export function ProjectHierarchyProvider({ children }: { children: React.ReactNode }) {
  // 🔐 ENTERPRISE: Auth-ready gating - wait for authentication before API calls
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);

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
  // forceRefresh: bypasses the "already loaded" guard — used by real-time events
  const loadCompanies = useCallback(async (forceRefresh = false) => {
    // 🔐 ENTERPRISE: Auth-ready gating - don't attempt API calls without authentication
    if (authLoading) {
      dlog('ProjectHierarchy', 'Waiting for auth state...');
      return; // Will be called again when auth is ready via useEffect
    }

    if (!user) {
      dlog('ProjectHierarchy', 'User not authenticated - skipping company load');
      return; // User not logged in - don't attempt API call
    }

    // Prevent duplicate loading (unless force-refreshing)
    if (companiesLoadingRef.current || (!forceRefresh && companiesLoadedRef.current)) {

      return;
    }

    companiesLoadingRef.current = true;
    setHierarchy(prev => ({ ...prev, loading: true, error: null }));

    try {
      dlog('ProjectHierarchy', 'Starting to load companies via Enterprise API Client...');
      interface CompaniesApiResponse {
        companies: CompanyContact[];
        count: number;
        cached: boolean;
      }

      const url = forceRefresh ? `${API_ROUTES.COMPANIES.LIST}?refresh=true` : API_ROUTES.COMPANIES.LIST;
      const result = await apiClient.get<CompaniesApiResponse>(url);

      const companies = result?.companies || [];
      dlog('ProjectHierarchy', 'Companies loaded successfully:', companies.length);

      const uniqueCompanies = companies.reduce((unique: CompanyContact[], company: CompanyContact) => {
        const duplicateById = unique.find((c: CompanyContact) => c.id === company.id);
        const duplicateByName = unique.find((c: CompanyContact) => c.companyName === company.companyName);
        if (!duplicateById && !duplicateByName) {
          unique.push(company);
        } else {
          if (duplicateById) dwarn('ProjectHierarchy', `Duplicate company by ID: ${company.companyName} (${company.id})`);
          if (duplicateByName) dwarn('ProjectHierarchy', `Duplicate company by NAME: ${company.companyName}`);
        }
        return unique;
      }, [] as typeof companies);

      setHierarchy(prev => ({
        ...prev,
        companies: uniqueCompanies,
        loading: false
      }));
      companiesLoadedRef.current = true;

    } catch (error) {
      derr('ProjectHierarchy', 'Error loading companies:', error);

      // Enhanced error details for debugging
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : 'No stack trace';

      derr('ProjectHierarchy', 'Error details:', {
        message: errorMessage,
        stack: errorStack,
        type: typeof error,
        error: error
      });

      setHierarchy(prev => ({
        ...prev,
        error: t('modal.loadError', { message: errorMessage }),
        loading: false
      }));
    } finally {
      companiesLoadingRef.current = false;
    }
  }, [authLoading, user]);

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
      dlog('ProjectHierarchy', `Loading projects for company: ${company?.companyName || companyId}`);

      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      interface ProjectsApiResponse {
        projects: Array<{
          id: string | number;
          name: string;
          company?: string;
          buildings?: Array<{ id: string; name: string; code?: string; floors?: unknown[] }>;
        }>;
        count: number;
      }

      const result = await apiClient.get<ProjectsApiResponse>(API_ROUTES.PROJECTS.BY_COMPANY(companyId));
      const projectsData = result?.projects || [];

      // Transform to our structure with buildings data
      const projects: Project[] = projectsData.map((project: { id: string | number; name: string; company?: string; buildings?: Array<{ id: string; name: string; code?: string; floors?: unknown[] }> }) => {
        const buildings: Building[] = (project.buildings || []).map((building: { id: string; name: string; code?: string; floors?: unknown[] }) => {
          const floors: Floor[] = Array.isArray(building.floors)
            ? building.floors.reduce<Floor[]>((acc, floor) => {
              if (!floor || typeof floor !== 'object') {
                return acc;
              }
              const floorRecord = floor as Record<string, unknown>;
              const id = floorRecord.id;
              const name = floorRecord.name;
              if ((typeof id !== 'string' && typeof id !== 'number') || typeof name !== 'string') {
                return acc;
              }
              acc.push({
                id: String(id),
                name,
                number: typeof floorRecord.number === 'number' ? floorRecord.number : 0,
                elevation: typeof floorRecord.elevation === 'number' ? floorRecord.elevation : undefined, // ADR-399: keep storey elevation (else 3D stacks floors at Y=0)
                kind: isFloorKind(floorRecord.kind) ? floorRecord.kind : undefined, // ADR-461 — special-level flag (undefined when data lacks it → no badge)
                units: []
              });
              return acc;
            }, [])
            : [];
          return {
            id: building.id,
            name: building.name,
            code: building.code,
            floors
          };
        });
        
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
      derr('ProjectHierarchy', 'Error loading projects from Firestore:', error);
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

  // Direct setters — bypass lookup, accept objects directly
  // Used by SimpleProjectDialog which loads buildings/floors from separate APIs
  const setBuildingDirect = (building: Building | null) => {
    setHierarchy(prev => ({
      ...prev,
      selectedBuilding: building,
      selectedFloor: null
    }));
  };

  const setFloorDirect = (floor: Floor | null) => {
    setHierarchy(prev => ({
      ...prev,
      selectedFloor: floor
    }));
  };

  const getAvailableDestinations = (): DestinationOption[] => {
    const destinations: DestinationOption[] = [];

    hierarchy.projects.forEach(project => {
      // Project level destinations
      destinations.push({
        id: project.id,
        label: t('destination.generalFloorplan', { name: project.name }),
        type: 'project'
      });

      if (project.parkingSpots && project.parkingSpots.length > 0) {
        destinations.push({
          id: `${project.id}_parking`,
          label: t('destination.parkingSpots', { name: project.name }),
          type: 'parking',
          parentId: project.id
        });
      }

      // Building level destinations
      project.buildings.forEach(building => {
        destinations.push({
          id: building.id,
          label: `${project.name} → ${formatBuildingLabel(building.code, building.name)}`,
          type: 'building',
          parentId: project.id
        });

        // Floor level destinations
        const bLabel = formatBuildingLabel(building.code, building.name);
        building.floors.forEach(floor => {
          destinations.push({
            id: floor.id,
            label: `${project.name} → ${bLabel} → ${floor.name}`,
            type: 'floor',
            parentId: building.id,
            metadata: { floorNumber: floor.number }
          });
        });

        // Storage destinations
        if (building.storageAreas && building.storageAreas.length > 0) {
          destinations.push({
            id: `${building.id}_storage`,
            label: t('destination.storages', { project: project.name, building: bLabel }),
            type: 'storage',
            parentId: building.id,
            metadata: { category: 'storage' }
          });
        }
      });
    });

    return destinations;
  };

  // 🔐 ENTERPRISE: Load projects when auth is ready
  // Dependencies: user, authLoading - re-runs when authentication state changes
  useEffect(() => {
    // Only load when auth is ready and user is logged in
    if (!authLoading && user) {
      dlog('ProjectHierarchy', 'Auth ready - loading companies...');
      loadProjects();
    }
  }, [user, authLoading]);

  // 🏢 ENTERPRISE: Centralized Real-time Service (ZERO DUPLICATES)
  // Uses RealtimeService.subscribeToProjectUpdates() for cross-page sync
  useEffect(() => {
    const handleProjectUpdate = (payload: ProjectUpdatedPayload) => {
      dlog('ProjectHierarchy', 'Applying update for project:', payload.projectId);

      setHierarchy(prev => ({
        ...prev,
        projects: prev.projects.map(project =>
          project.id === payload.projectId
            ? applyUpdates(project, payload.updates)
            : project
        ),
        // Also update selectedProject if it's the one being updated
        selectedProject: prev.selectedProject?.id === payload.projectId
          ? applyUpdates(prev.selectedProject, payload.updates)
          : prev.selectedProject
      }));
    };

    // Subscribe to project updates (same-page + cross-page)
    const unsubscribe = RealtimeService.subscribe('PROJECT_UPDATED', handleProjectUpdate);

    return unsubscribe;
  }, []);

  // 🏢 ENTERPRISE: Real-time company creation sync
  // When a new company contact is created anywhere in the app, auto-refresh the dropdown
  useEffect(() => {
    const handleContactCreated = (payload: ContactCreatedPayload) => {
      // Only refresh when a COMPANY contact is created (not individual/service)
      if (payload.contact.type === 'company') {
        dlog('ProjectHierarchy', 'New company created — refreshing companies list:', payload.contactId);
        loadCompanies(true);
      }
    };

    const unsubscribe = RealtimeService.subscribe('CONTACT_CREATED', handleContactCreated);

    return unsubscribe;
  }, [loadCompanies]);

  const contextValue: ProjectHierarchyContextType = {
    ...hierarchy,
    loadCompanies,
    selectCompany,
    loadProjects,
    loadProjectsForCompany,
    selectProject,
    selectBuilding,
    selectFloor,
    setBuildingDirect,
    setFloorDirect,
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

// ADR-371: optional variant for read-only consumers (Properties pipeline) that
// mount DXF-Viewer outside ProjectHierarchyProvider — returns null vs. throw.
export function useProjectHierarchyOptional(): ProjectHierarchyContextType | null {
  return useContext(ProjectHierarchyContext);
}

export default ProjectHierarchyContext;
