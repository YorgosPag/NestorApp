/**
 * @fileoverview **Η ΟΥΡΑ ΕΛΕΓΧΟΥ ΠΡΟΜΗΘΕΥΤΩΝ** — λίστα εκκρεμών (`GET`) και απόφαση (`POST`: έγκριση · απόρριψη · ανάκληση).
 * @related ADR-923 §5.13 Ε1α · server/catalog/supplier-review.server.ts · api/admin/ownership-verifications (το πρότυπο)
 *
 * 🔒 **ΜΟΝΟ `super_admin`**: η ουρά είναι της πλατφόρμας και δείχνει εταιρείες όλων των χώρων.
 */

import 'server-only';

import { after, NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { orRouteUnavailable, parsedRouteBody, refusableOutcomeResponse } from '@/lib/api/refusable-outcome-route';
import { withAuth, type AuthContext, type PermissionCache } from '@/lib/auth';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import {
  decideSupplierVerification,
  listSupplierReviews,
  revokeSupplierVerification,
  type SupplierReviewItem,
  type SupplierReviewOutcome,
} from '@/server/catalog/supplier-review.server';
import { refreshSupplierShowcaseStanding } from '@/server/catalog/supplier-showcase.server';

const logger = createModuleLogger('api/admin/supplier-verifications');

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
const SUPER_ADMIN_ONLY = { requiredGlobalRoles: 'super_admin' as const };

const DecisionSchema = z.object({
  companyId: z.string().min(1),
  decision: z.enum(['approve', 'reject', 'revoke']),
  note: z.string().max(1000).nullable().optional(),
});

type ListBody = { readonly items: ReadonlyArray<SupplierReviewItem> } | { readonly error: 'UNAVAILABLE' };
type DecisionBody = SupplierReviewOutcome | { readonly error: 'MALFORMED' | 'UNAVAILABLE' };

async function listHandler(request: NextRequest): Promise<NextResponse<ListBody>> {
  const status = request.nextUrl.searchParams.get('status') === 'approved' ? 'approved' : 'pending-review';
  return orRouteUnavailable(logger, 'Η ουρά προμηθευτών δεν διαβάστηκε', async () =>
    NextResponse.json({ items: await listSupplierReviews(getAdminFirestore(), status) }, { headers: NO_STORE }));
}

async function decisionHandler(request: NextRequest, ctx: AuthContext): Promise<NextResponse<DecisionBody>> {
  const parsed = await parsedRouteBody(request, DecisionSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { companyId, decision } = parsed;
  const note = parsed.note?.trim() || null;
  const nowIso = nowISO();
  return orRouteUnavailable<SupplierReviewOutcome>(logger, 'Η απόφαση ελέγχου δεν γράφτηκε', async () => {
    const db = getAdminFirestore();
    const outcome =
      decision === 'revoke'
        ? await revokeSupplierVerification(db, { companyId, reviewerUid: ctx.uid, note, nowIso })
        : await decideSupplierVerification(db, { companyId, reviewerUid: ctx.uid, decision, note, nowIso });
    // Η ανάκληση κατέχει τη συνέπειά της: η βιτρίνα αποσύρεται, μετά την απάντηση.
    if (outcome.kind === 'done' && decision === 'revoke') after(() => refreshSupplierShowcaseStanding(db, companyId, ctx.uid));
    return refusableOutcomeResponse(outcome, NO_STORE);
  });
}

export const GET = withSensitiveRateLimit(
  withAuth<ListBody>(async (request: NextRequest, _ctx: AuthContext, _cache: PermissionCache) => listHandler(request), SUPER_ADMIN_ONLY),
);

export const POST = withSensitiveRateLimit(
  withAuth<DecisionBody>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => decisionHandler(request, ctx),
    SUPER_ADMIN_ONLY,
  ),
);
