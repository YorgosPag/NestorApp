/**
 * =============================================================================
 * POST /api/accounting/bank/match — Match Bank Transaction(s) to Entities
 * =============================================================================
 *
 * Supports both 1:1 and N:M matching via MatchingEngine.
 *
 * Body (1:1 — backward compatible):
 *   - transactionId: string (required)
 *   - entityId: string (required)
 *   - entityType: 'invoice' | 'journal_entry' | 'efka_payment' | 'tax_payment' (required)
 *
 * Body (N:M group):
 *   - transactionIds: string[] (required)
 *   - entityRefs: Array<{ entityId, entityType, amount }> (required)
 *
 * Auth: withAuth | Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/bank/match
 * @enterprise DECISIONS-PHASE-2.md Q1, Q3 — MatchingEngine
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

// ── Zod Schemas ─────────────────────────────────────────────────────────────

const entityTypeEnum = z.enum(['invoice', 'journal_entry', 'efka_payment', 'tax_payment']);

const SingleMatchSchema = z.object({
  transactionId: z.string().min(1).max(128),
  entityId: z.string().min(1).max(128),
  entityType: entityTypeEnum,
});

const GroupMatchSchema = z.object({
  transactionIds: z.array(z.string().min(1).max(128)).min(1).max(50),
  entityRefs: z.array(z.object({
    entityId: z.string().min(1).max(128),
    entityType: entityTypeEnum,
    amount: z.number().positive(),
  })).min(1).max(50),
});

const MatchRequestSchema = z.union([SingleMatchSchema, GroupMatchSchema]);

// =============================================================================
// POST — Match
// =============================================================================

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { matchingEngine } = createAccountingServices();
        const body = await req.json();
        const parsed = safeParseBody(MatchRequestSchema, body);
        if (parsed.error) return parsed.error;
        const data = parsed.data;

        // N:M group match
        if ('transactionIds' in data) {
          const results = await matchingEngine.matchGroup(
            data.transactionIds,
            data.entityRefs
          );
          return NextResponse.json({ success: true, data: results });
        }

        // 1:1 match
        const result = await matchingEngine.matchTransaction(
          data.transactionId,
          data.entityId,
          data.entityType
        );
        return NextResponse.json({ success: true, data: result });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to match bank transaction');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
