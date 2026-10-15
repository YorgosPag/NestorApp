/**
 * =============================================================================
 * PATCH /api/accounting/fiscal-periods/[periodId] — Close/Lock/Reopen Period
 * =============================================================================
 *
 * Auth: withAuth — εγγραφές μόνο διοικητικός ρόλος (`ADMINISTRATIVE_ROLES`)
 * Rate: standard (60 req/min)
 *
 * @module api/accounting/fiscal-periods/[periodId]
 * @enterprise DECISIONS-PHASE-1b.md Q5-Q7
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { z } from 'zod';
import { defineRoute, ok, badRequest } from '@/lib/api/define-route';
import { ADMINISTRATIVE_ROLES } from '@/lib/auth/roles';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { withFiscalPeriodErrors } from '../../_shared/fiscal-period-errors';

const PatchPeriodSchema = z.object({
  action: z.enum(['close', 'lock', 'reopen']),
  reason: z.string().min(1).max(500).optional(),
});

// ── PATCH: Close/Lock/Reopen ──────────────────────────────────────────────────

export const PATCH = defineRoute({
  rateLimit: 'standard',
  // ADR-ACC-010 §2.1.1 Φ6: άνοιγμα/κλείσιμο/κλείδωμα περιόδων = διοικητική πράξη (Xero: μόνο Adviser · SAP OB52).
  auth: { requiredGlobalRoles: ADMINISTRATIVE_ROLES },
  fallbackError: 'Failed to update fiscal period',
  handler: async ({ req, auth, params }) => {
    const { periodId } = params;
    const parsed = PatchPeriodSchema.safeParse(await req.json());

    if (!parsed.success) {
      badRequest('Validation failed', { details: parsed.error.flatten() });
    }

    const { action, reason } = parsed.data;
    if (action === 'reopen' && !reason) {
      badRequest('Reason is required for reopen action');
    }
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });

    // ADR-ACC-010 §2.1.1 Φ6: απόφαση + εγγραφή + ίχνος σε ΜΙΑ συναλλαγή, για την περίοδο ΤΟΥ μισθωτή.
    const updated = await withFiscalPeriodErrors(() =>
      repository.transitionFiscalPeriod(periodId, { action, userId: auth.uid, reason: reason ?? null }));
    return ok(updated);
  },
});
