/**
 * @fileoverview **ΕΠΑΛΗΘΕΥΣΗ ΚΑΤΟΧΗΣ ΜΕ ΠΚΑ** — η κατάσταση (`GET`) και η υποβολή (`POST`).
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
import { readLatestVerification } from '@/services/ownership/verified-ownership.reader';
import type { OwnershipVerificationView } from '@/types/ownership-verification';

const logger = createModuleLogger('api/ownership-verification');

type RouteContext = { params: Promise<{ ownerPropertyId: string }> };

type ErrorBody = { readonly error: 'MISSING_ID' | 'MALFORMED' | 'UNAVAILABLE' | Extract<SubmitOutcome, { kind: 'refused' }>['reason'] };

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

async function propertyIdOf(routeContext?: RouteContext): Promise<string> {
  const params = await routeContext?.params;
  return params?.ownerPropertyId?.trim() ?? '';
}

async function getHandler(
  _request: NextRequest,
  actor: ApiActor,
  routeContext?: RouteContext,
): Promise<NextResponse<{ readonly verification: OwnershipVerificationView | null } | ErrorBody>> {
  const ownerPropertyId = await propertyIdOf(routeContext);
  if (ownerPropertyId === '') return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 });
  try {
    // 🔒 Το ερώτημα φέρει ΠΑΝΤΑ τον `uid` του καλούντος: ξένη αγγελία ⇒ `null`, όχι «υπάρχει».
    const latest = await readLatestVerification(getAdminFirestore(), ownerPropertyId, actor.ctx.uid);
    return NextResponse.json({ verification: latest === null ? null : viewOfVerification(latest) }, { headers: NO_STORE });
  } catch (error) {
    logger.error('Η κατάσταση επαλήθευσης δεν διαβάστηκε', {
      data: { ownerPropertyId },
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503 });
  }
}

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

async function postHandler(
  request: NextRequest,
  actor: ApiActor,
  routeContext?: RouteContext,
): Promise<NextResponse<{ readonly verification: OwnershipVerificationView } | ErrorBody>> {
  const ownerPropertyId = await propertyIdOf(routeContext);
  if (ownerPropertyId === '') return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 });

  const body: unknown = await request.json().catch(() => null);
  const fileId = typeof body === 'object' && body !== null ? (body as { fileId?: unknown }).fileId : undefined;
  if (typeof fileId !== 'string' || fileId.trim() === '') return NextResponse.json({ error: 'MALFORMED' }, { status: 400 });

  const outcome = await submitOwnershipVerification(
    getAdminFirestore(),
    { uid: actor.ctx.uid, ownerPropertyId, fileId: fileId.trim() },
    { verifySeal: verifyPdfSeal, readPdfText: extractPdfText, nowIso: nowISO() },
  );
  return responseOf(outcome);
}

export const GET = withSensitiveRateLimit(
  withPersonalOrOrgAuth<{ readonly verification: OwnershipVerificationView | null } | ErrorBody, RouteContext>(getHandler),
);

export const POST = withSensitiveRateLimit(
  withPersonalOrOrgAuth<{ readonly verification: OwnershipVerificationView } | ErrorBody, RouteContext>(postHandler),
);
