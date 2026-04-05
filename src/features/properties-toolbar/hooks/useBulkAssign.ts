'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ContactsService } from '@/services/contacts.service';
import { assignMultiplePropertiesOwnerWithPolicy } from '@/services/property/property-mutation-gateway';
import { translatePropertyMutationError } from '@/services/property/property-mutation-feedback';
import type { Contact } from '@/types/contacts';

interface NotificationFunctions {
  success: (message: string) => void;
  error: (message: string) => void;
}

interface UseBulkAssignProps {
  notifications: NotificationFunctions;
  onSuccess: () => void;
}

export function useBulkAssign({ notifications, onSuccess }: UseBulkAssignProps) {
  const { t } = useTranslation('properties');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { contacts: fetchedContacts } = await ContactsService.getAllContacts({
        limitCount: 1000,
      });

      if (mounted) {
        setContacts(fetchedContacts);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const assignToContact = useCallback(
    async (ids: string[]) => {
      if (!selectedContactId) {
        notifications.error(t('dropdowns.selectClient', { ns: 'common' }));
        return;
      }

      setIsLoading(true);

      try {
        await assignMultiplePropertiesOwnerWithPolicy({
          propertyIds: ids,
          contactId: selectedContactId,
        });

        notifications.success(t('toolbar.bulkAssignSuccess'));
        onSuccess();
      } catch (error) {
        notifications.error(
          translatePropertyMutationError(
            error,
            t,
            'toolbar.bulkAssignError',
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [notifications, onSuccess, selectedContactId, t],
  );

  return {
    contacts,
    selectedContactId,
    setSelectedContactId,
    isLoading,
    assignToContact,
  };
}
