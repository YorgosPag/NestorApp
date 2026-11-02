'use client';

/**
 * useContactPickerSearch — αναζήτηση επαφών με το όνομα, για pickers (ADR-601).
 *
 * Οι επαφές φορτώνονται μία φορά ανά στιγμιότυπο και φιλτράρονται στον client.
 * Το φίλτρο εταιρείας το βάζει το query service· εδώ δεν προστίθεται ούτε χαλαρώνει.
 *
 * ⚠️ Εκτός barrel: το `pickers/index.ts` δεν πρέπει να τραβά το `ContactsService`
 * σε όποιον χρειάζεται μόνο τη διάταξη του picker.
 */

import { useCallback } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { ContactsService } from '@/services/contacts.service';
import { getContactDisplayName, getPrimaryEmail, getPrimaryPhone } from '@/types/contacts';
import { useCachedPickerOptions } from './use-cached-picker-options';

const logger = createModuleLogger('useContactPickerSearch');

const FETCH_LIMIT = 500;
const MAX_RESULTS = 10;

export interface ContactPickerOption {
  readonly id: string;
  readonly label: string;
  readonly email?: string;
  readonly phone?: string;
}

async function loadContactPickerOptions(): Promise<readonly ContactPickerOption[]> {
  try {
    const { contacts } = await ContactsService.getAllContacts({ limitCount: FETCH_LIMIT });
    return contacts
      .map((contact) => ({
        id: contact.id ?? '',
        label: getContactDisplayName(contact),
        email: getPrimaryEmail(contact),
        phone: getPrimaryPhone(contact),
      }))
      .filter((option) => option.id !== '' && option.label.trim() !== '');
  } catch (error) {
    logger.warn('Failed to load contacts for a picker', { error });
    throw error;
  }
}

export function useContactPickerSearch(): (query: string) => Promise<ContactPickerOption[]> {
  const loadContacts = useCachedPickerOptions(loadContactPickerOptions);

  return useCallback(
    async (query: string) => {
      const options = await loadContacts();
      const term = query.toLowerCase().trim();
      return options
        .filter((option) => option.label.toLowerCase().includes(term))
        .slice(0, MAX_RESULTS);
    },
    [loadContacts]
  );
}
