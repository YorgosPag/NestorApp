/**
 * =============================================================================
 * GET /api/accounting/bank/candidates — Find Match Candidates
 * =============================================================================
 *
 * Returns ranked match candidates for a bank transaction.
 *
 * Query params:
 *   - transactionId: string (required)
 *
 * Returns: { candidates: MatchCandidate[] }
 *
 * Auth: withAuth | Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/bank/candidates
 * @enterprise DECISIONS-PHASE-2.md Q1 — Weighted Scoring
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { getErrorMessage } from '@/lib/error-utils';

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { matchingEngine, repository } = createAccountingServices({ companyId: ctx.companyId, userId: ctx.uid });

        const transactionId = req.nextUrl.searchParams.get('transactionId');
        if (!transactionId) {
          return NextResponse.json(
            { error: 'transactionId query parameter is required' },
            { status: 400 }
          );
        }

        const transaction = await repository.getBankTransaction(transactionId);
        if (!transaction) {
          return NextResponse.json(
            { error: 'Bank transaction not found' },
            { status: 404 }
          );
        }

        const candidates = await matchingEngine.findCandidates(transaction);

        return NextResponse.json({
          success: true,
          data: {
            transactionId,
            candidates,
            count: candidates.length,
          },
        });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to find match candidates');
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);
