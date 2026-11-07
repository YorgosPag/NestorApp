/**
 * @fileoverview Accounting Subapp — useFiscalPeriods Hook (ADR-ACC-010 §2.1.1 Φ9-Β)
 * @description Οι 13 περίοδοι μιας χρήσης + οι δύο διοικητικές πράξεις πάνω τους: άνοιγμα χρήσης (POST) και μετάβαση
 *   περιόδου (PATCH κλείσιμο/κλείδωμα/επαναφορά). Ο ΔΙΑΚΟΜΙΣΤΗΣ κρίνει τα πάντα μέσα στη συναλλαγή (ρόλος, κατάσταση,
 *   μισθωτής)· εδώ μόνο αίτημα, απάντηση και ξαναδιάβασμα. `Idempotency-Key` από τον `apiClient` (ADR-872).
 *   Μετά από πράξη η λίστα ΞΑΝΑΔΙΑΒΑΖΕΤΑΙ (όχι αισιόδοξη ενημέρωση): η κατάσταση περιόδου είναι λογιστικός φραγμός και
 *   η οθόνη δεν πρέπει να δείξει ποτέ «κλεισμένη» κάτι που ο γραφέας αρνήθηκε.
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { ApiClientError } from '@/lib/api/api-client-types';
import type { FiscalPeriod, FiscalPeriodAction } from '../types/fiscal-period';

interface FiscalPeriodListResponse {
  readonly items: FiscalPeriod[];
}

/** Κωδικός άρνησης του διακομιστή (`FISCAL_YEAR_EXISTS`, `FISCAL_PERIOD_INVALID_TRANSITION`, …) ή `UNKNOWN`. */
export type FiscalPeriodFailureCode = string;

export interface UseFiscalPeriodsReturn {
  readonly periods: readonly FiscalPeriod[];
  readonly loading: boolean;
  /** Αποτυχία ΑΝΑΓΝΩΣΗΣ της λίστας. */
  readonly loadFailure: FiscalPeriodFailureCode | null;
  /** Εκτελείται πράξη — τα κουμπιά κλειδώνουν (ένα κλικ = μία πράξη). */
  readonly running: boolean;
  /** Αποτυχία της τελευταίας ΠΡΑΞΗΣ. */
  readonly actionFailure: FiscalPeriodFailureCode | null;
  readonly openYear: () => Promise<boolean>;
  readonly transition: (periodId: string, action: FiscalPeriodAction, reason: string | null) => Promise<boolean>;
  readonly clearActionFailure: () => void;
}

function failureCodeOf(error: unknown): FiscalPeriodFailureCode {
  return error instanceof ApiClientError && error.errorCode ? error.errorCode : 'UNKNOWN';
}

export function useFiscalPeriods(fiscalYear: number): UseFiscalPeriodsReturn {
  const [periods, setPeriods] = useState<readonly FiscalPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailure, setLoadFailure] = useState<FiscalPeriodFailureCode | null>(null);
  const [running, setRunning] = useState(false);
  const [actionFailure, setActionFailure] = useState<FiscalPeriodFailureCode | null>(null);

  const load = useCallback(async (isCurrent: () => boolean = () => true) => {
    setLoading(true);
    setLoadFailure(null);
    try {
      const data = await apiClient.get<FiscalPeriodListResponse>(
        `${API_ROUTES.ACCOUNTING.FISCAL_PERIODS.LIST}?fiscalYear=${fiscalYear}`
      );
      if (isCurrent()) setPeriods(data.items);
    } catch (error) {
      if (isCurrent()) { setPeriods([]); setLoadFailure(failureCodeOf(error)); }
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [fiscalYear]);

  // Αλλαγή χρήσης ⇒ νέα ανάγνωση· η απάντηση μιας ΠΑΛΙΑΣ χρήσης δεν γράφει ποτέ πάνω στη νέα.
  useEffect(() => {
    let current = true;
    setActionFailure(null);
    void load(() => current);
    return () => { current = false; };
  }, [load]);

  const act = useCallback(async (request: () => Promise<unknown>) => {
    setRunning(true);
    setActionFailure(null);
    try {
      await request();
      await load();
      return true;
    } catch (error) {
      setActionFailure(failureCodeOf(error));
      // Η άρνηση συνήθως σημαίνει ότι η οθόνη είναι μπαγιάτικη (άλλος έκλεισε την περίοδο) ⇒ φρέσκια εικόνα.
      await load();
      return false;
    } finally {
      setRunning(false);
    }
  }, [load]);

  const openYear = useCallback(
    () => act(() => apiClient.post(API_ROUTES.ACCOUNTING.FISCAL_PERIODS.LIST, { fiscalYear })),
    [act, fiscalYear]
  );

  const transition = useCallback(
    (periodId: string, action: FiscalPeriodAction, reason: string | null) => {
      const trimmed = reason?.trim() ?? '';
      const body = trimmed ? { action, reason: trimmed } : { action };
      return act(() => apiClient.patch(API_ROUTES.ACCOUNTING.FISCAL_PERIODS.BY_ID(periodId), body));
    },
    [act]
  );

  const clearActionFailure = useCallback(() => setActionFailure(null), []);

  return { periods, loading, loadFailure, running, actionFailure, openYear, transition, clearActionFailure };
}
