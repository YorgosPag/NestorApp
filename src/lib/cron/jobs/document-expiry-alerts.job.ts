/**
 * =============================================================================
 * JOB: document-expiry-alerts — **ΤΟ ΜΗΤΡΩΟ ΛΗΞΕΩΝ ΜΙΛΑ** (ADR-915 Φ5α · §12)
 * =============================================================================
 *
 * ΠΕΑ που μπαίνει σε ώρα ανανέωσης, πλησιάζει τη λήξη, έληξε ή λείπει ⇒ το γραφείο το μαθαίνει **χωρίς** να ανοίξει
 * τη σελίδα, και **μία** φορά ανά νέο στάδιο ανά έγγραφο — ποτέ το ίδιο δύο φορές.
 *
 * 🔑 **Καμία νέα υποδομή** (ADR-740): εδώ δηλώνεται μόνο **ποια** εργασία είναι.
 *
 * @module lib/cron/jobs/document-expiry-alerts.job
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { sweepRegistryExpiryAlerts } from '@/services/document-registry/registry-expiry-alerts.server';
import type { CronJobResult } from '@/types/cron-schedule';

export async function runDocumentExpiryAlerts(): Promise<CronJobResult> {
  const report = await sweepRegistryExpiryAlerts(getAdminFirestore(), Date.now());
  return {
    summary:
      `considered ${report.considered}, notified ${report.notified}, skipped ${report.skipped}, failed ${report.failed}`
      + (report.incomplete > 0 ? `, INCOMPLETE ${report.incomplete}` : '')
      + (report.truncated ? ', TRUNCATED' : ''),
    metrics: {
      considered: report.considered,
      notified: report.notified,
      skipped: report.skipped,
      failed: report.failed,
      incomplete: report.incomplete,
      truncated: report.truncated ? 1 : 0,
    },
  };
}
