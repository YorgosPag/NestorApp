import { useState, useCallback, useMemo } from 'react';
import type { Contact } from '@/types/contacts';

interface UseContactsTrashStateParams {
  contacts: Contact[];
  selectedContact: Contact | null;
  setSelectedContact: (contact: Contact | null) => void;
  setSelectedContactIds: (ids: string[]) => void;
  selectedContactIds: string[];
  refreshContacts: () => void;
  setActiveCardFilter: (filter: string | null) => void;
}

export function useContactsTrashState({
  contacts,
  selectedContact,
  setSelectedContact,
  setSelectedContactIds,
  selectedContactIds,
  refreshContacts,
  setActiveCardFilter,
}: UseContactsTrashStateParams) {
  const [showPermanentDeleteDialog, setShowPermanentDeleteDialog] = useState(false);
  const [showTrash, setShowTrash] = useState(false);

  const trashCount = useMemo(
    () => contacts.filter(c => c.status === 'deleted').length,
    [contacts],
  );

  const handleRestoreContacts = useCallback((ids?: string[]) => {
    if (ids && ids.length > 0) {
      setSelectedContactIds(ids);
    } else if (selectedContact?.id) {
      setSelectedContactIds([selectedContact.id]);
    }
  }, [selectedContact?.id, setSelectedContactIds]);

  const handlePermanentDeleteContacts = useCallback((ids?: string[]) => {
    if (ids && ids.length > 0) {
      setSelectedContactIds(ids);
    } else if (selectedContact?.id) {
      setSelectedContactIds([selectedContact.id]);
    }
    setShowPermanentDeleteDialog(true);
  }, [selectedContact?.id, setSelectedContactIds]);

  const handleContactsPermanentDeleted = useCallback(async () => {
    setShowPermanentDeleteDialog(false);
    if (selectedContact && selectedContactIds.includes(selectedContact.id!)) {
      setSelectedContact(null);
    }
    setSelectedContactIds([]);
    refreshContacts();
  }, [selectedContact, selectedContactIds, refreshContacts, setSelectedContact, setSelectedContactIds]);

  const handleToggleTrash = useCallback(() => {
    setShowTrash(prev => !prev);
    setSelectedContact(null);
    setActiveCardFilter(null);
  }, [setSelectedContact, setActiveCardFilter]);

  return {
    showPermanentDeleteDialog,
    setShowPermanentDeleteDialog,
    showTrash,
    trashCount,
    handleToggleTrash,
    handleRestoreContacts,
    handlePermanentDeleteContacts,
    handleContactsPermanentDeleted,
  } as const;
}
