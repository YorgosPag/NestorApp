'use client';

/**
 * =============================================================================
 * **ΜΑΖΙΚΕΣ ΕΝΕΡΓΕΙΕΣ ΣΕ ΕΠΑΦΕΣ** — διαγραφή & αρχειοθέτηση (ADR-842 §7.6.13 Δ)
 * =============================================================================
 *
 * 🧹 **Γιατί ζει σε δικό του αρχείο** *(N.7.1 · εξαγωγή, όχι περικοπή)*: το
 * `useContactsPageState` πέρασε τις **500** γραμμές. Οι δύο μαζικές ενέργειες είναι
 * **η ίδια πράξη με άλλο ρήμα** — ίδιος στόχος, ίδιος διάλογος, ίδια ουρά — άρα
 * φεύγουν μαζί και μένουν μαζί.
 *
 * 🔑 **Το κοινό δεν είναι στιλιστικό**: πριν την ενοποίηση, «ποιες επαφές αφορά» και
 * «τι γίνεται μετά» ήταν **αντιγραμμένα** σε διαγραφή και αρχειοθέτηση — μια διόρθωση
 * στη μία *(π.χ. να μη μένει η επιλογή σε αρχειοθετημένη επαφή)* δεν έφτανε ποτέ στην
 * άλλη.
 */

import { useCallback, useState } from 'react';
import type { Contact } from '@/types/contacts';

interface UseContactBulkActionsParams {
  readonly selectedContact: Contact | null;
  readonly setSelectedContact: (contact: Contact | null) => void;
  readonly refreshContacts: () => void;
}

export function useContactBulkActions({
  selectedContact,
  setSelectedContact,
  refreshContacts,
}: UseContactBulkActionsParams) {
  const [showDeleteContactDialog, setShowDeleteContactDialog] = useState(false);
  const [showArchiveContactDialog, setShowArchiveContactDialog] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  /**
   * Ποιες επαφές αφορά η μαζική ενέργεια: οι ρητά δοσμένες, αλλιώς η επιλεγμένη,
   * αλλιώς καμία.
   */
  const resolveBulkTargetIds = useCallback((ids?: string[]): string[] => {
    if (ids && ids.length > 0) return ids;
    return selectedContact?.id ? [selectedContact.id] : [];
  }, [selectedContact?.id]);

  /**
   * Η κοινή ουρά κάθε μαζικής ενέργειας: κλείσε τον διάλογο, ξεκόλλα την επιλογή αν η
   * επιλεγμένη επαφή ήταν μέσα στις επηρεαζόμενες, καθάρισε τα ids, ανανέωσε.
   */
  const finishBulkContactAction = useCallback(
    (closeDialog: (open: boolean) => void) => {
      closeDialog(false);
      if (selectedContact && selectedContactIds.includes(selectedContact.id!)) {
        setSelectedContact(null);
      }
      setSelectedContactIds([]);
      refreshContacts();
    },
    [selectedContact, selectedContactIds, setSelectedContact, refreshContacts],
  );

  const handleDeleteContacts = useCallback((ids?: string[]) => {
    setSelectedContactIds(resolveBulkTargetIds(ids));
    setShowDeleteContactDialog(true);
  }, [resolveBulkTargetIds]);

  const handleContactsDeleted = useCallback(async () => {
    finishBulkContactAction(setShowDeleteContactDialog);
  }, [finishBulkContactAction]);

  const handleArchiveContacts = useCallback((ids?: string[]) => {
    setSelectedContactIds(resolveBulkTargetIds(ids));
    setShowArchiveContactDialog(true);
  }, [resolveBulkTargetIds]);

  const handleContactsArchived = useCallback(async () => {
    finishBulkContactAction(setShowArchiveContactDialog);
  }, [finishBulkContactAction]);

  return {
    selectedContactIds,
    setSelectedContactIds,
    showDeleteContactDialog,
    setShowDeleteContactDialog,
    showArchiveContactDialog,
    setShowArchiveContactDialog,
    handleDeleteContacts,
    handleContactsDeleted,
    handleArchiveContacts,
    handleContactsArchived,
  };
}
