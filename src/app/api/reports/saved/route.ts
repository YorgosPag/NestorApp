/**
 * @module api/reports/saved
 * @enterprise ADR-268 Phase 7 — Saved Reports API (List + Create)
 *
 * GET  /api/reports/saved — List saved reports for current user
 * POST /api/reports/saved — Create a new saved report
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  createSavedReport,
  listSavedReports,
} from '@/services/saved-reports/saved-reports-service';
import type {
  SavedReport,
  CreateSavedReportInput,
  SavedReportVisibility,
} from '@/types/reports/saved-report';
import { SAVED_REPORT_CATEGORIES } from '@/types/reports/saved-report';

// eslint-disable-next-line custom/no-hardcoded-strings -- error messages
const ERR_NAME_REQUIRED = 'Report name is required';
// eslint-disable-next-line custom/no-hardcoded-strings -- error messages
const ERR_CONFIG_REQUIRED = 'Report config is required';
// eslint-disable-next-line custom/no-hardcoded-strings -- error messages
const ERR_DOMAIN_REQUIRED = 'Config must include a domain';

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// ============================================================================
// GET — List saved reports
// ============================================================================

type ListResponse = ApiSuccessResponse<SavedReport[]>;

export const GET = withStandardRateLimit(async function GET(
  request: NextRequest,
) {
  const handler = withAuth<SavedReport[]>(
    async (
      req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ): Promise<NextResponse<ListResponse>> => {
      try {
        const url = new URL(req.url);
        const visibility = url.searchParams.get('visibility') as SavedReportVisibility | null;
        const category = url.searchParams.get('category');

        const reports = await listSavedReports(
          ctx.companyId,
          ctx.uid,
          {
            visibility: visibility ?? undefined,
            category: category ?? undefined,
          },
        );

        return apiSuccess<SavedReport[]>(reports, 'Saved reports listed');
      } catch (err) {
        return NextResponse.json(
          { success: false as const, error: getErrorMessage(err), timestamp: new Date().toISOString() },
          { status: 500 },
        );
      }
    },
    { permissions: 'reports:reports:view' },
  );
  return handler(request);
});

// ============================================================================
// POST — Create saved report
// ============================================================================

type CreateResponse = ApiSuccessResponse<SavedReport>;

export const POST = withStandardRateLimit(async function POST(
  request: NextRequest,
) {
  const handler = withAuth<SavedReport>(
    async (
      req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ): Promise<NextResponse<CreateResponse>> => {
      try {
        const body = (await req.json()) as CreateSavedReportInput;

        // Validation
        if (!body.name?.trim()) {
          return NextResponse.json(
            { success: false as const, error: ERR_NAME_REQUIRED, timestamp: new Date().toISOString() },
            { status: 400 },
          );
        }
        if (!body.config) {
          return NextResponse.json(
            { success: false as const, error: ERR_CONFIG_REQUIRED, timestamp: new Date().toISOString() },
            { status: 400 },
          );
        }
        if (!body.config.domain) {
          return NextResponse.json(
            { success: false as const, error: ERR_DOMAIN_REQUIRED, timestamp: new Date().toISOString() },
            { status: 400 },
          );
        }

        // Sanitize category
        const category = body.category && SAVED_REPORT_CATEGORIES.includes(body.category)
          ? body.category
          : 'general';

        const report = await createSavedReport(
          ctx.companyId,
          ctx.uid,
          { ...body, category },
        );

        return apiSuccess<SavedReport>(report, 'Report saved');
      } catch (err) {
        return NextResponse.json(
          { success: false as const, error: getErrorMessage(err), timestamp: new Date().toISOString() },
          { status: 500 },
        );
      }
    },
    { permissions: 'reports:reports:view' },
  );
  return handler(request);
});
