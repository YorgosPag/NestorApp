/**
 * 🏢 Payment Report API — ADR-234 Phase 5
 *
 * GET /api/projects/[projectId]/payment-report
 *
 * Returns aggregate payment data for all units in a project.
 * Uses denormalized PaymentSummary — ZERO N+1 queries.
 *
 * @module api/projects/[projectId]/payment-report
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { PaymentReportService } from '@/services/payment-report.service';
import type { PaymentReportData } from '@/services/payment-export/types';

const logger = createModuleLogger('PaymentReportAPI');

export const dynamic = 'force-dynamic';

// =============================================================================
// TYPES
// =============================================================================

type SegmentData = { params: Promise<{ projectId: string }> };

interface ReportResponse {
  ok: boolean;
  data: PaymentReportData;
}

// =============================================================================
// GET /api/projects/[projectId]/payment-report
// =============================================================================

async function handleGet(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { projectId } = await segmentData!.params;

  if (!projectId) {
    return NextResponse.json(
      { ok: false, error: 'projectId is required' },
      { status: 400 }
    );
  }

  const handler = withAuth<ReportResponse>(
    async (_req: NextRequest, _ctx: AuthContext, _cache: PermissionCache) => {
      const report = await PaymentReportService.getProjectReport(projectId);

      return NextResponse.json<ReportResponse>({
        ok: true,
        data: report,
      });
    },
    { permissions: 'projects:projects:view' }
  );

  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);
