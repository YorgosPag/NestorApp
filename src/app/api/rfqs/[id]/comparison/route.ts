/**
 * GET /api/rfqs/[id]/comparison — Compute multi-factor scoring + recommendation.
 *
 * Query params:
 *   - templateId?: keys of COMPARISON_TEMPLATES (default: rfq.comparisonTemplateId)
 *   - cherryPick?: 'true' to include CherryPickResult (only meaningful when awardMode='cherry_pick')
 *
 * Auth: withAuth | Rate: standard
 * @see ADR-327 §8 Comparison Engine (Phase P4)
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { computeRfqComparison, computeCherryPick } from '@/subapps/procurement/services/comparison-service';
import { COMPARISON_TEMPLATES } from '@/subapps/procurement/types/comparison';
import { getErrorMessage } from '@/lib/error-utils';

async function handleGet(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await segmentData!.params;
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const url = new URL(req.url);
        const templateId = url.searchParams.get('templateId') ?? undefined;
        const includeCherryPick = url.searchParams.get('cherryPick') === 'true';

        if (templateId && !(templateId in COMPARISON_TEMPLATES)) {
          return NextResponse.json(
            { success: false, error: `Unknown templateId: ${templateId}` },
            { status: 400 }
          );
        }

        const comparison = await computeRfqComparison(ctx.companyId, id, { templateId });
        const cherryPick = includeCherryPick ? await computeCherryPick(ctx.companyId, id) : null;

        return NextResponse.json({ success: true, data: { comparison, cherryPick } });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: getErrorMessage(error) },
          { status: 400 }
        );
      }
    }
  );
  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);
