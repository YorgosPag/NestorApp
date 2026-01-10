/**
 * Navigation API Service
 * Handles all API calls for navigation data
 */

import { getAllActiveCompanies } from '@/services/companies.service';
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
    const uniqueCompanies = companies.reduce((unique, company) => {
      const duplicateById = unique.find(c => c.id === company.id);
      const duplicateByName = unique.find(c => c.companyName === company.companyName);

      if (!duplicateById && !duplicateByName) {
        unique.push(company);
      }
      return unique;
    }, [] as typeof companies);

    // 💾 Update cache με fresh data
    cache.data = uniqueCompanies;
    cache.timestamp = now;

    // console.log(`🏢 CACHED: Returning ${uniqueCompanies.length} unique companies`);
    return uniqueCompanies;
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

      // 🚀 PERFORMANCE: Single API call - NO cascade!
      const projectsResponse = await fetch(`/api/projects/by-company/${companyId}`);
      if (!projectsResponse.ok) {
        console.warn(`Failed to load projects for company ${companyId}`);
        return [];
      }

      const projectsResult = await projectsResponse.json();
      if (!projectsResult.success || !projectsResult.data?.projects) {
        return [];
      }

      // 🚀 ENTERPRISE PHASE 2: Return projects WITHOUT buildings/floors/units
      // Buildings/floors/units will be loaded ON-DEMAND (Phase 3: Lazy Loading)
      const projects: NavigationProject[] = projectsResult.data.projects.map(
        (project: Record<string, unknown>) => ({
          id: project.id as string,
          name: project.name as string || 'Unnamed Project',
          company: '', // Will be filled by caller if needed
          companyId,
          projectCode: project.projectCode as string | null || null,
          status: project.status as string || 'unknown',
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
      const buildingsResponse = await fetch(`/api/buildings?projectId=${projectId}`);
      if (!buildingsResponse.ok) {
        console.warn(`Failed to load buildings for project ${projectId}`);
        return [];
      }

      const buildingsResult = await buildingsResponse.json();
      if (!buildingsResult.success) {
        return [];
      }

      // Return buildings with empty floors (loaded on-demand)
      return (buildingsResult.buildings || []).map((building: Record<string, unknown>) => ({
        id: building.id as string,
        name: building.name as string || 'Unnamed Building',
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
      const floorsResponse = await fetch(`/api/floors?buildingId=${buildingId}`);
      if (!floorsResponse.ok) {
        console.warn(`Failed to load floors for building ${buildingId}`);
        return [];
      }

      const floorsResult = await floorsResponse.json();
      if (!floorsResult.success) {
        return [];
      }

      const floors = floorsResult.data?.floors || floorsResult.floors || [];

      return floors.map((floor: Record<string, unknown>) => ({
        id: floor.id as string,
        name: floor.name as string || 'Unnamed Floor',
        number: floor.number as number || 0,
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
      const unitsResponse = await fetch(`/api/units?floorId=${floorId}&buildingId=${buildingId}`);
      if (!unitsResponse.ok) {
        console.warn(`Failed to load units for floor ${floorId}`);
        return [];
      }

      const unitsResult = await unitsResponse.json();
      if (!unitsResult.success) {
        return [];
      }

      return (unitsResult.units || []).map((unit: Record<string, unknown>) => ({
        id: unit.id as string,
        name: unit.name as string || 'Unnamed Unit',
        type: unit.type as string || 'unknown'
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
      const unitsResponse = await fetch(`/api/units?buildingId=${buildingId}`);
      if (!unitsResponse.ok) {
        console.warn(`Failed to load units for building ${buildingId}`);
        return [];
      }

      const unitsResult = await unitsResponse.json();
      if (!unitsResult.success) {
        return [];
      }

      return (unitsResult.units || []).map((unit: Record<string, unknown>) => ({
        id: unit.id as string,
        name: unit.name as string || 'Unnamed Unit',
        type: unit.type as string || 'unknown'
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