/**
 * Storage Public Upload — SSoT for server-side uploads with browser-accessible URLs.
 *
 * # Why this exists
 *
 * Three earlier upload patterns broke in this project:
 *   1. `bucket.file().makePublic()` + `https://storage.googleapis.com/{bucket}/{path}`
 *      — silently no-ops on UBLA-enabled buckets → 403 for anonymous reads.
 *   2. `firebaseStorageDownloadTokens` metadata + `firebasestorage.googleapis.com`
 *      token URL — Firebase Storage Rules still deny when tokens are written by
 *      Admin SDK (Firebase only honors tokens it generated server-side).
 *   3. Plain Admin-SDK upload — the `onStorageFinalize` Cloud Function
 *      (`functions/src/storage/orphan-cleanup.ts`) deletes any object whose
 *      `fileId` (last path segment minus extension) is not claimed in
 *      `FILES` or `FILE_SHARES`. Logos and quote PDFs were being soft-deleted
 *      ~2 s after upload.
 *
 * # How this fixes it
 *
 * - **Pre-claim**: a minimal `FILES/{fileId}` document is written *before*
 *   the GCS upload, so the orphan-cleanup function always finds an
 *   ownership claim by the time it fires. The pre-claim wins the race
 *   against `onFinalize` (which fires hundreds of milliseconds after save).
 * - **Auth-gated proxy URL**: the file is uploaded privately. The returned
 *   URL is `/api/storage/file/{path}` — same-origin, requires the user's
 *   session cookie + a `companyId` match against the path prefix.
 *
 * Browser `<img src="…">` requests carry the auth cookie automatically, so the
 * URL "just works" inside the app while staying private to outsiders.
 *
 * # When NOT to use this
 *
 * - Files needed in unauthenticated contexts (e.g. password-reset emails)
 *   → use signed URLs with explicit expiry.
 * - Streaming a server-generated artifact you never want to persist
 *   → write directly to a `Response` body.
 *
 * @module services/storage-admin/public-upload.service
 * @see ADR-327 §6 (vendor logo extraction triggered the discovery)
 * @see src/app/api/storage/file/[...path]/route.ts (the proxy)
 * @see functions/src/storage/orphan-cleanup.ts (the deleter we race against)
 * @see functions/src/shared/file-ownership-resolver.ts (claim providers)
 */

import 'server-only';

import type { Bucket } from '@google-cloud/storage';
import { getAdminBucket, getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('StoragePublicUpload');

export interface UploadPublicFileParams {
  /** Full storage path (e.g. result of `buildStoragePath(...)`). */
  storagePath: string;
  /** File contents. */
  buffer: Buffer;
  /** MIME type (e.g. `image/png`). */
  contentType: string;
  /** HTTP `Cache-Control` header value applied at the proxy. Defaults to `private, max-age=86400`. */
  cacheControl?: string;
  /** Extra GCS custom-metadata fields (server-side only — not exposed to clients). */
  customMetadata?: Record<string, string>;
  /**
   * Override the bucket. Defaults to `getAdminBucket()` (canonical
   * `FIREBASE_STORAGE_BUCKET`).
   */
  bucket?: Bucket;
  /**
   * Identifier of the user/system writing the file. Stored in the FILES
   * claim doc for audit. Defaults to `'system'`.
   */
  createdBy?: string;
}

export interface UploadPublicFileResult {
  /** Browser-accessible proxy URL (`/api/storage/file/{path}`) — auth-gated. */
  url: string;
  /** Storage path the file was written to. */
  storagePath: string;
  /** Bucket the file was written to. */
  bucket: string;
  /** FILES doc id used as orphan-cleanup claim (last path segment minus extension). */
  fileId: string;
}

const DEFAULT_CACHE_CONTROL = 'private, max-age=86400';

/**
 * Extract the `fileId` the orphan-cleanup function uses (last path segment
 * minus extension) — must mirror `functions/src/storage/orphan-cleanup.ts`.
 */
export function extractFileIdFromStoragePath(storagePath: string): string {
  const fileName = storagePath.split('/').pop() ?? storagePath;
  const dotIdx = fileName.lastIndexOf('.');
  return dotIdx > 0 ? fileName.slice(0, dotIdx) : fileName;
}

/**
 * Upload a buffer and return a same-origin proxy URL that the browser can use.
 *
 * Writes a `FILES/{fileId}` claim doc *before* the GCS upload to win the race
 * against the `onStorageFinalize` orphan-cleanup function. If the claim write
 * fails the upload is aborted — without a claim the file would be deleted.
 *
 * @throws Propagates errors from the claim write or `Bucket.file().save()`.
 *   Caller decides whether to suppress (post-creation enrichment) or fail
 *   (primary flow).
 */
export async function uploadPublicFile(
  params: UploadPublicFileParams,
): Promise<UploadPublicFileResult> {
  const bucket = params.bucket ?? getAdminBucket();
  const fileId = extractFileIdFromStoragePath(params.storagePath);

  await writeOrphanClaim({
    fileId,
    storagePath: params.storagePath,
    bucketName: bucket.name,
    contentType: params.contentType,
    sizeBytes: params.buffer.length,
    createdBy: params.createdBy ?? 'system',
  });

  const fileRef = bucket.file(params.storagePath);
  await fileRef.save(params.buffer, {
    metadata: {
      contentType: params.contentType,
      cacheControl: params.cacheControl ?? DEFAULT_CACHE_CONTROL,
      ...(params.customMetadata && Object.keys(params.customMetadata).length > 0
        ? { metadata: params.customMetadata }
        : {}),
    },
  });

  const url = buildProxyUrl(params.storagePath);
  logger.info('File uploaded', {
    bucket: bucket.name,
    storagePath: params.storagePath,
    fileId,
    sizeBytes: params.buffer.length,
    contentType: params.contentType,
  });
  return { url, storagePath: params.storagePath, bucket: bucket.name, fileId };
}

/**
 * Build the same-origin proxy URL for a stored file. Exported so the proxy
 * route's tests and any URL-construction helpers stay aligned with the
 * canonical scheme.
 */
export function buildProxyUrl(storagePath: string): string {
  const encoded = storagePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `/api/storage/file/${encoded}`;
}

/**
 * Write the minimal `FILES/{fileId}` document the orphan-cleanup resolver
 * checks (`functions/shared/file-ownership-resolver.ts::OWNERSHIP_CLAIM_PROVIDERS`).
 * Uses `set({ merge: true })` so re-uploads of the same artifact (e.g. a
 * deterministic per-entity id like `vlogo_{quoteId}`) refresh the claim
 * metadata in place instead of creating duplicates or failing. Callers MUST
 * derive `fileId` from `enterprise-id.service` (CLAUDE.md N.6) — never use
 * literal hardcoded ids.
 */
async function writeOrphanClaim(args: {
  fileId: string;
  storagePath: string;
  bucketName: string;
  contentType: string;
  sizeBytes: number;
  createdBy: string;
}): Promise<void> {
  try {
    const db = getAdminFirestore();
    await db.collection(COLLECTIONS.FILES).doc(args.fileId).set(
      {
        id: args.fileId,
        storagePath: args.storagePath,
        bucket: args.bucketName,
        contentType: args.contentType,
        sizeBytes: args.sizeBytes,
        status: 'active',
        isDeleted: false,
        createdBy: args.createdBy,
        claimSource: 'storage-public-upload',
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (err) {
    logger.error('Orphan-cleanup claim write FAILED — aborting upload to avoid soft-delete', {
      fileId: args.fileId,
      storagePath: args.storagePath,
      error: getErrorMessage(err),
    });
    throw err;
  }
}
