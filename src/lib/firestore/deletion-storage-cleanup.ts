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
import type { FileStoragePlacement } from '@/lib/files/file-storage-placement';
import type { OriginalStorageBucket } from '@/server/files/file-record-bucket';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('DeletionStorageCleanup');

export interface StorageCleanupDetail {
  pathTemplate: string;
  prefix: string;
  label: string;
  filesDeleted: number;
  error?: string;
  /** ADR-895 Α6: ο κάδος καταλόγου που σαρώθηκε — ένα detail ανά (πρότυπο × κάδος). */
  placement: FileStoragePlacement;
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
 * ADR-895 Α6: ο **κατάλογος** κάδων πρωτοτύπων, όσος υπάρχει (SSoT `provisionedOriginalStorageBuckets`). Ο κάδος ΕΕ
 * πριν την προμήθεια ⇒ παραλείπεται με σημείωση. Αποτυχία του ελέγχου ⇒ καμία σάρωση, **με προειδοποίηση** — ποτέ
 * σιωπηλό «δεν υπάρχει» (ο καθαρισμός εδώ είναι συμβουλευτικός, ADR-226).
 */
async function provisionedOriginalBuckets(entityId: string, companyId: string): Promise<readonly OriginalStorageBucket[]> {
  // Lazy import so client-side bundles / tests without Admin SDK don't break.
  const { provisionedOriginalStorageBuckets } = await import('@/server/files/file-record-bucket');
  try {
    const { provisioned, notProvisioned } = await provisionedOriginalStorageBuckets();
    for (const placement of notProvisioned) {
      logger.info(`[DeletionStorageCleanup] Bucket for placement '${placement}' not provisioned yet — skipped (not a failure)`, {
        entityId, companyId,
      });
    }
    return provisioned;
  } catch (err) {
    logger.warn('[DeletionStorageCleanup] Bucket catalogue unavailable — skipping storage cleanup', {
      error: getErrorMessage(err), entityId, companyId,
    });
    return [];
  }
}

/** Σάρωση ΕΝΟΣ προθέματος σε ΕΝΑ κάδο — per-prefix errors are captured but do not abort the sweep. */
async function sweepPrefixInBucket(
  def: StorageCleanupDef,
  prefix: string,
  target: OriginalStorageBucket,
  entityId: string,
  companyId: string,
): Promise<StorageCleanupDetail> {
  const { placement, bucket } = target;
  try {
    const [files] = await bucket.getFiles({ prefix });
    const filesCount = files.length;

    if (filesCount > 0) {
      // force: true → continue on per-file failure (e.g. already-deleted)
      await bucket.deleteFiles({ prefix, force: true });
    }

    logger.info(`[DeletionStorageCleanup] Deleted ${filesCount} objects under ${prefix} (${placement})`, {
      entityId, companyId, label: def.label, placement,
    });
    return { pathTemplate: def.pathTemplate, prefix, label: def.label, filesDeleted: filesCount, placement };
  } catch (err) {
    const message = getErrorMessage(err);
    logger.warn('[DeletionStorageCleanup] Prefix cleanup failed (non-blocking)', {
      entityId, companyId, prefix, error: message, placement,
    });
    return { pathTemplate: def.pathTemplate, prefix, label: def.label, filesDeleted: 0, error: message, placement };
  }
}

/**
 * Recursively delete all Storage objects under each template-resolved prefix — in EVERY
 * provisioned original-file bucket (ADR-895 Α6: the sweep enumerates the catalogue, never
 * "the bucket"). Per-prefix, per-bucket errors are captured but do not abort the sweep.
 */
export async function executeStorageCleanup(
  cleanupDefs: readonly StorageCleanupDef[],
  entityId: string,
  companyId: string
): Promise<StorageCleanupResult> {
  const buckets = await provisionedOriginalBuckets(entityId, companyId);
  if (buckets.length === 0) return { totalDeleted: 0, details: [] };

  const details: StorageCleanupDetail[] = [];
  for (const def of cleanupDefs) {
    const prefix = resolvePrefix(def.pathTemplate, companyId, entityId);
    for (const target of buckets) {
      details.push(await sweepPrefixInBucket(def, prefix, target, entityId, companyId));
    }
  }

  const totalDeleted = details.reduce((sum, d) => sum + d.filesDeleted, 0);
  return { totalDeleted, details };
}
