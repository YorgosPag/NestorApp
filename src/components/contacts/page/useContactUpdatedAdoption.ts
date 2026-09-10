'use client';

/**
 * @fileoverview Η λίστα επαφών **υιοθετεί** κάθε απήχηση `CONTACT_UPDATED` — ADR-332 D27 Β-ΙΙ.
 * @module components/contacts/page/useContactUpdatedAdoption
 *
 * Εξήχθη από το `useContactsPageState` (N.7.1) όταν η απήχηση απέκτησε **τις διευθύνσεις που
 * γράφτηκαν** (πρακτική Β5). Η ανοιχτή επαφή είναι παράγωγο της λίστας, οπότε ενημερώνεται μαζί —
 * πριν το D21 χρειαζόταν δεύτερη, χειροκίνητη εγγραφή, δηλαδή διπλός συγχρονισμός.
 *
 * ⚠️ Χωρίς αυτή τη σύνδεση, ένα «Μετακίνησε» γράφεται σωστά αλλά η οθόνη δείχνει την παλιά
 * πινέζα ως την επαναφόρτωση. Άγκυρα: `useContactUpdatedAdoption.test.ts`.
 */

import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { RealtimeService, type ContactUpdatedPayload } from '@/services/realtime';
import type { Contact } from '@/types/contacts';
import { createModuleLogger } from '@/lib/telemetry';
import { applyContactRealtimeUpdates } from './contact-realtime-updates';

const logger = createModuleLogger('ContactUpdatedAdoption');

export function useContactUpdatedAdoption(setContacts: Dispatch<SetStateAction<Contact[]>>): void {
  useEffect(() => {
    const handleContactUpdate = (payload: ContactUpdatedPayload) => {
      logger.info('Applying real-time update for contact', { contactId: payload.contactId });
      setContacts(prev => prev.map(contact =>
        contact.id === payload.contactId ? applyContactRealtimeUpdates(contact, payload.updates) : contact,
      ));
    };

    return RealtimeService.subscribe('CONTACT_UPDATED', handleContactUpdate, {
      checkPendingOnMount: false,
    });
  }, [setContacts]);
}
