'use client';

import { useState, useCallback, useMemo } from 'react';
import type { Contact } from '@/types/contacts';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';

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
  const { success: showSuccess } = useNotifications();
  const { t } = useTranslation('trash');
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
    const count = selectedContactIds.length;
    setShowPermanentDeleteDialog(false);
    if (selectedContact && selectedContactIds.includes(selectedContact.id!)) {
      setSelectedContact(null);
    }
    setSelectedContactIds([]);
    refreshContacts();
    showSuccess(count === 1 ? t('permanentDeleteSuccess_one') : t('permanentDeleteSuccess', { count }));
  }, [selectedContact, selectedContactIds, refreshContacts, setSelectedContact, setSelectedContactIds, showSuccess, t]);

  /** After a trash action (restore/delete), clear selection AND refresh list */
  const handleTrashActionComplete = useCallback(() => {
    setSelectedContact(null);
    setSelectedContactIds([]);
    refreshContacts();
  }, [setSelectedContact, setSelectedContactIds, refreshContacts]);

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
    handleTrashActionComplete,
  } as const;
}
