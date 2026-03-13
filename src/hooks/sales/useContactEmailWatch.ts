/**
 * @fileoverview Real-time contact email watcher for sales dialogs
 * @description Subscribes to a Firestore contact document via onSnapshot.
 *              Updates `hasEmail` in real-time when the contact card is edited
 *              (e.g. user adds email in another tab while the Reserve dialog is open).
 * @pattern Direct onSnapshot — same pattern as useProjectFloorplans, useMessageReactions
 */

'use client';

import { useEffect, useState } from 'react';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';

interface EmailInfo {
  email?: string;
  isPrimary?: boolean;
}

interface ContactEmailState {
  /** Whether the contact has at least one email */
  hasEmail: boolean;
  /** The primary (or first) email address, if any */
  email: string | null;
}

/**
 * Real-time watcher for a contact's email status.
 *
 * Subscribes to the contact document in Firestore and updates
 * whenever the contact is edited (e.g. email added in another tab).
 *
 * @param contactId - Firestore contact document ID (empty string = no subscription)
 * @returns { hasEmail, email } — live state
 */
export function useContactEmailWatch(contactId: string): ContactEmailState {
  const [state, setState] = useState<ContactEmailState>({ hasEmail: false, email: null });

  useEffect(() => {
    if (!contactId) {
      setState({ hasEmail: false, email: null });
      return;
    }

    const unsubscribe = firestoreQueryService.subscribeDoc<Record<string, unknown>>(
      'CONTACTS',
      contactId,
      (data) => {
        if (!data) {
          setState({ hasEmail: false, email: null });
          return;
        }

        // Check emails[] array (standard structure) first, then legacy email field
        const emails = data.emails as EmailInfo[] | undefined;
        const primaryEmail = emails?.find(e => e.isPrimary)?.email
          ?? emails?.[0]?.email
          ?? null;
        const resolvedEmail = primaryEmail ?? (data.email as string) ?? null;

        setState({
          hasEmail: !!resolvedEmail,
          email: resolvedEmail,
        });
      },
      () => {
        // On error, assume no email (non-blocking)
        setState({ hasEmail: false, email: null });
      }
    );

    return () => unsubscribe();
  }, [contactId]);

  return state;
}
