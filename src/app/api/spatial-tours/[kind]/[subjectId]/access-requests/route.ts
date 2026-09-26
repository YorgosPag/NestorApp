/**
 * @fileoverview **GET/POST /api/spatial-tours/{kind}/{subjectId}/access-requests** — ο υπεύθυνος βλέπει τα αιτήματα
 * θέασης μιας κατάστασης · αποφασίζει (και μαζικά).
 * @related ADR-884 Φ0.13 · Κ3β · `server/spatial-tour/tour-access-{inbox,decision}.ts` · `tour-access-notifier.ts`
 * @module app/api/spatial-tours/[kind]/[subjectId]/access-requests/route
 *
 * 🔑 **Μαζική απόφαση, αποτέλεσμα ανά άνθρωπο** (πρότυπο Gmail): ένα αίτημα που αποσύρθηκε στο μεταξύ δεν ρίχνει
 * τα άλλα είκοσι. Ιδεμποτία **φυσική**: απόφαση μόνο πάνω σε εκκρεμές — η επανάληψη απαντά `not-pending` ανά άνθρωπο,
 * ποτέ δεύτερη εγγραφή (CHECK 3.92).
 *
 * 🔑 Οι ειδοποιήσεις φεύγουν **μετά** τη γραφή και **ποτέ** δεν ρίχνουν την απάντηση (`announceTourAccessAnswered`).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { TOUR_ACCESS_REQUEST_STATES } from '@/constants/spatial-tour-vocabulary';
import { readJsonBody } from '@/lib/api/json-body';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit, withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { decideTourAccessRequests, type TourAccessDecisionResult } from '@/server/spatial-tour/tour-access-decision';
import { listTourAccessInbox, type TourAccessInboxRow } from '@/server/spatial-tour/tour-access-inbox';
import { announceTourAccessAnswered } from '@/server/spatial-tour/tour-access-notifier';
import type { TourSubject } from '@/types/spatial-tour';

import {
  readTourSubject,
  tourActorOf,
  tourBadSubjectResponse,
  tourRefusedResponse,
  type TourBadSubjectBody,
  type TourRefusedBody,
  type TourSegment,
} from '../../../_shared/tour-route';

export const dynamic = 'force-dynamic';

/** Όσοι αποφασίζονται σε μία πράξη — όσο χωρά μια σελίδα λίστας. */
const BULK_LIMIT = 100;

const decisionSchema = z.object({
  requesterUids: z.array(z.string().min(1).max(128)).min(1).max(BULK_LIMIT),
  decision: z.enum(['approved', 'declined']),
  /** Υποχρεωτικό στην έγκριση — το κρίνει το `checkTourGrantExpiry` (ποτέ προεπιλογή στον διακομιστή). */
  expiresAt: z.string().min(10).max(40).nullable(),
});

type Failure = TourBadSubjectBody | TourRefusedBody;
type ListResponse = { readonly requests: readonly TourAccessInboxRow[] } | Failure;
type DecisionView = Omit<Extract<TourAccessDecisionResult, { kind: 'decided' }>, 'requestId' | 'requestCount'>
  | Extract<TourAccessDecisionResult, { kind: 'refused' }>;
type DecideResponse = { readonly results: readonly DecisionView[] } | Failure;

async function listHandler(request: NextRequest, actor: ApiActor, segment?: TourSegment): Promise<NextResponse<ListResponse>> {
  const subject = await readTourSubject(segment);
  const state = request.nextUrl.searchParams.get('state');
  const parsedState = z.enum(TOUR_ACCESS_REQUEST_STATES).safeParse(state);
  if (subject === null || !parsedState.success) return tourBadSubjectResponse();
  const listed = await listTourAccessInbox(getAdminFirestore(), { subject, actor: tourActorOf(actor), state: parsedState.data });
  if (listed.kind === 'refused') return tourRefusedResponse(listed.reason);
  return NextResponse.json({ requests: listed.rows }, { headers: { 'Cache-Control': 'no-store' } });
}

/** Οι ειδοποιήσεις της απόφασης — μία ανά άνθρωπο που **όντως** κρίθηκε. Ποτέ δεν πετούν. */
function announceDecisions(subject: TourSubject, results: readonly TourAccessDecisionResult[]): Promise<void[]> {
  const db = getAdminFirestore();
  return Promise.all(results.map((result) => (result.kind !== 'decided' ? undefined : announceTourAccessAnswered(db, {
    subject, requestId: result.requestId, requestCount: result.requestCount, requesterUid: result.requesterUid,
    decision: result.state, expiresAt: result.expiresAt,
  }))));
}

function viewOf(result: TourAccessDecisionResult): DecisionView {
  if (result.kind === 'refused') return result;
  const { requestId: _id, requestCount: _count, ...view } = result;
  return view;
}

async function decideHandler(request: NextRequest, actor: ApiActor, segment?: TourSegment): Promise<NextResponse<DecideResponse>> {
  const subject = await readTourSubject(segment);
  if (subject === null) return tourBadSubjectResponse();
  const parsed = await readJsonBody(request, decisionSchema);
  if ('rejected' in parsed) return parsed.rejected;
  const outcome = await decideTourAccessRequests(getAdminFirestore(), { subject, actor: tourActorOf(actor), ...parsed.data });
  if (outcome.kind === 'refused') return tourRefusedResponse(outcome.reason);
  await announceDecisions(subject, outcome.results);
  return NextResponse.json({ results: outcome.results.map(viewOf) });
}

export const GET = withStandardRateLimit<TourSegment>(withPersonalOrOrgAuth<ListResponse, TourSegment>(listHandler));
export const POST = withSensitiveRateLimit<TourSegment>(
  withPersonalOrOrgAuth<DecideResponse, TourSegment>(decideHandler, {
    idempotency: { mode: 'natural', why: 'Απόφαση μόνο πάνω σε εκκρεμές (CAS σε συναλλαγή) — η επανάληψη απαντά not-pending' },
  }),
);
