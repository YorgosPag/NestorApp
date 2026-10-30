/**
 * @fileoverview Accounting Subapp — useAPYCertificateDraft Hook
 * @description Η προεπισκόπηση της βεβαίωσης παρακράτησης ενός πελάτη για μία χρήση — ο ΙΔΙΟΣ υπολογισμός που
 *   τρέχει ο διακομιστής κατά τη δημιουργία (`services/apy/apy-certificate-draft.ts`). Ο διάλογος δεν αθροίζει τίποτα.
 * @see ADR-ACC-020 Βεβαίωση Παρακράτησης Φόρου · ADR-ACC-010 §2.1.1 · ADR-223 (`useAsyncData`)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

'use client';

import { API_ROUTES } from '@/config/domain-constants';
import { useAsyncData } from '@/hooks/useAsyncData';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { APYCertificateDraft } from '@/subapps/accounting/services/apy/apy-certificate-draft';

export interface UseAPYCertificateDraftReturn {
  /** `null` όσο δεν έχει επιλεγεί πελάτης ή φορτώνει ο τρέχων. */
  readonly draft: APYCertificateDraft | null;
  readonly loading: boolean;
  /** Ο υπολογισμός απέτυχε — ΠΟΤΕ δεν εμφανίζεται ως «κανένα τιμολόγιο». */
  readonly failed: boolean;
}

/**
 * @param customerId η επαφή-πελάτης· `null` = καμία ανάγνωση
 * @param fiscalYear η χρήση
 *
 * ⚠️ Το `useAsyncData` κρατά τα προηγούμενα δεδομένα όσο φορτώνει το νέο κλειδί (και όταν απενεργοποιηθεί). Εδώ
 *    αυτό θα έδειχνε τα τιμολόγια ΑΛΛΟΥ πελάτη κάτω από τον νέο ⇒ δείχνουμε μόνο draft **του τρέχοντος κλειδιού**
 *    — το draft κουβαλά το δικό του `customerId`/`fiscalYear`, άρα ο έλεγχος δεν χρειάζεται δεύτερη κατάσταση.
 */
export function useAPYCertificateDraft(customerId: string | null, fiscalYear: number): UseAPYCertificateDraftReturn {
  const { data, loading, error } = useAsyncData<APYCertificateDraft>({
    fetcher: () => {
      const params = new URLSearchParams({ customerId: customerId ?? '', fiscalYear: String(fiscalYear) });
      return apiClient.get<APYCertificateDraft>(`${API_ROUTES.ACCOUNTING.APY_CERTIFICATES.DRAFT}?${params.toString()}`);
    },
    deps: [customerId, fiscalYear],
    enabled: customerId !== null,
  });

  const current = customerId !== null && data?.customerId === customerId && data.fiscalYear === fiscalYear;
  return {
    draft: current ? data : null,
    loading: customerId !== null && loading,
    failed: customerId !== null && error !== null && !loading,
  };
}
