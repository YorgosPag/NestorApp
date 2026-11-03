/**
 * @fileoverview **Η ΟΥΡΑ ΚΑΤΟΧΗΣ ΜΑΡΚΑΣ** — λίστα (`GET`) και απόφαση (`POST`: έγκριση με λήξη · απόρριψη · ανάκληση).
 * @related ADR-923 §16 · server/catalog/supplier-brand-claim.server.ts · api/admin/supplier-verifications (το πρότυπο)
 *
 * 🔒 **ΜΟΝΟ `super_admin`**: η ουρά είναι της πλατφόρμας και δείχνει εταιρείες όλων των χώρων.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { orRouteUnavailable, parsedRouteBody, refusableOutcomeResponse } from '@/lib/api/refusable-outcome-route';
import { withAuth, type AuthContext, type PermissionCache } from '@/lib/auth';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { decideSupplierBrand, listSupplierBrandClaims, revokeSupplierBrand, type SupplierBrandOutcome } from '@/server/catalog/supplier-brand-claim.server';
import type { SupplierBrandClaimRecord } from '@/subapps/catalog/types/supplier-brand-claim';

const logger = createModuleLogger('api/admin/supplier-brand-claims');

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
const SUPER_ADMIN_ONLY = { requiredGlobalRoles: 'super_admin' as const };

const DecisionSchema = z.object({
  claimId: z.string().min(1),
  decision: z.enum(['approve', 'reject', 'revoke']),
  note: z.string().max(1000).nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
});

type ListBody = { readonly items: readonly SupplierBrandClaimRecord[] } | { readonly error: 'UNAVAILABLE' };
type DecisionBody = SupplierBrandOutcome | { readonly error: 'MALFORMED' | 'UNAVAILABLE' };

async function listHandler(request: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<ListBody>> {
  const status = request.nextUrl.searchParams.get('status') === 'approved' ? 'approved' : 'pending-review';
  return orRouteUnavailable(logger, 'Η ουρά μαρκών δεν διαβάστηκε', async () =>
    NextResponse.json({ items: await listSupplierBrandClaims(getAdminFirestore(), status) }, { headers: NO_STORE }));
}

async function decisionHandler(request: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<DecisionBody>> {
  const parsed = await parsedRouteBody(request, DecisionSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { claimId, decision } = parsed;
  const note = parsed.note?.trim() || null;
  const common = { claimId, reviewerUid: ctx.uid, note, nowIso: nowISO() };
  return orRouteUnavailable<SupplierBrandOutcome>(logger, 'Η απόφαση μάρκας δεν γράφτηκε', async () => {
    const db = getAdminFirestore();
    const outcome = decision === 'revoke'
      ? await revokeSupplierBrand(db, common)
      : await decideSupplierBrand(db, { ...common, decision, validUntil: parsed.validUntil ?? null });
    return refusableOutcomeResponse(outcome, NO_STORE);
  });
}

export const GET = withSensitiveRateLimit(withAuth<ListBody>(listHandler, SUPER_ADMIN_ONLY));
export const POST = withSensitiveRateLimit(withAuth<DecisionBody>(decisionHandler, SUPER_ADMIN_ONLY));
