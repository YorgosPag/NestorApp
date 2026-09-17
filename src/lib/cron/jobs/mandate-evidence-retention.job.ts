/**
 * =============================================================================
 * JOB: mandate-evidence-retention — **ΚΛΕΙΔΩΜΑ ΚΑΙ ΔΙΑΘΕΣΗ ΑΠΟΔΕΙΚΤΙΚΩΝ** (ADR-864 §20)
 * =============================================================================
 *
 * Το αποδεικτικό μιας βεβαίωσης κρατιέται όσο ζει η σχέση γραφείου–ακινήτου (GCS temporary hold), κλειδώνεται
 * σε **Locked** retention όταν η σχέση λήξει (ως 31/12 του έτους λήξης + 5 έτη), και διατίθεται όταν περάσει
 * η ημερομηνία — με το **αποτύπωμα** να μένει στο μητρώο. Η κρίση ζει στο `lib/mandate/evidence-retention.ts`.
 *
 * 🔑 **Καμία νέα υποδομή** (ADR-740): lease, monitor, catch-up υπάρχουν· εδώ δηλώνεται **ποια** εργασία είναι.
 *
 * @module lib/cron/jobs/mandate-evidence-retention.job
 */

import 'server-only';

import { nowISO } from '@/lib/date-local';
import { getAdminBucket, getAdminFirestore } from '@/lib/firebaseAdmin';
import { runEvidenceRetention } from '@/services/mandate/evidence-retention.service';
import type { CronJobResult } from '@/types/cron-schedule';

/** ⚠️ Κάθε κάδος εκπέμπεται, **και όταν είναι μηδέν** — «0 αδέσποτα» ≠ «δεν κοίταξε κανείς». */
export async function runMandateEvidenceRetention(): Promise<CronJobResult> {
  const report = await runEvidenceRetention(getAdminFirestore(), getAdminBucket(), nowISO());
  return {
    summary:
      `considered ${report.considered}, retained ${report.retained}, disposed ${report.disposed}, ` +
      `kept ${report.kept}, adopted ${report.adopted}, stray ${report.stray}, failed ${report.failed}` +
      (report.truncated ? ', TRUNCATED' : ''),
    metrics: {
      considered: report.considered,
      retained: report.retained,
      disposed: report.disposed,
      kept: report.kept,
      adopted: report.adopted,
      stray: report.stray,
      failed: report.failed,
      truncated: report.truncated ? 1 : 0,
    },
  };
}
