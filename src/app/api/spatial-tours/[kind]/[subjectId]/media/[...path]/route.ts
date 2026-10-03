/**
 * @fileoverview **GET /api/spatial-tours/{kind}/{subjectId}/media/{...path}** — τα πλακίδια μιας περιήγησης, από τον
 * **ιδιωτικό** κάδο, με **μόνο** έλεγχο υπογραφής (ADR-884 Φ0.4 · Κ3β).
 * @related `server/spatial-tour/tour-view-grant.ts` (το κουπόνι) · `lib/spatial-tour/tour-media-path.ts` (η διαδρομή) ·
 *   `lib/storage/storage-object-stream.ts` (η ροή — ο ΕΝΑΣ τρόπος)
 * @module app/api/spatial-tours/[kind]/[subjectId]/media/[...path]/route
 *
 * 🏆 **Πιο έξυπνο από τον Matterport**: **καμία** ανάγνωση Firestore ανά πλακίδιο — ένα πανόραμα είναι εκατοντάδες
 * αιτήματα. Η κρίση έγινε **μία** φορά στη συνεδρία θέασης· εδώ μόνο HMAC. Ανάκληση ⇒ κανένα νέο κουπόνι, το
 * τρέχον λήγει σε ≤ 15′.
 *
 * 🔑 **Κρυφή μνήμη**: `private` (ποτέ ενδιάμεση/CDN — η πρόσβαση είναι ανά άνθρωπο) + `immutable`, γιατί η διαδρομή
 * φέρει το **hash** του tileset (`TourManifestStop.tilesetHash`): νέα έκδοση = νέο URL. `ETag` + `Range` για τα
 * μεγάλα μέσα.
 *
 * 🔒 **Χωρίς ταυτότητα, επίτηδες**: η απόδειξη είναι το κουπόνι (cookie `HttpOnly`, `Path` = αυτή η ρίζα). Όριο
 * ρυθμού `ASSET` (600/λεπτό) — το `STANDARD` θα έσπαγε μια κανονική προβολή.
 */

import type { NextRequest, NextResponse } from 'next/server';

import { isPlaceSource } from '@/constants/place-sources';
import { withAssetRateLimit } from '@/lib/middleware/with-rate-limit';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { tourMediaObjectPath } from '@/lib/spatial-tour/tour-media-path';
import { createModuleLogger } from '@/lib/telemetry';
import { tourMediaBucket } from '@/server/spatial-tour/tour-media-store';
import { requestTourViewGrant } from '@/server/spatial-tour/tour-view-grant';
import { enterpriseIdService } from '@/services/enterprise-id.service';

import { serveTourMedia, tourMediaStatus as status } from '../../../../_shared/tour-media-response';

const logger = createModuleLogger('TOUR_MEDIA');

export const dynamic = 'force-dynamic';

type Segment = { params: Promise<{ kind: string; subjectId: string; path: string[] }> };

async function handleGet(request: NextRequest, segment?: Segment): Promise<NextResponse> {
  const params = segment ? await segment.params : null;
  const kind = decodeRouteParam(params?.kind ?? '');
  const subjectId = decodeRouteParam(params?.subjectId ?? '').trim();
  if (!isPlaceSource(kind) || subjectId === '') return status(400);

  const tourId = enterpriseIdService.generateDeterministicSpatialTourId(kind, subjectId);
  const grant = requestTourViewGrant(request, tourId);
  if (grant === null) return status(401);
  const objectPath = tourMediaObjectPath(tourId, (params?.path ?? []).map(decodeRouteParam));
  if (objectPath === null) return status(400);
  // Ο κάδος από την υπογεγραμμένη άδεια (ζ5) — καμία ανάγνωση βάσης ανά πλακίδιο, κανένα «δοκίμασε και τον άλλον».
  return serveTourMedia(request, { objectPath, bucket: tourMediaBucket(grant.mediaPlacement), logContext: { tourId } }, logger);
}

export const GET = withAssetRateLimit<Segment>(handleGet);
