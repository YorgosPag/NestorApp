/**
 * Οι αρνήσεις του γραφέα περιόδων (ADR-ACC-010 §2.1.1 Φάση 6) ⇒ HTTP με `errorCode` (ADR-284):
 * ανύπαρκτη ή ξένη περίοδος ⇒ 404 (ίδια απάντηση — καμία διαρροή ύπαρξης) · άκυρη μετάβαση / υπάρχουσα χρήση ⇒ 409
 * (κατάσταση, όχι κακό αίτημα). Οτιδήποτε άλλο ανεβαίνει αμετάβλητο (500 από το `defineRoute`).
 *
 * @module api/accounting/_shared/fiscal-period-errors
 */

import 'server-only';

import { ApiError } from '@/lib/api/ApiErrorHandler';
import {
  FiscalPeriodNotFoundError,
  FiscalPeriodTransitionError,
  FiscalYearExistsError,
} from '@/subapps/accounting/services/repository/accounting-repo-fiscal-periods';

export async function withFiscalPeriodErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof FiscalPeriodNotFoundError) throw new ApiError(404, error.message, error.code);
    if (error instanceof FiscalPeriodTransitionError || error instanceof FiscalYearExistsError) {
      throw new ApiError(409, error.message, error.code);
    }
    throw error;
  }
}
