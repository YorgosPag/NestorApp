/**
 * @fileoverview **GET/PATCH /api/spatial-tours/{kind}/{subjectId}/settings** — ορατότητα + κύκλος ζωής της περιήγησης.
 * @related ADR-884 Κ3β · §12 Δ3 · `server/spatial-tour/tour-settings.ts` (η κρίση και η εγγραφή)
 * @module app/api/spatial-tours/[kind]/[subjectId]/settings/route
 *
 * 🔑 Μόνο ο υπεύθυνος (`mayManageTour`, στην υπηρεσία). Ιδεμποτία **φυσική**: ίδιες τιμές ⇒ `unchanged`, καμία
 * εγγραφή — μια επανάληψη δικτύου δεν αλλάζει τίποτα (CHECK 3.92).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { SPATIAL_TOUR_LIFECYCLES, SPATIAL_TOUR_VISIBILITIES } from '@/constants/spatial-tour-vocabulary';
import { readJsonBody } from '@/lib/api/json-body';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit, withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { readManagedTourSettings, updateTourSettings, type TourSettings } from '@/server/spatial-tour/tour-settings';

import {
  readTourSubject,
  tourActorOf,
  tourBadSubjectResponse,
  tourRefusedResponse,
  tourSubjectResponse,
  type TourBadSubjectBody,
  type TourRefusedBody,
  type TourSegment,
} from '../../../_shared/tour-route';

export const dynamic = 'force-dynamic';

const settingsSchema = z.object({
  visibility: z.enum(SPATIAL_TOUR_VISIBILITIES),
  lifecycle: z.enum(SPATIAL_TOUR_LIFECYCLES),
});

type Failure = TourBadSubjectBody | TourRefusedBody;
type ReadResponse = { readonly tourId: string; readonly settings: TourSettings; readonly exists: boolean } | Failure;
type UpdateResponse = { readonly settings: TourSettings; readonly changed: boolean } | Failure;

function readHandler(_request: NextRequest, actor: ApiActor, segment?: TourSegment): Promise<NextResponse<ReadResponse>> {
  return tourSubjectResponse(segment, actor, readManagedTourSettings, (read) => ({ tourId: read.tourId, settings: read.settings, exists: read.exists }));
}

async function updateHandler(request: NextRequest, actor: ApiActor, segment?: TourSegment): Promise<NextResponse<UpdateResponse>> {
  const subject = await readTourSubject(segment);
  if (subject === null) return tourBadSubjectResponse();
  const parsed = await readJsonBody(request, settingsSchema);
  if ('rejected' in parsed) return parsed.rejected;
  const outcome = await updateTourSettings(getAdminFirestore(), { subject, actor: tourActorOf(actor), settings: parsed.data });
  if (outcome.kind === 'refused') return tourRefusedResponse(outcome.reason);
  return NextResponse.json({ settings: outcome.settings, changed: outcome.kind === 'updated' });
}

export const GET = withStandardRateLimit<TourSegment>(withPersonalOrOrgAuth<ReadResponse, TourSegment>(readHandler));
export const PATCH = withSensitiveRateLimit<TourSegment>(
  withPersonalOrOrgAuth<UpdateResponse, TourSegment>(updateHandler, {
    idempotency: { mode: 'natural', why: 'Ίδιες ρυθμίσεις ⇒ `unchanged` χωρίς εγγραφή — η επανάληψη δεν αλλάζει τίποτα' },
  }),
);
