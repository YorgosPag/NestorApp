/**
 * @fileoverview Accounting Subapp — useJournalReversal Hook
 * @description Αντιλογισμός (storno) εγγραφής από το βιβλίο. Ο ΔΙΑΚΟΜΙΣΤΗΣ αποφασίζει τα πάντα (επιτρέπεται; ποια
 *   ημερομηνία;)· εδώ μόνο το αίτημα και η απάντηση. `Idempotency-Key` από τον `apiClient` (ADR-872): η αυτόματη
 *   επανάληψη ΔΕΝ γεννά δεύτερο storno — και ούτε θα μπορούσε (ντετερμινιστικό id, ADR-ACC-010 §2.1.1 Φ8).
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

'use client';

import { useCallback, useState } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { ApiClientError } from '@/lib/api/api-client-types';
import type { JournalReversalReasonCode } from '../types/journal-reversal';

/** Η απάντηση του διακομιστή (ίδια για νέο αντιλογισμό και για ιδεμπότητη επανάληψη). */
export interface JournalReversalResult {
  readonly originalEntryId: string;
  readonly reversalEntryId: string | null;
  readonly reversalDate?: string;
  readonly crossPeriod?: boolean;
  readonly alreadyReversed: boolean;
}

/** Η άρνηση όπως ήρθε: κωδικός + ωμό σώμα (για το μήνυμα περιόδου). */
export interface JournalReversalFailure {
  readonly errorCode: string;
  readonly body: unknown;
}

export interface UseJournalReversalReturn {
  /** Εκτελείται — το κουμπί κλειδώνει (ένα κλικ = μία πράξη). */
  readonly running: boolean;
  readonly failure: JournalReversalFailure | null;
  readonly reverse: (entryId: string, reasonCode: JournalReversalReasonCode, notes: string) => Promise<JournalReversalResult | null>;
  readonly reset: () => void;
}

function failureOf(error: unknown): JournalReversalFailure {
  if (error instanceof ApiClientError) {
    return { errorCode: error.errorCode ?? 'UNKNOWN', body: error.errorBody ?? null };
  }
  return { errorCode: 'UNKNOWN', body: null };
}

export function useJournalReversal(): UseJournalReversalReturn {
  const [running, setRunning] = useState(false);
  const [failure, setFailure] = useState<JournalReversalFailure | null>(null);

  const reverse = useCallback(async (entryId: string, reasonCode: JournalReversalReasonCode, notes: string) => {
    setRunning(true);
    setFailure(null);
    try {
      const trimmed = notes.trim();
      return await apiClient.post<JournalReversalResult>(
        API_ROUTES.ACCOUNTING.JOURNAL_REVERSAL(entryId),
        trimmed ? { reasonCode, notes: trimmed } : { reasonCode }
      );
    } catch (error) {
      setFailure(failureOf(error));
      return null;
    } finally {
      setRunning(false);
    }
  }, []);

  const reset = useCallback(() => setFailure(null), []);

  return { running, failure, reverse, reset };
}
