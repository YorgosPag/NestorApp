/**
 * @fileoverview **POST /api/spatial-tours/{kind}/{subjectId}/uploads** — ξεκίνα ανέβασμα λήψης 360°.
 * @related ADR-884 Φ0.8 · §4.5 (Κ3α) · `startTourCaptureUpload` · `lib/storage/resumable-upload-session.ts`
 * @module app/api/spatial-tours/[kind]/[subjectId]/uploads/route
 *
 * 🔑 **Μία πόρτα για υπεύθυνο ΚΑΙ φωτογράφο** (Φ0.8). Η απόκριση φέρει: τη **συνεδρία** (ο φυλλομετρητής στέλνει τα
 * bytes **απευθείας** στο GCS και συνεχίζει μετά από διακοπή) και το υπογεγραμμένο **εισιτήριο** (το επιστρέφει στην
 * ολοκλήρωση). Τα bytes δεν περνούν **ποτέ** από αυτόν τον διακομιστή — 40 MB × φωτογράφοι δεν χωρούν σε Node.
 *
 * ⛔ Το `sessionUri` είναι **κλειδί εγγραφής**: μόνο στην απόκριση, **ποτέ** σε log.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/json-body';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getErrorMessage } from '@/lib/error-utils';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { publicOrigin } from '@/lib/http/public-origin';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { startTourCaptureUpload } from '@/server/spatial-tour/tour-capture-upload';

import {
  readTourSubject,
  tourActorOf,
  tourBadSubjectResponse,
  tourRefusedResponse,
  tourUnavailableResponse,
  type TourBadSubjectBody,
  type TourRefusedBody,
  type TourSegment,
  type TourUnavailableBody,
} from '../../../_shared/tour-route';

const logger = createModuleLogger('TOUR_CAPTURE_UPLOAD_START');

export const dynamic = 'force-dynamic';

const startBodySchema = z.object({
  contentType: z.string().min(3).max(100),
  /** Το δηλωμένο μέγεθος — το ταβάνι το κρίνει η πολιτική πανοράματος, και το GCS δεν δέχεται byte παραπάνω. */
  contentLength: z.number().int().positive(),
});

type StartResponse =
  | { readonly uploadId: string; readonly ticket: string; readonly sessionUri: string; readonly expiresAt: string }
  | TourBadSubjectBody
  | TourRefusedBody
  | TourUnavailableBody;

async function handler(request: NextRequest, actor: ApiActor, segment?: TourSegment): Promise<NextResponse<StartResponse>> {
  const subject = await readTourSubject(segment);
  if (subject === null) return tourBadSubjectResponse();
  const parsed = await readJsonBody(request, startBodySchema);
  if ('rejected' in parsed) return parsed.rejected;
  // Το origin του φυλλομετρητή (η συνεδρία δένεται σε αυτό — CORS, ADR-351)· χωρίς αυτό, το δημόσιο της εφαρμογής.
  const origin = request.headers.get('origin') ?? publicOrigin();
  if (origin === null) return tourUnavailableResponse();

  try {
    const outcome = await startTourCaptureUpload(getAdminFirestore(), {
      subject, actor: tourActorOf(actor), origin, contentType: parsed.data.contentType, contentLength: parsed.data.contentLength,
    });
    if (outcome.kind === 'refused') return tourRefusedResponse(outcome.reason);
    if (outcome.kind === 'unavailable') {
      logger.error('Το ανέβασμα δεν ξεκίνησε', { reason: outcome.reason, subjectKind: subject.kind });
      return tourUnavailableResponse();
    }
    const { uploadId, ticket, sessionUri, expiresAt } = outcome;
    return NextResponse.json({ uploadId, ticket, sessionUri, expiresAt }, { status: 201 });
  } catch (error: unknown) {
    logger.error('Το ανέβασμα δεν ξεκίνησε', { subjectKind: subject.kind, error: getErrorMessage(error) });
    return tourUnavailableResponse();
  }
}

export const POST = withHeavyRateLimit<TourSegment>(withPersonalOrOrgAuth<StartResponse, TourSegment>(handler));
