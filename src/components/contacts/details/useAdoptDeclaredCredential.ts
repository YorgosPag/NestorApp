'use client';

/**
 * @fileoverview **Η υιοθέτηση της δήλωσης** — κλήση του server και η είδηση στον άνθρωπο (ADR-915 §40.6).
 * @module components/contacts/details/useAdoptDeclaredCredential
 *
 * 🔑 Ο πελάτης στέλνει **μόνο** την τιμή που είδε (CAS)· 409 ⇒ «άλλαξε στο μεταξύ», ποτέ σιωπηλή επανάληψη.
 * 🔑 Μετά την επιτυχία δεν χρειάζεται ανανέωση: η λίστα επαφών είναι ζωντανή (`subscribeToContacts`), άρα η σύγκριση
 *    γίνεται μόνη της «ίδιο» και το κουμπί φεύγει.
 */

import { useCallback, useState } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { ApiClientError } from '@/lib/api/api-client-types';
import { API_ROUTES } from '@/config/domain-constants';
import { useNotifications } from '@/providers/NotificationProvider';
import type { Translate } from '@/i18n/hooks/useTranslation';
import type { CredentialValue } from '@/lib/contacts/declared-credential-comparison';
import type { AdoptDeclaredCredentialRequest, AdoptDeclaredCredentialResponse } from '@/types/contact-professional-link';
import { ADOPTION_KEYS } from './contact-professional-link-labels';

export function useAdoptDeclaredCredential(contactId: string, t: Translate) {
  const { success, info, warning, error } = useNotifications();
  const [pending, setPending] = useState(false);

  const adopt = useCallback(
    async (expectedCurrent: CredentialValue | null): Promise<void> => {
      setPending(true);
      try {
        const body: AdoptDeclaredCredentialRequest = { expectedCurrent };
        const result = await apiClient.post<AdoptDeclaredCredentialResponse>(API_ROUTES.CONTACTS.ADOPT_DECLARED_CREDENTIAL(contactId), body);
        if (result.outcome === 'adopted') success(t(ADOPTION_KEYS.adopted));
        else info(t(ADOPTION_KEYS.unchanged));
      } catch (err) {
        if (err instanceof ApiClientError && err.statusCode === 409) warning(t(ADOPTION_KEYS.conflict));
        else error(t(ADOPTION_KEYS.failed));
      } finally {
        setPending(false);
      }
    },
    [contactId, t, success, info, warning, error],
  );

  return { adopt, pending };
}
