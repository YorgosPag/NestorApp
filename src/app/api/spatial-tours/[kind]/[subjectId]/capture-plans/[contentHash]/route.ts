/**
 * @fileoverview **GET /api/spatial-tours/{kind}/{subjectId}/capture-plans/{contentHash}** — η εικόνα της βαθμονομημένης κάτοψης
 * ενός ορόφου, για να πατήσει ο φωτογράφος το σημείο όπου στέκεται (ADR-904 Κ9 · Α8 · συμβόλαιο 1.3.0, `getCapturePlan`).
 * @related `server/spatial-tour/tour-capture-plan.ts` (ποιος και ποια) · `_shared/tour-media-response.ts` (η ροή) ·
 *   `CaptureLevel.calibratedPlan` (από πού έρχεται το hash)
 * @module app/api/spatial-tours/[kind]/[subjectId]/capture-plans/[contentHash]/route
 *
 * 🔑 **Ταυτότητα, όχι κουπόνι θέασης**: όπως όλο το συμβόλαιο λήψης (Bearer). Μία εικόνα ανά όροφο — η κρίση ανά αίτημα κοστίζει
 *   μία ανάγνωση, όχι εκατοντάδες όπως στα πλακίδια.
 * 🔑 **Αμετάβλητο ανά hash** ⇒ `private, immutable` + `ETag`: η εφαρμογή το κρατά για λήψη χωρίς σήμα· νέα κάτοψη = νέο hash.
 *   Παλιό hash ⇒ `TOUR_REFUSED` `plan-absent` (409): «η κάτοψη άλλαξε — ξαναζήτα τη λίστα».
 */

import type { NextRequest, NextResponse } from 'next/server';

import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getErrorMessage } from '@/lib/error-utils';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import { locateCapturePlan } from '@/server/spatial-tour/tour-capture-plan';

import { serveTourMedia } from '../../../../_shared/tour-media-response';
import {
  readTourSubjectWith,
  tourActorOf,
  tourBadSubjectResponse,
  tourRefusedResponse,
  tourUnavailableResponse,
} from '../../../../_shared/tour-route';

const logger = createModuleLogger('TOUR_CAPTURE_PLAN');

export const dynamic = 'force-dynamic';

type Segment = { params: Promise<{ kind: string; subjectId: string; contentHash: string }> };

async function handler(request: NextRequest, actor: ApiActor, segment?: Segment): Promise<NextResponse> {
  const read = await readTourSubjectWith(segment, 'contentHash');
  if (read === null) return tourBadSubjectResponse();
  let located: Awaited<ReturnType<typeof locateCapturePlan>>;
  try {
    located = await locateCapturePlan(getAdminFirestore(), { subject: read.subject, actor: tourActorOf(actor), contentHash: read.value });
  } catch (error: unknown) {
    logger.error('Η κάτοψη λήψης δεν κρίθηκε', { uid: actor.ctx.uid, error: getErrorMessage(error) });
    return tourUnavailableResponse();
  }
  if (located.kind === 'refused') return tourRefusedResponse(located.reason);
  return serveTourMedia(request, { objectPath: located.objectPath, bucket: located.bucket, logContext: { tourId: located.tourId } }, logger);
}

export const GET = withStandardRateLimit<Segment>(withPersonalOrOrgAuth<unknown, Segment>(handler));
