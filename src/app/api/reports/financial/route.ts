/**
 * @module api/reports/financial
 * @enterprise ADR-265 Phase 5 — Financial Report API
 *
 * Server-side aggregation of financial data using ReportDataAggregator.
 * Returns combined financial + construction data for the dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ReportDataAggregator } from '@/services/report-engine';
import type { FinancialReportData, ConstructionReportData } from '@/services/report-engine';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('FinancialReportRoute');

export const dynamic = 'force-dynamic';

interface FinancialReportPayload {
  financial: FinancialReportData;
  construction: ConstructionReportData;
  buildingNames: Record<string, string>;
}

type FinancialResponse = ApiSuccessResponse<FinancialReportPayload>;

export const GET = withStandardRateLimit(async function GET(
  request: NextRequest,
) {
  const handler = withAuth<FinancialResponse>(
    async (
      _req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ) => {
      try {
        const filter = { companyId: ctx.companyId };

        const [financial, construction] = await Promise.all([
          ReportDataAggregator.getFinancialReport(filter),
          ReportDataAggregator.getConstructionReport(filter),
        ]);

        // Resolve building names for chart labels
        const buildingNames = await resolveBuildingNames(
          Object.keys(construction.evmByBuilding),
        );

        return apiSuccess<FinancialReportPayload>(
          { financial, construction, buildingNames },
          'Financial report generated',
        );
      } catch (err) {
        logger.error('Financial report failed', { error: getErrorMessage(err) });
        return NextResponse.json(
          { success: false as const, error: getErrorMessage(err), timestamp: nowISO() },
          { status: 500 },
        );
      }
    },
    { permissions: 'reports:reports:view' },
  );

  return handler(request);
});

// ---------------------------------------------------------------------------
// Helper: resolve building IDs to names
// ---------------------------------------------------------------------------

async function resolveBuildingNames(
  buildingIds: string[],
): Promise<Record<string, string>> {
  if (buildingIds.length === 0) return {};

  const db = getAdminFirestore();
  const names: Record<string, string> = {};

  // Firestore IN query limit = 10, chunk if needed
  const chunks = chunkArray(buildingIds, 10);

  for (const chunk of chunks) {
    const snap = await db
      .collection(COLLECTIONS.BUILDINGS)
      .where('__name__', 'in', chunk)
      .select('name')
      .get();

    for (const doc of snap.docs) {
      const data = doc.data();
      names[doc.id] = (data?.name as string) || doc.id;
    }
  }

  return names;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
