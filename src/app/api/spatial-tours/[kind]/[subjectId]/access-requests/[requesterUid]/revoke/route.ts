/**
 * @fileoverview **POST /api/spatial-tours/{kind}/{subjectId}/access-requests/{requesterUid}/revoke** — ο υπεύθυνος
 * ανακαλεί ενεργή θέαση.
 * @related ADR-884 Φ0.13 · Κ3β · `server/spatial-tour/tour-access-decision.ts` (`revokeTourAccess`)
 * @module app/api/spatial-tours/[kind]/[subjectId]/access-requests/[requesterUid]/revoke/route
 *
 * 🔑 Η πρόσβαση κόβεται **αμέσως** στο έγγραφο: η επόμενη συνεδρία θέασης αρνείται, και το κουπόνι που κυκλοφορεί
 * λήγει σε ≤ 15′ (Φ0.4). Ιδεμποτία **φυσική**: μόνο ενεργή άδεια ανακαλείται — η επανάληψη απαντά `not-active`.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { revokeTourAccess } from '@/server/spatial-tour/tour-access-decision';

import {
  readTourSubjectWith,
  tourActorOf,
  tourBadSubjectResponse,
  tourRefusedResponse,
  type TourBadSubjectBody,
  type TourRefusedBody,
} from '../../../../../_shared/tour-route';

export const dynamic = 'force-dynamic';

type Segment = { params: Promise<{ kind: string; subjectId: string; requesterUid: string }> };
type RevokeResponse = { readonly status: 'revoked' } | TourBadSubjectBody | TourRefusedBody;

async function handler(_request: NextRequest, actor: ApiActor, segment?: Segment): Promise<NextResponse<RevokeResponse>> {
  const read = await readTourSubjectWith(segment, 'requesterUid');
  if (read === null) return tourBadSubjectResponse();
  const outcome = await revokeTourAccess(getAdminFirestore(), {
    subject: read.subject, actor: tourActorOf(actor), requesterUid: read.value,
  });
  if (outcome.kind === 'refused') return tourRefusedResponse(outcome.reason);
  return NextResponse.json({ status: 'revoked' } as const);
}

export const POST = withSensitiveRateLimit<Segment>(
  withPersonalOrOrgAuth<RevokeResponse, Segment>(handler, {
    idempotency: { mode: 'natural', why: 'Μόνο ενεργή άδεια ανακαλείται (συναλλαγή) — η επανάληψη απαντά not-active' },
  }),
);
