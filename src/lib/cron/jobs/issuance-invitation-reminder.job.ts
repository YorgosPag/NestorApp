/**
 * =============================================================================
 * JOB: issuance-invitation-reminder — **Ο ΣΥΝΔΕΣΜΟΣ ΠΟΥ ΔΕΝ ΑΠΑΝΤΗΘΗΚΕ** (ADR-915 §31) **+ Η ΠΑΡΑΔΟΣΗ** (§45 Φ3)
 * =============================================================================
 *
 * Δύο σαρώσεις, ένα cron, ίδιες ώρες γραφείου:
 * - §31 — ο υπεύθυνος ιδιοκτήτης ή ο επαγγελματίας δεν απάντησε στο αίτημα που το γραφείο **έστειλε χειροκίνητα** ⇒
 *   υπενθύμιση 72 ώρες μετά και την παραμονή της λήξης (DocuSign / Adobe Sign). Ποτέ πρώτη αποστολή.
 * - §45 Φ3 — η προθεσμία παράδοσης της αναληφθείσας ανάθεσης πλησιάζει ή πέρασε ⇒ υπενθύμιση στον επαγγελματία
 *   (παραμονή · +1 · κάθε 5 εργάσιμες, Vanta).
 *
 * 🔑 **Καμία νέα υποδομή** (ADR-740): περιοδική εκτέλεση, ταυτότητα μηχανής→μηχανής, lease, monitor και catch-up
 * υπάρχουν όλα. Εδώ δηλώνεται **ποια** εργασία είναι. Οι σαρώσεις τρέχουν **η μία μετά την άλλη** και η καθεμία
 * εκπέμπει τους δικούς της κάδους. Η βλάβη **μιας** ανάθεσης μετριέται μέσα στη σάρωση (`failed`)· βλάβη του ίδιου του
 * ερωτήματος ρίχνει το job, ώστε να τη δει το monitor (ADR-740) — ποτέ σιωπηλό «0».
 *
 * @module lib/cron/jobs/issuance-invitation-reminder.job
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { sweepIssuanceDeliveryReminders } from '@/server/issuance-invitations/issuance-delivery-reminder';
import {
  sweepIssuanceInvitationReminders,
  type IssuanceReminderSweepReport,
} from '@/server/issuance-invitations/issuance-invitation-reminder';
import type { CronJobResult } from '@/types/cron-schedule';

function summaryOf(label: string, report: IssuanceReminderSweepReport): string {
  if (report.outsideOfficeHours) return `${label}: outside office hours — nothing considered`;
  return `${label}: considered ${report.considered}, reminded ${report.reminded}, retired ${report.retired}, `
    + `waiting ${report.waiting}, failed ${report.failed}` + (report.truncated ? ', TRUNCATED' : '');
}

function metricsOf(prefix: string, report: IssuanceReminderSweepReport): Record<string, number> {
  return {
    [`${prefix}considered`]: report.considered,
    [`${prefix}reminded`]: report.reminded,
    [`${prefix}retired`]: report.retired,
    [`${prefix}waiting`]: report.waiting,
    [`${prefix}failed`]: report.failed,
    [`${prefix}truncated`]: report.truncated ? 1 : 0,
    [`${prefix}outsideOfficeHours`]: report.outsideOfficeHours ? 1 : 0,
  };
}

export async function runIssuanceInvitationReminder(): Promise<CronJobResult> {
  const db = getAdminFirestore();
  const links = await sweepIssuanceInvitationReminders(db, new Date());
  const delivery = await sweepIssuanceDeliveryReminders(db, new Date());
  return {
    summary: `${summaryOf('links', links)} · ${summaryOf('delivery', delivery)}`,
    // Τα μετρικά της §31 κρατούν τα ονόματά τους (οι πίνακες παρακολούθησης τα διαβάζουν ήδη).
    metrics: { ...metricsOf('', links), ...metricsOf('delivery.', delivery) },
  };
}
