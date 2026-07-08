/**
 * =============================================================================
 * PATCH /api/accounting/fiscal-periods/[periodId] — Close/Lock/Reopen Period
 * =============================================================================
 *
 * Auth: withAuth (authenticated users)
 * Rate: standard (60 req/min)
 *
 * @module api/accounting/fiscal-periods/[periodId]
 * @enterprise DECISIONS-PHASE-1b.md Q5-Q7
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { z } from 'zod';
import { defineRoute, ok, badRequest } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import {
  closePeriod,
  lockPeriod,
  reopenPeriod,
} from '@/subapps/accounting/services/fiscal-period-service';

const PatchPeriodSchema = z.object({
  action: z.enum(['close', 'lock', 'reopen']),
  reason: z.string().min(1).max(500).optional(),
});

// ── PATCH: Close/Lock/Reopen ──────────────────────────────────────────────────

export const PATCH = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to update fiscal period',
  handler: async ({ req, auth, params }) => {
    const { periodId } = params;
    const parsed = PatchPeriodSchema.safeParse(await req.json());

    if (!parsed.success) {
      badRequest('Validation failed', { details: parsed.error.flatten() });
    }

    const { action, reason } = parsed.data;
    const userId = auth.uid;
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });

    switch (action) {
      case 'close':
        await closePeriod(repository, periodId, userId);
        break;
      case 'lock':
        await lockPeriod(repository, periodId, userId);
        break;
      case 'reopen':
        if (!reason) {
          badRequest('Reason is required for reopen action');
        }
        await reopenPeriod(repository, periodId, userId, reason);
        break;
    }

    const updated = await repository.getFiscalPeriod(periodId);
    return ok(updated);
  },
});
