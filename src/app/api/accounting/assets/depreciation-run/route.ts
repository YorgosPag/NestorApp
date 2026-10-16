/**
 * =============================================================================
 * GET + POST /api/accounting/assets/depreciation-run — Αποσβέσεις χρήσης
 * =============================================================================
 *
 * GET:  Προεπισκόπηση (SAP AFAB test run) — σωστό / καταχωρημένο / διαφορά ανά πάγιο, ΚΑΜΙΑ εγγραφή.
 * POST: Καταχώριση στο Βιβλίο Ε-Ε (SAP update / repeat run) — το καταχωρημένο συγκλίνει στο σωστό. Ιδεμπότητη:
 *       επανεκτέλεση = 0 νέα έξοδα (ντετερμινιστικά id), πέρα από το `Idempotency-Key` του `withAuth` (CHECK 3.92).
 *
 * Auth: GET κάθε συνδεδεμένος· POST μόνο διοικητικός ρόλος (αλλάζει νούμερα φόρου — Xero: μόνο Adviser).
 * Rate: GET standard · POST sensitive.
 * Errors: 409 `FISCAL_YEAR_NOT_ENDED` / `PERIOD_NOT_FOUND` / `PERIOD_CLOSED` / `PERIOD_LOCKED` · 422 `INVALID_DEPRECIATION_TERMS`.
 *
 * @module api/accounting/assets/depreciation-run
 * @enterprise ADR-ACC-010 §2.1.1 Φάση 5 · ADR-ACC-007 §10 · ADR-603
 */

import 'server-only';

import { defineRoute, ok } from '@/lib/api/define-route';
import { ADMINISTRATIVE_ROLES } from '@/lib/auth/roles';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { resolveYearInRange } from '../../_shared/fiscal-year-param';
import { DepreciationRunSchema, withDepreciationRunErrors } from '../../_shared/depreciation-run-request';

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to preview depreciation run',
  handler: async ({ req, auth }) => {
    const fiscalYear = resolveYearInRange(req, 'fiscalYear', 'fiscalYear');
    const { service } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    return ok(await withDepreciationRunErrors(() => service.previewYearEndDepreciation(fiscalYear)));
  },
});

export const POST = defineRoute({
  rateLimit: 'sensitive',
  auth: { requiredGlobalRoles: ADMINISTRATIVE_ROLES },
  schema: DepreciationRunSchema,
  fallbackError: 'Failed to run depreciation',
  handler: async ({ auth, body }) => {
    const { service } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    return ok(await withDepreciationRunErrors(() => service.runYearEndDepreciation(body.fiscalYear)));
  },
});
