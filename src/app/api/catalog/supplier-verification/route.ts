/**
 * @fileoverview **GET + POST /api/catalog/supplier-verification** — η κατάσταση και η αίτηση ελέγχου του προμηθευτή.
 * @related ADR-923 §5.13 Ε1α · Ε1γ · server/catalog/supplier-review.server.ts · api/companies/registry-verification (το πρότυπο)
 *
 * ⚠️ **Ο οργανισμός ΔΕΝ έρχεται από το σώμα**, από το `ctx.companyId`: αλλιώς ένας χώρος θα υπέβαλλε αίτηση για ξένο.
 * Το αρχείο κρίνεται στον διακομιστή ότι ανήκει σε αυτόν τον χώρο και είναι PDF.
 *
 * 🔒 `ADMINISTRATIVE_ROLES`: η νομική ταυτότητα του οργανισμού, ίδιο επίπεδο με την επαλήθευση ΓΕΜΗ.
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
import {
  readOwnSupplierReview,
  requestSupplierReview,
  type OwnSupplierReview,
  type SupplierReviewOutcome,
} from '@/server/catalog/supplier-review.server';

const logger = createModuleLogger('api/catalog/supplier-verification');

const RequestSchema = z.object({ evidenceFileId: z.string().min(1) });

type Body = SupplierReviewOutcome | { readonly error: 'MALFORMED' | 'NO_ORGANIZATION' | 'UNAVAILABLE' };

async function handler(request: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<Body>> {
  const companyId = routeOrganizationOf(ctx);
  if (typeof companyId !== 'string') return companyId;
  const parsed = await parsedRouteBody(request, RequestSchema);
  if (parsed instanceof NextResponse) return parsed;
  return orRouteUnavailable<SupplierReviewOutcome>(logger, 'Η αίτηση ελέγχου δεν γράφτηκε', async () => refusableOutcomeResponse(await requestSupplierReview(getAdminFirestore(), {
    companyId,
    actorUid: ctx.uid,
    evidenceFileId: parsed.evidenceFileId,
    nowIso: nowISO(),
  })));
}

type ReadBody = { readonly review: OwnSupplierReview } | { readonly error: 'NO_ORGANIZATION' | 'UNAVAILABLE' };

async function readHandler(_request: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<ReadBody>> {
  const companyId = ctx.companyId?.trim() ?? '';
  if (companyId === '') return NextResponse.json({ error: 'NO_ORGANIZATION' }, { status: 403 });
  try {
    const review = await readOwnSupplierReview(getAdminFirestore(), companyId);
    if (review !== null) return NextResponse.json({ review }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logger.error('Η κατάσταση ελέγχου δεν διαβάστηκε', { error: error instanceof Error ? error.message : String(error) });
  }
  return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503 });
}

export const GET = withStandardRateLimit(withAuth<ReadBody>(readHandler, { requiredGlobalRoles: ADMINISTRATIVE_ROLES }));

export const POST = withSensitiveRateLimit(withAuth<Body>(handler, { requiredGlobalRoles: ADMINISTRATIVE_ROLES }));
