/**
 * @fileoverview **Η ΡΟΗ ΕΝΟΣ ΜΕΣΟΥ ΠΕΡΙΗΓΗΣΗΣ** — από τον ιδιωτικό κάδο στην απάντηση: `ETag`/`304`, `Range`/`206`/`416`,
 * κρυφή μνήμη `private, immutable` (ADR-884 Φ0.4 · ADR-904 Κ9).
 * @related `media/[...path]/route.ts` (πλακίδια, με κουπόνι θέασης) · `capture-plans/[contentHash]/route.ts` (κάτοψη για τη λήψη,
 *   με ταυτότητα) · `lib/storage/storage-object-stream.ts` (ο ΕΝΑΣ τρόπος ανοίγματος)
 * @module app/api/spatial-tours/_shared/tour-media-response
 *
 * 🔑 **Ένας σερβιτόρος, δύο πόρτες**: η **κρίση** διαφέρει (HMAC ανά πλακίδιο · κριτής ανεβάσματος για την κάτοψη), η **ροή**
 *   όχι. Η διαδρομή φέρει πάντα **hash** περιεχομένου ⇒ νέα έκδοση = νέο URL ⇒ `immutable` είναι αληθές.
 * 🔒 `private` — ποτέ ενδιάμεση/CDN μνήμη: η πρόσβαση είναι ανά άνθρωπο.
 */

import { NextResponse, type NextRequest } from 'next/server';
import type { Bucket } from '@google-cloud/storage';

import { getErrorMessage } from '@/lib/error-utils';
import { openStorageObject, type StorageObjectStream } from '@/lib/storage/storage-object-stream';
import type { createModuleLogger } from '@/lib/telemetry';

const CACHE_CONTROL = 'private, max-age=86400, immutable';

/** Απάντηση χωρίς σώμα που **δεν** κρατιέται σε κρυφή μνήμη (άρνηση · ανύπαρκτο · σφάλμα). */
export function tourMediaStatus(code: number): NextResponse {
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

export interface TourMediaTarget {
  readonly objectPath: string;
  readonly bucket: Bucket;
  /** Τι γράφεται στο log αν η αποθήκευση δεν απαντήσει (ποτέ το περιεχόμενο). */
  readonly logContext: Readonly<Record<string, string>>;
}

/** **Σέρβιρε ένα αντικείμενο** του κάδου μέσων — η κρίση έχει ήδη γίνει από τον καλούντα. */
export async function serveTourMedia(
  request: NextRequest,
  target: TourMediaTarget,
  logger: ReturnType<typeof createModuleLogger>,
): Promise<NextResponse> {
  try {
    // Ένα ταξίδι ως τον κάδο (Φ2ε · §4.11): η κρυφή μνήμη των μέσων είναι ΔΙΚΗ μας (`CACHE_CONTROL`), όχι η αποθηκευμένη.
    const opened = await openStorageObject(target.objectPath, request.headers.get('range'), { singleRequest: true, bucket: target.bucket });
    if (opened.kind === 'absent') return tourMediaStatus(404);
    if (opened.kind === 'range-unsatisfiable') {
      return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${opened.totalSize}` } });
    }
    if (opened.etag !== null && request.headers.get('if-none-match') === opened.etag) {
      void opened.stream.cancel();
      return new NextResponse(null, { status: 304, headers: { ETag: opened.etag, 'Cache-Control': CACHE_CONTROL } });
    }
    return streamResponse(opened);
  } catch (error: unknown) {
    logger.error('Το μέσο περιήγησης δεν σερβιρίστηκε', { ...target.logContext, error: getErrorMessage(error) });
    return tourMediaStatus(503);
  }
}
