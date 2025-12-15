/**
 * Navigation API Service
 * Handles all API calls for navigation data
 */

import { getAllActiveCompanies } from '@/services/companies.service';
import type { NavigationCompany, NavigationProject } from '../types';

export class NavigationApiService {
  /**
   * Load all active companies
   */
  static async loadCompanies(): Promise<NavigationCompany[]> {
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

    return uniqueCompanies;
  }

  /**
   * Load projects for a specific company
   */
  static async loadProjectsForCompany(companyId: string): Promise<NavigationProject[]> {
    try {
      // VALIDATION: Skip invalid/non-existent company IDs to prevent infinite loops
      const KNOWN_VALID_COMPANY_ID = '5djayaxc0X33wsE8T2uY';
      const KNOWN_INVALID_IDS = ['ZRCoT0yCeZQxUieIjTQb', 'kGKmSIbhoRlDdrtDnUgD'];

      if (KNOWN_INVALID_IDS.includes(companyId)) {
        console.warn(`⚠️ Skipping API call for known invalid companyId: ${companyId}`);
        return [];
      }

      // Enterprise pattern: Load real data from normalized collections
      if (companyId === KNOWN_VALID_COMPANY_ID) {
        // Load projects from projects API (already normalized in previous migration)
        const projectsResponse = await fetch(`/api/projects/by-company/${companyId}`);
        if (!projectsResponse.ok) {
          console.warn(`Failed to load projects for company ${companyId}`);
          return [];
        }

        const projectsResult = await projectsResponse.json();
        if (!projectsResult.success || !projectsResult.projects) {
          return [];
        }

        // For each project, load buildings and floors using enterprise normalized structure
        const projectsWithBuildings = await Promise.all(
          projectsResult.projects.map(async (project: any) => {
            try {
              // Load buildings for this project
              const buildingsResponse = await fetch(`/api/buildings?projectId=${project.id}`);
              const buildingsResult = await buildingsResponse.json();

              if (!buildingsResult.success) {
                return { ...project, buildings: [], companyId };
              }

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
      }

      const response = await fetch(`/api/projects/by-company/${companyId}`);
      const result = await response.json();


      if (result.success && result.projects) {
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
            companyId: project.companyId || companyId // Ensure companyId is set
          };
        });
      }

      return [];
    } catch (error) {
      return [];
    }
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