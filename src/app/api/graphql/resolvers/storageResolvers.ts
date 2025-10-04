import { storageService } from '../../../services/storage.service';
import { buildingsService } from '../../../services/buildings.service';
import { contactsService } from '../../../services/contacts.service';
import type {
  StorageItem,
  StorageFiltersInput,
  PaginationInput,
  SortingInput,
  CreateStorageInput,
  UpdateStorageInput
} from '../../../types/storage';

export const storageResolvers = {
  Query: {
    storage: async (
      _: any,
      { filters, pagination, sorting }: {
        filters?: StorageFiltersInput;
        pagination?: PaginationInput;
        sorting?: SortingInput;
      }
    ) => {
      try {
        const result = await storageService.getStorage({
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
        console.error('Error fetching storage:', error);
        throw new Error('Failed to fetch storage');
      }
    },

    storageItem: async (_: any, { id }: { id: string }) => {
      try {
        return await storageService.getStorageById(id);
      } catch (error) {
        console.error('Error fetching storage item:', error);
        throw new Error('Failed to fetch storage item');
      }
    },
  },

  Mutation: {
    createStorageItem: async (_: any, { input }: { input: CreateStorageInput }) => {
      try {
        return await storageService.createStorage(input);
      } catch (error) {
        console.error('Error creating storage item:', error);
        throw new Error('Failed to create storage item');
      }
    },

    updateStorageItem: async (_: any, { id, input }: { id: string; input: UpdateStorageInput }) => {
      try {
        return await storageService.updateStorage(id, input);
      } catch (error) {
        console.error('Error updating storage item:', error);
        throw new Error('Failed to update storage item');
      }
    },

    deleteStorageItem: async (_: any, { id }: { id: string }) => {
      try {
        await storageService.deleteStorage(id);
        return true;
      } catch (error) {
        console.error('Error deleting storage item:', error);
        throw new Error('Failed to delete storage item');
      }
    },
  },

  StorageItem: {
    // Resolver για building που ανήκει το storage item
    building: async (parent: StorageItem) => {
      try {
        return await buildingsService.getBuildingById(parent.buildingId);
      } catch (error) {
        console.error('Error fetching storage building:', error);
        throw new Error('Failed to fetch storage building');
      }
    },

    // Resolver για assigned contact
    assignedTo: async (parent: StorageItem) => {
      if (!parent.assignedToId) return null;
      
      try {
        return await contactsService.getContactById(parent.assignedToId);
      } catch (error) {
        console.error('Error fetching assigned contact:', error);
        return null;
      }
    },
  },
};