/**
 * =============================================================================
 * JOB: engagement-invitation-reminder — **Η ΠΡΟΣΚΛΗΣΗ ΠΟΥ ΔΕΝ ΑΠΑΝΤΗΘΗΚΕ** (ADR-901 Ε-5)
 * =============================================================================
 *
 * Ο δικηγόρος/συμβολαιογράφος που προσκλήθηκε με email δεν απάντησε σε 3 ημέρες ⇒ ο **προσκαλών** μαθαίνει (κουδούνι +
 * email κατά τις προτιμήσεις του), ώστε να τηλεφωνήσει, να ξαναστείλει ή να ορίσει άλλον. Η ληγμένη κλείνει.
 *
 * 🔑 **Καμία νέα υποδομή** (ADR-740): περιοδική εκτέλεση, ταυτότητα μηχανής→μηχανής, lease, monitor και catch-up
 * υπάρχουν όλα. Εδώ δηλώνεται **ποια** εργασία είναι.
 *
 * @module lib/cron/jobs/engagement-invitation-reminder.job
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { sweepEngagementInvitationReminders } from '@/server/engagement-invitations/engagement-invitation-reminder';
import type { CronJobResult } from '@/types/cron-schedule';

export async function runEngagementInvitationReminder(): Promise<CronJobResult> {
  const report = await sweepEngagementInvitationReminders(getAdminFirestore());
  return {
    summary:
      `considered ${report.considered}, reminded ${report.reminded}, expired ${report.expired}, `
      + `skipped ${report.skipped}, failed ${report.failed}` + (report.truncated ? ', TRUNCATED' : ''),
    metrics: {
      considered: report.considered,
      reminded: report.reminded,
      expired: report.expired,
      skipped: report.skipped,
      failed: report.failed,
      truncated: report.truncated ? 1 : 0,
    },
  };
}
