/**
 * @fileoverview **ΕΠΑΛΗΘΕΥΣΗ ΚΑΤΟΧΗΣ ΜΕ ΠΚΑ** — η κατάσταση (`GET`), η υποβολή (`POST`) και η αποδέσμευση
 * (`DELETE`, ADR-900 §8 #2 Β3).
 * @related ADR-900 §3.8 · services/ownership/ownership-verification.service.ts · CHECK 3.78 · CHECK 3.92
 *
 * 🔑 **Το σώμα κουβαλά ΜΟΝΟ το `fileId`** του ΠΚΑ στον φάκελο της αγγελίας. Όνομα και ΑΦΜ **δεν** έρχονται
 * από τη φόρμα: είναι η ταυτότητα του λογαριασμού (`users/{uid}`), με τον **έναν** γραφέα ΑΦΜ (mod-11).
 *
 * ⚠️ **`withSensitiveRateLimit`**: κάθε υποβολή κατεβάζει αρχείο, ελέγχει κρυπτογραφικά σφραγίδα και
 * αναλύει PDF — βαρύ έργο ανά αίτημα, και η επανάληψη είναι μαντεψιά πάνω σε ξένους ΚΑΕΚ/ΑΦΜ.
 * ⚠️ **`withPersonalOrOrgAuth`**: ο ιδιοκτήτης είναι ιδιώτης· την κατοχή την κρίνει η υπηρεσία
 * (`mayAdminister`, μόνο ιδιωτική θεματοφυλακή). Η ιδεμποτία (`Idempotency-Key`) είναι του συνόρου.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { verifyPdfSeal } from '@/server/pdf-seal/verify-pdf-seal';
import { extractPdfText } from '@/services/pdf/pdf-rasterize.service';
import { submitOwnershipVerification, type SubmitOutcome } from '@/services/ownership/ownership-verification.service';
import { viewOfVerification } from '@/services/ownership/ownership-verification-record';
import {
  revokeOwnershipVerification,
  type RevokeOutcome,
} from '@/services/ownership/ownership-verification-revoke.service';
import { readActiveVerification, readLatestVerification } from '@/services/ownership/verified-ownership.reader';
import type { OwnershipVerificationView } from '@/types/ownership-verification';

const logger = createModuleLogger('api/ownership-verification');

type RouteContext = { params: Promise<{ ownerPropertyId: string }> };

type ErrorBody = {
  readonly error:
    | 'MISSING_ID'
    | 'MALFORMED'
    | 'UNAVAILABLE'
    | Extract<SubmitOutcome, { kind: 'refused' }>['reason']
    | Extract<RevokeOutcome, { kind: 'refused' }>['reason'];
};

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

type ViewBody = { readonly verification: OwnershipVerificationView | null } | ErrorBody;

type OwnerPropertyHandler<B> = (request: NextRequest, actor: ApiActor, ownerPropertyId: string) => Promise<NextResponse<B>>;

/** Το id της αγγελίας από τη διαδρομή — κενό ⇒ 400 πριν από κάθε ανάγνωση (ένα σημείο για τις τρεις μεθόδους). */
function forOwnerProperty<B>(handler: OwnerPropertyHandler<B | ErrorBody>) {
  return async (request: NextRequest, actor: ApiActor, routeContext?: RouteContext): Promise<NextResponse<B | ErrorBody>> => {
    const ownerPropertyId = (await routeContext?.params)?.ownerPropertyId?.trim() ?? '';
    if (ownerPropertyId === '') return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 });
    return handler(request, actor, ownerPropertyId);
  };
}

/**
 * Η **τελευταία** προσπάθεια του καλούντος, ως προβολή. 🔒 Το ερώτημα φέρει ΠΑΝΤΑ τον `uid` του καλούντος: ξένη
 * αγγελία ⇒ `null`, όχι «υπάρχει».
 */
async function latestResponse(ownerPropertyId: string, uid: string): Promise<NextResponse<ViewBody>> {
  const latest = await readLatestVerification(getAdminFirestore(), ownerPropertyId, uid);
  return NextResponse.json({ verification: latest === null ? null : viewOfVerification(latest) }, { headers: NO_STORE });
}

function unavailable(message: string, ownerPropertyId: string, error: unknown): NextResponse<ErrorBody> {
  logger.error(message, { data: { ownerPropertyId }, error: error instanceof Error ? error.message : String(error) });
  return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503 });
}

const getHandler = forOwnerProperty<ViewBody>(async (_request, actor, ownerPropertyId) => {
  try {
    return await latestResponse(ownerPropertyId, actor.ctx.uid);
  } catch (error) {
    return unavailable('Η κατάσταση επαλήθευσης δεν διαβάστηκε', ownerPropertyId, error);
  }
});

/** Αποτέλεσμα → HTTP. Η άρνηση είναι 4xx με όνομα· η βλάβη 503 («ξαναδοκίμασε, μην αλλάξεις τίποτα»). */
function responseOf(outcome: SubmitOutcome): NextResponse<{ readonly verification: OwnershipVerificationView } | ErrorBody> {
  switch (outcome.kind) {
    case 'judged':
      return NextResponse.json({ verification: outcome.view }, { headers: NO_STORE });
    case 'unavailable':
      return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503 });
    case 'refused':
      return NextResponse.json({ error: outcome.reason }, { status: outcome.reason === 'not-your-property' ? 404 : 422 });
  }
}

const postHandler = forOwnerProperty<{ readonly verification: OwnershipVerificationView }>(
  async (request, actor, ownerPropertyId) => {
    const body: unknown = await request.json().catch(() => null);
    const fileId = typeof body === 'object' && body !== null ? (body as { fileId?: unknown }).fileId : undefined;
    if (typeof fileId !== 'string' || fileId.trim() === '') return NextResponse.json({ error: 'MALFORMED' }, { status: 400 });

    const outcome = await submitOwnershipVerification(
      getAdminFirestore(),
      { uid: actor.ctx.uid, ownerPropertyId, fileId: fileId.trim() },
      { verifySeal: verifyPdfSeal, readPdfText: extractPdfText, nowIso: nowISO() },
    );
    return responseOf(outcome);
  },
);

/**
 * **Αποδέσμευση** (σχήμα Zillow «unclaim», ADR-900 §8 #2 Β3): ο κάτοχος ανακαλεί τη **δική** του ενεργή απόδειξη.
 * Λόγος πάντα `owner-request` ⇒ η δημόσια μονάδα **μένει** (το σπίτι υπάρχει). Ίδιος γραφέας με την ουρά.
 */
const deleteHandler = forOwnerProperty<ViewBody>(async (_request, actor, ownerPropertyId) => {
  try {
    // 🔒 Μόνο η ενεργή απόδειξη **του καλούντος**: ξένη ⇒ «καμία ενεργή», όχι «υπάρχει».
    const active = await readActiveVerification(getAdminFirestore(), ownerPropertyId, actor.ctx.uid);
    if (active === null) return NextResponse.json({ error: 'not-revocable' }, { status: 409 });
    const outcome = await revokeOwnershipVerification(getAdminFirestore(), {
      verificationId: active.id,
      actor: { kind: 'owner', uid: actor.ctx.uid },
      reason: 'owner-request',
      note: null,
      nowIso: nowISO(),
    });
    if (outcome.kind === 'refused') return NextResponse.json({ error: outcome.reason }, { status: 409 });
    return await latestResponse(ownerPropertyId, actor.ctx.uid);
  } catch (error) {
    return unavailable('Η αποδέσμευση κατοχής δεν ολοκληρώθηκε', ownerPropertyId, error);
  }
});

export const GET = withSensitiveRateLimit(withPersonalOrOrgAuth<ViewBody, RouteContext>(getHandler));

export const POST = withSensitiveRateLimit(
  withPersonalOrOrgAuth<{ readonly verification: OwnershipVerificationView } | ErrorBody, RouteContext>(postHandler),
);

export const DELETE = withSensitiveRateLimit(withPersonalOrOrgAuth<ViewBody, RouteContext>(deleteHandler));
