/**
 * @fileoverview **POST /api/catalog/supplier-verification** — η αίτηση ελέγχου του προμηθευτή, με το έγγραφό του.
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

import { withAuth, type AuthContext, type PermissionCache } from '@/lib/auth';
import { ADMINISTRATIVE_ROLES } from '@/lib/auth/roles';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { requestSupplierReview, type SupplierReviewOutcome } from '@/server/catalog/supplier-review.server';

const logger = createModuleLogger('api/catalog/supplier-verification');

const RequestSchema = z.object({ evidenceFileId: z.string().min(1) });

type Body = SupplierReviewOutcome | { readonly error: 'MALFORMED' | 'NO_ORGANIZATION' | 'UNAVAILABLE' };

async function handler(request: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<Body>> {
  const companyId = ctx.companyId?.trim() ?? '';
  if (companyId === '') return NextResponse.json({ error: 'NO_ORGANIZATION' }, { status: 403 });
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'MALFORMED' }, { status: 400 });
  try {
    const outcome = await requestSupplierReview(getAdminFirestore(), {
      companyId,
      actorUid: ctx.uid,
      evidenceFileId: parsed.data.evidenceFileId,
      nowIso: nowISO(),
    });
    return NextResponse.json(outcome, { status: outcome.kind === 'refused' ? 409 : 200 });
  } catch (error) {
    logger.error('Η αίτηση ελέγχου δεν γράφτηκε', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503 });
  }
}

export const POST = withSensitiveRateLimit(withAuth<Body>(handler, { requiredGlobalRoles: ADMINISTRATIVE_ROLES }));
