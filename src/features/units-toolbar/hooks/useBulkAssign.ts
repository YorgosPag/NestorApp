'use client';
import { useEffect, useState, useCallback } from 'react';
import { ContactsService } from '@/services/contacts.service';
import { updateMultipleUnitsOwner } from '@/services/units.service';
import type { Contact } from '@/types/contacts';

type ToastFn = (o: {
  title: string;
  description?: string;
  variant?: 'success' | 'destructive' | 'default';
}) => void;

interface UseBulkAssignProps {
  toast: ToastFn;
  onSuccess: () => void;
}

export function useBulkAssign({ toast, onSuccess }: UseBulkAssignProps) {
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
        toast({
          title: 'Σφάλμα',
          description: 'Παρακαλώ επιλέξτε έναν πελάτη.',
          variant: 'destructive',
        });
        return;
      }
      setIsLoading(true);
      try {
        await updateMultipleUnitsOwner(ids, selectedContactId);
        toast({
          title: 'Επιτυχία',
          description: 'Τα ακίνητα ανατέθηκαν στον επιλεγμένο πελάτη.',
          variant: 'success',
        });
        onSuccess();
      } catch {
        toast({
          title: 'Σφάλμα',
          description: 'Η ανάθεση απέτυχε.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [selectedContactId, toast, onSuccess]
  );

  return {
    contacts,
    selectedContactId,
    setSelectedContactId,
    isLoading,
    assignToContact,
  };
}
