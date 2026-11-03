/**
 * @fileoverview **GET + POST /api/catalog/supplier-brand-claims** — τα αιτήματα κατοχής μάρκας του χώρου (ADR-923 §16).
 *
 * ⚠️ Ο οργανισμός έρχεται από το `ctx.companyId`, ποτέ από το σώμα.
 * 🔒 `ADMINISTRATIVE_ROLES`: η δημόσια εμφάνιση του οργανισμού.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { orRouteUnavailable, parsedRouteBody, refusableOutcomeResponse, routeOrganizationOf } from '@/lib/api/refusable-outcome-route';
import { withAuth, type AuthContext, type PermissionCache } from '@/lib/auth';
import { ADMINISTRATIVE_ROLES } from '@/lib/auth/roles';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit, withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { readOwnBrandClaims, requestSupplierBrand, type SupplierBrandOutcome } from '@/server/catalog/supplier-brand-claim.server';
import { MAX_BRAND_NAME_LENGTH, SUPPLIER_BRAND_RELATIONS, type SupplierBrandClaimRecord } from '@/subapps/catalog/types/supplier-brand-claim';

const logger = createModuleLogger('api/catalog/supplier-brand-claims');

const RequestSchema = z.object({
  brandName: z.string().trim().min(1).max(MAX_BRAND_NAME_LENGTH),
  relation: z.enum(SUPPLIER_BRAND_RELATIONS),
  evidenceFileId: z.string().min(1),
});

type Failure = { readonly error: 'NO_ORGANIZATION' | 'MALFORMED' | 'UNAVAILABLE' };
type ReadBody = { readonly claims: readonly SupplierBrandClaimRecord[] } | Failure;
type WriteBody = SupplierBrandOutcome | Failure;

async function readHandler(_request: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<ReadBody>> {
  const companyId = routeOrganizationOf(ctx);
  if (typeof companyId !== 'string') return companyId;
  return orRouteUnavailable(logger, 'Οι μάρκες δεν διαβάστηκαν', async () =>
    NextResponse.json({ claims: await readOwnBrandClaims(getAdminFirestore(), companyId) }, { headers: { 'Cache-Control': 'no-store' } }));
}

async function writeHandler(request: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<WriteBody>> {
  const companyId = routeOrganizationOf(ctx);
  if (typeof companyId !== 'string') return companyId;
  const parsed = await parsedRouteBody(request, RequestSchema);
  if (parsed instanceof NextResponse) return parsed;
  return orRouteUnavailable<SupplierBrandOutcome>(logger, 'Η αίτηση μάρκας δεν γράφτηκε', async () =>
    refusableOutcomeResponse(await requestSupplierBrand(getAdminFirestore(), { ...parsed, companyId, actorUid: ctx.uid, nowIso: nowISO() })));
}

export const GET = withStandardRateLimit(withAuth<ReadBody>(readHandler, { requiredGlobalRoles: ADMINISTRATIVE_ROLES }));
export const POST = withSensitiveRateLimit(withAuth<WriteBody>(writeHandler, { requiredGlobalRoles: ADMINISTRATIVE_ROLES }));
