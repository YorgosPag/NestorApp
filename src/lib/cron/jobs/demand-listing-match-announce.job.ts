/**
 * =============================================================================
 * JOB: demand-listing-match-announce — «βγήκε αγγελία που ταιριάζει στη ζήτησή σου»
 * =============================================================================
 *
 * Η αντίθετη κατεύθυνση από το `demand-interest-announce.job.ts`: εκείνο λέει στον
 * **ιδιοκτήτη** «πόσοι σε ψάχνουν», αυτό λέει στον **ζητούντα** «εμφανίστηκε κάτι που
 * ζήτησες». Ίδια υποδομή (ADR-740 `CRON_SCHEDULE` + `verifyCronAuthorization` +
 * lease + Sentry monitor) — δες την κεφαλίδα του αδελφού job για το γιατί ζει εδώ και
 * όχι σε Firestore trigger· το σκεπτικό είναι ταυτόσημο.
 *
 * ⚠️ **Δεν πιάνει σφάλματα, σκόπιμα.** Ο dispatcher τα πιάνει· ένα `try/catch` εδώ θα
 * έκανε μια αποτυχημένη σάρωση να **φαίνεται επιτυχημένη**.
 *
 * @module lib/cron/jobs/demand-listing-match-announce
 * @see ADR-740 — το πρόγραμμα ζει στο src/config/cron-schedule.ts
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  announceListingMatchesToDemandAuthors,
  type ListingMatchReport,
} from '@/services/demand/listing-match-notifier.service';
import type { CronJobResult } from '@/types/cron-schedule';

/**
 * Η αναφορά ως μετρήσιμα μεγέθη.
 *
 * ⚠️ **Κάθε κάδος εκπέμπεται, ΚΑΙ ΟΤΑΝ ΕΙΝΑΙ ΜΗΔΕΝ** — ίδιο σκεπτικό με το αδελφό job:
 * ένα `announced` που λείπει διαβάζεται εξίσου ως «τίποτα δεν στάλθηκε» και ως «κανείς
 * δεν μέτρησε», και η διάκριση είναι ο πυρήνας του ADR-777.
 */
function metricsOf(report: ListingMatchReport): Record<string, number> {
  return {
    announced: report.announced,
    alreadyKnown: report.alreadyKnown,
    optedOut: report.optedOut,
    considered: report.considered,
    demandsConsidered: report.demandsConsidered,
    demandsTruncated: report.demandsTruncated,
    truncated: report.truncated ? 1 : 0,
  };
}

/** Ένα πέρασμα: «πες σε κάθε ζητούντα ό,τι νέο ταιριάζει». */
export async function runDemandListingMatchAnnounce(): Promise<CronJobResult> {
  const db = getAdminFirestore();
  const report = await announceListingMatchesToDemandAuthors(db);
  const metrics = metricsOf(report);

  return {
    summary:
      `announced ${metrics.announced}, already-known ${metrics.alreadyKnown}, ` +
      `opted-out ${metrics.optedOut} (considered ${metrics.considered} ζεύγη σε ` +
      `${metrics.demandsConsidered} ζητήσεις` +
      `${metrics.demandsTruncated > 0 ? `, ${metrics.demandsTruncated} ζητήσεις TRUNCATED` : ''}` +
      `${metrics.truncated === 1 ? ', ΔΕΞΑΜΕΝΗ TRUNCATED' : ''})`,
    metrics,
  };
}
