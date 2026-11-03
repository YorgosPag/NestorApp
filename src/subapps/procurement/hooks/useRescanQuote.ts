'use client';

/**
 * useRescanQuote — «Επανάληψη» εξαγωγής AI (ADR-327 §6.10) μέσω `POST /api/quotes/{id}/rescan`.
 *
 * Μετά την αποδοχή (202) καλεί `onStarted` ⇒ ο καλών ξαναδιαβάζει την προσφορά, ο κριτής τη βλέπει `extracting`
 * και το polling του `useQuote` ξαναρχίζει μόνο του. Οι αρνήσεις του server (409 + κωδικός) μένουν **κωδικοί**:
 * το κείμενο το δίνει η κάρτα με στατικές κλήσεις `t('…')` (ορατές στο CHECK 3.8 και στο route slice, ADR-744).
 */

import { useCallback, useState } from 'react';
import { fetchJson, jsonRequest } from '@/lib/api/fetch-json';

const RESCAN_REFUSAL_CODES = ['not_retryable', 'no_document', 'file_unavailable'] as const;

/** Γιατί δεν ξεκίνησε η επανάληψη — `failed` = οτιδήποτε άλλο (δίκτυο, 5xx). Το κείμενο το δίνει η κάρτα. */
export type RescanError = (typeof RESCAN_REFUSAL_CODES)[number] | 'failed';

function rescanErrorOf(error: unknown): RescanError {
  const message = error instanceof Error ? error.message : '';
  return RESCAN_REFUSAL_CODES.find((code) => code === message) ?? 'failed';
}

export interface UseRescanQuoteResult {
  rescan: () => Promise<void>;
  rescanning: boolean;
  /** Η τελευταία άρνηση — `null` όσο δεν υπάρχει. */
  rescanError: RescanError | null;
}

export function useRescanQuote(quoteId: string, onStarted: () => Promise<void> | void): UseRescanQuoteResult {
  const [rescanning, setRescanning] = useState(false);
  const [rescanError, setRescanError] = useState<RescanError | null>(null);

  const rescan = useCallback(async () => {
    setRescanning(true);
    setRescanError(null);
    try {
      await fetchJson(`/api/quotes/${quoteId}/rescan`, jsonRequest('POST'));
      await onStarted();
    } catch (e) {
      // Άλλη καρτέλα/κλικ ξεκίνησε ήδη προσπάθεια: δεν είναι σφάλμα — δείξε την (spinner + polling).
      if (e instanceof Error && e.message === 'in_progress') await onStarted();
      else setRescanError(rescanErrorOf(e));
    } finally {
      setRescanning(false);
    }
  }, [quoteId, onStarted]);

  return { rescan, rescanning, rescanError };
}
