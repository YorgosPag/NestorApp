/**
 * @fileoverview **POST /api/spatial-tours/{kind}/{subjectId}/capture-grants/{granteeUid}/revoke** — ο υπεύθυνος
 * κόβει την άδεια ενός φωτογράφου **αμέσως** (πράξη ανθρώπου, νικά τη λήξη).
 * @related ADR-884 Φ0.5 · §4.5 (Κ3α) · `revokeTourCaptureGrant`
 * @module app/api/spatial-tours/[kind]/[subjectId]/capture-grants/[granteeUid]/revoke/route
 *
 * 🔑 Κόβει **και** ανέβασμα σε εξέλιξη: η ολοκλήρωση **ξανακρίνει** την άδεια (`finalizeTourCaptureUpload`).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { revokeTourCaptureGrant } from '@/server/spatial-tour/tour-capture-invitation';

import {
  readTourSubjectWith,
  tourActorOf,
  tourBadSubjectResponse,
  tourRefusedResponse,
  type TourBadSubjectBody,
  type TourRefusedBody,
} from '../../../../../_shared/tour-route';

export const dynamic = 'force-dynamic';

type Segment = { params: Promise<{ kind: string; subjectId: string; granteeUid: string }> };
type RevokeResponse = { readonly status: 'revoked' } | TourBadSubjectBody | TourRefusedBody;

async function handler(_request: NextRequest, actor: ApiActor, segment?: Segment): Promise<NextResponse<RevokeResponse>> {
  const read = await readTourSubjectWith(segment, 'granteeUid');
  if (read === null) return tourBadSubjectResponse();
  const { subject, value: granteeUid } = read;

  const outcome = await revokeTourCaptureGrant(getAdminFirestore(), { subject, actor: tourActorOf(actor), granteeUid });
  if (outcome.kind === 'refused') return tourRefusedResponse(outcome.reason);
  return NextResponse.json({ status: 'revoked' } as const);
}

export const POST = withSensitiveRateLimit<Segment>(withPersonalOrOrgAuth<RevokeResponse, Segment>(handler));
