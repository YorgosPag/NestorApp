/**
 * @fileoverview **GET /api/spatial-tours/capture-targets** — σε ποια ακίνητα μπορεί να ανεβάσει λήψεις ο συνδεδεμένος.
 * @related ADR-904 §3.2 Κ7 · συμβόλαιο 1.1.0 `listCaptureTargets` · `server/spatial-tour/tour-capture-targets.ts`
 * @module app/api/spatial-tours/capture-targets/route
 *
 * 🔑 Το σημείο εκκίνησης της εφαρμογής λήψης: υπεύθυνος **και** φωτογράφος (που **δεν** είναι μέλος χώρου) —
 * `withPersonalOrOrgAuth`. Η κρίση ζει στην υπηρεσία· εδώ μόνο το query (το **ίδιο** σχήμα με το συμβόλαιο) και ο δρομέας.
 *
 * 🔴 Χαλασμένο `pageToken` ⇒ **400** `MALFORMED_QUERY` — ποτέ «πρώτη σελίδα» σιωπηλά (θα έδειχνε διπλά ακίνητα).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { CaptureTargetsQuerySchema } from '@/contracts/capture-api/capture-api-schemas';
import { decodeChainPosition } from '@/lib/api/chained-pages';
import { malformedResponse, type MalformedRequestBody } from '@/lib/api/malformed-request';
import { readQueryParams } from '@/lib/api/query-params';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getErrorMessage } from '@/lib/error-utils';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import {
  CAPTURE_TARGET_SOURCES,
  captureTargetsPageSize,
  listCaptureTargets,
  type CaptureTargetsPage,
} from '@/server/spatial-tour/tour-capture-targets';

import { tourActorOf, tourUnavailableResponse, type TourUnavailableBody } from '../_shared/tour-route';

export const dynamic = 'force-dynamic';

const logger = createModuleLogger('CaptureTargetsRoute');

type CaptureTargetsResponse = CaptureTargetsPage | MalformedRequestBody | TourUnavailableBody;

async function handler(request: NextRequest, actor: ApiActor): Promise<NextResponse<CaptureTargetsResponse>> {
  const query = readQueryParams(request, CaptureTargetsQuerySchema);
  if ('rejected' in query) return query.rejected;
  const { pageToken, pageSize } = query.data;
  const from = pageToken === undefined ? null : decodeChainPosition(pageToken, CAPTURE_TARGET_SOURCES);
  if (pageToken !== undefined && from === null) return malformedResponse('MALFORMED_QUERY', [{ path: ['pageToken'] }]);
  try {
    const page = await listCaptureTargets(getAdminFirestore(), {
      actor: tourActorOf(actor), from, pageSize: captureTargetsPageSize(pageSize),
    });
    return NextResponse.json(page, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logger.error('Ο κατάλογος «τα ακίνητά μου» δεν ολοκληρώθηκε', { uid: actor.ctx.uid, error: getErrorMessage(error) });
    return tourUnavailableResponse();
  }
}

export const GET = withStandardRateLimit(withPersonalOrOrgAuth<CaptureTargetsResponse>(handler));
