/**
 * @fileoverview **Η ΣΥΝΕΔΡΙΑ ΘΕΑΣΗΣ ΣΤΟ ΣΥΡΜΑ** — ένας σκελετός για τις δύο πόρτες (με/χωρίς λογαριασμό) (ADR-884 Κ3β).
 * @related `server/spatial-tour/tour-view-session.ts` (η κρίση) · `view-session/route.ts` · `view-session/public/route.ts`
 * @module app/api/spatial-tours/_shared/tour-view-route
 *
 * 🔑 **Γιατί δύο πόρτες και όχι μία «προαιρετική ταυτότητα»**: οι πόρτες ταυτότητας είναι **κλειστό σύνολο**
 * (ADR-817 §5). Η **δημόσια** πόρτα δεν ρωτά **ποτέ** ποιος είσαι — κρίνει μόνο βάσεις που δεν χρειάζονται
 * λογαριασμό (`public` · `link`). Η **αυθεντικοποιημένη** προσθέτει `manager` και `request`. Καμία δεν «μαντεύει».
 *
 * 🔑 **Ο σύνδεσμος αποδεικνύεται από τον browser, όχι από το σώμα**: το `shareId` του σώματος μετρά **μόνο** αν ο
 * browser φέρει το κουπόνι επίσκεψης **αυτού** του συνδέσμου (δηλαδή άνοιξε το `/shared/[token]` με το διακριτικό).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/json-body';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type { TourActor } from '@/lib/spatial-tour/tour-authority';
import { requestHasShareAccessGrant } from '@/server/sharing/share-access-grant';
import { attachTourViewGrant, requestTourViewGrant } from '@/server/spatial-tour/tour-view-grant';
import { openTourViewSession, type TourManifest } from '@/server/spatial-tour/tour-view-session';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import type { TourViewBasis } from '@/constants/spatial-tour-vocabulary';

import {
  readTourSubject,
  tourBadSubjectResponse,
  tourRefusedResponse,
  tourUnavailableResponse,
  type TourBadSubjectBody,
  type TourRefusedBody,
  type TourSegment,
  type TourUnavailableBody,
} from './tour-route';

const sessionSchema = z.object({ shareId: z.string().min(1).max(128).nullable().optional() });

/** Ό,τι μαθαίνει η οθόνη θέασης — **ποτέ** το κουπόνι (ζει σε cookie `HttpOnly`). */
export interface TourViewSessionView {
  readonly basis: TourViewBasis;
  readonly manifest: TourManifest;
}

export type TourViewSessionResponse = TourViewSessionView | TourBadSubjectBody | TourRefusedBody | TourUnavailableBody;

/** **Άνοιξε επίσκεψη** — `actor: null` ⇒ δημόσια πόρτα (μόνο `public` · `link`). */
export async function respondTourViewSession(
  request: NextRequest,
  segment: TourSegment | undefined,
  actor: TourActor | null,
): Promise<NextResponse<TourViewSessionResponse>> {
  const subject = await readTourSubject(segment);
  if (subject === null) return tourBadSubjectResponse();
  const parsed = await readJsonBody(request, sessionSchema);
  if ('rejected' in parsed) return parsed.rejected;

  const claimedShareId = parsed.data.shareId ?? null;
  const openedShareId = claimedShareId !== null && requestHasShareAccessGrant(request, claimedShareId) ? claimedShareId : null;
  const tourId = enterpriseIdService.generateDeterministicSpatialTourId(subject.kind, subject.id);
  const outcome = await openTourViewSession(getAdminFirestore(), {
    subject, actor, openedShareId, presentedGrant: requestTourViewGrant(request, tourId), nowMs: Date.now(),
  });
  if (outcome.kind === 'refused') return tourRefusedResponse(outcome.reason);
  if (outcome.token === null) return tourUnavailableResponse();

  const response = NextResponse.json<TourViewSessionResponse>(
    { basis: outcome.grant.basis, manifest: outcome.manifest },
    { headers: { 'Cache-Control': 'no-store' } },
  );
  attachTourViewGrant(response, subject, outcome.grant.tourId, outcome.token);
  return response;
}
