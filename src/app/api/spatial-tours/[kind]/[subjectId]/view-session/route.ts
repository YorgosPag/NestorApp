/**
 * @fileoverview **POST /api/spatial-tours/{kind}/{subjectId}/view-session** — επίσκεψη **με** λογαριασμό: ο υπεύθυνος
 * (`manager`), ο εγκεκριμένος αιτών (`request`) — και ό,τι βλέπει κάθε επισκέπτης (`public` · `link`).
 * @related ADR-884 Κ3β · Φ0.4 · `_shared/tour-view-route.ts` (ο σκελετός) · `view-session/public` (η πόρτα χωρίς λογαριασμό)
 * @module app/api/spatial-tours/[kind]/[subjectId]/view-session/route
 *
 * 🔑 Ιδεμποτία **φυσική**: μία επίσκεψη μετρά **μία** φορά — το κουπόνι 15′ που φέρει ήδη ο browser είναι ο
 * αποδιπλασιαστής (`isNewVisit`)· η επανάληψη ξαναεκδίδει κουπόνι χωρίς νέα μέτρηση (CHECK 3.92).
 */

import type { NextRequest } from 'next/server';

import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

import { tourActorOf, type TourSegment } from '../../../_shared/tour-route';
import { respondTourViewSession, type TourViewSessionResponse } from '../../../_shared/tour-view-route';

export const dynamic = 'force-dynamic';

function handler(request: NextRequest, actor: ApiActor, segment?: TourSegment) {
  return respondTourViewSession(request, segment, tourActorOf(actor));
}

export const POST = withStandardRateLimit<TourSegment>(
  withPersonalOrOrgAuth<TourViewSessionResponse, TourSegment>(handler, {
    idempotency: { mode: 'natural', why: 'Το κουπόνι 15′ του browser αποδιπλασιάζει την επίσκεψη — η επανάληψη δεν ξαναμετρά' },
  }),
);
