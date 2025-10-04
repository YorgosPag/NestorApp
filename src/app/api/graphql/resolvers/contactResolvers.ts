import { contactsService } from '../../../services/contacts.service';
import { projectsService } from '../../../services/projects.service';
import { communicationsService } from '../../../services/communications.service';
import { opportunitiesService } from '../../../services/opportunities.service';
import type {
  Contact,
  ContactFiltersInput,
  PaginationInput,
  SortingInput,
  CreateContactInput,
  UpdateContactInput
} from '../../../types/contacts';

export const contactResolvers = {
  Query: {
    contacts: async (
      _: any,
      { filters, pagination, sorting }: {
        filters?: ContactFiltersInput;
        pagination?: PaginationInput;
        sorting?: SortingInput;
      }
    ) => {
      try {
        const result = await contactsService.getContacts({
          filters,
          pagination: pagination || { page: 1, limit: 10 },
          sorting: sorting || { field: 'lastName', direction: 'ASC' }
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
        console.error('Error fetching contacts:', error);
        throw new Error('Failed to fetch contacts');
      }
    },

    contact: async (_: any, { id }: { id: string }) => {
      try {
        return await contactsService.getContactById(id);
      } catch (error) {
        console.error('Error fetching contact:', error);
        throw new Error('Failed to fetch contact');
      }
    },
  },

  Mutation: {
    createContact: async (_: any, { input }: { input: CreateContactInput }) => {
      try {
        return await contactsService.createContact(input);
      } catch (error) {
        console.error('Error creating contact:', error);
        throw new Error('Failed to create contact');
      }
    },

    updateContact: async (_: any, { id, input }: { id: string; input: UpdateContactInput }) => {
      try {
        return await contactsService.updateContact(id, input);
      } catch (error) {
        console.error('Error updating contact:', error);
        throw new Error('Failed to update contact');
      }
    },

    deleteContact: async (_: any, { id }: { id: string }) => {
      try {
        await contactsService.deleteContact(id);
        return true;
      } catch (error) {
        console.error('Error deleting contact:', error);
        throw new Error('Failed to delete contact');
      }
    },
  },

  Contact: {
    // Resolver για projects όπου ο contact είναι μέλος
    projects: async (parent: Contact) => {
      try {
        return await projectsService.getProjectsByContactId(parent.id);
      } catch (error) {
        console.error('Error fetching contact projects:', error);
        return [];
      }
    },

    // Resolver για communications history
    communications: async (parent: Contact) => {
      try {
        return await communicationsService.getCommunicationsByContactId(parent.id);
      } catch (error) {
        console.error('Error fetching contact communications:', error);
        return [];
      }
    },

    // Resolver για opportunities
    opportunities: async (parent: Contact) => {
      try {
        return await opportunitiesService.getOpportunitiesByContactId(parent.id);
      } catch (error) {
        console.error('Error fetching contact opportunities:', error);
        return [];
      }
    },
  },
};