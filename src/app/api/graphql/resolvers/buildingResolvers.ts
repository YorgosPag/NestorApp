import { buildingsService } from '../../../services/buildings.service';
import { storageService } from '../../../services/storage.service';
import { projectsService } from '../../../services/projects.service';
import type { 
  Building, 
  BuildingFiltersInput, 
  PaginationInput, 
  SortingInput,
  CreateBuildingInput,
  UpdateBuildingInput 
} from '../../../types/building';

export const buildingResolvers = {
  Query: {
    buildings: async (
      _: any, 
      { filters, pagination, sorting }: {
        filters?: BuildingFiltersInput;
        pagination?: PaginationInput;
        sorting?: SortingInput;
      }
    ) => {
      try {
        const result = await buildingsService.getBuildings({
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
        console.error('Error fetching buildings:', error);
        throw new Error('Failed to fetch buildings');
      }
    },

    building: async (_: any, { id }: { id: string }) => {
      try {
        return await buildingsService.getBuildingById(id);
      } catch (error) {
        console.error('Error fetching building:', error);
        throw new Error('Failed to fetch building');
      }
    },
  },

  Mutation: {
    createBuilding: async (_: any, { input }: { input: CreateBuildingInput }) => {
      try {
        return await buildingsService.createBuilding(input);
      } catch (error) {
        console.error('Error creating building:', error);
        throw new Error('Failed to create building');
      }
    },

    updateBuilding: async (_: any, { id, input }: { id: string; input: UpdateBuildingInput }) => {
      try {
        return await buildingsService.updateBuilding(id, input);
      } catch (error) {
        console.error('Error updating building:', error);
        throw new Error('Failed to update building');
      }
    },

    deleteBuilding: async (_: any, { id }: { id: string }) => {
      try {
        await buildingsService.deleteBuilding(id);
        return true;
      } catch (error) {
        console.error('Error deleting building:', error);
        throw new Error('Failed to delete building');
      }
    },
  },

  Building: {
    // Resolver για storage items που ανήκουν σε αυτό το building
    storage: async (parent: Building) => {
      try {
        return await storageService.getStorageByBuildingId(parent.id);
      } catch (error) {
        console.error('Error fetching building storage:', error);
        return [];
      }
    },

    // Resolver για projects που ανήκουν σε αυτό το building
    projects: async (parent: Building) => {
      try {
        return await projectsService.getProjectsByBuildingId(parent.id);
      } catch (error) {
        console.error('Error fetching building projects:', error);
        return [];
      }
    },

    // Computed field για available units
    availableUnits: async (parent: Building) => {
      try {
        const storage = await storageService.getStorageByBuildingId(parent.id);
        return storage.filter(item => item.status === 'AVAILABLE').length;
      } catch (error) {
        console.error('Error computing available units:', error);
        return 0;
      }
    },
  },
};