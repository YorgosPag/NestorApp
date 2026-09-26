/**
 * @fileoverview **POST /api/spatial-tours/{kind}/{subjectId}/capture-invitations/{invitationId}/revoke** — ο υπεύθυνος
 * ακυρώνει πρόσκληση φωτογράφου πριν γίνει δεκτή.
 * @related ADR-884 Φ0.5 · §4.5 (Κ3α) · πρότυπο `api/workspace-invitations/[invitationId]/revoke/route.ts`
 * @module app/api/spatial-tours/[kind]/[subjectId]/capture-invitations/[invitationId]/revoke/route
 *
 * 🔑 **Η ιδιοκτησία είναι ΔΟΜΙΚΗ**: η πρόσκληση αναζητείται **κάτω** από την περιήγηση που ο δράστης διαχειρίζεται,
 * άρα ξένη πρόσκληση = `404` — αδιάκριτη από ανύπαρκτη, επίτηδες (κανένα μαντείο ύπαρξης).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { revokeTourCaptureInvitation } from '@/server/spatial-tour/tour-capture-invitation';

import {
  readTourSubjectWith,
  tourActorOf,
  tourBadSubjectResponse,
  tourRefusedResponse,
  type TourBadSubjectBody,
  type TourRefusedBody,
} from '../../../../../_shared/tour-route';

export const dynamic = 'force-dynamic';

type Segment = { params: Promise<{ kind: string; subjectId: string; invitationId: string }> };

type RevokeResponse =
  | { readonly status: 'revoked' }
  | { readonly error: 'INVITATION_NOT_FOUND' }
  /** Είχε ήδη λυθεί (δεκτή · άρνηση · ανακλήθηκε) — ιδεμπότητο: καμία γραφή. */
  | { readonly error: 'ALREADY_RESOLVED'; readonly state: string }
  | TourBadSubjectBody
  | TourRefusedBody;

async function handler(_request: NextRequest, actor: ApiActor, segment?: Segment): Promise<NextResponse<RevokeResponse>> {
  const read = await readTourSubjectWith(segment, 'invitationId');
  if (read === null) return tourBadSubjectResponse();
  const { subject, value: invitationId } = read;

  const outcome = await revokeTourCaptureInvitation(getAdminFirestore(), { subject, actor: tourActorOf(actor), invitationId });
  switch (outcome.kind) {
    case 'revoked':
      return NextResponse.json({ status: 'revoked' } as const);
    case 'absent':
      return NextResponse.json({ error: 'INVITATION_NOT_FOUND' } as const, { status: 404 });
    case 'already':
      return NextResponse.json({ error: 'ALREADY_RESOLVED', state: outcome.state } as const, { status: 409 });
    case 'refused':
      return tourRefusedResponse(outcome.reason);
  }
}

export const POST = withSensitiveRateLimit<Segment>(withPersonalOrOrgAuth<RevokeResponse, Segment>(handler));
