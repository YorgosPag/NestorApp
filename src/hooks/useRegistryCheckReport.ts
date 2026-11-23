'use client';

/**
 * @fileoverview **Η ΜΙΑ αρχή του «Έλεγχος στο μητρώο»** στην οθόνη — ανάγνωση της κρίσης + η πράξη.
 * @module hooks/useRegistryCheckReport
 *
 * Καταναλωτές: άδεια επαγγελματία (ADR-915 §40.7 Φ2 · `useLicenceRegistryCheck`) και επαφή-εταιρεία στο ΓΕΜΗ
 * (ADR-948 §8 Βήμα 7). Πριν υπήρχε ΜΟΝΟ ο πρώτος· ο δεύτερος θα ήταν σχεδόν πιστό αντίγραφο (N.0.2) ⇒ ένα hook.
 *
 * 🔑 Η ανάγνωση (GET) **δεν** ρωτά το μητρώο — κρίνει τα αποθηκευμένα· μόνο το πάτημα (POST) ρωτά.
 * 🔑 Ξαναδιαβάζει όταν αλλάξει το `reloadKey` (π.χ. ο **αποθηκευμένος** αριθμός): η κρίση εξαρτάται από αυτόν.
 * 🔑 Η απάντηση αντικαθιστά την αναφορά **ολόκληρη** — καμία συγχώνευση με παλιά κατάσταση.
 * 🔑 Ένα πάτημα τη φορά (`useInFlightAction`): το δεύτερο αγνοείται, δεν γίνεται δεύτερη κλήση έξω.
 */

import { useCallback, useEffect, useState } from 'react';

import { useInFlightAction } from '@/hooks/useInFlightAction';
import { apiClient } from '@/lib/api/enterprise-api-client';

export type RegistryCheckReportState<R> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'ready'; readonly report: R };

export interface RegistryCheckReportHandle<R> {
  readonly state: RegistryCheckReportState<R>;
  /** `true` όσο τρέχει η πράξη — δέσε το σε `disabled` **και** σε `aria-busy`. */
  readonly checking: boolean;
  /** Η πράξη (POST). Αποτυχία ⇒ `failed`· ποτέ σιωπή. */
  readonly check: () => Promise<void>;
}

export function useRegistryCheckReport<R>(url: string, reloadKey: string): RegistryCheckReportHandle<R> {
  const [state, setState] = useState<RegistryCheckReportState<R>>({ kind: 'loading' });
  const { isRunning, run } = useInFlightAction();

  useEffect(() => {
    let alive = true;
    setState({ kind: 'loading' });
    apiClient
      .get<R>(url)
      .then((report) => { if (alive) setState({ kind: 'ready', report }); })
      .catch(() => { if (alive) setState({ kind: 'failed' }); });
    return () => { alive = false; };
  }, [url, reloadKey]);

  const check = useCallback(
    () =>
      run(async () => {
        try {
          setState({ kind: 'ready', report: await apiClient.post<R>(url) });
        } catch {
          setState({ kind: 'failed' });
        }
      }),
    [run, url],
  );

  return { state, checking: isRunning, check };
}
