'use client';
import { useEffect, useState, useCallback } from 'react';
import { ContactsService } from '@/services/contacts.service';
import { updateMultipleUnitsOwner } from '@/services/units.service';
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
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { contacts: fetchedContacts } = await ContactsService.getAllContacts({
        limitCount: 1000,
      });
      if (mounted) setContacts(fetchedContacts);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const assignToContact = useCallback(
    async (ids: string[]) => {
      if (!selectedContactId) {
        notifications.error('❌ Παρακαλώ επιλέξτε έναν πελάτη');
        return;
      }
      setIsLoading(true);
      try {
        await updateMultipleUnitsOwner(ids, selectedContactId);
        notifications.success('✅ Τα ακίνητα ανατέθηκαν στον επιλεγμένο πελάτη');
        onSuccess();
      } catch {
        notifications.error('❌ Η ανάθεση απέτυχε');
      } finally {
        setIsLoading(false);
      }
    },
    [selectedContactId, notifications, onSuccess]
  );

  return {
    contacts,
    selectedContactId,
    setSelectedContactId,
    isLoading,
    assignToContact,
  };
}
