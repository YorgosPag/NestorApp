'use client';

/**
 * @fileoverview Το δέσιμο του `reportMutationFailure` με το React (ADR-898 §21.6 Ε3 · Ε4): **φορτώνει μόνο του** τα
 * namespaces που χρειάζεται ένα μήνυμα πολιτικής, ώστε κανένας καλών να μη χρειάζεται να θυμάται ότι το 409 της
 * αποσύνδεσης αναφέρει ετικέτα του `properties`.
 * @module hooks/useMutationFailureFeedback
 */

import { useCallback, useMemo } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { POLICY_ERROR_NAMESPACES, reportMutationFailure } from '@/lib/policy';
import { createModuleLogger } from '@/lib/telemetry';
import { useNotifications } from '@/providers/NotificationProvider';

/** `(σφάλμα, τι επιχειρήθηκε, γενικό μήνυμα)` — σταθερή αναφορά, μπαίνει σε `useCallback`. */
export type MutationFailureReporter = (error: unknown, action: string, fallbackMessage: string) => void;

/** @param scope — το όνομα του καταγραφέα (π.χ. `ParkingTab`). */
export function useMutationFailureFeedback(scope: string): MutationFailureReporter {
  const { t } = useTranslation(POLICY_ERROR_NAMESPACES);
  const { error: notify } = useNotifications();
  const logger = useMemo(() => createModuleLogger(scope), [scope]);

  return useCallback<MutationFailureReporter>(
    (error, action, fallbackMessage) => reportMutationFailure(error, action, fallbackMessage, { t, notify, logger }),
    [t, notify, logger],
  );
}
