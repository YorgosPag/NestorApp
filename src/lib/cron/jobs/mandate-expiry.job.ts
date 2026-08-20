/**
 * =============================================================================
 * JOB: mandate-expiry — **Η ΕΝΤΟΛΗ ΤΕΛΕΙΩΣΕ** (ADR-777 §8.33)
 * =============================================================================
 *
 * Η λήξη είναι ήδη **δομική**: μια αγγελία με ληγμένη εντολή δεν έχει καμία διάθεση
 * στην αγορά, οπότε η επόμενη επανασύνθεση τη σβήνει από τον χάρτη μόνη της. Αυτό που
 * λείπει είναι κάποιος να **σκανδαλίσει** την επανασύνθεση για αγγελίες που κανείς δεν
 * άγγιξε — ένα έγγραφο που δεν ξαναγράφτηκε δεν ξέρει ότι πέρασε η ώρα του.
 *
 * 🔑 **Καμία νέα υποδομή** (ADR-740): περιοδική εκτέλεση, ταυτότητα μηχανής→μηχανής,
 * lease, monitor και catch-up υπάρχουν όλα. Εδώ δηλώνεται **ποια** εργασία είναι.
 *
 * @module lib/cron/jobs/mandate-expiry.job
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { retireExpiredMandates } from '@/services/mandate/mandate-expiry.service';
import type { CronJobResult } from '@/types/cron-schedule';

/**
 * Ένα πέρασμα: «κατέβασε ό,τι έληξε».
 *
 * ⚠️ **Κάθε κάδος εκπέμπεται, ΚΑΙ ΟΤΑΝ ΕΙΝΑΙ ΜΗΔΕΝ.** Ένα `considered` που λείπει
 * διαβάζεται ως «δεν έληξε τίποτα» — αλλά διαβάζεται **εξίσου** ως «δεν κοίταξε
 * κανείς». Η διάκριση είναι το σχήμα που κυνηγά όλο το ADR-777.
 */
export async function runMandateExpiry(): Promise<CronJobResult> {
  const report = await retireExpiredMandates(getAdminFirestore());

  return {
    summary:
      `expired ${report.considered}, retired ${report.retired}, ` +
      `already-off ${report.alreadyOff}, failed ${report.failed}` +
      (report.truncated ? ', TRUNCATED' : ''),
    metrics: {
      considered: report.considered,
      retired: report.retired,
      alreadyOff: report.alreadyOff,
      failed: report.failed,
      truncated: report.truncated ? 1 : 0,
    },
  };
}
