/**
 * Κοινά της εκτέλεσης / αναίρεσης αποσβέσεων χρήσης (ADR-ACC-010 §2.1.1 Φάση 5): σχήμα σώματος + αντιστοίχιση των
 * αρνήσεων της μηχανής σε HTTP με `errorCode` (ADR-284). Το όριο ρυθμού και ο ρόλος δηλώνονται ΡΗΤΑ σε κάθε
 * `route.ts` (CHECK 3.78 / 3.68) — εδώ ζει μόνο ό,τι θα ήταν δίδυμο.
 *
 * @module api/accounting/_shared/depreciation-run-request
 */

import 'server-only';

import { z } from 'zod';

import { ApiError } from '@/lib/api/ApiErrorHandler';
import { DepreciationRunError } from '@/subapps/accounting/services/engines/depreciation-engine';
import { InvalidDepreciationTermsError } from '@/subapps/accounting/services/engines/depreciation-schedule';
import { DepreciationPeriodClosedError } from '@/subapps/accounting/services/repository/accounting-repo-depreciation';
import { MAX_FISCAL_YEAR, MIN_FISCAL_YEAR } from './fiscal-year-param';

/** `{ fiscalYear }` — ακέραιο έτος στα όρια του query (ένα σημείο ορίων: `fiscal-year-param`). */
export const DepreciationRunSchema = z.object({
  fiscalYear: z.number().int().min(MIN_FISCAL_YEAR).max(MAX_FISCAL_YEAR),
}).strict();

/**
 * Η μηχανή αρνήθηκε ⇒ 409 με τον κωδικό της (η χρήση/περίοδος δεν το επιτρέπει — κατάσταση, όχι κακό αίτημα)·
 * άκυρα στοιχεία παγίου ⇒ 422. Οτιδήποτε άλλο ανεβαίνει αμετάβλητο (500 από το `defineRoute`).
 */
export async function withDepreciationRunErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof DepreciationRunError || error instanceof DepreciationPeriodClosedError) {
      throw new ApiError(409, error.message, error.code);
    }
    if (error instanceof InvalidDepreciationTermsError) {
      throw new ApiError(422, error.message, 'INVALID_DEPRECIATION_TERMS', { field: String(error.field) });
    }
    throw error;
  }
}
