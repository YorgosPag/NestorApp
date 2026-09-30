/**
 * 🧹 **Τα bytes ενός σβησμένου ορόφου** — διαγραφή ανά εγγραφή **στον κάδο της** και σάρωση προθέματος σε **κάθε**
 * κάδο του καταλόγου (ADR-895 Α2/Α6 · ADR-709). Εξήχθη από το `floorplan-floor-wipe.service` ώστε να έχει άγκυρες.
 *
 * @module services/floorplan-background/floor-wipe-storage
 */

import 'server-only';

import type { Bucket } from '@google-cloud/storage';
import { fileRecordBucket, provisionedOriginalStorageBuckets } from '@/server/files/file-record-bucket';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { FileRow } from './floor-wipe-queries';

const logger = createModuleLogger('FloorWipeStorage');

export interface DeleteTally {
  deleted: number;
  failed: number;
}

export const sumTallies = (tallies: readonly DeleteTally[]): DeleteTally =>
  tallies.reduce((acc, t) => ({ deleted: acc.deleted + t.deleted, failed: acc.failed + t.failed }), { deleted: 0, failed: 0 });

/**
 * Σβήσε ό,τι ζει κάτω από `prefix` σε **έναν** κάδο — ανά αντικείμενο non-blocking. Το prefix-list πιάνει και τις
 * παραγώγους του `FloorplanProcessService` (`{storagePath}.processed.json`, `.thumbnail.png`, …).
 */
async function deletePrefixIn(bucket: Bucket, prefix: string): Promise<DeleteTally> {
  const tally: DeleteTally = { deleted: 0, failed: 0 };
  try {
    const [matches] = await bucket.getFiles({ prefix });
    await Promise.all(
      matches.map(async (f) => {
        try {
          await f.delete({ ignoreNotFound: true });
          tally.deleted += 1;
        } catch (innerErr) {
          tally.failed += 1;
          logger.warn('Storage delete failed (non-blocking)', { path: f.name, error: getErrorMessage(innerErr) });
        }
      }),
    );
  } catch (err) {
    tally.failed += 1;
    logger.warn('Storage prefix-list failed (non-blocking)', { prefix, error: getErrorMessage(err) });
  }
  return tally;
}

/**
 * ADR-709: sweep ONE prefix — σε **κάθε** κάδο του καταλόγου που υπάρχει (ADR-895 Α6). Callers pass both the
 * canonical prefix and — when the floor's project is known — the legacy project-scoped one.
 */
export async function sweepFloorCategoryPath(prefix: string): Promise<DeleteTally> {
  try {
    const { provisioned } = await provisionedOriginalStorageBuckets();
    return sumTallies(await Promise.all(provisioned.map(({ bucket }) => deletePrefixIn(bucket, prefix))));
  } catch (err) {
    logger.warn('Floor-category sweep: bucket catalogue unavailable (non-blocking)', { prefix, error: getErrorMessage(err) });
    return { deleted: 0, failed: 1 };
  }
}

/** Τα bytes κάθε εγγραφής **στον κάδο της** (ADR-895 Α2) — άγνωστη θέση ⇒ αποτυχία που μετριέται, ποτέ μαντεψιά. */
export async function deleteStorageObjects(rows: readonly FileRow[]): Promise<DeleteTally> {
  const tallies = await Promise.all(
    rows
      .filter((row): row is FileRow & { storagePath: string } => typeof row.storagePath === 'string' && row.storagePath.length > 0)
      .map(async (row) => {
        let bucket: Bucket;
        try {
          bucket = fileRecordBucket(row);
        } catch (err) {
          logger.warn('Storage delete refused: unknown placement (non-blocking)', { path: row.storagePath, error: getErrorMessage(err) });
          return { deleted: 0, failed: 1 };
        }
        return deletePrefixIn(bucket, row.storagePath);
      }),
  );
  return sumTallies(tallies);
}
