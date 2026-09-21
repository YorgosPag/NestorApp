'use client';

/**
 * @fileoverview **«Διάλεξε επαφή → γέμισε τη φόρμα»** — ο κύκλος ζωής, μία φορά.
 * @related CLAUDE.md N.0.2 / N.18 (CHECK 3.28) · `utils/contact-party.ts`
 *
 * 🔴 **Γιατί υπάρχει**: ο ίδιος handler (επιλογή → πλήρης επαφή → εφαρμογή → μήνυμα που
 * σβήνει σε 3″) ζούσε στο `CustomerSelector` και στο `BasicInfoSection`. Και στα δύο το
 * `setTimeout` **δεν καθαριζόταν**: κλείσιμο της φόρμας μέσα στα 3″ άφηνε `setState` σε
 * component που είχε φύγει, και μια δεύτερη επιλογή έσβηνε το μήνυμά της με τον χρονιστή
 * της πρώτης. Εδώ υπάρχει **ένας** χρονιστής, που ακυρώνεται σε νέα επιλογή και στο unmount.
 *
 * ⚠️ Η **αντιστοίχιση** πεδίων μένει στον καλούντα (`apply`): πελάτης τιμολογίου και
 * στοιχεία εταιρείας θέλουν άλλα πεδία από την ίδια επαφή.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import { ContactsService } from '@/services/contacts.service';
import type { Contact } from '@/types/contacts';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useContactAutoFill');
const MESSAGE_VISIBLE_MS = 3000;

export function useContactAutoFill(apply: (contact: Contact) => void, initialContactId = '') {
  const { t } = useTranslation('accounting-setup');
  const [selectedContactId, setSelectedContactId] = useState(initialContactId);
  const [autoFillMessage, setAutoFillMessage] = useState<string | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClearTimer = useCallback(() => {
    if (clearTimerRef.current !== null) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = null;
  }, []);

  useEffect(() => cancelClearTimer, [cancelClearTimer]);

  const handleContactAutoFill = useCallback(async (contact: ContactSummary | null) => {
    cancelClearTimer();
    if (!contact) {
      setSelectedContactId('');
      setAutoFillMessage(null);
      return;
    }
    setSelectedContactId(contact.id);
    try {
      const fullContact = await ContactsService.getContact(contact.id);
      if (!fullContact) {
        setAutoFillMessage(t('setup.contactAutoFillError'));
        return;
      }
      apply(fullContact);
      setAutoFillMessage(t('setup.contactAutoFilled'));
      clearTimerRef.current = setTimeout(() => setAutoFillMessage(null), MESSAGE_VISIBLE_MS);
    } catch (error) {
      logger.error('Contact auto-fill failed', { contactId: contact.id, error });
      setAutoFillMessage(t('setup.contactAutoFillError'));
    }
  }, [apply, cancelClearTimer, t]);

  return { selectedContactId, autoFillMessage, handleContactAutoFill };
}
