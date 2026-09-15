/**
 * =============================================================================
 * JOB: holiday-hours-question — **«ΘΑ ΕΙΣΤΕ ΑΝΟΙΧΤΑ ΣΤΙΣ ΑΡΓΙΕΣ;»** (ADR-841 §7 Α21.21 Φάση Β)
 * =============================================================================
 *
 * Η ερώτηση γεννιέται από τον **χρόνο**, όχι από πράξη ανθρώπου: 21 ημέρες πριν από την πρώτη αναπάντητη αργία μιας
 * περιόδου κανείς δεν πατά τίποτα. Κάποιος πρέπει να **ρωτήσει το ημερολόγιο** κάθε μέρα.
 *
 * 🔑 **Καμία νέα υποδομή** (ADR-740): περιοδική εκτέλεση, ταυτότητα μηχανής→μηχανής, lease, monitor και catch-up
 * υπάρχουν όλα. Εδώ δηλώνεται **ποια** εργασία είναι· η κρίση ζει στο `lib/calendar/holiday-question`, η πράξη στο
 * `services/mandate/holiday-hours-question.service`.
 *
 * @module lib/cron/jobs/holiday-hours-question.job
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { issueDueHolidayQuestions } from '@/services/mandate/holiday-hours-question.service';
import type { CronJobResult } from '@/types/cron-schedule';

/**
 * Ένα πέρασμα: «ρώτα όποιον ωρίμασε, υπενθύμισε όποιον ξέχασε».
 *
 * ⚠️ **Κάθε κάδος εκπέμπεται, ΚΑΙ ΟΤΑΝ ΕΙΝΑΙ ΜΗΔΕΝ** — ένα `asked` που λείπει διαβάζεται και ως «δεν ωρίμασε τίποτα»
 * και ως «δεν κοίταξε κανείς».
 */
export async function runHolidayHoursQuestion(): Promise<CronJobResult> {
  const report = await issueDueHolidayQuestions(getAdminFirestore());

  return {
    summary:
      `considered ${report.considered}, asked ${report.asked}, reminded ${report.reminded}, ` +
      `skipped ${report.skipped}, failed ${report.failed}`,
    metrics: {
      considered: report.considered,
      asked: report.asked,
      reminded: report.reminded,
      skipped: report.skipped,
      failed: report.failed,
    },
  };
}
