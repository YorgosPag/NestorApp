import { opportunitiesService } from '../../../services/opportunities.service';
import { contactsService } from '../../../services/contacts.service';
import type {
  Opportunity,
  OpportunityFiltersInput,
  PaginationInput,
  SortingInput,
  CreateOpportunityInput,
  UpdateOpportunityInput
} from '../../../types/crm';

export const opportunityResolvers = {
  Query: {
    opportunities: async (
      _: any,
      { filters, pagination, sorting }: {
        filters?: OpportunityFiltersInput;
        pagination?: PaginationInput;
        sorting?: SortingInput;
      }
    ) => {
      try {
        const result = await opportunitiesService.getOpportunities({
          filters,
          pagination: pagination || { page: 1, limit: 10 },
          sorting: sorting || { field: 'createdAt', direction: 'DESC' }
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
        console.error('Error fetching opportunities:', error);
        throw new Error('Failed to fetch opportunities');
      }
    },

    opportunity: async (_: any, { id }: { id: string }) => {
      try {
        return await opportunitiesService.getOpportunityById(id);
      } catch (error) {
        console.error('Error fetching opportunity:', error);
        throw new Error('Failed to fetch opportunity');
      }
    },
  },

  Mutation: {
    createOpportunity: async (_: any, { input }: { input: CreateOpportunityInput }) => {
      try {
        return await opportunitiesService.createOpportunity(input);
      } catch (error) {
        console.error('Error creating opportunity:', error);
        throw new Error('Failed to create opportunity');
      }
    },

    updateOpportunity: async (_: any, { id, input }: { id: string; input: UpdateOpportunityInput }) => {
      try {
        return await opportunitiesService.updateOpportunity(id, input);
      } catch (error) {
        console.error('Error updating opportunity:', error);
        throw new Error('Failed to update opportunity');
      }
    },

    deleteOpportunity: async (_: any, { id }: { id: string }) => {
      try {
        await opportunitiesService.deleteOpportunity(id);
        return true;
      } catch (error) {
        console.error('Error deleting opportunity:', error);
        throw new Error('Failed to delete opportunity');
      }
    },
  },

  Opportunity: {
    // Resolver για contact που ανήκει το opportunity
    contact: async (parent: Opportunity) => {
      try {
        return await contactsService.getContactById(parent.contactId);
      } catch (error) {
        console.error('Error fetching opportunity contact:', error);
        throw new Error('Failed to fetch opportunity contact');
      }
    },

    // Resolver για activities
    activities: async (parent: Opportunity) => {
      try {
        return await opportunitiesService.getOpportunityActivities(parent.id);
      } catch (error) {
        console.error('Error fetching opportunity activities:', error);
        return [];
      }
    },
  },
};