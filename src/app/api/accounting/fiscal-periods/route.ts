/**
 * =============================================================================
 * GET + POST /api/accounting/fiscal-periods — Fiscal Period Management
 * =============================================================================
 *
 * GET:  List periods for a fiscal year (optional: year-end checklist)
 * POST: Create 13 periods for a new fiscal year
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/fiscal-periods
 * @enterprise DECISIONS-PHASE-1b.md Q5-Q8
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import {
  createFiscalYear,
  getYearEndChecklist,
} from '@/subapps/accounting/services/fiscal-period-service';
import { getErrorMessage } from '@/lib/error-utils';

const CreateFiscalYearSchema = z.object({
  fiscalYear: z.number().int().min(2020).max(2100),
});

// ── GET: List periods ──────────��─────────────────────────────────────────────

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const url = new URL(req.url);
        const fiscalYearParam = url.searchParams.get('fiscalYear');
        const includeChecklist = url.searchParams.get('checklist') === 'true';
        const fiscalYear = fiscalYearParam ? parseInt(fiscalYearParam, 10) : new Date().getFullYear();

        if (isNaN(fiscalYear)) {
          return NextResponse.json({ success: false, error: 'Invalid fiscalYear' }, { status: 400 });
        }

        const { repository } = createAccountingServices();
        const periods = await repository.listFiscalPeriods(fiscalYear);

        const response: Record<string, unknown> = {
          success: true,
          data: { items: periods, total: periods.length, fiscalYear },
        };

        if (includeChecklist) {
          (response.data as Record<string, unknown>).yearEndChecklist =
            await getYearEndChecklist(repository, fiscalYear);
        }

        return NextResponse.json(response);
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to list fiscal periods');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

// ── POST: Create fiscal year ─────────────────────��───────────────────────────

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const body = await req.json();
        const parsed = CreateFiscalYearSchema.safeParse(body);

        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: 'Validation failed', details: parsed.error.flatten() },
            { status: 400 }
          );
        }

        const { repository } = createAccountingServices();
        const periods = await createFiscalYear(repository, parsed.data.fiscalYear);

        return NextResponse.json({
          success: true,
          data: { fiscalYear: parsed.data.fiscalYear, periodsCreated: periods.length },
        }, { status: 201 });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to create fiscal year');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

// ── Route exports ───────────────────────────���───────────────────────────────��

export const GET = withStandardRateLimit(handleGet);
export const POST = withStandardRateLimit(handlePost);
