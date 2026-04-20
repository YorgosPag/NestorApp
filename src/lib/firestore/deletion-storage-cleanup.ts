/**
 * 🛡️ DELETION STORAGE CLEANUP — Best-effort prefix purge in Firebase Storage.
 *
 * Called AFTER Firestore cascade during `executeDeletion`. Failures are logged
 * but do NOT throw: storage cleanup is advisory, not authoritative (pattern
 * used in `src/app/api/files/purge/route.ts`).
 *
 * @module lib/firestore/deletion-storage-cleanup
 * @enterprise ADR-226 — Deletion Guard
 */

import 'server-only';

import type { StorageCleanupDef } from '@/config/deletion-registry';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('DeletionStorageCleanup');

export interface StorageCleanupDetail {
  pathTemplate: string;
  prefix: string;
  label: string;
  filesDeleted: number;
  error?: string;
}

export interface StorageCleanupResult {
  totalDeleted: number;
  details: StorageCleanupDetail[];
}

function resolvePrefix(template: string, companyId: string, entityId: string): string {
  return template
    .replace(/\{companyId\}/g, companyId)
    .replace(/\{entityId\}/g, entityId);
}

/**
 * Recursively delete all Storage objects under each template-resolved prefix.
 * Per-prefix errors are captured but do not abort the sweep.
 */
export async function executeStorageCleanup(
  cleanupDefs: readonly StorageCleanupDef[],
  entityId: string,
  companyId: string
): Promise<StorageCleanupResult> {
  // Lazy import so client-side bundles / tests without Admin SDK don't break.
  const { getAdminBucket } = await import('@/lib/firebaseAdmin');

  const details: StorageCleanupDetail[] = [];
  let totalDeleted = 0;

  let bucket: ReturnType<typeof getAdminBucket>;
  try {
    bucket = getAdminBucket();
  } catch (err) {
    logger.warn('[DeletionStorageCleanup] Bucket unavailable — skipping storage cleanup', {
      error: getErrorMessage(err), entityId, companyId,
    });
    return { totalDeleted: 0, details: [] };
  }

  for (const def of cleanupDefs) {
    const prefix = resolvePrefix(def.pathTemplate, companyId, entityId);

    try {
      const [files] = await bucket.getFiles({ prefix });
      const filesCount = files.length;

      if (filesCount > 0) {
        // force: true → continue on per-file failure (e.g. already-deleted)
        await bucket.deleteFiles({ prefix, force: true });
      }

      details.push({
        pathTemplate: def.pathTemplate,
        prefix,
        label: def.label,
        filesDeleted: filesCount,
      });
      totalDeleted += filesCount;

      logger.info(`[DeletionStorageCleanup] Deleted ${filesCount} objects under ${prefix}`, {
        entityId, companyId, label: def.label,
      });
    } catch (err) {
      const message = getErrorMessage(err);
      logger.warn('[DeletionStorageCleanup] Prefix cleanup failed (non-blocking)', {
        entityId, companyId, prefix, error: message,
      });
      details.push({
        pathTemplate: def.pathTemplate,
        prefix,
        label: def.label,
        filesDeleted: 0,
        error: message,
      });
    }
  }

  return { totalDeleted, details };
}
