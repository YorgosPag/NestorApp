/**
 * @fileoverview **POST/GET /api/spatial-tours/{kind}/{subjectId}/capture-invitations** — ο υπεύθυνος προσκαλεί
 * φωτογράφο · βλέπει τις ζωντανές προσκλήσεις.
 * @related ADR-884 Φ0.5 · §4.5 (Κ3α) · ADR-853 §20 · πρότυπο `api/workspace-invitations/route.ts`
 * @module app/api/spatial-tours/[kind]/[subjectId]/capture-invitations/route
 *
 * 🔑 **Η ΠΡΩΤΗ πρόσκληση γεννά την περιήγηση** (`ensureManagedTour`, πρότυπο Matterport/Zillow). Η κρίση
 * «διαχειρίζεσαι;» ζει στην υπηρεσία (`mayManageTour`) — **όχι** εδώ.
 *
 * 🔴 **Το ωμό token δεν φεύγει ΠΟΤΕ στην απόκριση** — μόνο στο email (αλυσίδα δύο κρίκων: έκδοση → ειδοποίηση).
 * Η απόκριση λέει **τι απέγινε το email** (`delivery`), ώστε ο υπεύθυνος να μη νομίζει «στάλθηκε» όταν δεν ταξίδεψε.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/json-body';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getErrorMessage } from '@/lib/error-utils';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import type { InvitationNoticeOutcome } from '@/server/invitations/invitation-notice';
import {
  issueTourCaptureInvitation,
  listPendingTourCaptureInvitations,
} from '@/server/spatial-tour/tour-capture-invitation';
import { notifyTourCaptureInvitation } from '@/server/spatial-tour/tour-capture-invitation-notice';
import type { TourCaptureInvitation } from '@/types/spatial-tour';

import {
  readTourSubject,
  tourActorOf,
  tourBadSubjectResponse,
  tourRefusedResponse,
  tourSubjectResponse,
  tourUnavailableResponse,
  type TourBadSubjectBody,
  type TourRefusedBody,
  type TourSegment,
  type TourUnavailableBody,
} from '../../../_shared/tour-route';

const logger = createModuleLogger('TOUR_CAPTURE_INVITATION_ISSUE');

export const dynamic = 'force-dynamic';

const issueBodySchema = z.object({
  email: z.string().min(3).max(254),
  /** Η λήξη της **άδειας** — υποχρεωτική· την κρίνει το `checkTourGrantExpiry` (ποτέ προεπιλογή εδώ). */
  grantExpiresAt: z.string().min(10).max(40),
  reason: z.string().max(500),
});

/** Η πρόσκληση όπως τη βλέπει ο υπεύθυνος — **χωρίς** `nonceHash` και χωρίς token. */
export interface TourCaptureInvitationView {
  readonly id: string;
  readonly inviteeEmail: string;
  readonly state: TourCaptureInvitation['state'];
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly grantExpiresAt: string;
  readonly reason: string;
  readonly openedAt: string | null;
}

function viewOf(invitation: TourCaptureInvitation): TourCaptureInvitationView {
  const { id, inviteeEmail, state, createdAt, expiresAt, grantExpiresAt, reason, openedAt } = invitation;
  return { id, inviteeEmail, state, createdAt, expiresAt, grantExpiresAt, reason, openedAt };
}

type Failure = TourBadSubjectBody | TourRefusedBody | TourUnavailableBody;
type IssueResponse =
  | { readonly invitation: TourCaptureInvitationView; readonly supersededCount: number; readonly delivery: InvitationNoticeOutcome }
  | Failure;
type ListResponse = { readonly invitations: readonly TourCaptureInvitationView[] } | Failure;

async function issueHandler(request: NextRequest, actor: ApiActor, segment?: TourSegment): Promise<NextResponse<IssueResponse>> {
  const subject = await readTourSubject(segment);
  if (subject === null) return tourBadSubjectResponse();
  const parsed = await readJsonBody(request, issueBodySchema);
  if ('rejected' in parsed) return parsed.rejected;

  const db = getAdminFirestore();
  try {
    const outcome = await issueTourCaptureInvitation(db, {
      subject, actor: tourActorOf(actor), inviteeEmailRaw: parsed.data.email,
      grantExpiresAt: parsed.data.grantExpiresAt, reason: parsed.data.reason,
    });
    if (outcome.kind === 'refused') return tourRefusedResponse(outcome.reason);
    const delivery = await notifyTourCaptureInvitation(db, { invitation: outcome.invitation, token: outcome.token });
    return NextResponse.json(
      { invitation: viewOf(outcome.invitation), supersededCount: outcome.supersededCount, delivery },
      { status: 201 },
    );
  } catch (error: unknown) {
    // Λείπει το μυστικό · ο Firestore δεν απάντησε — «δεν μπόρεσα», ποτέ ονομασμένη άρνηση.
    logger.error('Η πρόσκληση φωτογράφου δεν εκδόθηκε', { subjectKind: subject.kind, error: getErrorMessage(error) });
    return tourUnavailableResponse();
  }
}

function listHandler(_request: NextRequest, actor: ApiActor, segment?: TourSegment): Promise<NextResponse<ListResponse>> {
  return tourSubjectResponse(segment, actor, listPendingTourCaptureInvitations, (listed) => ({ invitations: listed.invitations.map(viewOf) }));
}

export const POST = withSensitiveRateLimit<TourSegment>(withPersonalOrOrgAuth<IssueResponse, TourSegment>(issueHandler));
export const GET = withSensitiveRateLimit<TourSegment>(withPersonalOrOrgAuth<ListResponse, TourSegment>(listHandler));
