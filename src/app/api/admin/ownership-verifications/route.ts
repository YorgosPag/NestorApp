/**
 * @fileoverview **Η ΟΥΡΑ ΕΛΕΓΧΟΥ ΕΠΑΛΗΘΕΥΣΕΩΝ ΚΑΤΟΧΗΣ** — λίστα εκκρεμών (`GET`) και απόφαση (`POST`).
 * @related ADR-900 §3.8 · services/ownership/ownership-verification-review.service.ts
 *
 * 🔒 **ΜΟΝΟ `super_admin`** — όχι `company_admin`/`internal_user` όπως η ουρά του AI pipeline (ADR-080):
 * εκεί κάθε γραφείο βλέπει τα **δικά** του στοιχεία· εδώ η ουρά είναι **της πλατφόρμας** και δείχνει
 * ιδιοκτήτες **όλων**. Ένας διαχειριστής γραφείου που την έβλεπε θα μάθαινε ποιος κατέχει τι, παντού.
 * Το **μοτίβο** του operator-inbox (withAuth + SENSITIVE + zod), όχι το μοντέλο δεδομένων του.
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
  decideOwnershipReview,
  listPendingOwnershipReviews,
  type OwnershipReviewItem,
  type ReviewOutcome,
} from '@/services/ownership/ownership-verification-review.service';

const logger = createModuleLogger('api/admin/ownership-verifications');

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const DecisionSchema = z.object({
  verificationId: z.string().min(1),
  decision: z.enum(['approve', 'reject']),
  note: z.string().max(1000).nullable().optional(),
});

type ListBody = { readonly items: ReadonlyArray<OwnershipReviewItem> } | { readonly error: 'UNAVAILABLE' };
type DecisionBody = ReviewOutcome | { readonly error: 'MALFORMED' | 'UNAVAILABLE' };

const SUPER_ADMIN_ONLY = { requiredGlobalRoles: 'super_admin' as const };

async function listHandler(): Promise<NextResponse<ListBody>> {
  try {
    const items = await listPendingOwnershipReviews(getAdminFirestore());
    return NextResponse.json({ items }, { headers: NO_STORE });
  } catch (error) {
    logger.error('Η ουρά επαληθεύσεων δεν διαβάστηκε', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503 });
  }
}

async function decisionHandler(request: NextRequest, ctx: AuthContext): Promise<NextResponse<DecisionBody>> {
  const parsed = DecisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'MALFORMED' }, { status: 400 });
  try {
    const outcome = await decideOwnershipReview(getAdminFirestore(), {
      verificationId: parsed.data.verificationId,
      reviewerUid: ctx.uid,
      decision: parsed.data.decision,
      note: parsed.data.note?.trim() || null,
      nowIso: nowISO(),
    });
    return NextResponse.json(outcome, { status: outcome.kind === 'decided' ? 200 : 409, headers: NO_STORE });
  } catch (error) {
    logger.error('Η απόφαση επαλήθευσης δεν γράφτηκε', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503 });
  }
}

export const GET = withSensitiveRateLimit(
  withAuth<ListBody>(
    async (_request: NextRequest, _ctx: AuthContext, _cache: PermissionCache) => listHandler(),
    SUPER_ADMIN_ONLY,
  ),
);

export const POST = withSensitiveRateLimit(
  withAuth<DecisionBody>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => decisionHandler(request, ctx),
    SUPER_ADMIN_ONLY,
  ),
);
