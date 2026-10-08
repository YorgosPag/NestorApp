import 'server-only';

/**
 * @fileoverview Cron: **η βραδινή συμφιλίωση των μέσων κάθε δημόσιας αγγελίας** (ADR-845 §7.17 Α5).
 * @related services/listings/listing-media-reconciliation.service.ts (η πράξη) · config/cron-schedule.ts
 * @module lib/cron/jobs/listing-media-reconcile.job
 *
 * 🔴 **Το `drifted` και το `missing` είναι ο λόγος ύπαρξής της**: με κάθε πόρτα αρχείου να
 * ξαναπροβάλλει, είναι **μηδέν**. Μη μηδενικό = πόρτα που ξέφυγε — φαίνεται στα μεγέθη της
 * εκτέλεσης και, με το ακίνητό της, στο ημερολόγιο σφαλμάτων.
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { reconcileListingMedia } from '@/services/listings/listing-media-reconciliation.service';
import { convergeShelfCacheControl } from '@/services/listings/public-shelf-bucket';
import type { CronJobResult } from '@/types/cron-schedule';

/**
 * 🔑 **Δύο συμφιλιώσεις, με αυτή τη σειρά** *(Α7)*: πρώτα **ποια** αντικείμενα πρέπει να υπάρχουν
 * (η επαναπροβολή σβήνει ό,τι περισσεύει), έπειτα **πόσο** μένει στην κρυφή μνήμη ό,τι έμεινε.
 * Ανάποδα, το πέρασμα θα διόρθωνε μεταδεδομένα σε αντικείμενα που σβήνονται ένα βήμα μετά.
 */
export async function runListingMediaReconcile(): Promise<CronJobResult> {
  const report = await reconcileListingMedia(getAdminFirestore());
  const cache = await convergeShelfCacheControl();

  return {
    summary:
      `listed ${report.listed}/${report.scanned}: agreed ${report.agreed}, drifted ${report.drifted}, `
      + `unstamped ${report.unstamped}, missing ${report.missing}, republished ${report.republished}, `
      + `failed ${report.failed} · cache healed ${cache.healed}/${cache.scanned}`,
    metrics: { ...report, cacheScanned: cache.scanned, cacheHealed: cache.healed },
  };
}
