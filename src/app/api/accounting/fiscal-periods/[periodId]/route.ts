/**
 * =============================================================================
 * PATCH /api/accounting/fiscal-periods/[periodId] — Close/Lock/Reopen Period
 * =============================================================================
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/fiscal-periods/[periodId]
 * @enterprise DECISIONS-PHASE-1b.md Q5-Q7
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import {
  closePeriod,
  lockPeriod,
  reopenPeriod,
} from '@/subapps/accounting/services/fiscal-period-service';
import { getErrorMessage } from '@/lib/error-utils';

const PatchPeriodSchema = z.object({
  action: z.enum(['close', 'lock', 'reopen']),
  reason: z.string().min(1).max(500).optional(),
});

// ── PATCH: Close/Lock/Reopen ──��──────────────────────────────────────────────

async function handlePatch(
  request: NextRequest,
  segmentData?: { params: Promise<{ periodId: string }> }
): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        if (!segmentData?.params) {
          return NextResponse.json({ success: false, error: 'Missing route params' }, { status: 400 });
        }

        const { periodId } = await segmentData.params;
        const body = await req.json();
        const parsed = PatchPeriodSchema.safeParse(body);

        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: 'Validation failed', details: parsed.error.flatten() },
            { status: 400 }
          );
        }

        const { action, reason } = parsed.data;
        const userId = ctx.uid;
        const { repository } = createAccountingServices({ companyId: ctx.companyId, userId: ctx.uid });

        switch (action) {
          case 'close':
            await closePeriod(repository, periodId, userId);
            break;
          case 'lock':
            await lockPeriod(repository, periodId, userId);
            break;
          case 'reopen':
            if (!reason) {
              return NextResponse.json(
                { success: false, error: 'Reason is required for reopen action' },
                { status: 400 }
              );
            }
            await reopenPeriod(repository, periodId, userId, reason);
            break;
        }

        const updated = await repository.getFiscalPeriod(periodId);
        return NextResponse.json({ success: true, data: updated });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update fiscal period');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

// ── Route exports ─────────────────────────────────��──────────────────────────

export const PATCH = withStandardRateLimit(handlePatch);
