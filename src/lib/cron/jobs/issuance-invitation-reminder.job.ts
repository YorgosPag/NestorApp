/**
 * =============================================================================
 * JOB: issuance-invitation-reminder — **Ο ΣΥΝΔΕΣΜΟΣ ΠΟΥ ΔΕΝ ΑΠΑΝΤΗΘΗΚΕ** (ADR-915 §31)
 * =============================================================================
 *
 * Ο υπεύθυνος ιδιοκτήτης ή ο επαγγελματίας δεν απάντησε στο αίτημα που το γραφείο **έστειλε χειροκίνητα** ⇒ υπενθύμιση
 * στο γραμματοκιβώτιό του, 72 ώρες μετά και την παραμονή της λήξης (DocuSign / Adobe Sign). Ποτέ πρώτη αποστολή.
 *
 * 🔑 **Καμία νέα υποδομή** (ADR-740): περιοδική εκτέλεση, ταυτότητα μηχανής→μηχανής, lease, monitor και catch-up
 * υπάρχουν όλα. Εδώ δηλώνεται **ποια** εργασία είναι.
 *
 * @module lib/cron/jobs/issuance-invitation-reminder.job
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { sweepIssuanceInvitationReminders } from '@/server/issuance-invitations/issuance-invitation-reminder';
import type { CronJobResult } from '@/types/cron-schedule';

export async function runIssuanceInvitationReminder(): Promise<CronJobResult> {
  const report = await sweepIssuanceInvitationReminders(getAdminFirestore(), new Date());
  return {
    summary: report.outsideOfficeHours
      ? 'outside office hours — nothing considered'
      : `considered ${report.considered}, reminded ${report.reminded}, retired ${report.retired}, `
        + `waiting ${report.waiting}, failed ${report.failed}` + (report.truncated ? ', TRUNCATED' : ''),
    metrics: {
      considered: report.considered,
      reminded: report.reminded,
      retired: report.retired,
      waiting: report.waiting,
      failed: report.failed,
      truncated: report.truncated ? 1 : 0,
      outsideOfficeHours: report.outsideOfficeHours ? 1 : 0,
    },
  };
}
