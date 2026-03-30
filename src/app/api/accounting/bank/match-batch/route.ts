/**
 * =============================================================================
 * POST /api/accounting/bank/match-batch — Batch Match Bank Transactions
 * =============================================================================
 *
 * Runs the matching engine on multiple transactions at once.
 * 1st pass: 1:1 matching, 2nd pass: N:M grouping for remaining.
 *
 * Body:
 *   - transactionIds: string[] (required, max 100)
 *
 * Returns: { results: MatchResult[] }
 *
 * Auth: withAuth | Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/bank/match-batch
 * @enterprise DECISIONS-PHASE-2.md Q1, Q3 — Batch Matching
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';

const BatchMatchSchema = z.object({
  transactionIds: z.array(z.string().min(1).max(128)).min(1).max(100),
});

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { matchingEngine } = createAccountingServices();
        const parsed = safeParseBody(BatchMatchSchema, await req.json());
        if (parsed.error) return parsed.error;

        const results = await matchingEngine.matchBatch(parsed.data.transactionIds);

        return NextResponse.json({
          success: true,
          data: {
            results,
            total: results.length,
            matched: results.filter((r) => r.status !== 'unmatched').length,
            unmatched: results.filter((r) => r.status === 'unmatched').length,
          },
        });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to batch match transactions');
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
