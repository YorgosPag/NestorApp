// ============================================================================
// 🏢 ENTERPRISE: EMPLOYEE SELECTOR SERVICE
// ============================================================================
//
// 🎯 PURPOSE: Contact search and retrieval functions for EmployeeSelector
// 🔗 USED BY: EmployeeSelector component
// 🏢 STANDARDS: Enterprise service patterns, centralized types
//
// Extracted from EmployeeSelector.tsx for SRP compliance (ADR N.7.1)
// ============================================================================

import { createModuleLogger } from '@/lib/telemetry';
import type { ContactType } from '@/types/contacts';
import {
  isIndividualContact,
  isCompanyContact,
  isServiceContact
} from '@/types/contacts';
import { ContactsService } from '@/services/contacts.service';

// ============================================================================
// 🏢 ENTERPRISE: TYPES & INTERFACES
// ============================================================================

export interface ContactSummary {
  id: string;
  name: string;
  type: ContactType;
  email?: string;
  phone?: string;
  address?: string;
  company?: string;     // For individual contacts
  department?: string;  // For individual contacts
  avatar?: string;
  lastActivity?: string;
}

export interface ContactSearchFilters {
  allowedTypes?: ContactType[];
  excludeIds?: string[];
  maxResults?: number;
}

// ============================================================================
// 🏢 ENTERPRISE: SERVICE FUNCTIONS
// ============================================================================

const logger = createModuleLogger('EmployeeSelector');

export const searchContacts = async (
  query: string,
  filters: ContactSearchFilters
): Promise<ContactSummary[]> => {
  try {
    logger.info('Searching contacts', { query, filters });

    const result = await ContactsService.getAllContacts();
    const allContacts = result?.contacts || [];
    logger.info('Found contacts in database', { count: allContacts.length });

    if (!Array.isArray(allContacts)) {
      logger.error('ContactsService.getAllContacts() returned invalid contacts array', { result });
      return [];
    }

    let filtered = allContacts.map(contact => {
      let name = '';
      let company: string | undefined;
      let department: string | undefined;

      if (isIndividualContact(contact)) {
        name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
        company = contact.employer || '';
        department = contact.position || '';
      } else if (isCompanyContact(contact)) {
        name = contact.companyName || '';
      } else if (isServiceContact(contact)) {
        name = contact.serviceName || '';
      }

      // Safe date conversion
      let lastActivityDate: string | undefined;
      if (contact.updatedAt) {
        try {
          const dateValue = contact.updatedAt instanceof Date
            ? contact.updatedAt
            : typeof contact.updatedAt === 'string' || typeof contact.updatedAt === 'number'
            ? new Date(contact.updatedAt)
            : undefined;

          if (dateValue && !isNaN(dateValue.getTime())) {
            lastActivityDate = dateValue.toISOString().split('T')[0];
          }
        } catch {
          lastActivityDate = undefined;
        }
      }

      const summary: ContactSummary = {
        id: contact.id ?? '',
        name,
        type: contact.type,
        email: contact.emails?.[0]?.email || '',
        phone: contact.phones?.[0]?.number || '',
        company,
        department,
        lastActivity: lastActivityDate
      };
      return summary;
    }).filter(contact => contact.name.length > 0);

    logger.info('After mapping, valid contacts', { count: filtered.length });

    if (query.trim()) {
      const searchTerm = query.toLowerCase();
      filtered = filtered.filter(contact =>
        contact.name.toLowerCase().includes(searchTerm) ||
        contact.email?.toLowerCase().includes(searchTerm) ||
        contact.company?.toLowerCase().includes(searchTerm) ||
        contact.department?.toLowerCase().includes(searchTerm)
      );
      logger.info('After text filter', { count: filtered.length });
    }

    if (filters.allowedTypes?.length) {
      filtered = filtered.filter(contact =>
        filters.allowedTypes!.includes(contact.type)
      );
      logger.info('After type filter', { count: filtered.length });
    }

    if (filters.excludeIds?.length) {
      filtered = filtered.filter(contact =>
        !filters.excludeIds!.includes(contact.id)
      );
      logger.info('After excluding IDs', { count: filtered.length });
    }

    if (filters.maxResults) {
      filtered = filtered.slice(0, filters.maxResults);
      logger.info('After limit, returning contacts', { count: filtered.length });
    }

    return filtered;
  } catch (error) {
    logger.error('Failed to search contacts', { error });
    return [];
  }
};

export const getContactById = async (id: string): Promise<ContactSummary | null> => {
  const results = await searchContacts('', { excludeIds: [], maxResults: 100 });
  return results.find(contact => contact.id === id) || null;
};
