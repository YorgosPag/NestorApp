/**
 * =============================================================================
 * MIGRATION OPERATIONS: legacy project-scoped Storage paths → canonical
 * =============================================================================
 *
 * Moves objects written under the pre-ADR-709 scheme
 *   `companies/{c}/projects/{p}/entities/{t}/{id}/…`
 * to the one canonical scheme
 *   `companies/{c}/entities/{t}/{id}/…`
 *
 * Scope note: this is a data-shape migration, not a cleanup. Nothing is deleted
 * that is not first proven to exist at the destination.
 *
 * @module api/admin/migrations/normalize-storage-paths/storage-path-normalize-operations
 * @enterprise ADR-709 — Immutable Storage Path
 * @enterprise ADR-704 — Admin Migration-Runner SSoT
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import { COLLECTIONS } from '@/config/firestore-collections';
import { buildStoragePath, parseStoragePath } from '@/services/upload/utils/storage-path';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('MigrationNormalizeStoragePaths');

// ============================================================================
// TYPES
// ============================================================================

/** One FileRecord whose storagePath still uses the legacy project-scoped tree. */
export interface LegacyPathRecord {
  fileRecordId: string;
  companyId: string;
  legacyProjectId: string;
  legacyPath: string;
  canonicalPath: string;
  downloadUrl?: string;
}

/** Outcome of scanning the `files` collection. */
export interface LegacyScanResult {
  legacy: LegacyPathRecord[];
  /** Already canonical — nothing to do. */
  alreadyCanonical: number;
  /** storagePath missing or unparseable — reported, never touched. */
  unparseable: Array<{ fileRecordId: string; storagePath: string | undefined }>;
}

/** Per-record result of the execute phase. */
export interface MoveResult {
  fileRecordId: string;
  movedObjects: number;
  error?: string;
}

// ============================================================================
// SCAN (dry-run safe — zero writes)
// ============================================================================

/**
 * Reads every FileRecord and classifies its storagePath.
 *
 * Firestore cannot query by substring, so the whole collection is read and
 * classified in memory by the SSoT parser — never by an ad-hoc `includes('/projects/')`,
 * which would also match a company whose id happened to contain that text.
 */
export async function scanLegacyPaths(db: Firestore): Promise<LegacyScanResult> {
  const snap = await db.collection(COLLECTIONS.FILES).get();

  const legacy: LegacyPathRecord[] = [];
  const unparseable: LegacyScanResult['unparseable'] = [];
  let alreadyCanonical = 0;

  for (const doc of snap.docs) {
    const data = doc.data() as { storagePath?: string; downloadUrl?: string };
    const storagePath = data.storagePath;

    const parsed = storagePath ? parseStoragePath(storagePath) : null;
    if (!parsed) {
      unparseable.push({ fileRecordId: doc.id, storagePath });
      continue;
    }

    if (!parsed.legacyProjectId) {
      alreadyCanonical += 1;
      continue;
    }

    legacy.push({
      fileRecordId: doc.id,
      companyId: parsed.companyId,
      legacyProjectId: parsed.legacyProjectId,
      legacyPath: storagePath as string,
      canonicalPath: buildStoragePath(parsed).path,
      downloadUrl: data.downloadUrl,
    });
  }

  logger.info('Legacy storage-path scan complete', {
    total: snap.size,
    legacy: legacy.length,
    alreadyCanonical,
    unparseable: unparseable.length,
  });

  return { legacy, alreadyCanonical, unparseable };
}

// ============================================================================
// EXECUTE
// ============================================================================

/**
 * Rewrites a Firebase download URL for the object's new location.
 *
 * `bucket.file().copy()` carries custom metadata across, including
 * `firebaseStorageDownloadTokens` — so the token stays valid and only the
 * percent-encoded object path inside the URL has to change. Returns undefined
 * when there was no URL to rewrite.
 */
export function rewriteDownloadUrl(
  downloadUrl: string | undefined,
  legacyPath: string,
  canonicalPath: string
): string | undefined {
  if (!downloadUrl) return undefined;
  const encodedLegacy = encodeURIComponent(legacyPath);
  if (!downloadUrl.includes(encodedLegacy)) return downloadUrl;
  return downloadUrl.replace(encodedLegacy, encodeURIComponent(canonicalPath));
}

/**
 * Moves one FileRecord's objects — the file itself plus every derivation that
 * shares its path prefix (`{path}.processed.json`, `{path}.thumbnail.png`, …).
 *
 * Order is copy → verify → delete, per object. A failure leaves the source
 * intact; the migration is therefore safe to re-run.
 */
export async function moveRecordObjects(
  bucket: Bucket,
  record: LegacyPathRecord
): Promise<MoveResult> {
  try {
    // Derivations share the exact path as prefix, so one list covers all of them.
    const [sources] = await bucket.getFiles({ prefix: record.legacyPath });
    if (sources.length === 0) {
      return { fileRecordId: record.fileRecordId, movedObjects: 0 };
    }

    let movedObjects = 0;
    for (const source of sources) {
      const suffix = source.name.slice(record.legacyPath.length);
      const destinationName = `${record.canonicalPath}${suffix}`;

      await source.copy(bucket.file(destinationName));

      // Verify before destroying the only remaining copy.
      const [exists] = await bucket.file(destinationName).exists();
      if (!exists) {
        throw new Error(`Copy verification failed for ${destinationName}`);
      }

      await source.delete({ ignoreNotFound: true });
      movedObjects += 1;
    }

    return { fileRecordId: record.fileRecordId, movedObjects };
  } catch (err) {
    const error = getErrorMessage(err);
    logger.warn('Object move failed (record left untouched)', {
      fileRecordId: record.fileRecordId,
      legacyPath: record.legacyPath,
      error,
    });
    return { fileRecordId: record.fileRecordId, movedObjects: 0, error };
  }
}
