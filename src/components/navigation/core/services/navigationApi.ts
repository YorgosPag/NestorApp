/**
 * Navigation API Service
 * Handles all API calls for navigation data
 */

import { getAllActiveCompanies } from '@/services/companies.service';
import type { NavigationCompany, NavigationProject } from '../types';

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
      console.log(`🔍 Loading projects for company: ${companyId}`);

      // Load projects from projects API (normalized structure)
      const projectsResponse = await fetch(`/api/projects/by-company/${companyId}`);
      if (!projectsResponse.ok) {
        console.warn(`Failed to load projects for company ${companyId}`);
        return [];
      }

      const projectsResult = await projectsResponse.json();
      if (!projectsResult.success || !projectsResult.projects) {
        console.log(`📊 No projects found for company ${companyId}`);
        return [];
      }

      console.log(`📊 Found ${projectsResult.projects.length} projects for company ${companyId}`);

      // For each project, load buildings and floors using enterprise normalized structure
      const projectsWithBuildings = await Promise.all(
        projectsResult.projects.map(async (project: any) => {
          try {
            console.log(`🏗️ Loading buildings for project: ${project.id} (${project.name})`);

            // Load buildings for this project
            const buildingsResponse = await fetch(`/api/buildings?projectId=${project.id}`);
            const buildingsResult = await buildingsResponse.json();

            if (!buildingsResult.success) {
              console.warn(`⚠️ No buildings found for project ${project.id}`);
              return { ...project, buildings: [], companyId };
            }

            console.log(`🏛️ Found ${buildingsResult.buildings.length} buildings for project ${project.id}`);

            // For each building, load floors from normalized floors collection
            const buildingsWithFloors = await Promise.all(
              buildingsResult.buildings.map(async (building: any) => {
                try {
                  // Enterprise query: Load floors by buildingId foreign key
                  const floorsResponse = await fetch(`/api/floors?buildingId=${building.id}`);
                  const floorsResult = await floorsResponse.json();

                  if (!floorsResult.success) {
                    return { ...building, floors: [] };
                  }

                  // For each floor, load units
                  const floorsWithUnits = await Promise.all(
                    floorsResult.floors.map(async (floor: any) => {
                      try {
                        // Load units for this floor
                        const unitsResponse = await fetch(`/api/units?floorId=${floor.id}&buildingId=${building.id}`);
                        const unitsResult = await unitsResponse.json();

                        const units = unitsResult.success ? unitsResult.units : [];

                        return {
                          id: floor.id,
                          name: floor.name,
                          number: floor.number,
                          units: units.map((unit: any) => ({
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

                  return {
                    ...building,
                    floors: floorsWithUnits
                  };

                } catch (error) {
                  console.warn(`Failed to load floors for building ${building.id}:`, error);
                  return { ...building, floors: [] };
                }
              })
            );

            const projectWithBuildings = {
              ...project,
              buildings: buildingsWithFloors,
              companyId
            };

            console.log(`✅ Project ${project.name}: ${buildingsWithFloors.length} buildings loaded`);
            return projectWithBuildings;

          } catch (error) {
            console.warn(`Failed to load buildings for project ${project.id}:`, error);
            return { ...project, buildings: [], companyId };
          }
        })
      );

      console.log(`🎯 Company ${companyId}: Loaded ${projectsWithBuildings.length} projects with full hierarchy`);
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
    console.log('🏢 NavigationApiService: Companies cache cleared');
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