/**
 * @fileoverview Accounting Subapp — useListSummary Hook
 * @description Οι κάρτες μιας λίστας από τον διακομιστή (`…/summary`), πάνω σε ΟΛΗ την εμβέλεια των ΙΔΙΩΝ φίλτρων με
 *   τη λίστα — όχι άθροισμα της φορτωμένης σελίδας. Ένα hook για κάθε λίστα (τιμολόγια · ημερολόγιο · τράπεζα · πάγια).
 * @see ADR-ACC-010 §2.1.1 («σελίδα ≠ καθολικό» — κάρτες σύνοψης) · ADR-223 (`useAsyncData`)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

'use client';

import { useAuth } from '@/hooks/useAuth';
import { useAsyncData, type UseAsyncDataReturn } from '@/hooks/useAsyncData';
import { buildUrl, type PagedListParamValue } from '@/hooks/useCursorPagedList';
import { apiClient } from '@/lib/api/enterprise-api-client';

/**
 * @param url το `…_SUMMARY` της λίστας (`API_ROUTES.ACCOUNTING`)
 * @param params **τα ίδια** φίλτρα με το hook της λίστας — το URL χτίζεται από τον ίδιο `buildUrl`
 *
 * ⚠️ Μετά από αλλαγή δεδομένων (νέα εγγραφή, πληρωμή, αντιστοίχιση) ο καλών καλεί **και** το `refetch` αυτού του hook.
 * ⚠️ `data === null` και `!loading` ⇒ σφάλμα: η οθόνη δείχνει «—», ΠΟΤΕ «0».
 *
 * 🔴 Το `useAsyncData` σε σφάλμα ορίζει ΜΟΝΟ το `error` και ΚΡΑΤΑ την προηγούμενη απάντηση: φίλτρο 2026 → 2025 με
 *    αποτυχημένο αίτημα θα έδειχνε τα ποσά του 2026 κάτω από «2025», χωρίς ένδειξη. Εδώ σφάλμα ⇒ `data = null` (το
 *    κοινό hook μένει ως έχει — άλλοι καταναλωτές του βασίζονται στο «κράτα τα τελευταία καλά»).
 */
export function useListSummary<S>(
  url: string,
  params: Readonly<Record<string, PagedListParamValue>>,
): UseAsyncDataReturn<S> {
  const { user } = useAuth();
  const result = useAsyncData<S>({
    fetcher: () => apiClient.get<S>(buildUrl(url, params, null)),
    // Ταξινομημένα κλειδιά ⇒ η σειρά δήλωσης των φίλτρων δεν γεννά «νέο» αίτημα.
    deps: [url, Object.entries(params).sort(([a], [b]) => (a < b ? -1 : 1))],
    enabled: user !== null,
  });
  return result.error === null ? result : { ...result, data: null };
}
