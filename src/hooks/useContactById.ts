'use client';

/**
 * useContactById — Single contact lookup by ID
 *
 * O(1) Firestore document read. Used in detail views where we have
 * an ID but no full contact list in scope (e.g. PurchaseOrderDetail).
 *
 * @module hooks/useContactById
 * @see ADR-214 — Contact Query Service
 */

import { useState, useEffect } from 'react';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import type { Contact } from '@/types/contacts';
import { createModuleLogger } from '@/lib/telemetry';
import { useAuth } from '@/hooks/useAuth';

const logger = createModuleLogger('useContactById');

export function useContactById(contactId: string | null | undefined): Contact | null {
  const { user, loading: authLoading } = useAuth();
  const [contact, setContact] = useState<Contact | null>(null);

  useEffect(() => {
    if (!contactId || authLoading || !user) return;

    firestoreQueryService
      .getById<Record<string, unknown>>('CONTACTS', contactId)
      .then((doc) => {
        if (doc) setContact(doc as unknown as Contact);
      })
      .catch((err) => {
        logger.warn('Contact lookup failed', { contactId, error: err });
      });
  }, [contactId, authLoading, user]);

  return contact;
}
