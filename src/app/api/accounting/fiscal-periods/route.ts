/**
 * =============================================================================
 * GET + POST /api/accounting/fiscal-periods — Fiscal Period Management
 * =============================================================================
 *
 * GET:  List periods for a fiscal year (optional: year-end checklist)
 * POST: Create 13 periods for a new fiscal year
 *
 * Auth: withAuth (authenticated users)
 * Rate: standard (60 req/min)
 *
 * @module api/accounting/fiscal-periods
 * @enterprise DECISIONS-PHASE-1b.md Q5-Q8
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { z } from 'zod';
import { defineRoute, ok, created, badRequest } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import {
  createFiscalYear,
  getYearEndChecklist,
} from '@/subapps/accounting/services/fiscal-period-service';
import { resolveFiscalYearParam } from '../_shared/fiscal-year-param';

const CreateFiscalYearSchema = z.object({
  fiscalYear: z.number().int().min(2020).max(2100),
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
  fallbackError: 'Failed to create fiscal year',
  handler: async ({ req, auth }) => {
    const parsed = CreateFiscalYearSchema.safeParse(await req.json());

    if (!parsed.success) {
      badRequest('Validation failed', { details: parsed.error.flatten() });
    }

    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const periods = await createFiscalYear(repository, parsed.data.fiscalYear);

    return created({ fiscalYear: parsed.data.fiscalYear, periodsCreated: periods.length });
  },
});
