/**
 * @fileoverview **POST /api/spatial-tours/{kind}/{subjectId}/graph** — τοποθέτηση/αφαίρεση λήψης, βελάκι, αποσύνδεση, κάτοψη,
 * και (Γ3β) σχήματα χώρων + νοητές γραμμές· για νέο σχήμα η απάντηση φέρει το `createdId`.
 * @related ADR-884 Φ2β · §4.9 · `server/spatial-tour/tour-graph-write.ts` (η κρίση και η εγγραφή)
 * @module app/api/spatial-tours/[kind]/[subjectId]/graph/route
 *
 * 🔑 Μόνο ο υπεύθυνος (`locateManagedTour`, στην υπηρεσία). Ιδεμποτία στο **σύνορο** (`Idempotency-Key`, CHECK 3.92):
 * το «νέο σημείο» κόβει νέο id — μια επανάληψη δικτύου πρέπει να πάρει την **ίδια** απάντηση, όχι «ήδη τοποθετημένη».
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import {
  FLOOR_PLAN_DECLARABLE_SOURCES,
  TOUR_DECLARED_AREA_SOURCES,
  TOUR_SPACE_MAX_VERTICES,
  TOUR_SPACE_MIN_VERTICES,
  TOUR_SPACE_SOURCES,
} from '@/constants/spatial-tour-vocabulary';
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

/** Σημείο σε μέτρα κάτοψης — ίδιος φράχτης με τη θέση σημείου. */
const planXY = z.object({ x: z.number().finite().min(-1e6).max(1e6), y: z.number().finite().min(-1e6).max(1e6) });
/** Όνομα χώρου/σημείου — ίδιος φράχτης με την εντολή `name` (το «έγκυρο» το κρίνει το `normalizeTourRoom`). */
const roomInput = z.object({ types: z.array(z.string().max(32)).max(8), label: z.string().max(200).nullable() });
const spaceDraft = z.object({
  points: z.array(planXY).min(TOUR_SPACE_MIN_VERTICES).max(TOUR_SPACE_MAX_VERTICES),
  source: z.enum(TOUR_SPACE_SOURCES),
  room: roomInput.nullable(),
  declaredArea: z.object({ areaM2: z.number().finite().positive(), source: z.enum(TOUR_DECLARED_AREA_SOURCES) }).nullable(),
});

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
  // Εδώ μόνο φράχτης μεγέθους· το «έγκυρο χώρο» το κρίνει ΜΙΑ αρχή, το `normalizeTourRoom` (ίδια και στην ανάγνωση).
  z.object({ op: z.literal('name'), nodeId: id, room: roomInput.nullable() }),
  // ── Η κάτοψη (Φ2στ-β · §4.13): εδώ μόνο σχήμα και φράχτες· «ανήκει στο ακίνητο;», «πάνω στην κάτοψη;» τα κρίνουν ο
  //    κριτής κάτοψης και οι καθαρές (`tour-plan-prepare` · `tour-plan-edit`). ──
  z.object({
    op: z.literal('floorplan'),
    levelKey,
    plan: z.object({ fileId: id, source: z.enum(FLOOR_PLAN_DECLARABLE_SOURCES) }).nullable(),
  }),
  z.object({ op: z.literal('calibrate'), levelKey, metresPerPixel: z.number().finite().positive().max(1000).nullable() }),
  z.object({ op: z.literal('position'), nodeId: id, point: planXY.nullable() }),
  z.object({ op: z.literal('orient'), captureId: id, headingRad: z.number().finite().min(-4 * Math.PI).max(4 * Math.PI) }),
  // ── Τα σχήματα των χώρων (Φ2στ-γ Γ3β · §4.14): εδώ μόνο σχήμα και φράχτες μεγέθους· «πάνω στην κάτοψη;», «αυτοτέμνεται;»,
  //    «επικαλύπτει άλλον;» τα κρίνει ΜΙΑ αρχή, το `tour-space-edit.ts` — ο διακομιστής ξανακρίνει πάντα. ──
  z.object({ op: z.literal('space'), levelKey, spaceId: id.nullable(), space: spaceDraft }),
  z.object({ op: z.literal('unspace'), levelKey, spaceId: id }),
  z.object({ op: z.literal('separate'), levelKey, separationId: id.nullable(), a: planXY, b: planXY }),
  z.object({ op: z.literal('unseparate'), levelKey, separationId: id }),
]);

type GraphResponse = TourGraphEditResponse | TourBadSubjectBody | TourRefusedBody;

async function handler(request: NextRequest, actor: ApiActor, segment?: TourSegment): Promise<NextResponse<GraphResponse>> {
  const subject = await readTourSubject(segment);
  if (subject === null) return tourBadSubjectResponse();
  const parsed = await readJsonBody(request, commandSchema);
  if ('rejected' in parsed) return parsed.rejected;
  const outcome = await writeTourGraph(getAdminFirestore(), { subject, actor: tourActorOf(actor), command: parsed.data });
  if (outcome.kind === 'refused') return tourRefusedResponse(outcome.reason);
  return NextResponse.json({
    changed: outcome.kind === 'written',
    revision: outcome.revision,
    ...(outcome.createdId === undefined ? {} : { createdId: outcome.createdId }),
  });
}

export const POST = withSensitiveRateLimit<TourSegment>(withPersonalOrOrgAuth<GraphResponse, TourSegment>(handler));
