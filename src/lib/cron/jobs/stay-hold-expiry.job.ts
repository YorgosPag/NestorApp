/**
 * =============================================================================
 * JOB: stay-hold-expiry — **ΤΟ ΑΙΤΗΜΑ ΕΛΗΞΕ** (ADR-835 §23.7, Στάδιο Δ)
 * =============================================================================
 *
 * Οι νύχτες ενός ληγμένου αιτήματος είναι **ήδη** ελεύθερες — η λήξη ισχύει στην ανάγνωση. Εδώ
 * καταγράφεται το γεγονός και φεύγουν οι ειδοποιήσεις (δες `stay-hold-expiry.service`).
 *
 * 🔑 **Καμία νέα υποδομή** (ADR-740): lease, ταυτότητα μηχανής→μηχανής, monitor και catch-up
 * υπάρχουν. Εδώ δηλώνεται **ποια** εργασία είναι.
 *
 * @module lib/cron/jobs/stay-hold-expiry.job
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { expireLapsedHolds } from '@/services/stay-calendar/stay-hold-expiry.service';
import type { CronJobResult } from '@/types/cron-schedule';

/**
 * Ένα πέρασμα: «κατέγραψε ό,τι έληξε».
 *
 * ⚠️ **Κάθε κάδος εκπέμπεται, ΚΑΙ ΟΤΑΝ ΕΙΝΑΙ ΜΗΔΕΝ** — ένα `considered` που λείπει διαβάζεται και ως
 * «δεν έληξε τίποτα» και ως «κανείς δεν κοίταξε».
 */
export async function runStayHoldExpiry(): Promise<CronJobResult> {
  const report = await expireLapsedHolds(getAdminFirestore());

  return {
    summary:
      `lapsed ${report.considered}, expired ${report.expired}, ` +
      `already-resolved ${report.alreadyResolved}, failed ${report.failed}` +
      (report.truncated ? ', TRUNCATED' : ''),
    metrics: {
      considered: report.considered,
      expired: report.expired,
      alreadyResolved: report.alreadyResolved,
      failed: report.failed,
      truncated: report.truncated ? 1 : 0,
    },
  };
}
