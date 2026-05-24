/**
 * =============================================================================
 * ADMIN: ISO 19650 Enrichment Cost Aggregate (ADR-373 P2.5)
 * =============================================================================
 *
 * Returns aggregated AI enrichment cost data for the super_admin dashboard.
 *
 * GET ?companyId=xxx[&month=2026-05]
 *   → { totalCostUsd, fileCount, byDiscipline, byMonth, records }
 *
 * `month` (YYYY-MM) filters records to that calendar month.
 * Without `month`, all records for the company are returned (max 500).
 *
 * @module api/admin/iso19650/costs
 * @see ADR-373 §P2.5 — Cost Dashboard
 *
 * 🔒 SECURITY: super_admin ONLY + withSensitiveRateLimit
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('Iso19650Costs');

const MAX_RECORDS = 500;

// ============================================================================
// TYPES
// ============================================================================

interface CostLogDoc {
  id: string;
  companyId: string;
  fileId: string;
  costUsd: number;
  model: string;
  disciplineCode: string | null;
  filledBy: 'ai';
  createdAt: FirebaseFirestore.Timestamp;
}

interface CostAggregateResponse {
  companyId: string;
  month: string | null;
  totalCostUsd: number;
  fileCount: number;
  byDiscipline: Record<string, number>;
  byMonth: Record<string, number>;
  records: Omit<CostLogDoc, 'createdAt'>[];
}

// ============================================================================
// HELPERS
// ============================================================================

function toYearMonth(ts: FirebaseFirestore.Timestamp): string {
  const d = ts.toDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function buildMonthRange(month: string): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const m = parseInt(match[2], 10) - 1;
  const start = new Date(year, m, 1);
  const end = new Date(year, m + 1, 1);
  return { start, end };
}

// ============================================================================
// HANDLER
// ============================================================================

async function handleGetCosts(
  ctx: AuthContext,
  companyId: string,
  month: string | null,
): Promise<NextResponse> {
  if (ctx.globalRole !== 'super_admin') {
    logger.warn('BLOCKED: Non-super_admin attempted ISO 19650 cost query', {
      email: ctx.email,
      globalRole: ctx.globalRole,
    });
    return NextResponse.json(
      { success: false, error: 'Forbidden: Only super_admin can query enrichment costs' },
      { status: 403 },
    );
  }

  try {
    const db = getAdminFirestore();
    let query: FirebaseFirestore.Query = db
      .collection(COLLECTIONS.ISO19650_COST_LOG)
      .where('companyId', '==', companyId)
      .orderBy('createdAt', 'desc')
      .limit(MAX_RECORDS);

    if (month) {
      const range = buildMonthRange(month);
      if (!range) {
        return NextResponse.json(
          { success: false, error: 'Invalid month format — use YYYY-MM' },
          { status: 400 },
        );
      }
      query = query
        .where('createdAt', '>=', range.start)
        .where('createdAt', '<', range.end);
    }

    const snapshot = await query.get();

    const byDiscipline: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    let totalCostUsd = 0;
    const records: Omit<CostLogDoc, 'createdAt'>[] = [];

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as CostLogDoc;
      totalCostUsd += data.costUsd ?? 0;

      const disc = data.disciplineCode ?? 'unknown';
      byDiscipline[disc] = (byDiscipline[disc] ?? 0) + (data.costUsd ?? 0);

      const ym = data.createdAt ? toYearMonth(data.createdAt) : 'unknown';
      byMonth[ym] = (byMonth[ym] ?? 0) + (data.costUsd ?? 0);

      records.push({
        id: data.id,
        companyId: data.companyId,
        fileId: data.fileId,
        costUsd: data.costUsd,
        model: data.model,
        disciplineCode: data.disciplineCode,
        filledBy: data.filledBy,
      });
    }

    const response: CostAggregateResponse = {
      companyId,
      month,
      totalCostUsd: Math.round(totalCostUsd * 1_000_000) / 1_000_000,
      fileCount: records.length,
      byDiscipline,
      byMonth,
      records,
    };

    logger.info('ISO19650 cost query', {
      companyId,
      month,
      fileCount: records.length,
      totalCostUsd: response.totalCostUsd,
      email: ctx.email,
    });

    return NextResponse.json({ success: true, ...response });
  } catch (err) {
    logger.error('ISO19650 cost query failed', { companyId, error: getErrorMessage(err) });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ============================================================================
// ROUTE
// ============================================================================

export async function GET(request: NextRequest): Promise<Response> {
  const handler = withSensitiveRateLimit(
    withAuth(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
        const companyId = req.nextUrl.searchParams.get('companyId') ?? '';
        if (!companyId) {
          return NextResponse.json(
            { success: false, error: 'companyId query param required' },
            { status: 400 },
          );
        }
        const month = req.nextUrl.searchParams.get('month');
        return handleGetCosts(ctx, companyId, month);
      },
      { permissions: 'admin:migrations:execute' },
    ),
  );
  return handler(request);
}
