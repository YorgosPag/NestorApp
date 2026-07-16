/**
 * =============================================================================
 * FIREBASE ADMIN STORAGE — OBJECT DOWNLOAD (SSoT)
 * =============================================================================
 *
 * Reads objects out of the admin bucket given the public
 * `https://storage.googleapis.com/<bucket>/<path>` URL that the app stores on
 * documents. `getAdminBucket()` hands back a bare Bucket, so every caller was
 * re-deriving the same prefix-strip → decode → download idiom by hand.
 *
 * Server-only: holds admin credentials via `getAdminBucket()`. Callers holding
 * a *public/signed* URL with no admin rights want
 * `@/services/ai/openai-responses/download-file` instead.
 *
 * @module lib/firebaseAdmin-storage
 */

import 'server-only';
import { getAdminBucket } from '@/lib/firebaseAdmin';

/**
 * Download an admin-bucket object addressed by its public URL.
 *
 * @param url - Must start with `https://storage.googleapis.com/<bucket>/`.
 *   The remainder is URL-decoded into the storage path.
 * @throws If `url` does not address the configured admin bucket — a URL from
 *   somewhere else is a programming error, not a missing file.
 */
export async function downloadAdminObjectByPublicUrl(url: string): Promise<Buffer> {
  const bucket = getAdminBucket();
  const prefix = `https://storage.googleapis.com/${bucket.name}/`;
  if (!url.startsWith(prefix)) throw new Error(`Unexpected storage URL: ${url}`);

  const storagePath = decodeURIComponent(url.slice(prefix.length));
  const [buffer] = await bucket.file(storagePath).download();
  return buffer;
}
