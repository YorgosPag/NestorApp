/**
 * =============================================================================
 * POST /api/accounting/assets/depreciation-run/reversal — Αναίρεση αποσβέσεων χρήσης
 * =============================================================================
 *
 * Xero «rollback depreciation»: το καταχωρημένο ποσό συγκλίνει στο 0 με ΑΝΤΙΛΟΓΙΣΤΙΚΗ εγγραφή στο Βιβλίο Ε-Ε (η
 * αρχική δεν σβήνεται ποτέ). Μόνο όπου η χρήση είναι η νεότερη καταχωρημένη του παγίου (αλλιώς `refused`), και μόνο
 * με ανοιχτή την περίοδο 12. Ιδεμπότητη: δεύτερη αναίρεση = τίποτα.
 *
 * Auth: μόνο διοικητικός ρόλος (αλλάζει νούμερα φόρου). Rate: sensitive.
 * Errors: 409 `PERIOD_NOT_FOUND` / `PERIOD_NOT_OPEN` · 422 `INVALID_DEPRECIATION_TERMS`.
 *
 * @module api/accounting/assets/depreciation-run/reversal
 * @enterprise ADR-ACC-010 §2.1.1 Φάση 5 · ADR-603
 */

import 'server-only';

import { defineRoute, ok } from '@/lib/api/define-route';
import { ADMINISTRATIVE_ROLES } from '@/lib/auth/roles';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { DepreciationRunSchema, withDepreciationRunErrors } from '../../../_shared/depreciation-run-request';

export const POST = defineRoute({
  rateLimit: 'sensitive',
  auth: { requiredGlobalRoles: ADMINISTRATIVE_ROLES },
  schema: DepreciationRunSchema,
  fallbackError: 'Failed to reverse depreciation',
  handler: async ({ auth, body }) => {
    const { service } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    return ok(await withDepreciationRunErrors(() => service.reverseYearEndDepreciation(body.fiscalYear)));
  },
});
