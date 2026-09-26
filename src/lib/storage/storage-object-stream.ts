import 'server-only';

/**
 * @fileoverview **Ένα αντικείμενο του κάδου ως ροή HTTP** — ο ΕΝΑΣ τρόπος (ADR-884 Κ3β · N.0.2).
 * @module lib/storage/storage-object-stream
 *
 * 🔴 **Γιατί υπάρχει**: η μετατροπή `createReadStream()` → `ReadableStream` ήταν γραμμένη **δύο φορές**
 * (`app/api/storage/file/[...path]` · `app/api/showcase/shared-pdf-proxy-helpers`), και η τρίτη (μέσα περιήγησης)
 * θα χρειαζόταν και `Range` — δηλαδή θα απέκλινε. Εδώ ζει μία φορά, με:
 * - **απουσία ≠ βλάβη**: `absent` μόνο για 404 του GCS (το `exists()` είναι αναξιόπιστο σε κάδους
 *   `.firebasestorage.app` — το `getMetadata` δίνει δομημένο 404)·
 * - **`Range: bytes=a-b`** (RFC 9110 §14): ένα εύρος, `206` + `Content-Range`· άκυρο/ανικανοποίητο ⇒ `416`·
 * - **`ETag`** από τη γενιά του αντικειμένου — ο browser επαναχρησιμοποιεί ό,τι έχει.
 */

import { getAdminBucket } from '@/lib/firebaseAdmin';

export interface StorageObjectRange {
  readonly start: number;
  readonly end: number;
}

export type StorageObjectStream =
  | {
      readonly kind: 'found';
      readonly stream: ReadableStream<Uint8Array>;
      readonly contentType: string;
      /** Όσα bytes στέλνονται (ολόκληρο ή το εύρος). */
      readonly contentLength: number | null;
      readonly totalSize: number | null;
      /** Το εύρος που σερβίρεται — `null` ⇒ ολόκληρο (`200`). */
      readonly range: StorageObjectRange | null;
      readonly etag: string | null;
      readonly storedCacheControl: string | null;
    }
  | { readonly kind: 'absent' }
  | { readonly kind: 'range-unsatisfiable'; readonly totalSize: number };

/** `bytes=a-b` · `bytes=a-` · `bytes=-n` — ένα εύρος μόνο· οτιδήποτε άλλο ⇒ `null` (αγνοείται, `200`). */
export function parseByteRange(header: string | null, totalSize: number): StorageObjectRange | 'unsatisfiable' | null {
  const match = header === null ? null : /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (match === null) return null;
  const [, from, to] = match;
  if (from === '' && to === '') return null;
  if (from === '') {
    const suffix = Number(to);
    if (suffix === 0) return 'unsatisfiable';
    return { start: Math.max(0, totalSize - suffix), end: totalSize - 1 };
  }
  const start = Number(from);
  const end = to === '' ? totalSize - 1 : Math.min(Number(to), totalSize - 1);
  return start >= totalSize || start > end ? 'unsatisfiable' : { start, end };
}

function toWebStream(nodeStream: NodeJS.ReadableStream & { destroy(): void }): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      nodeStream.on('end', () => controller.close());
      nodeStream.on('error', (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}

function sizeOf(raw: unknown): number | null {
  const size = typeof raw === 'string' ? Number(raw) : raw;
  return typeof size === 'number' && Number.isFinite(size) ? size : null;
}

/** **Άνοιξε το αντικείμενο** — προαιρετικά με κεφαλίδα `Range`. Πετά μόνο σε βλάβη (όχι σε απουσία). */
export async function openStorageObject(path: string, rangeHeader: string | null = null): Promise<StorageObjectStream> {
  const file = getAdminBucket().file(path);
  let metadata: Awaited<ReturnType<typeof file.getMetadata>>[0];
  try {
    [metadata] = await file.getMetadata();
  } catch (error) {
    if ((error as { code?: number }).code === 404) return { kind: 'absent' };
    throw error;
  }
  const totalSize = sizeOf(metadata.size);
  const parsed = totalSize === null ? null : parseByteRange(rangeHeader, totalSize);
  if (parsed === 'unsatisfiable' && totalSize !== null) return { kind: 'range-unsatisfiable', totalSize };
  const range = parsed === 'unsatisfiable' ? null : parsed;
  const stream = toWebStream(range === null ? file.createReadStream() : file.createReadStream(range));
  return {
    kind: 'found',
    stream,
    contentType: (metadata.contentType as string | undefined) ?? 'application/octet-stream',
    contentLength: range === null ? totalSize : range.end - range.start + 1,
    totalSize,
    range,
    etag: metadata.generation === undefined ? null : `"${String(metadata.generation)}"`,
    storedCacheControl: (metadata.cacheControl as string | undefined) ?? null,
  };
}
