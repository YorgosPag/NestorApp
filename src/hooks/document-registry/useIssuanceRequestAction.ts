'use client';

/**
 * @fileoverview ADR-945 §7.6 — **η αποστολή μιας πράξης στο αίτημα προσφορών** (πρόσκληση · επιλογή · ακύρωση).
 * @related lib/document-validity/issuance-bidding-request.ts (σύρμα · ο ΕΝΑΣ πίνακας αρνήσεων) ·
 *   services/document-registry/document-registry.client.ts (`saveIssuanceRequestAction`) ·
 *   useUpkeepDeclaration.ts (το ΙΔΙΟ ιδίωμα)
 * @module hooks/document-registry/useIssuanceRequestAction
 *
 * 🔑 **ΟΧΙ αισιόδοξα** (ίδια απόφαση με το `useUpkeepDeclaration`): κάθε πράξη κρίνεται με **CAS σε δύο επίπεδα** και η
 *    ανάθεση κλείνει τις άλλες προσφορές στην ίδια συναλλαγή — μια αισιόδοξη αναπαραγωγή εδώ θα ήταν δεύτερη μηχανή, και
 *    ένα «ανατέθηκε» που ξαναχάνεται. Το κουμπί λέει «Αποθηκεύεται…»· επιτυχία ⇒ `revalidate`· άρνηση ⇒ **γιατί**.
 * 🔑 **Χωρίς διπλή αποστολή**: όσο υπάρχει αίτημα σε πτήση, δεύτερο πάτημα αγνοείται (ref). Το `Idempotency-Key` του
 *    `apiClient.put` καλύπτει την αυτόματη επανάληψη του δικτύου (CHECK 3.92).
 */

import { useCallback, useRef, useState } from 'react';

import { REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import { OWNER_ISSUANCE_KEYS } from '@/components/owner-property/owner-issuance-labels';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  issuanceRequestRefusalOfCode,
  type IssuanceRequestBody,
  type IssuanceRequestServiceRefusal,
} from '@/lib/document-validity/issuance-bidding-request';
import { useNotifications } from '@/providers/NotificationProvider';
import { saveIssuanceRequestAction } from '@/services/document-registry/document-registry.client';

export type IssuanceRequestActionError = IssuanceRequestServiceRefusal | 'failed';

export interface IssuanceRequestActionApi {
  /** `true` = ο διακομιστής δέχτηκε την πράξη (ή ήταν ήδη έτσι). */
  readonly submit: (body: IssuanceRequestBody) => Promise<boolean>;
  /** Η πράξη σε πτήση (`issuanceActionKeyOf`) — `null` όταν τίποτα. */
  readonly busyKey: string | null;
  /** Η άρνηση της τελευταίας αποστολής, με την πράξη της. ⚠️ Γραμμή, όχι κλειδί (CHECK 3.34). */
  readonly error: { readonly key: string; readonly reason: IssuanceRequestActionError } | null;
}

/** Η ΜΙΑ ταυτότητα μιας πράξης — «ποιο κουμπί περιμένει» και «πού λέγεται η άρνηση». */
export function issuanceActionKeyOf(body: IssuanceRequestBody): string {
  const subject = body.action === 'award' ? body.bidId : body.action === 'invite' ? body.professionalCompanyId : '';
  return `${body.documentKind}:${body.action}:${subject}`;
}

/** Το μήνυμα επιτυχίας ανά πράξη — χάρτης με κυριολεκτικές τιμές (CHECK 3.34). */
const DONE_KEYS: Readonly<Record<IssuanceRequestBody['action'], string>> = {
  invite: OWNER_ISSUANCE_KEYS.invited,
  award: OWNER_ISSUANCE_KEYS.awarded,
  cancel: OWNER_ISSUANCE_KEYS.cancelled,
};

export function useIssuanceRequestAction(revalidate: () => Promise<void>): IssuanceRequestActionApi {
  // Μόνο τα μηνύματα επιτυχίας (`document-registry`) — όχι οι ετικέτες είδους: ο καλών στο `/pro` δεν τις χρειάζεται (CHECK 3.34).
  const { t } = useTranslation([REGISTRY_NS]);
  const { success } = useNotifications();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<IssuanceRequestActionApi['error']>(null);
  const inFlight = useRef(false);

  const submit = useCallback(async (body: IssuanceRequestBody): Promise<boolean> => {
    if (inFlight.current) return false;
    inFlight.current = true;
    const key = issuanceActionKeyOf(body);
    setBusyKey(key);
    setError(null);
    try {
      const saved = await saveIssuanceRequestAction(body);
      if (saved.kind === 'failed') {
        setError({ key, reason: issuanceRequestRefusalOfCode(saved.code) ?? 'failed' });
        // Ο κόσμος άλλαξε κάτω από τον άνθρωπο ⇒ του δείχνουμε τον νέο, για να ξανακρίνει (Google Docs «reload»).
        if (saved.code !== null) await revalidate();
        return false;
      }
      await revalidate();
      success(t(DONE_KEYS[body.action]));
      return true;
    } finally {
      inFlight.current = false;
      setBusyKey(null);
    }
  }, [revalidate, success, t]);

  return { submit, busyKey, error };
}
