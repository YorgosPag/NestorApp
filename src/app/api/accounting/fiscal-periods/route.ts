/**
 * =============================================================================
 * GET + POST /api/accounting/fiscal-periods — Fiscal Period Management
 * =============================================================================
 *
 * GET:  List periods for a fiscal year (optional: year-end checklist)
 * POST: Create 13 periods for a new fiscal year
 *
 * Auth: withAuth — εγγραφές μόνο διοικητικός ρόλος (`ADMINISTRATIVE_ROLES`)
 * Rate: standard (60 req/min)
 *
 * @module api/accounting/fiscal-periods
 * @enterprise DECISIONS-PHASE-1b.md Q5-Q8
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { z } from 'zod';
import { defineRoute, ok, created, badRequest } from '@/lib/api/define-route';
import { ADMINISTRATIVE_ROLES } from '@/lib/auth/roles';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import {
  createFiscalYear,
  getYearEndChecklist,
} from '@/subapps/accounting/services/fiscal-period-service';
import { MAX_FISCAL_YEAR, MIN_FISCAL_YEAR, resolveFiscalYearParam } from '../_shared/fiscal-year-param';
import { withFiscalPeriodErrors } from '../_shared/fiscal-period-errors';

const CreateFiscalYearSchema = z.object({
  fiscalYear: z.number().int().min(MIN_FISCAL_YEAR).max(MAX_FISCAL_YEAR),
});

// ── GET: List periods ────────────────────────────────────────────────────────

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to list fiscal periods',
  handler: async ({ req, auth }) => {
    const includeChecklist = new URL(req.url).searchParams.get('checklist') === 'true';
    const fiscalYear = resolveFiscalYearParam(req);

    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const periods = await repository.listFiscalPeriods(fiscalYear);

    const data: Record<string, unknown> = { items: periods, total: periods.length, fiscalYear };

    if (includeChecklist) {
      data.yearEndChecklist = await getYearEndChecklist(repository, fiscalYear);
    }

    return ok(data);
  },
});

// ── POST: Create fiscal year ──────────────────────────────────────────────────

export const POST = defineRoute({
  rateLimit: 'standard',
  // ADR-ACC-010 §2.1.1 Φ6: άνοιγμα/κλείσιμο/κλείδωμα περιόδων = διοικητική πράξη (Xero: μόνο Adviser · SAP OB52).
  auth: { requiredGlobalRoles: ADMINISTRATIVE_ROLES },
  fallbackError: 'Failed to create fiscal year',
  handler: async ({ req, auth }) => {
    const parsed = CreateFiscalYearSchema.safeParse(await req.json());

    if (!parsed.success) {
      badRequest('Validation failed', { details: parsed.error.flatten() });
    }

    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const periods = await withFiscalPeriodErrors(() => createFiscalYear(repository, parsed.data.fiscalYear));

    return created({ fiscalYear: parsed.data.fiscalYear, periodsCreated: periods.length });
  },
});
