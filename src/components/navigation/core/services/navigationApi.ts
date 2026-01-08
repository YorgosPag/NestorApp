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
   * Load projects for a specific company
   */
  static async loadProjectsForCompany(companyId: string): Promise<NavigationProject[]> {
    try {
      // 🏢 ENTERPRISE: Dynamic validation instead of hardcoded IDs
      if (!companyId || companyId.length < 10) {
        console.warn(`⚠️ Invalid companyId format: ${companyId}`);
        return [];
      }

      // 🏢 ENTERPRISE PATTERN: Load real data from normalized collections FOR ALL COMPANIES
      // 🎯 PRODUCTION: Reduced logging verbosity για καθαρότερη κονσόλα
      // console.log(`🔍 Loading projects for company: ${companyId}`);

      // Load projects from projects API (normalized structure)
      const projectsResponse = await fetch(`/api/projects/by-company/${companyId}`);
      if (!projectsResponse.ok) {
        console.warn(`Failed to load projects for company ${companyId}`);
        return [];
      }

      const projectsResult = await projectsResponse.json();
      if (!projectsResult.success || !projectsResult.data?.projects) {
        return [];
      }

      // For each project, load buildings and floors using enterprise normalized structure
      const projectsWithBuildings = await Promise.all(
        projectsResult.data.projects.map(async (project: NavigationProject) => {
          try {

            // Load buildings for this project
            const buildingsResponse = await fetch(`/api/buildings?projectId=${project.id}`);
            const buildingsResult = await buildingsResponse.json();

            if (!buildingsResult.success) {
              return { ...project, buildings: [], companyId };
            }

            // For each building, load floors from normalized floors collection
            const buildingsWithFloors = await Promise.all(
              buildingsResult.buildings.map(async (building: NavigationBuilding) => {
                try {
                  // Enterprise query: Load floors by buildingId foreign key
                  const floorsResponse = await fetch(`/api/floors?buildingId=${building.id}`);
                  const floorsResult = await floorsResponse.json();

                  if (!floorsResult.success) {
                    return { ...building, floors: [], units: [] };
                  }

                  // Extract floors from correct API structure (data.floors)
                  const floors = floorsResult.data?.floors || floorsResult.floors || [];

                  // 🔍 DEBUG: Log floors for investigation
                  console.log(`🏢 [Navigation] Building ${building.id} (${building.name}) has ${floors.length} floors`);

                  // 🏢 ENTERPRISE: If building has NO floors, load units directly by buildingId
                  if (floors.length === 0) {
                    try {
                      const unitsResponse = await fetch(`/api/units?buildingId=${building.id}`);
                      const unitsResult = await unitsResponse.json();

                      const directUnits = unitsResult.success ? unitsResult.units : [];
                      console.log(`📦 [Navigation] Building ${building.id} has ${directUnits.length} direct units (no floors)`);

                      return {
                        ...building,
                        floors: [],
                        // 🏢 ENTERPRISE: Direct units for buildings without floors
                        units: directUnits.map((unit: NavigationUnit) => ({
                          id: unit.id,
                          name: unit.name,
                          type: unit.type
                        }))
                      };
                    } catch (error) {
                      console.warn(`Failed to load direct units for building ${building.id}:`, error);
                      return { ...building, floors: [], units: [] };
                    }
                  }

                  // For each floor, load units
                  const floorsWithUnits = await Promise.all(
                    floors.map(async (floor: NavigationFloor) => {
                      try {
                        // Load units for this floor
                        const unitsResponse = await fetch(`/api/units?floorId=${floor.id}&buildingId=${building.id}`);
                        const unitsResult = await unitsResponse.json();

                        const units = unitsResult.success ? unitsResult.units : [];

                        // 🔍 DEBUG: Log units per floor
                        console.log(`📦 [Navigation] Floor ${floor.id} (${floor.name}) has ${units.length} units`);

                        return {
                          id: floor.id,
                          name: floor.name,
                          number: floor.number,
                          units: units.map((unit: NavigationUnit) => ({
                            id: unit.id,
                            name: unit.name,
                            type: unit.type
                          }))
                        };
                      } catch (error) {
                        console.warn(`Failed to load units for floor ${floor.id}:`, error);
                        return {
                          id: floor.id,
                          name: floor.name,
                          number: floor.number,
                          units: []
                        };
                      }
                    })
                  );

                  // 🏢 ENTERPRISE: Check if any floor has units
                  const totalFloorUnits = floorsWithUnits.reduce((sum, f) => sum + f.units.length, 0);

                  // 🔧 FIX: If floors exist but have no units, try loading by buildingId (fallback)
                  // This handles cases where units don't have floorId but have buildingId
                  if (totalFloorUnits === 0) {
                    console.log(`⚠️ [Navigation] Building ${building.id} has ${floors.length} floors but 0 floor units. Trying buildingId fallback...`);
                    try {
                      const fallbackResponse = await fetch(`/api/units?buildingId=${building.id}`);
                      const fallbackResult = await fallbackResponse.json();
                      const fallbackUnits = fallbackResult.success ? fallbackResult.units : [];
                      console.log(`📦 [Navigation] Fallback: Found ${fallbackUnits.length} units by buildingId`);

                      return {
                        ...building,
                        floors: floorsWithUnits,
                        units: fallbackUnits.map((unit: NavigationUnit) => ({
                          id: unit.id,
                          name: unit.name,
                          type: unit.type
                        }))
                      };
                    } catch (error) {
                      console.warn(`Failed to load fallback units for building ${building.id}:`, error);
                    }
                  }

                  return {
                    ...building,
                    floors: floorsWithUnits,
                    units: [] // No direct units when floors exist and have units
                  };

                } catch (error) {
                  console.warn(`Failed to load floors for building ${building.id}:`, error);
                  return { ...building, floors: [], units: [] };
                }
              })
            );

            return {
              ...project,
              buildings: buildingsWithFloors,
              companyId
            };

          } catch (error) {
            console.warn(`Failed to load buildings for project ${project.id}:`, error);
            return { ...project, buildings: [], companyId };
          }
        })
      );

      return projectsWithBuildings;

    } catch (error) {
      console.error(`🚨 Failed to load projects for company ${companyId}:`, error);
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