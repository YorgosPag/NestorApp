/**
 * Navigation API Service
 * Handles all API calls for navigation data
 */

import { getAllActiveCompanies } from '@/services/companies.service';
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';
import type {
  NavigationCompany,
  NavigationProject,
  NavigationBuilding,
  NavigationFloor,
  NavigationUnit
} from '../types';

export class NavigationApiService {
  // 🏢 ENTERPRISE CACHING: Companies cache με memory optimization
  private static companiesCache: {
    data: NavigationCompany[] | null;
    timestamp: number;
    ttl: number;
  } = {
    data: null,
    timestamp: 0,
    ttl: 3 * 60 * 1000, // 3 λεπτά cache για navigation
  };

  /**
   * 🚀 PERFORMANCE OPTIMIZED: Load all active companies με caching
   */
  static async loadCompanies(): Promise<NavigationCompany[]> {
    // 🚀 PERFORMANCE: Check cache first
    const now = Date.now();
    const cache = NavigationApiService.companiesCache;

    if (cache.data && (now - cache.timestamp) < cache.ttl) {
      // console.log(`🏢 CACHE HIT: Returning ${cache.data.length} cached companies`);
      return cache.data;
    }

    // 🔄 Cache miss - fetch from service
    const companies = await getAllActiveCompanies();

    // 🚀 PERFORMANCE: Remove duplicates by id AND by companyName
    // 🏢 ENTERPRISE: Filter companies with valid id (required by NavigationCompany)
    const validCompanies = companies.filter((c): c is typeof c & { id: string } =>
      typeof c.id === 'string' && c.id.length > 0
    );

    const uniqueCompanies = validCompanies.reduce((unique, company) => {
      const duplicateById = unique.find(c => c.id === company.id);
      const duplicateByName = unique.find(c => c.companyName === company.companyName);

      if (!duplicateById && !duplicateByName) {
        unique.push(company);
      }
      return unique;
    }, [] as typeof validCompanies);

    // 🏢 ENTERPRISE: Transform to NavigationCompany type
    const navigationCompanies: NavigationCompany[] = uniqueCompanies.map(c => ({
      id: c.id,
      companyName: c.companyName,
      industry: c.industry,
      vatNumber: c.vatNumber
    }));

    // 💾 Update cache με fresh data
    cache.data = navigationCompanies;
    cache.timestamp = now;

    // console.log(`🏢 CACHED: Returning ${navigationCompanies.length} unique companies`);
    return navigationCompanies;
  }

  /**
   * 🚀 ENTERPRISE PHASE 2: Load projects for a specific company
   *
   * PERFORMANCE FIX: No longer loads buildings/floors/units cascade
   * Buildings/floors/units are loaded ON-DEMAND when user navigates
   *
   * This eliminates the N+1 cascade that caused 85+ API calls
   */
  static async loadProjectsForCompany(companyId: string): Promise<NavigationProject[]> {
    try {
      // 🏢 ENTERPRISE: Dynamic validation instead of hardcoded IDs
      if (!companyId || companyId.length < 10) {
        console.warn(`⚠️ Invalid companyId format: ${companyId}`);
        return [];
      }

      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      interface ProjectsApiResponse {
        projects: Array<{
          id: string;
          name?: string;
          projectCode?: string | null;
          status?: string;
        }>;
      }

      const projectsResult = await apiClient.get<ProjectsApiResponse>(`/api/projects/by-company/${companyId}`);

      if (!projectsResult?.projects) {
        return [];
      }

      // 🚀 ENTERPRISE PHASE 2: Return projects WITHOUT buildings/floors/units
      // Buildings/floors/units will be loaded ON-DEMAND (Phase 3: Lazy Loading)
      const projects: NavigationProject[] = projectsResult.projects.map(
        (project) => ({
          id: project.id,
          name: project.name || 'Unnamed Project',
          company: '', // Will be filled by caller if needed
          companyId,
          projectCode: project.projectCode || null,
          status: project.status || 'unknown',
          // 🚀 PERFORMANCE: Empty arrays - loaded on-demand
          buildings: []
        })
      );

      return projects;

    } catch (error) {
      console.error(`🚨 Failed to load projects for company ${companyId}:`, error);
      return [];
    }
  }

  /**
   * 🏢 ENTERPRISE: Load buildings for a specific project (ON-DEMAND)
   * Called when user expands/selects a project in navigation
   */
  static async loadBuildingsForProject(projectId: string): Promise<NavigationBuilding[]> {
    try {
      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      interface BuildingsApiResponse {
        buildings: Array<{
          id: string;
          name?: string;
        }>;
      }

      const buildingsResult = await apiClient.get<BuildingsApiResponse>(`/api/buildings?projectId=${projectId}`);

      // Return buildings with empty floors (loaded on-demand)
      return (buildingsResult?.buildings || []).map((building) => ({
        id: building.id,
        name: building.name || 'Unnamed Building',
        floors: [] // Loaded on-demand
      }));

    } catch (error) {
      console.error(`🚨 Failed to load buildings for project ${projectId}:`, error);
      return [];
    }
  }

  /**
   * 🏢 ENTERPRISE: Load floors for a specific building (ON-DEMAND)
   * Called when user expands/selects a building in navigation
   */
  static async loadFloorsForBuilding(buildingId: string): Promise<NavigationFloor[]> {
    try {
      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      interface FloorsApiResponse {
        floors?: Array<{
          id: string;
          name?: string;
          number?: number;
        }>;
        data?: {
          floors?: Array<{
            id: string;
            name?: string;
            number?: number;
          }>;
        };
      }

      const floorsResult = await apiClient.get<FloorsApiResponse>(`/api/floors?buildingId=${buildingId}`);

      const floors = floorsResult?.data?.floors || floorsResult?.floors || [];

      return floors.map((floor) => ({
        id: floor.id,
        name: floor.name || 'Unnamed Floor',
        number: floor.number || 0,
        units: [] // Loaded on-demand
      }));

    } catch (error) {
      console.error(`🚨 Failed to load floors for building ${buildingId}:`, error);
      return [];
    }
  }

  /**
   * 🏢 ENTERPRISE: Load units for a specific floor (ON-DEMAND)
   * Called when user expands/selects a floor in navigation
   */
  static async loadUnitsForFloor(floorId: string, buildingId: string): Promise<NavigationUnit[]> {
    try {
      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      interface UnitsApiResponse {
        units: Array<{
          id: string;
          name?: string;
          type?: string;
          floor?: number;
          area?: number;
          status?: string;
        }>;
      }

      const unitsResult = await apiClient.get<UnitsApiResponse>(`/api/units?floorId=${floorId}&buildingId=${buildingId}`);

      // 🏢 ENTERPRISE: Map to NavigationUnit with all required fields
      return (unitsResult?.units || []).map((unit): NavigationUnit => ({
        id: unit.id,
        name: unit.name || 'Unnamed Unit',
        type: (unit.type as NavigationUnit['type']) || 'apartment',
        floor: 0, // Default floor - actual value loaded on-demand
        area: 0,  // Default area - actual value loaded on-demand
        status: 'forSale' // Default status - actual value loaded on-demand
      }));

    } catch (error) {
      console.error(`🚨 Failed to load units for floor ${floorId}:`, error);
      return [];
    }
  }

  /**
   * 🏢 ENTERPRISE: Load units directly by building (for buildings without floors)
   */
  static async loadUnitsForBuilding(buildingId: string): Promise<NavigationUnit[]> {
    try {
      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      interface UnitsApiResponse {
        units: Array<{
          id: string;
          name?: string;
          type?: string;
          floor?: number;
          area?: number;
          status?: string;
        }>;
      }

      const unitsResult = await apiClient.get<UnitsApiResponse>(`/api/units?buildingId=${buildingId}`);

      // 🏢 ENTERPRISE: Map to NavigationUnit with all required fields
      return (unitsResult?.units || []).map((unit): NavigationUnit => ({
        id: unit.id,
        name: unit.name || 'Unnamed Unit',
        type: (unit.type as NavigationUnit['type']) || 'apartment',
        floor: unit.floor ?? 0,
        area: unit.area ?? 0,
        status: (unit.status as NavigationUnit['status']) || 'forSale'
      }));

    } catch (error) {
      console.error(`🚨 Failed to load units for building ${buildingId}:`, error);
      return [];
    }
  }

  /**
   * 🗑️ ENTERPRISE CACHE MANAGEMENT: Clear companies cache
   * Καλείται όταν αλλάζουν οι navigation companies (προσθήκη/αφαίρεση)
   */
  static clearCompaniesCache(): void {
    NavigationApiService.companiesCache.data = null;
    NavigationApiService.companiesCache.timestamp = 0;
  }

  /**
   * Load all projects for multiple companies in parallel
   */
  static async loadAllProjects(companies: NavigationCompany[]): Promise<NavigationProject[]> {
    if (companies.length === 0) return [];


    try {
      // Load projects for all companies in parallel
      const projectPromises = companies.map(company =>
        NavigationApiService.loadProjectsForCompany(company.id)
      );

      const projectsResults = await Promise.all(projectPromises);

      // Flatten all projects
      const allProjects: NavigationProject[] = [];
      projectsResults.forEach(projects => {
        allProjects.push(...projects);
      });

      return allProjects;

    } catch (error) {
      return [];
    }
  }
}