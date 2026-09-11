/**
 * POST /api/admin/workspace-access-requests/deny — **απόρριψη αιτήματος ένταξης** (ADR-660 §6).
 *
 * 🔒 **Περιορισμένη στον χώρο ΕΚ ΚΑΤΑΣΚΕΥΗΣ**: το σώμα φέρει **μόνο** `uid`· το αίτημα βρίσκεται
 * από το `(ctx.companyId, uid)` (ντετερμινιστικό id). Διαχειριστής **δεν μπορεί** να αγγίξει
 * αίτημα άλλου χώρου — όχι επειδή τον σταματά ένας έλεγχος ρόλου εδώ, αλλά επειδή **δεν
 * υπάρχει** τρόπος να το ονομάσει. Καμία δεύτερη κρίση «επιτρέπεται;» (CHECK 3.68): το
 * δικαίωμα είναι **το ίδιο** με της έγκρισης (`users:users:manage`), μέσα από το `withAuth`.
 *
 * 🔒 **Μόνο `pending →`**: ήδη αποφασισμένο ⇒ `409` με την κατάσταση, **καμία** γραφή.
 *
 * @module api/admin/workspace-access-requests/deny
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { ENTITY_TYPES } from '@/config/domain-constants';
import { readJsonBody } from '@/lib/api/json-body';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { getErrorMessage } from '@/lib/error-utils';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { notifyAccessDecision } from '@/server/auth/workspace-access-decision-notice';
import { decideAccessRequest } from '@/server/auth/workspace-access-request';
import { EntityAuditService } from '@/services/entity-audit.service';

const logger = createModuleLogger('WORKSPACE_ACCESS_DENY');

const bodySchema = z.object({ uid: z.string().min(1).max(128) });

async function handler(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const parsed = await readJsonBody(request, bodySchema);
  if ('rejected' in parsed) return parsed.rejected;

  const outcome = await decideAccessRequest({
    companyId: ctx.companyId,
    uid: parsed.data.uid,
    decision: 'denied',
    decidedBy: ctx.uid,
  });

  if (outcome.kind === 'absent') {
    return NextResponse.json({ success: false, error: 'REQUEST_NOT_FOUND' } as const, { status: 404 });
  }
  if (outcome.kind === 'already') {
    return NextResponse.json({ success: false, error: 'ALREADY_DECIDED', status: outcome.status } as const, { status: 409 });
  }

  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.COMPANY, entityId: ctx.companyId, entityName: null,
    action: 'updated', changes: [{ field: 'accessRequest', oldValue: 'pending', newValue: 'denied' }],
    performedBy: ctx.uid, performedByName: ctx.email ?? null, companyId: ctx.companyId,
  }).catch((error: unknown) => logger.warn('EntityAudit failed (non-blocking)', { error: getErrorMessage(error) }));

  await notifyAccessDecision(outcome.request);
  return NextResponse.json({ success: true, status: 'denied' } as const);
}

export const POST = withSensitiveRateLimit(
  withAuth(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => handler(request, ctx),
    { permissions: 'users:users:manage' },
  ),
);
