/**
 * @fileoverview **GET /api/spatial-tours/{kind}/{subjectId}/capture-grants** — ποιοι φωτογράφοι έχουν (ή είχαν) άδεια.
 * @related ADR-884 Φ0.5 · §4.5 (Κ3α) · `listTourCaptureGrants`
 * @module app/api/spatial-tours/[kind]/[subjectId]/capture-grants/route
 *
 * 🔑 Και οι ληγμένες/ανακλημένες, με την κατάστασή τους **τώρα** (παράγεται — δεν αποθηκεύεται): ο υπεύθυνος
 * πρέπει να δει «έληξε» για να ξαναπροσκαλέσει.
 */

import type { NextRequest, NextResponse } from 'next/server';

import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { listTourCaptureGrants, type TourCaptureGrantView } from '@/server/spatial-tour/tour-capture-invitation';

import { tourSubjectResponse, type TourSegment, type TourSubjectBody } from '../../../_shared/tour-route';

export const dynamic = 'force-dynamic';

type ListResponse = TourSubjectBody<{ readonly grants: readonly TourCaptureGrantView[] }>;

function handler(_request: NextRequest, actor: ApiActor, segment?: TourSegment): Promise<NextResponse<ListResponse>> {
  return tourSubjectResponse(segment, actor, listTourCaptureGrants, (listed) => ({ grants: listed.grants }));
}

export const GET = withSensitiveRateLimit<TourSegment>(withPersonalOrOrgAuth<ListResponse, TourSegment>(handler));
