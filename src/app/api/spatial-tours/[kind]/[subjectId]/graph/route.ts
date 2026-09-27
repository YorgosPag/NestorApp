/**
 * @fileoverview **POST /api/spatial-tours/{kind}/{subjectId}/graph** — τοποθέτηση/αφαίρεση λήψης, βελάκι, αποσύνδεση.
 * @related ADR-884 Φ2β · §4.9 · `server/spatial-tour/tour-graph-write.ts` (η κρίση και η εγγραφή)
 * @module app/api/spatial-tours/[kind]/[subjectId]/graph/route
 *
 * 🔑 Μόνο ο υπεύθυνος (`locateManagedTour`, στην υπηρεσία). Ιδεμποτία στο **σύνορο** (`Idempotency-Key`, CHECK 3.92):
 * το «νέο σημείο» κόβει νέο id — μια επανάληψη δικτύου πρέπει να πάρει την **ίδια** απάντηση, όχι «ήδη τοποθετημένη».
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/json-body';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import type { TourGraphEditResponse } from '@/lib/spatial-tour/tour-graph-edit';
import { writeTourGraph } from '@/server/spatial-tour/tour-graph-write';

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

const id = z.string().min(1).max(128);
/** Διόπτευση κόσμου σε ακτίνια — `null` ⇒ μόνο στη λίστα. */
const bearing = z.number().finite().min(-2 * Math.PI).max(2 * Math.PI).nullable();
const levelKey = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('local'), ordinal: z.number().int().min(-5).max(200) }),
  z.object({ kind: z.literal('floor'), floorId: id }),
]);

const commandSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('place'),
    captureId: id,
    target: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('node'), nodeId: id }),
      z.object({ kind: z.literal('new-node'), levelKey, linkFrom: id.nullable() }),
    ]),
  }),
  z.object({ op: z.literal('unplace'), captureId: id }),
  z.object({ op: z.literal('link'), fromNodeId: id, toNodeId: id, bearingRad: bearing }),
  z.object({ op: z.literal('unlink'), fromNodeId: id, toNodeId: id }),
]);

type GraphResponse = TourGraphEditResponse | TourBadSubjectBody | TourRefusedBody;

async function handler(request: NextRequest, actor: ApiActor, segment?: TourSegment): Promise<NextResponse<GraphResponse>> {
  const subject = await readTourSubject(segment);
  if (subject === null) return tourBadSubjectResponse();
  const parsed = await readJsonBody(request, commandSchema);
  if ('rejected' in parsed) return parsed.rejected;
  const outcome = await writeTourGraph(getAdminFirestore(), { subject, actor: tourActorOf(actor), command: parsed.data });
  if (outcome.kind === 'refused') return tourRefusedResponse(outcome.reason);
  return NextResponse.json({ changed: outcome.kind === 'written', revision: outcome.revision });
}

export const POST = withSensitiveRateLimit<TourSegment>(withPersonalOrOrgAuth<GraphResponse, TourSegment>(handler));
