/**
 * @fileoverview Accounting Subapp — useDepreciationRun Hook
 * @description Αποσβέσεις χρήσης από την οθόνη τέλους χρήσης: προεπισκόπηση (SAP test run) → καταχώριση στο Βιβλίο
 *   Ε-Ε (update / repeat run) → αναίρεση (Xero rollback). Ο ΔΙΑΚΟΜΙΣΤΗΣ υπολογίζει τα πάντα· εδώ καμία αριθμητική.
 * @see ADR-ACC-010 §2.1.1 Φάση 5 · ADR-ACC-007 §10
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { ApiClientError } from '@/lib/api/api-client-types';
import type { DepreciationPreview, DepreciationRunResult } from '@/subapps/accounting/types';

/** Ο κωδικός άρνησης του διακομιστή (μεταφράζεται στο UI) — `UNKNOWN` όταν δεν υπάρχει. */
function errorCodeOf(error: unknown): string {
  return error instanceof ApiClientError && error.errorCode ? error.errorCode : 'UNKNOWN';
}

interface PreviewState {
  readonly preview: DepreciationPreview | null;
  readonly loading: boolean;
  readonly errorCode: string | null;
  readonly reload: () => Promise<void>;
}

/** Η προεπισκόπηση της χρήσης. Αλλαγή χρήσης ενώ φορτώνει η προηγούμενη ⇒ η παλιά απάντηση ΔΕΝ γράφει πάνω στη νέα. */
function useDepreciationPreview(fiscalYear: number | null): PreviewState {
  const [preview, setPreview] = useState<DepreciationPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const requestedYear = useRef<number | null>(fiscalYear);

  const reload = useCallback(async () => {
    requestedYear.current = fiscalYear;
    if (fiscalYear === null) return;
    const current = () => requestedYear.current === fiscalYear;
    setLoading(true);
    setErrorCode(null);
    try {
      const data = await apiClient.get<DepreciationPreview>(`${API_ROUTES.ACCOUNTING.DEPRECIATION_RUN}?fiscalYear=${fiscalYear}`);
      if (current()) setPreview(data);
    } catch (error) {
      if (current()) setErrorCode(errorCodeOf(error));
    } finally {
      if (current()) setLoading(false);
    }
  }, [fiscalYear]);

  useEffect(() => {
    setPreview(null);
    void reload();
  }, [reload]);

  return { preview, loading, errorCode, reload };
}

export interface UseDepreciationRunReturn {
  readonly preview: DepreciationPreview | null;
  readonly loading: boolean;
  /** Εκτελείται καταχώριση / αναίρεση — τα κουμπιά κλειδώνουν (ένα κλικ = μία πράξη). */
  readonly running: boolean;
  readonly errorCode: string | null;
  readonly lastResult: DepreciationRunResult | null;
  readonly book: () => Promise<void>;
  readonly reverse: () => Promise<void>;
  readonly reload: () => Promise<void>;
}

/**
 * @param fiscalYear η χρήση· `null` = κλειστό παράθυρο (καμία ανάγνωση)
 * @param onPosted καλείται μετά από κάθε επιτυχή εγγραφή (π.χ. ανανέωση του μητρώου παγίων)
 */
export function useDepreciationRun(fiscalYear: number | null, onPosted?: () => void): UseDepreciationRunReturn {
  const { preview, loading, errorCode: previewError, reload } = useDepreciationPreview(fiscalYear);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<DepreciationRunResult | null>(null);
  // Χωριστά από το σφάλμα της προεπισκόπησης: η ανανέωση ΜΕΤΑ από αποτυχημένη πράξη δεν σβήνει τον λόγο της άρνησης.
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    setLastResult(null);
    setRunError(null);
  }, [fiscalYear]);

  const execute = useCallback(async (url: string) => {
    if (fiscalYear === null) return;
    setRunning(true);
    setRunError(null);
    try {
      setLastResult(await apiClient.post<DepreciationRunResult>(url, { fiscalYear }));
      onPosted?.();
    } catch (error) {
      setLastResult(null);
      setRunError(errorCodeOf(error));
    } finally {
      setRunning(false);
      await reload();
    }
  }, [fiscalYear, onPosted, reload]);

  const book = useCallback(() => execute(API_ROUTES.ACCOUNTING.DEPRECIATION_RUN), [execute]);
  const reverse = useCallback(() => execute(API_ROUTES.ACCOUNTING.DEPRECIATION_REVERSAL), [execute]);

  return { preview, loading, running, errorCode: runError ?? previewError, lastResult, book, reverse, reload };
}
