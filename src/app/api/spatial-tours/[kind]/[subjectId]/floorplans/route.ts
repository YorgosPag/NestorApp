/**
 * @fileoverview **GET /api/spatial-tours/{kind}/{subjectId}/floorplans** — οι κατόψεις του ακινήτου που μπορεί να πάρει η
 * περιήγηση (ADR-884 Φ2στ-β · §4.13 · §12 Δ7.1).
 * @related `server/spatial-tour/tour-plan-files.ts` (ο ΕΝΑΣ κριτής — ο ίδιος κρίνει και την επιλογή στο `POST …/graph`)
 * @module app/api/spatial-tours/[kind]/[subjectId]/floorplans/route
 *
 * 🔑 Μόνο ο υπεύθυνος (`locateManagedTour`, στην υπηρεσία). Η οθόνη δείχνει **ακριβώς** ό,τι θα δεχτεί ο γραφέας.
 */

import type { NextRequest, NextResponse } from 'next/server';

import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import type { TourPlanCandidate } from '@/lib/spatial-tour/tour-graph-edit';
import { listTourPlanFilesForManager } from '@/server/spatial-tour/tour-plan-files';

import { tourSubjectResponse, type TourSegment, type TourSubjectBody } from '../../../_shared/tour-route';

export const dynamic = 'force-dynamic';

type PlansResponse = TourSubjectBody<{ readonly plans: readonly TourPlanCandidate[] }>;

function handler(_request: NextRequest, actor: ApiActor, segment?: TourSegment): Promise<NextResponse<PlansResponse>> {
  return tourSubjectResponse(segment, actor, listTourPlanFilesForManager, (listed) => ({ plans: listed.plans }));
}

export const GET = withStandardRateLimit<TourSegment>(withPersonalOrOrgAuth<PlansResponse, TourSegment>(handler));
