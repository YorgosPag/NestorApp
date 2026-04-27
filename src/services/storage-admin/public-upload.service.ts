/**
 * Public Storage Upload — SSoT for server-side publicly accessible uploads.
 *
 * # Why this exists
 *
 * `bucket.file().makePublic()` from the Firebase Admin SDK silently no-ops on
 * Uniform Bucket-Level Access (UBLA) buckets — the default for the new
 * `*.firebasestorage.app` Firebase Storage bucket. Direct
 * `https://storage.googleapis.com/{bucket}/{path}` URLs return 403 for
 * unauthenticated requests when the object lacks a `publicRead` ACL, which is
 * always the case under UBLA.
 *
 * # How this fixes it
 *
 * Uses Firebase Storage **download tokens** — the same mechanism client-side
 * `getDownloadURL()` uses. A token is stored in object metadata under
 * `firebaseStorageDownloadTokens`; any holder of that token can download the
 * file via the Firebase Storage REST API (`firebasestorage.googleapis.com`)
 * regardless of bucket ACLs or UBLA.
 *
 * Tokens are persistent (no expiry), bypass Firebase Storage security rules,
 * and work uniformly on legacy `*.appspot.com` and new `*.firebasestorage.app`
 * buckets.
 *
 * # When NOT to use this
 *
 * - Files that must remain private behind auth → use `getAdminBucket().file()`
 *   directly + a server-side proxy route (see
 *   `src/app/api/showcase/shared-pdf-proxy-helpers.ts`).
 * - Client-side browser uploads → use Firebase Storage SDK
 *   (`uploadBytesResumable` + `getDownloadURL`).
 *
 * @module services/storage-admin/public-upload.service
 * @see ADR-327 §6 (vendor logo extraction triggered the discovery)
 */

import 'server-only';

import { randomUUID } from 'node:crypto';
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
  /** HTTP `Cache-Control` header value. Defaults to `public, max-age=86400`. */
  cacheControl?: string;
  /** Extra custom metadata fields stored alongside the download token. */
  customMetadata?: Record<string, string>;
  /**
   * Override the bucket. Defaults to `getAdminBucket()` (canonical
   * `FIREBASE_STORAGE_BUCKET`). Pass `getAdminStorage().bucket()` to target
   * the legacy default bucket instead.
   */
  bucket?: Bucket;
}

export interface UploadPublicFileResult {
  /** Token-based public URL (`firebasestorage.googleapis.com/v0/b/.../o/...?alt=media&token=...`). */
  url: string;
  /** Storage path the file was written to. */
  storagePath: string;
  /** Bucket the file was written to. */
  bucket: string;
}

const DEFAULT_CACHE_CONTROL = 'public, max-age=86400';

/**
 * Upload a buffer and return a public URL accessible without auth.
 *
 * @throws Propagates errors from `Bucket.file().save()`. Caller decides
 *   whether to suppress (post-creation enrichment) or fail (primary flow).
 */
export async function uploadPublicFile(
  params: UploadPublicFileParams,
): Promise<UploadPublicFileResult> {
  const bucket = params.bucket ?? getAdminBucket();
  const fileRef = bucket.file(params.storagePath);
  const downloadToken = randomUUID();

  await fileRef.save(params.buffer, {
    metadata: {
      contentType: params.contentType,
      cacheControl: params.cacheControl ?? DEFAULT_CACHE_CONTROL,
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
        ...params.customMetadata,
      },
    },
  });

  const encodedPath = encodeURIComponent(params.storagePath);
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;

  logger.info('Public file uploaded', {
    bucket: bucket.name,
    storagePath: params.storagePath,
    sizeBytes: params.buffer.length,
    contentType: params.contentType,
  });

  return { url, storagePath: params.storagePath, bucket: bucket.name };
}
