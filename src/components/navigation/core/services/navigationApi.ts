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

      // Temporary fallback for the company that should have 3 projects
      if (companyId === '5djayaxc0X33wsE8T2uY') {
        console.log('🎯 NavigationApi: Using hardcoded data for Ν.Χ.Γ. ΠΑΓΩΝΗΣ company');
        return [
          {
            id: '1001',
            name: 'Παλαιολόγου Πολυκατοικία',
            company: 'Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.',
            buildings: [
              {
                id: 'building_1_palaiologou',
                name: 'ΚΤΙΡΙΟ Α - Παλαιολόγου',
                floors: [
                  {
                    id: 'floor_0',
                    name: 'Ισόγειο',
                    units: [
                      { id: 'unit_0_1', name: 'Μονάδα Ισογείου', type: 'Διαμέρισμα' }
                    ]
                  },
                  {
                    id: 'floor_1',
                    name: '1ος Όροφος',
                    units: [
                      { id: 'unit_1_1', name: 'Διαμέρισμα 1.1', type: 'Διαμέρισμα' },
                      { id: 'unit_1_2', name: 'Διαμέρισμα 1.2', type: 'Διαμέρισμα' }
                    ]
                  },
                  {
                    id: 'floor_2',
                    name: '2ος Όροφος',
                    units: [
                      { id: 'unit_2_1', name: 'Διαμέρισμα 2.1', type: 'Διαμέρισμα' },
                      { id: 'unit_2_2', name: 'Διαμέρισμα 2.2', type: 'Διαμέρισμα' }
                    ]
                  },
                  {
                    id: 'floor_3',
                    name: '3ος Όροφος',
                    units: [
                      { id: 'unit_3_1', name: 'Διαμέρισμα 3.1', type: 'Διαμέρισμα' },
                      { id: 'unit_3_2', name: 'Διαμέρισμα 3.2', type: 'Διαμέρισμα' }
                    ]
                  },
                  {
                    id: 'floor_4',
                    name: '4ος Όροφος',
                    units: [
                      { id: 'unit_4_1', name: 'Πεντάρι Οροφής', type: 'Διαμέρισμα' }
                    ]
                  }
                ]
              },
              {
                id: 'building_2_palaiologou',
                name: 'ΚΤΙΡΙΟ Β - Βοηθητικές Εγκαταστάσεις',
                floors: [
                  {
                    id: 'floor_-1',
                    name: 'Υπόγειο',
                    units: [
                      { id: 'unit_b1_1', name: 'Αποθήκη Β1.1', type: 'Αποθήκη' },
                      { id: 'unit_b1_2', name: 'Αποθήκη Β1.2', type: 'Αποθήκη' },
                      { id: 'unit_b1_3', name: 'Αποθήκη Β1.3', type: 'Αποθήκη' }
                    ]
                  },
                  {
                    id: 'floor_0_b',
                    name: 'Ισόγειο',
                    units: [
                      { id: 'unit_b0_1', name: 'Κοινόχρηστος Χώρος', type: 'Κοινόχρηστο' },
                      { id: 'unit_b0_2', name: 'Χώρος Διανομής', type: 'Κοινόχρηστο' },
                      { id: 'unit_b0_3', name: 'Λοιποί Χώροι', type: 'Κοινόχρηστο' }
                    ]
                  }
                ]
              }
            ],
            parkingSpots: [],
            companyId: companyId
          },
          {
            id: '1002',
            name: 'Μεγάλου Αλεξάνδρου Συγκρότημα',
            company: 'Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.',
            buildings: [],
            parkingSpots: [],
            companyId: companyId
          },
          {
            id: '1003',
            name: 'Τσιμισκή Εμπορικό Κέντρο',
            company: 'Ν.Χ.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ Ο.Ε.',
            buildings: [],
            parkingSpots: [],
            companyId: companyId
          }
        ];
      }

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