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

import { NextResponse, type NextRequest } from 'next/server';

import { isPlaceSource } from '@/constants/place-sources';
import { getErrorMessage } from '@/lib/error-utils';
import { withAssetRateLimit } from '@/lib/middleware/with-rate-limit';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { tourMediaObjectPath } from '@/lib/spatial-tour/tour-media-path';
import { openStorageObject, type StorageObjectStream } from '@/lib/storage/storage-object-stream';
import { createModuleLogger } from '@/lib/telemetry';
import { requestTourViewGrant } from '@/server/spatial-tour/tour-view-grant';
import { enterpriseIdService } from '@/services/enterprise-id.service';

const logger = createModuleLogger('TOUR_MEDIA');

export const dynamic = 'force-dynamic';

type Segment = { params: Promise<{ kind: string; subjectId: string; path: string[] }> };

const CACHE_CONTROL = 'private, max-age=86400, immutable';

function status(code: number): NextResponse {
  return new NextResponse(null, { status: code, headers: { 'Cache-Control': 'no-store' } });
}

function streamResponse(opened: Extract<StorageObjectStream, { kind: 'found' }>): NextResponse {
  const headers = new Headers({ 'Content-Type': opened.contentType, 'Cache-Control': CACHE_CONTROL, 'Accept-Ranges': 'bytes' });
  if (opened.etag !== null) headers.set('ETag', opened.etag);
  if (opened.contentLength !== null) headers.set('Content-Length', String(opened.contentLength));
  if (opened.range !== null && opened.totalSize !== null) {
    headers.set('Content-Range', `bytes ${opened.range.start}-${opened.range.end}/${opened.totalSize}`);
  }
  return new NextResponse(opened.stream, { status: opened.range === null ? 200 : 206, headers });
}

async function handleGet(request: NextRequest, segment?: Segment): Promise<NextResponse> {
  const params = segment ? await segment.params : null;
  const kind = decodeRouteParam(params?.kind ?? '');
  const subjectId = decodeRouteParam(params?.subjectId ?? '').trim();
  if (!isPlaceSource(kind) || subjectId === '') return status(400);

  const tourId = enterpriseIdService.generateDeterministicSpatialTourId(kind, subjectId);
  if (requestTourViewGrant(request, tourId) === null) return status(401);
  const objectPath = tourMediaObjectPath(tourId, (params?.path ?? []).map(decodeRouteParam));
  if (objectPath === null) return status(400);

  try {
    const opened = await openStorageObject(objectPath, request.headers.get('range'));
    if (opened.kind === 'absent') return status(404);
    if (opened.kind === 'range-unsatisfiable') {
      return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${opened.totalSize}` } });
    }
    if (opened.etag !== null && request.headers.get('if-none-match') === opened.etag) {
      void opened.stream.cancel();
      return new NextResponse(null, { status: 304, headers: { ETag: opened.etag, 'Cache-Control': CACHE_CONTROL } });
    }
    return streamResponse(opened);
  } catch (error: unknown) {
    logger.error('Το μέσο περιήγησης δεν σερβιρίστηκε', { tourId, error: getErrorMessage(error) });
    return status(503);
  }
}

export const GET = withAssetRateLimit<Segment>(handleGet);
