/**
 * @fileoverview **Η ΟΥΡΑ ΕΛΕΓΧΟΥ ΠΡΟΜΗΘΕΥΤΩΝ** — λίστα εκκρεμών (`GET`) και απόφαση (`POST`: έγκριση · απόρριψη · ανάκληση).
 * @related ADR-923 §5.13 Ε1α · server/catalog/supplier-review.server.ts · api/admin/ownership-verifications (το πρότυπο)
 *
 * 🔒 **ΜΟΝΟ `super_admin`**: η ουρά είναι της πλατφόρμας και δείχνει εταιρείες όλων των χώρων.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { withAuth, type AuthContext, type PermissionCache } from '@/lib/auth';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import {
  decideSupplierVerification,
  listPendingSupplierReviews,
  revokeSupplierVerification,
  type SupplierReviewItem,
  type SupplierReviewOutcome,
} from '@/server/catalog/supplier-review.server';

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

async function listHandler(): Promise<NextResponse<ListBody>> {
  try {
    const items = await listPendingSupplierReviews(getAdminFirestore());
    return NextResponse.json({ items }, { headers: NO_STORE });
  } catch (error) {
    logger.error('Η ουρά προμηθευτών δεν διαβάστηκε', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503 });
  }
}

async function decisionHandler(request: NextRequest, ctx: AuthContext): Promise<NextResponse<DecisionBody>> {
  const parsed = DecisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'MALFORMED' }, { status: 400 });
  const { companyId, decision } = parsed.data;
  const note = parsed.data.note?.trim() || null;
  const nowIso = nowISO();
  try {
    const db = getAdminFirestore();
    const outcome =
      decision === 'revoke'
        ? await revokeSupplierVerification(db, { companyId, reviewerUid: ctx.uid, note, nowIso })
        : await decideSupplierVerification(db, { companyId, reviewerUid: ctx.uid, decision, note, nowIso });
    return NextResponse.json(outcome, { status: outcome.kind === 'refused' ? 409 : 200, headers: NO_STORE });
  } catch (error) {
    logger.error('Η απόφαση ελέγχου δεν γράφτηκε', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503 });
  }
}

export const GET = withSensitiveRateLimit(
  withAuth<ListBody>(async (_request: NextRequest, _ctx: AuthContext, _cache: PermissionCache) => listHandler(), SUPER_ADMIN_ONLY),
);

export const POST = withSensitiveRateLimit(
  withAuth<DecisionBody>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => decisionHandler(request, ctx),
    SUPER_ADMIN_ONLY,
  ),
);
