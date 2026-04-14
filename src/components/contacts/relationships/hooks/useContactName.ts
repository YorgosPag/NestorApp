// ============================================================================
// USE CONTACT NAME HOOK
// ============================================================================
//
// 🪝 Custom hook for fetching and managing contact names
// Centralized logic to avoid duplication between RelationshipCard and RelationshipsSummary
//
// ============================================================================

import { useState, useEffect } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { ContactsService } from '@/services/contacts.service';
import { useTranslation } from '@/i18n/hooks/useTranslation';

const logger = createModuleLogger('useContactName');

/**
 * 🪝 useContactName Hook
 *
 * Fetches and manages a contact's display name by contact ID
 *
 * @param contactId - The ID of the contact to fetch
 * @returns Object with contactName and loading state
 */
export const useContactName = (contactId: string | undefined) => {
  const { t } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships']);
  const [contactName, setContactName] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchContactName = async () => {
      if (!contactId) {
        setContactName('');
        return;
      }

      try {
        setLoading(true);

        const contact = await ContactsService.getContact(contactId);

        if (contact) {
          let resolved = t('relationships.organizationTree.unknownContact');

          if (contact.name) {
            resolved = contact.name;
          } else if (contact.firstName && contact.lastName) {
            resolved = `${contact.firstName} ${contact.lastName}`;
          } else if (contact.companyName) {
            resolved = contact.companyName;
          } else if (contact.serviceName) {
            resolved = contact.serviceName;
          } else if (contact.firstName) {
            resolved = contact.firstName;
          }

          setContactName(resolved);
        } else {
          logger.warn('Contact not found', { contactId });
          setContactName(t('relationships.organizationTree.unknownContact'));
        }
      } catch (error) {
        logger.error('Error fetching contact name', { error });
        setContactName(t('relationships.organizationTree.unknownContact'));
      } finally {
        setLoading(false);
      }
    };

    fetchContactName();
  }, [contactId, t]);

  return { contactName, loading };
};