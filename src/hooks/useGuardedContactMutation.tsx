'use client';

import type React from 'react';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { ContactsService } from '@/services/contacts.service';
import { useContactUpdateGuards } from '@/hooks/useContactUpdateGuards';
import { executeGuardedContactUpdate } from '@/utils/contactForm/execute-guarded-contact-update';

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
  ) => Promise<boolean>;
  readonly runExistingContactPartialFormUpdate: (
    formData: ContactFormData,
    partialFormData: Partial<ContactFormData>,
    logScope: string,
    action?: () => Promise<void>,
  ) => Promise<boolean>;
}

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

  const runGuardedUpdate = (
    formData: ContactFormData,
    action: () => Promise<void>,
    logScope: string,
  ): Promise<boolean> => executeGuardedContactUpdate({
    formData,
    notifications,
    previewBeforeUpdate,
    action,
    logScope,
  });

  const runExistingContactFormUpdate = async (
    formData: ContactFormData,
    logScope: string,
    action?: () => Promise<void>,
  ): Promise<boolean> => {
    if (!editContact) {
      throw new Error('Existing contact context is required for guarded updates');
    }

    const performUpdate = action ?? (async () => {
      await ContactsService.updateExistingContactFromForm(editContact, formData);
    });

    return runGuardedUpdate(formData, performUpdate, logScope);
  };

  const runExistingContactPartialFormUpdate = async (
    formData: ContactFormData,
    partialFormData: Partial<ContactFormData>,
    logScope: string,
    action?: () => Promise<void>,
  ): Promise<boolean> => {
    if (!editContact) {
      throw new Error('Existing contact context is required for guarded updates');
    }

    const performUpdate = action ?? (async () => {
      await ContactsService.updateExistingContactFromForm(editContact, partialFormData);
    });

    return runGuardedUpdate(formData, performUpdate, logScope);
  };

  return {
    guardDialogs: GuardDialogs,
    runExistingContactFormUpdate,
    runExistingContactPartialFormUpdate,
  };
}
