/**
 * @module api/reports/saved/[reportId]
 * @enterprise ADR-268 Phase 7 — Saved Reports API (Read + Update + Delete)
 *
 * GET    /api/reports/saved/:id — Get a single saved report
 * PUT    /api/reports/saved/:id — Update a saved report
 * DELETE /api/reports/saved/:id — Delete a saved report
 * POST   /api/reports/saved/:id — Special actions (toggle favorite, track run)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  getSavedReport,
  updateSavedReport,
  deleteSavedReport,
  toggleFavorite,
  trackReportRun,
} from '@/services/saved-reports/saved-reports-service';
import type { SavedReport, UpdateSavedReportInput } from '@/types/reports/saved-report';

// eslint-disable-next-line custom/no-hardcoded-strings -- error messages
const ERR_NOT_FOUND = 'Report not found';
// eslint-disable-next-line custom/no-hardcoded-strings -- error messages
const ERR_DELETE_FAILED = 'Cannot delete this report';

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

interface SegmentData {
  params: Promise<{ reportId: string }>;
}

// ============================================================================
// GET — Read single report
// ============================================================================

type SingleResponse = ApiSuccessResponse<SavedReport>;

export const GET = withStandardRateLimit(async function GET(
  request: NextRequest,
  segmentData?: SegmentData,
) {
  const { reportId } = await segmentData!.params;

  const handler = withAuth<SingleResponse>(
    async (
      _req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ) => {
      try {
        const report = await getSavedReport(ctx.companyId, reportId);
        if (!report) {
          return NextResponse.json(
            { success: false as const, error: ERR_NOT_FOUND, timestamp: new Date().toISOString() },
            { status: 404 },
          );
        }

        return apiSuccess<SavedReport>(report, 'Report loaded');
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
// PUT — Update report
// ============================================================================

export const PUT = withStandardRateLimit(async function PUT(
  request: NextRequest,
  segmentData?: SegmentData,
) {
  const { reportId } = await segmentData!.params;

  const handler = withAuth<SingleResponse>(
    async (
      req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ) => {
      try {
        const body = (await req.json()) as UpdateSavedReportInput;

        const updated = await updateSavedReport(
          ctx.companyId,
          reportId,
          ctx.uid,
          body,
        );

        if (!updated) {
          return NextResponse.json(
            { success: false as const, error: ERR_NOT_FOUND, timestamp: new Date().toISOString() },
            { status: 404 },
          );
        }

        return apiSuccess<SavedReport>(updated, 'Report updated');
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
// DELETE — Remove report
// ============================================================================

type DeleteResponse = ApiSuccessResponse<{ deleted: boolean }>;

export const DELETE = withStandardRateLimit(async function DELETE(
  request: NextRequest,
  segmentData?: SegmentData,
) {
  const { reportId } = await segmentData!.params;

  const handler = withAuth<DeleteResponse>(
    async (
      _req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ) => {
      try {
        const success = await deleteSavedReport(
          ctx.companyId,
          reportId,
          ctx.uid,
        );

        if (!success) {
          return NextResponse.json(
            { success: false as const, error: ERR_DELETE_FAILED, timestamp: new Date().toISOString() },
            { status: 403 },
          );
        }

        return apiSuccess<{ deleted: boolean }>({ deleted: true }, 'Report deleted');
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
// POST — Special actions (favorite toggle, track run)
// ============================================================================

type ActionResponse = ApiSuccessResponse<{ action: string; result: boolean }>;

export const POST = withStandardRateLimit(async function POST(
  request: NextRequest,
  segmentData?: SegmentData,
) {
  const { reportId } = await segmentData!.params;

  const handler = withAuth<ActionResponse>(
    async (
      req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ) => {
      try {
        const body = (await req.json()) as { action: string };

        if (body.action === 'toggle_favorite') {
          const isFavorited = await toggleFavorite(
            ctx.companyId,
            reportId,
            ctx.uid,
          );
          return apiSuccess<{ action: string; result: boolean }>(
            { action: 'toggle_favorite', result: isFavorited },
            isFavorited ? 'Added to favorites' : 'Removed from favorites',
          );
        }

        if (body.action === 'track_run') {
          await trackReportRun(ctx.companyId, reportId);
          return apiSuccess<{ action: string; result: boolean }>(
            { action: 'track_run', result: true },
            'Run tracked',
          );
        }

        return NextResponse.json(
          { success: false as const, error: 'Unknown action', timestamp: new Date().toISOString() },
          { status: 400 },
        );
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
