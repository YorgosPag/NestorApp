import 'server-only';

/**
 * @fileoverview Cron: **ο ιδιοκτήτης του κύκλου ζωής της θέσης διεύθυνσης** (ADR-332 §D33).
 * @related services/listings/address-position-sweep.ts (η πράξη) · config/cron-schedule.ts
 * @module lib/cron/jobs/address-position-sweep.job
 *
 * Εδώ δένονται τα τρία που η πράξη δεν οφείλει να ξέρει: η **λωρίδα παρασκηνίου** του Nominatim (κάθε
 * κλήση υποχωρεί μπροστά στους ανθρώπους), το **σημείο συνέχισης** (στο έγγραφο της εργασίας) και ό,τι
 * ακολουθεί μια γραφή θέσης **έργου** (μνήμη λίστας + αγγελίες — η ίδια συνάρτηση με το `after()`).
 *
 * 🔴 **Το σήμα είναι το `retried`**: μη μηδενικό για μέρες = ο πάροχος δεν απαντά σε κάποιες διευθύνσεις.
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { readCronScanCursor, writeCronScanCursor } from '@/lib/cron/cron-scan-cursor';
import { inBackgroundGeocodingLane } from '@/app/api/geocoding/nominatim-pacer';
import { projectPositionsWritten } from '@/app/api/projects/_shared/project-address-write';
import { PROJECT_ADDRESS_CONTAINER } from '@/services/listings/address-position-containers';
import { runAddressPositionSweep } from '@/services/listings/address-position-sweep';
import type { CronJobResult } from '@/types/cron-schedule';

/** Το κλειδί της εργασίας — lease, monitor **και** σημείο συνέχισης μοιράζονται το ίδιο έγγραφο. */
const SLUG = 'address-position-sweep';

export async function runAddressPositionSweepJob(): Promise<CronJobResult> {
  const db = getAdminFirestore();
  const cursor = await readCronScanCursor(db, SLUG);
  const report = await inBackgroundGeocodingLane(() => runAddressPositionSweep({
    db,
    cursor,
    saveCursor: (next) => writeCronScanCursor(db, SLUG, next),
    onWritten: async (container, docId, data) => {
      if (container !== PROJECT_ADDRESS_CONTAINER || typeof data.companyId !== 'string') return;
      await projectPositionsWritten(db, docId, data.companyId);
    },
  }));
  return {
    summary: `address positions: scanned ${report.scanned}, discovered ${report.discovered}, `
      + `attempted ${report.attempted}, written ${report.written}, settled ${report.settled}, `
      + `retried ${report.retried}, deferred ${report.deferred}`,
    metrics: { ...report },
  };
}
