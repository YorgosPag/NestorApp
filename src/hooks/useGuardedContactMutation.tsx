'use client';

import type React from 'react';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { ContactsService } from '@/services/contacts.service';
import { useContactUpdateGuards } from '@/hooks/useContactUpdateGuards';
import { executeGuardedContactUpdate } from '@/utils/contactForm/execute-guarded-contact-update';
import type { SettledGuardOutcome } from '@/hooks/impact-guard/guard-result';

interface NotificationApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

interface UseGuardedContactMutationProps {
  readonly editContact?: Contact | null;
  readonly notifications: NotificationApi;
  readonly onUpdateSucceeded?: () => void;
  readonly setLoading?: (loading: boolean) => void;
}

interface UseGuardedContactMutationReturn {
  readonly guardDialogs: React.ReactNode;
  readonly runExistingContactFormUpdate: (
    formData: ContactFormData,
    logScope: string,
    action?: () => Promise<void>,
  ) => Promise<SettledGuardOutcome>;
  readonly runExistingContactPartialFormUpdate: (
    formData: ContactFormData,
    partialFormData: Partial<ContactFormData>,
    logScope: string,
    action?: () => Promise<void>,
  ) => Promise<SettledGuardOutcome>;
}

/**
 * Φυλαγμένες ενημερώσεις υπάρχουσας επαφής.
 *
 * 🔗 ADR-777 §8.69.13 — επιστρέφουν **ονομασμένη** έκβαση αφού τελειώσει η πράξη (ήταν boolean που
 * γινόταν `false` πριν απαντήσει ο άνθρωπος). `failed` ρίχνεται στο `catch` του καλούντα.
 */
export function useGuardedContactMutation({
  editContact,
  notifications,
  onUpdateSucceeded,
  setLoading,
}: UseGuardedContactMutationProps): UseGuardedContactMutationReturn {
  const { previewBeforeUpdate, GuardDialogs } = useContactUpdateGuards({
    editContact,
    notifications,
    onUpdateSucceeded,
    setLoading,
  });

  /**
   * Ο **ένας** δρόμος: οι φύλακες βλέπουν ολόκληρη τη φόρμα (`formData`), η εγγραφή στέλνει
   * `written` — ολόκληρη ή μόνο το «βρώμικο» κομμάτι (ADR-323).
   */
  const runExistingUpdate = async (
    formData: ContactFormData,
    written: Partial<ContactFormData>,
    logScope: string,
    action?: () => Promise<void>,
  ): Promise<SettledGuardOutcome> => {
    if (!editContact) {
      throw new Error('Existing contact context is required for guarded updates');
    }

    const performUpdate = action ?? (async () => {
      await ContactsService.updateExistingContactFromForm(editContact, written);
    });

    return executeGuardedContactUpdate({ formData, previewBeforeUpdate, action: performUpdate, logScope });
  };

  return {
    guardDialogs: GuardDialogs,
    runExistingContactFormUpdate: (formData, logScope, action) =>
      runExistingUpdate(formData, formData, logScope, action),
    runExistingContactPartialFormUpdate: (formData, partialFormData, logScope, action) =>
      runExistingUpdate(formData, partialFormData, logScope, action),
  };
}
