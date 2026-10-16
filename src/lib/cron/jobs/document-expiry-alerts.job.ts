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
import { conveyanceToday } from '@/lib/conveyance/conveyance-calendar';
import { enfiaCentralIssuanceCoverage } from '@/lib/document-validity/validity-bounds';
import { createModuleLogger } from '@/lib/telemetry';
import { sweepRegistryExpiryAlerts } from '@/services/document-registry/registry-expiry-alerts.server';
import type { CronJobResult } from '@/types/cron-schedule';

const logger = createModuleLogger('DOCUMENT_EXPIRY_ALERTS_JOB');

/**
 * ADR-915 §17 — ο ημερήσιος φρουρός του πίνακα κεντρικών εκδόσεων ΕΝΦΙΑ: έτος χωρίς γραμμή μετά την αναμενόμενη
 * ημερομηνία ⇒ σφάλμα στα logs **κάθε** μέρα μέχρι να προστεθεί (με πηγή). Η σάρωση δεν σταματά.
 */
function enfiaTableIsMissing(now: Date): boolean {
  const today = conveyanceToday(now);
  if (enfiaCentralIssuanceCoverage(today) !== 'missing') return false;
  logger.error('ENFIA central issuance date missing for the current year — add it to ENFIA_CENTRAL_ISSUANCE with an AADE source', { today });
  return true;
}

export async function runDocumentExpiryAlerts(): Promise<CronJobResult> {
  const nowMs = Date.now();
  const enfiaMissing = enfiaTableIsMissing(new Date(nowMs));
  const report = await sweepRegistryExpiryAlerts(getAdminFirestore(), nowMs);
  return {
    summary:
      `considered ${report.considered}, notified ${report.notified}, skipped ${report.skipped}, failed ${report.failed}`
      + (report.incomplete > 0 ? `, INCOMPLETE ${report.incomplete}` : '')
      + (report.truncated ? ', TRUNCATED' : '')
      + (enfiaMissing ? ', ENFIA_CENTRAL_ISSUANCE_MISSING' : ''),
    metrics: {
      considered: report.considered,
      notified: report.notified,
      skipped: report.skipped,
      failed: report.failed,
      incomplete: report.incomplete,
      truncated: report.truncated ? 1 : 0,
      enfiaCentralIssuanceMissing: enfiaMissing ? 1 : 0,
    },
  };
}
