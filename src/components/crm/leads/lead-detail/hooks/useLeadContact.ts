'use client';

import { useEffect, useState } from 'react';
import { ContactsService } from '@/services/contacts.service';
import type { Contact } from '@/types/contacts/contracts';
import { createModuleLogger } from '@/lib/telemetry';
import { createStaleCache } from '@/lib/stale-cache';

const logger = createModuleLogger('useLeadContact');

const contactCache = createStaleCache<Contact>('crm-lead-contact');

/** Η επαφή μιας ευκαιρίας· `null` όσο φορτώνει, όταν λείπει ή όταν η ανάγνωση αποτύχει. */
export function useLeadContact(contactId: string | undefined): Contact | null {
  const [contact, setContact] = useState<Contact | null>(contactId ? contactCache.get(contactId) : null);

  useEffect(() => {
    setContact(contactId ? contactCache.get(contactId) : null);
    if (!contactId) return;

    let cancelled = false;
    ContactsService.getContact(contactId)
      .then((fresh) => {
        if (cancelled) return;
        if (fresh) contactCache.set(fresh, contactId);
        setContact(fresh);
      })
      .catch((error: unknown) => {
        logger.error('Failed to load lead contact', { error, contactId });
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  return contact;
}
