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
      console.log(`🔍 NavigationApi: Fetching projects for company ${companyId}`);
      const response = await fetch(`/api/projects/by-company/${companyId}`);
      const result = await response.json();

      console.log(`📊 NavigationApi: Company ${companyId} returned:`, result);

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
      console.error(`NavigationApi: Error loading projects for company ${companyId}:`, error);
      return [];
    }
  }

  /**
   * Load all projects for multiple companies in parallel
   */
  static async loadAllProjects(companies: NavigationCompany[]): Promise<NavigationProject[]> {
    if (companies.length === 0) return [];

    console.log('🚀 NavigationApi: Loading all projects for companies:', companies.map(c => c.companyName));

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

      console.log(`✅ NavigationApi: Loaded ${allProjects.length} total projects`);
      return allProjects;

    } catch (error) {
      console.error('NavigationApi: Error loading all projects:', error);
      return [];
    }
  }
}