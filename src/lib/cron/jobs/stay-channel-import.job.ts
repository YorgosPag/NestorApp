/**
 * =============================================================================
 * JOB: stay-channel-import — **ΤΑ ΚΑΝΑΛΙΑ ΜΙΛΟΥΝ** (ADR-835 §22, Στάδιο Γ)
 * =============================================================================
 *
 * Το iCal είναι **poll, όχι push**: κανείς δεν μας ειδοποιεί όταν η Airbnb δώσει μια
 * νύχτα. Αυτό το πέρασμα είναι ο **μόνος** τρόπος να μάθουμε — και ο λόγος που η
 * σιωπή του μετριέται: πηγή που δεν διαβάστηκε πάνω από το όριο εμπιστοσύνης κάνει το
 * ημερολόγιο του καταλύματος να **σταματήσει να υπόσχεται** (`unsynced`, §6.4), αντί να
 * διαφημίζει νύχτες που μπορεί να έχουν πουληθεί αλλού.
 *
 * 🔑 **Καμία νέα υποδομή** (ADR-740): lease, ταυτότητα μηχανής→μηχανής, monitor και
 * catch-up υπάρχουν. Εδώ δηλώνεται **ποια** εργασία είναι.
 *
 * @module lib/cron/jobs/stay-channel-import.job
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { pollStayChannels } from '@/services/stay-calendar/stay-channel-poll.service';
import type { CronJobResult } from '@/types/cron-schedule';

/**
 * Ένα πέρασμα: «διάβασε ό,τι οφείλεται».
 *
 * ⚠️ **Κάθε κάδος εκπέμπεται, ΚΑΙ ΟΤΑΝ ΕΙΝΑΙ ΜΗΔΕΝ** — ίδιος κανόνας με το
 * `mandate-expiry`: ένα `feeds: 0` που λείπει διαβάζεται και ως «όλα φρέσκα» και ως
 * «κανείς δεν κοίταξε».
 */
export async function runStayChannelImport(): Promise<CronJobResult> {
  const report = await pollStayChannels(getAdminFirestore());

  return {
    summary:
      `properties ${report.properties}, feeds ${report.feeds}, ` +
      `+${report.created} ~${report.updated} -${report.deleted}, ` +
      `failed ${report.failed}, unreadable ${report.unreadable}` +
      (report.truncated ? ', TRUNCATED' : ''),
    metrics: {
      properties: report.properties,
      feeds: report.feeds,
      created: report.created,
      updated: report.updated,
      deleted: report.deleted,
      failed: report.failed,
      unreadable: report.unreadable,
      truncated: report.truncated ? 1 : 0,
    },
  };
}
