/**
 * 🧹 **Το δίχτυ ορφανών ενός ορόφου που αντικαθίσταται** — σάρωση προθέματος σε **κάθε** κάδο του καταλόγου
 * (ADR-895 Α6 · ADR-709), **μόνο** για ό,τι δεν ανήκει σε καμία εγγραφή (ADR-899 §2.2.1).
 *
 * 🔴 Ως τις 2026-11-02 εδώ ζούσε και ένας **δεύτερος** γραφέας bytes (`deleteStorageObjects`: σάρωση `{storagePath}*` ανά
 * εγγραφή, non-blocking), και η σάρωση φακέλου έσβηνε **ό,τι** έβρισκε — και τα bytes αρχείου σε δέσμευση. Τώρα τα bytes
 * μιας εγγραφής τα σβήνει **μόνο** ο γραφέας του purge (`purgeFileRecord` → `deleteStorageObjectForPurge` → συνοδευτικά),
 * με τον κριτή δέσμευσης· εδώ μένουν τα αντικείμενα **χωρίς** εγγραφή (παράγωγα παλιών wipes που είχαν χάσει τον γονιό).
 *
 * @module services/floorplan-background/floor-wipe-storage
 */

import 'server-only';

import type { Bucket } from '@google-cloud/storage';
import { isCompanionPathOf } from '@/lib/files/file-companion-objects';
import { provisionedOriginalStorageBuckets } from '@/server/files/file-record-bucket';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { FileRow } from './floor-wipe-queries';

const logger = createModuleLogger('FloorWipeStorage');

export interface DeleteTally {
  deleted: number;
  failed: number;
  /** Αντικείμενα που **ανήκουν** σε εγγραφή και γι' αυτό δεν αγγίχτηκαν (κρατημένη · στην ουρά του purge). */
  spared: number;
}

export const sumTallies = (tallies: readonly DeleteTally[]): DeleteTally =>
  tallies.reduce(
    (acc, t) => ({ deleted: acc.deleted + t.deleted, failed: acc.failed + t.failed, spared: acc.spared + t.spared }),
    { deleted: 0, failed: 0, spared: 0 },
  );

/** «Ανήκει αυτό το αντικείμενο σε εγγραφή;» — η ερώτηση της σάρωσης, πριν από κάθε διαγραφή. */
export type ObjectClaim = (objectName: string) => boolean;

/**
 * 🔒 **Τα αντικείμενα των εγγραφών του ορόφου** — πρωτότυπο **και** κάθε συνοδευτικό, με τον **ίδιο** φρουρό που
 * χρησιμοποιεί ο γραφέας του purge (`isCompanionPathOf` — από αυτόν περνούν και οι στόχοι του `companionTargetsOf`).
 *
 * Κρίνει **κάθε** εγγραφή, σε όποια κατάσταση: κρατημένη (μένει) · στον κάδο (τα bytes της τα σβήνει το cron, με κριτή) ·
 * επιτύμβιο (τα bytes λείπουν ήδη — η εξαίρεση είναι αθώα). Fail-closed: καλύτερα ένα ορφανό που μένει, παρά bytes
 * εγγραφής που χάνονται χωρίς επιτύμβιο.
 */
export function claimedByFileRows(rows: readonly FileRow[]): ObjectClaim {
  const owners = rows.flatMap((row) => {
    const storagePath = row.data.storagePath;
    return typeof storagePath === 'string' && storagePath.length > 0 ? [{ fileId: row.ref.id, storagePath }] : [];
  });
  return (objectName) =>
    owners.some((o) => objectName === o.storagePath || isCompanionPathOf(o.fileId, o.storagePath, objectName));
}

/** Σβήσε ό,τι ζει κάτω από `prefix` σε **έναν** κάδο **και δεν ανήκει σε εγγραφή** — ανά αντικείμενο non-blocking. */
async function deleteUnclaimedIn(bucket: Bucket, prefix: string, isClaimed: ObjectClaim): Promise<DeleteTally> {
  const tally: DeleteTally = { deleted: 0, failed: 0, spared: 0 };
  try {
    const [matches] = await bucket.getFiles({ prefix });
    const orphans = matches.filter((object) => !isClaimed(object.name));
    tally.spared = matches.length - orphans.length;
    await Promise.all(
      orphans.map(async (object) => {
        try {
          await object.delete({ ignoreNotFound: true });
          tally.deleted += 1;
        } catch (innerErr) {
          tally.failed += 1;
          logger.warn('Storage delete failed (non-blocking)', { path: object.name, error: getErrorMessage(innerErr) });
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
 * canonical prefix and — when the floor's project is known — the legacy project-scoped one, **και** τον φρουρό
 * ({@link claimedByFileRows}): χωρίς αυτόν δεν υπάρχει σάρωση.
 */
export async function sweepFloorCategoryPath(prefix: string, isClaimed: ObjectClaim): Promise<DeleteTally> {
  try {
    const { provisioned } = await provisionedOriginalStorageBuckets();
    return sumTallies(await Promise.all(provisioned.map(({ bucket }) => deleteUnclaimedIn(bucket, prefix, isClaimed))));
  } catch (err) {
    logger.warn('Floor-category sweep: bucket catalogue unavailable (non-blocking)', { prefix, error: getErrorMessage(err) });
    return { deleted: 0, failed: 1, spared: 0 };
  }
}
