/**
 * @fileoverview **GET /api/spatial-tours/{kind}/{subjectId}/captures** — οι λήψεις της περιήγησης («εισερχόμενα»).
 * @related ADR-884 §4.5 (Κ3α) · `listTourCaptures`
 * @module app/api/spatial-tours/[kind]/[subjectId]/captures/route
 *
 * 🔑 Ο υπεύθυνος βλέπει **όλες**· ο φωτογράφος **μόνο τις δικές του** — η κρίση ζει στην υπηρεσία, όχι εδώ.
 */

import type { NextRequest, NextResponse } from 'next/server';

import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { listTourCaptures } from '@/server/spatial-tour/tour-capture-list';
import type { TourCapture } from '@/types/spatial-tour';

import { tourSubjectResponse, type TourSegment, type TourSubjectBody } from '../../../_shared/tour-route';

export const dynamic = 'force-dynamic';

type ListResponse = TourSubjectBody<{ readonly captures: readonly TourCapture[]; readonly asManager: boolean }>;

function handler(_request: NextRequest, actor: ApiActor, segment?: TourSegment): Promise<NextResponse<ListResponse>> {
  return tourSubjectResponse(segment, actor, listTourCaptures, (listed) => ({ captures: listed.captures, asManager: listed.asManager }));
}

export const GET = withStandardRateLimit<TourSegment>(withPersonalOrOrgAuth<ListResponse, TourSegment>(handler));
