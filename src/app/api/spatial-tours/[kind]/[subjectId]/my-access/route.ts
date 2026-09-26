/**
 * @fileoverview **GET/POST/DELETE /api/spatial-tours/{kind}/{subjectId}/my-access** — ο **αιτών**: πού βρίσκεται το
 * αίτημά μου · «αφήστε με να δω» · απόσυρση.
 * @related ADR-884 Φ0.13 · Κ3β · `server/spatial-tour/tour-access-request.ts` · `tour-access-notifier.ts`
 * @module app/api/spatial-tours/[kind]/[subjectId]/my-access/route
 *
 * 🔑 **Λογαριασμός υποχρεωτικός, χωρίς τριβή** (απόφαση Ε11, πρότυπο Google Drive): η έγκριση δένεται στον
 * **λογαριασμό** — προωθημένος σύνδεσμος δεν δίνει τίποτα σε τρίτον. Γι' αυτό `withPersonalOrOrgAuth`: ο αγοραστής
 * είναι πολίτης χωρίς οργανισμό (ADR-817).
 *
 * 🔑 Ιδεμποτία **φυσική**: το αίτημα είναι **ένα** ντετερμινιστικό έγγραφο ανά (περιήγηση, άνθρωπο) — δεύτερο αίτημα
 * σε εκκρεμές/ενεργό δεν γράφει τίποτα (`already-*`)· και ειδοποίηση φεύγει **μόνο** σε νέα υποβολή.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import type { TourAccessStanding } from '@/constants/spatial-tour-vocabulary';
import { readJsonBody } from '@/lib/api/json-body';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit, withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { readAccountIdentities } from '@/server/auth/account-identities';
import { announceTourAccessRequested } from '@/server/spatial-tour/tour-access-notifier';
import { locateManagedTour } from '@/server/spatial-tour/tour-access-shared';
import {
  readMyTourAccess,
  requestTourAccess,
  TOUR_ACCESS_MESSAGE_MAX,
  withdrawTourAccessRequest,
} from '@/server/spatial-tour/tour-access-request';
import type { TourAccessRequest, TourSubject } from '@/types/spatial-tour';

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

const requestSchema = z.object({ message: z.string().max(TOUR_ACCESS_MESSAGE_MAX).nullable() });

/** Ό,τι βλέπει ο αιτών για το **δικό του** αίτημα — ποτέ ποιος αποφάσισε. */
export interface MyTourAccessView {
  readonly standing: TourAccessStanding | 'none';
  readonly requestedAt: string | null;
  readonly expiresAt: string | null;
  readonly message: string | null;
  /** Ο δράστης **διαχειρίζεται** την περιήγηση — η οθόνη του δείχνει «άνοιγμα», όχι «ζητήστε πρόσβαση». */
  readonly manages: boolean;
}

type Failure = TourBadSubjectBody | TourRefusedBody;
type ReadResponse = MyTourAccessView | Failure;
type RequestResponse = MyTourAccessView & { readonly outcome: 'requested' | 'already-pending' | 'already-active' } | Failure;
type WithdrawResponse = { readonly status: 'withdrawn' } | Failure;

function viewOf(standing: TourAccessStanding | 'none', request: TourAccessRequest | null, manages: boolean): MyTourAccessView {
  return {
    standing,
    requestedAt: request?.requestedAt ?? null,
    expiresAt: request?.expiresAt ?? null,
    message: request?.message ?? null,
    manages,
  };
}

async function readHandler(_request: NextRequest, actor: ApiActor, segment?: TourSegment): Promise<NextResponse<ReadResponse>> {
  const subject = await readTourSubject(segment);
  if (subject === null) return tourBadSubjectResponse();
  const db = getAdminFirestore();
  const [mine, managed] = await Promise.all([
    readMyTourAccess(db, { subject, requesterUid: actor.ctx.uid }),
    locateManagedTour(db, subject, tourActorOf(actor)),
  ]);
  return NextResponse.json(viewOf(mine.standing, mine.request, managed.kind === 'managed'), { headers: { 'Cache-Control': 'no-store' } });
}

/** «Ο Χ ζήτησε» — με το όνομα από την **πηγή** (Auth/προφίλ), ποτέ από το σώμα του αιτήματος. */
async function announce(subject: TourSubject, request: TourAccessRequest, uid: string): Promise<void> {
  const db = getAdminFirestore();
  const identity = (await readAccountIdentities(db, [uid])).get(uid);
  const requesterName = identity?.displayName ?? identity?.email ?? uid;
  await announceTourAccessRequested(db, { subject, requestId: request.id, requestCount: request.requestCount, requesterName });
}

async function requestHandler(request: NextRequest, actor: ApiActor, segment?: TourSegment): Promise<NextResponse<RequestResponse>> {
  const subject = await readTourSubject(segment);
  if (subject === null) return tourBadSubjectResponse();
  const parsed = await readJsonBody(request, requestSchema);
  if ('rejected' in parsed) return parsed.rejected;
  const uid = actor.ctx.uid;
  const db = getAdminFirestore();
  // 🔑 Ο υπεύθυνος δεν «ζητά» πρόσβαση στη δική του περιήγηση — τη βλέπει ήδη (βάση `manager`).
  if ((await locateManagedTour(db, subject, tourActorOf(actor))).kind === 'managed') return tourRefusedResponse('not-requestable');
  const outcome = await requestTourAccess(db, { subject, requesterUid: uid, message: parsed.data.message });
  if (outcome.kind === 'refused') return tourRefusedResponse(outcome.reason);
  if (outcome.kind === 'requested') await announce(subject, outcome.request, uid);
  const standing = outcome.kind === 'already-active' ? 'active' : 'pending';
  return NextResponse.json({ ...viewOf(standing, outcome.request, false), outcome: outcome.kind }, { status: outcome.kind === 'requested' ? 201 : 200 });
}

async function withdrawHandler(_request: NextRequest, actor: ApiActor, segment?: TourSegment): Promise<NextResponse<WithdrawResponse>> {
  const subject = await readTourSubject(segment);
  if (subject === null) return tourBadSubjectResponse();
  const outcome = await withdrawTourAccessRequest(getAdminFirestore(), { subject, requesterUid: actor.ctx.uid });
  if (outcome.kind === 'refused') return tourRefusedResponse(outcome.reason);
  return NextResponse.json({ status: 'withdrawn' } as const);
}

export const GET = withStandardRateLimit<TourSegment>(withPersonalOrOrgAuth<ReadResponse, TourSegment>(readHandler));
export const POST = withSensitiveRateLimit<TourSegment>(
  withPersonalOrOrgAuth<RequestResponse, TourSegment>(requestHandler, {
    idempotency: { mode: 'natural', why: 'Ένα ντετερμινιστικό αίτημα ανά (περιήγηση, άνθρωπο) — σε εκκρεμές/ενεργό δεν γράφεται τίποτα' },
  }),
);
export const DELETE = withSensitiveRateLimit<TourSegment>(
  withPersonalOrOrgAuth<WithdrawResponse, TourSegment>(withdrawHandler, {
    idempotency: { mode: 'natural', why: 'Απόσυρση μόνο εκκρεμούς (συναλλαγή) — η επανάληψη απαντά not-pending' },
  }),
);
