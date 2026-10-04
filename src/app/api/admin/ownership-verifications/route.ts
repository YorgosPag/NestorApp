/**
 * @fileoverview **Η ΟΥΡΑ ΕΛΕΓΧΟΥ ΕΠΑΛΗΘΕΥΣΕΩΝ ΚΑΤΟΧΗΣ** — λίστα εκκρεμών (`GET`), αναζήτηση ανακλήσιμων
 * (`GET ?kaek=|?ownerPropertyId=`) και απόφαση (`POST`: έγκριση · απόρριψη · **ανάκληση** με λόγο, ADR-900 §8 #2 Β3).
 * @related ADR-900 §3.8 · services/ownership/ownership-verification-review.service.ts ·
 *   services/ownership/ownership-verification-revoke.service.ts
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
import { canonicalKaek } from '@/lib/geo/kaek';
import {
  decideOwnershipReview,
  listPendingOwnershipReviews,
  listRevocableOwnerships,
  type OwnershipReviewItem,
  type RevocableOwnershipItem,
  type RevocableSearch,
  type ReviewOutcome,
} from '@/services/ownership/ownership-verification-review.service';
import {
  revokeOwnershipVerification,
  type RevokeOutcome,
} from '@/services/ownership/ownership-verification-revoke.service';
import { ADMIN_REVOCATION_REASONS } from '@/types/ownership-verification';

const logger = createModuleLogger('api/admin/ownership-verifications');

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const NoteSchema = z.string().max(1000).nullable().optional();

/** Η απόφαση της ουράς — έγκριση/απόρριψη εκκρεμούς, ή **ανάκληση** με λόγο από κλειστό σύνολο (ADR-900 §8 #2 Β3). */
const DecisionSchema = z.discriminatedUnion('decision', [
  z.object({ verificationId: z.string().min(1), decision: z.enum(['approve', 'reject']), note: NoteSchema }),
  z.object({
    verificationId: z.string().min(1),
    decision: z.literal('revoke'),
    reason: z.enum(ADMIN_REVOCATION_REASONS),
    note: NoteSchema,
  }),
]);

type ListBody =
  | { readonly items: ReadonlyArray<OwnershipReviewItem> }
  | { readonly revocable: ReadonlyArray<RevocableOwnershipItem> }
  | { readonly error: 'UNAVAILABLE' | 'MALFORMED' };
type DecisionBody = ReviewOutcome | RevokeOutcome | { readonly error: 'MALFORMED' | 'UNAVAILABLE' };

/** `?kaek=` (κανονικοποιείται) ή `?ownerPropertyId=` ⇒ αναζήτηση ανακλήσιμων· τίποτα ⇒ η ουρά εκκρεμών. */
function revocableSearchOf(request: NextRequest): RevocableSearch | 'malformed' | null {
  const params = request.nextUrl.searchParams;
  const rawKaek = params.get('kaek')?.trim() ?? '';
  const ownerPropertyId = params.get('ownerPropertyId')?.trim() ?? '';
  if (rawKaek !== '') {
    const kaek = canonicalKaek(rawKaek);
    return kaek === null ? 'malformed' : { kaek };
  }
  return ownerPropertyId === '' ? null : { ownerPropertyId };
}

const SUPER_ADMIN_ONLY = { requiredGlobalRoles: 'super_admin' as const };

async function listHandler(request: NextRequest): Promise<NextResponse<ListBody>> {
  const search = revocableSearchOf(request);
  if (search === 'malformed') return NextResponse.json({ error: 'MALFORMED' }, { status: 400 });
  try {
    if (search !== null) {
      const revocable = await listRevocableOwnerships(getAdminFirestore(), search);
      return NextResponse.json({ revocable }, { headers: NO_STORE });
    }
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
  const note = parsed.data.note?.trim() || null;
  try {
    const db = getAdminFirestore();
    const outcome =
      parsed.data.decision === 'revoke'
        ? await revokeOwnershipVerification(db, {
            verificationId: parsed.data.verificationId,
            actor: { kind: 'admin', uid: ctx.uid },
            reason: parsed.data.reason,
            note,
            nowIso: nowISO(),
          })
        : await decideOwnershipReview(db, {
            verificationId: parsed.data.verificationId,
            reviewerUid: ctx.uid,
            decision: parsed.data.decision,
            note,
            nowIso: nowISO(),
          });
    return NextResponse.json(outcome, { status: outcome.kind === 'refused' ? 409 : 200, headers: NO_STORE });
  } catch (error) {
    logger.error('Η απόφαση επαλήθευσης δεν γράφτηκε', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503 });
  }
}

export const GET = withSensitiveRateLimit(
  withAuth<ListBody>(
    async (request: NextRequest, _ctx: AuthContext, _cache: PermissionCache) => listHandler(request),
    SUPER_ADMIN_ONLY,
  ),
);

export const POST = withSensitiveRateLimit(
  withAuth<DecisionBody>(
    async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => decisionHandler(request, ctx),
    SUPER_ADMIN_ONLY,
  ),
);
