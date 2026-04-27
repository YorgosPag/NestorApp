/**
 * Storage Public Upload — SSoT for server-side uploads with browser-accessible URLs.
 *
 * # Why this exists
 *
 * Two earlier upload patterns broke on the new `*.firebasestorage.app` Firebase
 * Storage bucket:
 *   1. `bucket.file().makePublic()` + `https://storage.googleapis.com/{bucket}/{path}`
 *      — silently no-ops on UBLA-enabled buckets → 403 for anonymous reads.
 *   2. `firebaseStorageDownloadTokens` metadata + `firebasestorage.googleapis.com`
 *      token URL — Firebase Storage Rules still deny when tokens are written by
 *      Admin SDK (Firebase only honors tokens it generated server-side).
 *
 * # How this fixes it
 *
 * The file is uploaded privately. The returned URL is a **same-origin proxy**
 * (`/api/storage/file/{path}`) that re-streams the bytes after verifying:
 *   - User is authenticated (session cookie).
 *   - User's `companyId` claim matches the `companies/{companyId}/...` prefix
 *     of the storage path.
 *
 * Browser `<img src="…">` requests carry the auth cookie automatically, so the
 * URL "just works" inside the app while staying private to outsiders.
 *
 * # When NOT to use this
 *
 * - Files needed in unauthenticated emails (e.g. password-reset images)
 *   → use signed URLs with explicit expiry.
 * - Streaming a server-generated artifact you never want to persist
 *   → write directly to a `Response` body.
 *
 * @module services/storage-admin/public-upload.service
 * @see ADR-327 §6 (vendor logo extraction triggered the discovery)
 * @see src/app/api/storage/file/[...path]/route.ts (the proxy)
 */

import 'server-only';

import type { Bucket } from '@google-cloud/storage';
import { getAdminBucket } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';

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
}

export interface UploadPublicFileResult {
  /** Browser-accessible proxy URL (`/api/storage/file/{path}`) — auth-gated. */
  url: string;
  /** Storage path the file was written to. */
  storagePath: string;
  /** Bucket the file was written to. */
  bucket: string;
}

const DEFAULT_CACHE_CONTROL = 'private, max-age=86400';

/**
 * Upload a buffer and return a same-origin proxy URL that the browser can use.
 *
 * @throws Propagates errors from `Bucket.file().save()`. Caller decides
 *   whether to suppress (post-creation enrichment) or fail (primary flow).
 */
export async function uploadPublicFile(
  params: UploadPublicFileParams,
): Promise<UploadPublicFileResult> {
  const bucket = params.bucket ?? getAdminBucket();
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
    sizeBytes: params.buffer.length,
    contentType: params.contentType,
  });

  return { url, storagePath: params.storagePath, bucket: bucket.name };
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
