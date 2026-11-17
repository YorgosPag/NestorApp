'use client';

/**
 * @fileoverview **Η υιοθέτηση του ονόματος του λογαριασμού** — επιπτώσεις, κλήση του server και η είδηση (ADR-915 §40.9).
 * @module components/contacts/details/useAdoptAccountName
 *
 * 🔑 Ίδιο μοτίβο με το `useAdoptDeclaredCredential`: ο πελάτης στέλνει **μόνο** ό,τι είδε (CAS)· 409 ⇒ «άλλαξε στο
 *    μεταξύ», ποτέ σιωπηλή επανάληψη. Η λίστα επαφών είναι ζωντανή (`subscribeToContacts`) **και** η κρίση «ίδιο /
 *    διαφορετικό» γίνεται στον πελάτη πάνω της (ADR-915 §40.10, `ContactProfessionalLinkBadge`) ⇒ μετά την επιτυχία το
 *    σήμα και το κουμπί φεύγουν μόνα τους — καμία αισιόδοξη κατάσταση που θα χρειαζόταν επαναφορά, κανένα δεύτερο αίτημα.
 *    ⚠️ Ως την §40.10 η κρίση ερχόταν **έτοιμη** από τον server και αυτό το σχόλιο ήταν ψευδές: μετρήθηκε στην παραγωγή
 *    2026-11-17 ότι το σήμα έμενε «διαφορετικό» μέχρι ανανέωση.
 * 🔑 **Επιπτώσεις** = το ΙΔΙΟ `name-cascade-preview` που ρωτά η φόρμα πριν από αλλαγή ονόματος (ADR-249 Guard 1).
 *    Αποτυχία ⇒ `unavailable`, όχι εμπόδιο: το cascade τρέχει στον server και είναι η αυθεντία· ο αριθμός ενημερώνει.
 */

import { useCallback, useState } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { ApiClientError } from '@/lib/api/api-client-types';
import { API_ROUTES } from '@/config/domain-constants';
import { useNotifications } from '@/providers/NotificationProvider';
import type { Translate } from '@/i18n/hooks/useTranslation';
import type { ContactPersonName } from '@/lib/engagements/contact-account-name-match';
import type { AdoptAccountNameRequest, AdoptAccountNameResponse } from '@/types/contact-professional-link';
import { ACCOUNT_NAME_ADOPTION_KEYS } from './contact-professional-link-labels';

/** Πόσες ακόμη εγγραφές θα ενημερωθούν — `loading` · `unavailable` · ή ο αριθμός. */
export type NameAdoptionImpact =
  | { readonly state: 'loading' }
  | { readonly state: 'unavailable' }
  | { readonly state: 'known'; readonly totalAffected: number };

interface NameCascadePreviewResponse {
  readonly totalAffected: number;
}

export function useAdoptAccountName(contactId: string, t: Translate) {
  const { success, info, warning, error } = useNotifications();
  const [pending, setPending] = useState(false);
  const [impact, setImpact] = useState<NameAdoptionImpact>({ state: 'loading' });

  const loadImpact = useCallback(async (): Promise<void> => {
    setImpact({ state: 'loading' });
    try {
      const preview = await apiClient.get<NameCascadePreviewResponse>(API_ROUTES.CONTACTS.NAME_CASCADE_PREVIEW(contactId));
      setImpact({ state: 'known', totalAffected: preview.totalAffected });
    } catch {
      setImpact({ state: 'unavailable' });
    }
  }, [contactId]);

  const notifyResult = useCallback(
    (result: AdoptAccountNameResponse): void => {
      if (result.outcome === 'unchanged') info(t(ACCOUNT_NAME_ADOPTION_KEYS.unchanged));
      else if (result.nameCascade === 'failed') warning(t(ACCOUNT_NAME_ADOPTION_KEYS.cascadeFailed));
      else success(t(ACCOUNT_NAME_ADOPTION_KEYS.adopted));
    },
    [t, success, info, warning],
  );

  const adopt = useCallback(
    async (expectedCurrent: ContactPersonName): Promise<void> => {
      setPending(true);
      try {
        const body: AdoptAccountNameRequest = { expectedCurrent };
        notifyResult(await apiClient.post<AdoptAccountNameResponse>(API_ROUTES.CONTACTS.ADOPT_ACCOUNT_NAME(contactId), body));
      } catch (err) {
        if (err instanceof ApiClientError && err.statusCode === 409) warning(t(ACCOUNT_NAME_ADOPTION_KEYS.conflict));
        else error(t(ACCOUNT_NAME_ADOPTION_KEYS.failed));
      } finally {
        setPending(false);
      }
    },
    [contactId, t, notifyResult, warning, error],
  );

  return { adopt, pending, impact, loadImpact };
}
