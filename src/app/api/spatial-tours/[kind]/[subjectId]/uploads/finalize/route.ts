/**
 * @fileoverview **POST /api/spatial-tours/{kind}/{subjectId}/uploads/finalize** — ολοκλήρωσε ανέβασμα λήψης 360°.
 * @related ADR-884 Φ0.8 · Φ0.14 · §4.5 (Κ3α) · `finalizeTourCaptureUpload`
 * @module app/api/spatial-tours/[kind]/[subjectId]/uploads/finalize/route
 *
 * 🔑 **Ιδεμπότητο από κατασκευή**: η δεύτερη κλήση με το ίδιο εισιτήριο επιστρέφει την **ίδια** λήψη (`replayed`).
 * Η ρίζα της διαδρομής **δεν** κρίνει τίποτα εδώ — την περιήγηση τη λέει το **υπογεγραμμένο** εισιτήριο· η διαδρομή
 * απλώς ελέγχει ότι συμφωνούν, ώστε ένα λάθος στον πελάτη να μη γίνει ποτέ «ανέβηκε αλλού».
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/json-body';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getErrorMessage } from '@/lib/error-utils';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { finalizeTourCaptureUpload } from '@/server/spatial-tour/tour-capture-finalize';
import { readTourUploadTicket } from '@/server/spatial-tour/tour-upload-ticket';
import type { TourCapture } from '@/types/spatial-tour';

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
} from '../../../../_shared/tour-route';

const logger = createModuleLogger('TOUR_CAPTURE_UPLOAD_FINALIZE');

export const dynamic = 'force-dynamic';

const finalizeBodySchema = z.object({
  ticket: z.string().min(16).max(4096),
  /** Η δήλωση της λήψης — την κρίνει ο **ίδιος** αναγνώστης που διαβάζει τη λήψη (`readCaptureDeclaration`). */
  declaration: z.unknown(),
});

type FinalizeResponse =
  | { readonly capture: TourCapture; readonly replayed: boolean }
  | TourBadSubjectBody
  | TourRefusedBody
  | TourUnavailableBody;

/** Η ρίζα της διαδρομής **ΠΡΕΠΕΙ** να είναι αυτή του εισιτηρίου — αλλιώς ο πελάτης μπέρδεψε ανεβάσματα. */
function ticketMatchesRoute(ticket: string, route: { readonly kind: string; readonly id: string }): boolean {
  const reading = readTourUploadTicket(ticket, Date.now());
  return reading.kind !== 'read' || (reading.ticket.subject.kind === route.kind && reading.ticket.subject.id === route.id);
}

async function handler(request: NextRequest, actor: ApiActor, segment?: TourSegment): Promise<NextResponse<FinalizeResponse>> {
  const subject = await readTourSubject(segment);
  if (subject === null) return tourBadSubjectResponse();
  const parsed = await readJsonBody(request, finalizeBodySchema);
  if ('rejected' in parsed) return parsed.rejected;
  if (!ticketMatchesRoute(parsed.data.ticket, subject)) return tourRefusedResponse('ticket-foreign');

  try {
    const outcome = await finalizeTourCaptureUpload(getAdminFirestore(), {
      ticket: parsed.data.ticket, actor: tourActorOf(actor), declaration: parsed.data.declaration,
    });
    if (outcome.kind === 'refused') return tourRefusedResponse(outcome.reason);
    if (outcome.kind === 'unavailable') {
      logger.error('Η λήψη δεν ολοκληρώθηκε', { reason: outcome.reason });
      return tourUnavailableResponse();
    }
    return NextResponse.json({ capture: outcome.capture, replayed: outcome.replayed }, { status: outcome.replayed ? 200 : 201 });
  } catch (error: unknown) {
    logger.error('Η λήψη δεν ολοκληρώθηκε', { subjectKind: subject.kind, error: getErrorMessage(error) });
    return tourUnavailableResponse();
  }
}

export const POST = withHeavyRateLimit<TourSegment>(withPersonalOrOrgAuth<FinalizeResponse, TourSegment>(handler));
