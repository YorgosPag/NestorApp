/**
 * Navigation API Service
 * Handles all API calls for navigation data
 */

import { getAllActiveCompanies } from '@/services/companies.service';
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type {
  NavigationCompany,
  NavigationProject,
  NavigationBuilding,
  NavigationFloor,
  NavigationProperty
} from '../types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('NavigationApiService');

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
      // logger.info(`CACHE HIT: Returning ${cache.data.length} cached companies`);
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

    // logger.info(`CACHED: Returning ${navigationCompanies.length} unique companies`);
    return navigationCompanies;
  }

  /**
   * 🚀 ENTERPRISE PHASE 2: Load projects for a specific company
   *
   * PERFORMANCE FIX: No longer loads buildings/floors/properties cascade
   * Buildings/floors/properties are loaded ON-DEMAND when user navigates
   *
   * This eliminates the N+1 cascade that caused 85+ API calls
   */
  static async loadProjectsForCompany(companyId: string): Promise<NavigationProject[]> {
    try {
      // 🏢 ENTERPRISE: Dynamic validation instead of hardcoded IDs
      if (!companyId || companyId.length < 10) {
        logger.warn('Invalid companyId format', { companyId });
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

      const projectsResult = await apiClient.get<ProjectsApiResponse>(API_ROUTES.PROJECTS.BY_COMPANY(companyId));

      if (!projectsResult?.projects) {
        return [];
      }

      // 🚀 ENTERPRISE PHASE 2: Return projects WITHOUT buildings/floors/properties
      // Buildings/floors/properties will be loaded ON-DEMAND (Phase 3: Lazy Loading)
      const projects: NavigationProject[] = projectsResult.projects.map(
        (project) => ({
          id: project.id,
          name: project.name || 'Unnamed Project',
          company: '', // Will be filled by caller if needed
          companyId,
          linkedCompanyId: companyId, // ADR-232: Navigation implies business link
          projectCode: project.projectCode || null,
          status: project.status || 'unknown',
          // 🚀 PERFORMANCE: Empty arrays - loaded on-demand
          buildings: []
        })
      );

      return projects;

    } catch (error) {
      logger.error('Failed to load projects for company', { companyId, error });
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

      const buildingsResult = await apiClient.get<BuildingsApiResponse>(`${API_ROUTES.BUILDINGS.LIST}?projectId=${projectId}`);

      // Return buildings with empty floors (loaded on-demand)
      return (buildingsResult?.buildings || []).map((building) => ({
        id: building.id,
        name: building.name || 'Unnamed Building',
        code: building.code,
        floors: [] // Loaded on-demand
      }));

    } catch (error) {
      logger.error('Failed to load buildings for project', { projectId, error });
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

      const floorsResult = await apiClient.get<FloorsApiResponse>(`${API_ROUTES.FLOORS.LIST}?buildingId=${buildingId}`);

      const floors = floorsResult?.data?.floors || floorsResult?.floors || [];

      return floors.map((floor) => ({
        id: floor.id,
        name: floor.name || 'Unnamed Floor',
        number: floor.number || 0,
        properties: [] // Loaded on-demand
      }));

    } catch (error) {
      logger.error('Failed to load floors for building', { buildingId, error });
      return [];
    }
  }

  /**
   * 🏢 ENTERPRISE: Load properties for a specific floor (ON-DEMAND)
   * Called when user expands/selects a floor in navigation
   */
  static async loadPropertiesForFloor(floorId: string, buildingId: string): Promise<NavigationProperty[]> {
    try {
      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      interface PropertiesApiResponse {
        units: Array<{
          id: string;
          name?: string;
          type?: string;
          floor?: number;
          area?: number;
          status?: string;
        }>;
      }

      const propertiesResult = await apiClient.get<PropertiesApiResponse>(`${API_ROUTES.PROPERTIES.LIST}?floorId=${floorId}&buildingId=${buildingId}`);

      // 🏢 ENTERPRISE: Map to NavigationProperty with all required fields
      return (propertiesResult?.units || []).map((property): NavigationProperty => ({
        id: property.id,
        name: property.name || 'Unnamed Property',
        type: (property.type as NavigationProperty['type']) || 'apartment',
        floor: 0, // Default floor - actual value loaded on-demand
        area: 0,  // Default area - actual value loaded on-demand
        status: 'forSale' // Default status - actual value loaded on-demand
      }));

    } catch (error) {
      logger.error('Failed to load properties for floor', { floorId, error });
      return [];
    }
  }

  /**
   * 🏢 ENTERPRISE: Load properties directly by building (for buildings without floors)
   */
  static async loadPropertiesForBuilding(buildingId: string): Promise<NavigationProperty[]> {
    try {
      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      interface PropertiesApiResponse {
        units: Array<{
          id: string;
          name?: string;
          type?: string;
          floor?: number;
          area?: number;
          status?: string;
        }>;
      }

      const propertiesResult = await apiClient.get<PropertiesApiResponse>(`${API_ROUTES.PROPERTIES.LIST}?buildingId=${buildingId}`);

      // 🏢 ENTERPRISE: Map to NavigationProperty with all required fields
      return (propertiesResult?.units || []).map((property): NavigationProperty => ({
        id: property.id,
        name: property.name || 'Unnamed Property',
        type: (property.type as NavigationProperty['type']) || 'apartment',
        floor: property.floor ?? 0,
        area: property.area ?? 0,
        status: (property.status as NavigationProperty['status']) || 'forSale'
      }));

    } catch (error) {
      logger.error('Failed to load properties for building', { buildingId, error });
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

    } catch (_error) {
      return [];
    }
  }
}