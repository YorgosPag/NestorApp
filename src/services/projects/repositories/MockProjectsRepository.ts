
import type { IProjectsRepository } from '../contracts';
import { buildings as buildingsData } from '@/components/building-management/mockData';
import type { Project } from '@/types/project';
import type { Building } from '@/types/building/contracts';

export class MockProjectsRepository implements Pick<IProjectsRepository, 'getProjectsByCompanyId'> {
  async getProjectsByCompanyId(companyId: string): Promise<Project[]> {
    // Simulate API call with a delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Debug logging removed: console.log(`🏗️ MockProjectsRepository: Searching for companyId: "${companyId}"`);
    
    // Convert buildings data to projects data
    // The mock data has buildings, but we need to group them by project
    const dataArray = Array.isArray(buildingsData) ? buildingsData : [];
    // Debug logging removed: console.log(`🏗️ MockProjectsRepository: Available buildings:`, dataArray.map(b => ({
    //   id: b.id,
    //   name: b.name,
    //   project: b.project,
    //   company: b.company,
    //   companyId: b.companyId
    // })));
    
    // Filter buildings by company first
    const companyBuildings = dataArray.filter(b => b.companyId === companyId);
    // Debug logging removed: console.log(`🏗️ MockProjectsRepository: Found ${companyBuildings.length} buildings for companyId "${companyId}"`);
    
    // Group buildings by project to create Project objects
    const projectsMap = new Map<string, Project>();
    
    companyBuildings.forEach(building => {
      const projectKey = building.project;
      if (!projectsMap.has(projectKey)) {
        projectsMap.set(projectKey, {
          id: building.projectId,
          name: building.project,
          company: building.company,
          companyId: building.companyId,
          description: `Project containing multiple buildings`,
          startDate: building.startDate || '',
          completionDate: building.completionDate || '',
          status: 'active',
          progress: building.progress || 0,
          totalValue: 0,
          buildings: []
        });
      }
      
      const project = projectsMap.get(projectKey)!;
      project.totalValue += building.totalValue || 0;
    });
    
    const projects = Array.from(projectsMap.values());
    // Debug logging removed: console.log(`🏗️ MockProjectsRepository: Created ${projects.length} projects:`, projects.map(p => p.name));
    
    return projects;
  }
}
