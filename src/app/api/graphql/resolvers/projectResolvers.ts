import { projectsService } from '../../../services/projects.service';
import { buildingsService } from '../../../services/buildings.service';
import { contactsService } from '../../../services/contacts.service';
import type { 
  Project,
  ProjectFiltersInput,
  PaginationInput,
  SortingInput,
  CreateProjectInput,
  UpdateProjectInput
} from '../../../types/project';

export const projectResolvers = {
  Query: {
    projects: async (
      _: any,
      { filters, pagination, sorting }: {
        filters?: ProjectFiltersInput;
        pagination?: PaginationInput;
        sorting?: SortingInput;
      }
    ) => {
      try {
        const result = await projectsService.getProjects({
          filters,
          pagination: pagination || { page: 1, limit: 10 },
          sorting: sorting || { field: 'name', direction: 'ASC' }
        });

        return {
          data: result.data,
          pagination: {
            page: result.pagination.page,
            limit: result.pagination.limit,
            totalPages: result.pagination.totalPages,
            hasNextPage: result.pagination.hasNextPage,
            hasPreviousPage: result.pagination.hasPreviousPage,
          },
          totalCount: result.totalCount
        };
      } catch (error) {
        console.error('Error fetching projects:', error);
        throw new Error('Failed to fetch projects');
      }
    },

    project: async (_: any, { id }: { id: string }) => {
      try {
        return await projectsService.getProjectById(id);
      } catch (error) {
        console.error('Error fetching project:', error);
        throw new Error('Failed to fetch project');
      }
    },
  },

  Mutation: {
    createProject: async (_: any, { input }: { input: CreateProjectInput }) => {
      try {
        return await projectsService.createProject(input);
      } catch (error) {
        console.error('Error creating project:', error);
        throw new Error('Failed to create project');
      }
    },

    updateProject: async (_: any, { id, input }: { id: string; input: UpdateProjectInput }) => {
      try {
        return await projectsService.updateProject(id, input);
      } catch (error) {
        console.error('Error updating project:', error);
        throw new Error('Failed to update project');
      }
    },

    deleteProject: async (_: any, { id }: { id: string }) => {
      try {
        await projectsService.deleteProject(id);
        return true;
      } catch (error) {
        console.error('Error deleting project:', error);
        throw new Error('Failed to delete project');
      }
    },
  },

  Project: {
    // Resolver για building που ανήκει το project
    building: async (parent: Project) => {
      if (!parent.buildingId) return null;
      
      try {
        return await buildingsService.getBuildingById(parent.buildingId);
      } catch (error) {
        console.error('Error fetching project building:', error);
        return null;
      }
    },

    // Resolver για project manager
    manager: async (parent: Project) => {
      if (!parent.managerId) return null;
      
      try {
        return await contactsService.getContactById(parent.managerId);
      } catch (error) {
        console.error('Error fetching project manager:', error);
        return null;
      }
    },

    // Resolver για team members
    team: async (parent: Project) => {
      if (!parent.teamMemberIds || parent.teamMemberIds.length === 0) return [];
      
      try {
        const teamMembers = await Promise.all(
          parent.teamMemberIds.map(memberId => 
            contactsService.getContactById(memberId)
          )
        );
        return teamMembers.filter(member => member !== null);
      } catch (error) {
        console.error('Error fetching project team:', error);
        return [];
      }
    },

    // Resolver για documents
    documents: async (parent: Project) => {
      try {
        return await projectsService.getProjectDocuments(parent.id);
      } catch (error) {
        console.error('Error fetching project documents:', error);
        return [];
      }
    },

    // Resolver για timeline events
    timeline: async (parent: Project) => {
      try {
        return await projectsService.getProjectTimeline(parent.id);
      } catch (error) {
        console.error('Error fetching project timeline:', error);
        return [];
      }
    },
  },
};