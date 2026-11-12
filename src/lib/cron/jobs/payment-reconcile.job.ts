/**
 * =============================================================================
 * JOB: payment-reconcile — **ΠΛΗΡΩΘΗΚΕ, ΚΙ ΑΣ ΜΗΝ ΗΡΘΕ ΤΟ WEBHOOK** (ADR-ACC-030 §5)
 * =============================================================================
 *
 * Το δίχτυ ασφαλείας κάτω από το webhook του παρόχου πληρωμών: ρωτά τον πάροχο για κάθε ανοιχτή συνεδρία πληρωμής
 * και καταγράφει ό,τι εισπράχθηκε, με τον ίδιο συγχρονισμό (δες `payment-reconcile.service`). Δεύτερο πέρασμα: οι
 * πληρωμές με **πρόσφατη επιστροφή** στον πάροχο (`payment-refund-reconcile.service`) — η συνεδρία τους είναι ήδη
 * `paid`, άρα το πρώτο πέρασμα δεν θα έβλεπε ποτέ επιστροφή με χαμένο webhook.
 *
 * 🔑 **Καμία νέα υποδομή** (ADR-740): lease, ταυτότητα μηχανής→μηχανής, monitor και catch-up υπάρχουν.
 *
 * @module lib/cron/jobs/payment-reconcile.job
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { reconcilePendingCheckouts } from '@/server/accounting/payments/payment-reconcile.service';
import { reconcileRecentRefunds } from '@/server/accounting/payments/payment-refund-reconcile.service';
import type { CronJobResult } from '@/types/cron-schedule';

/** ⚠️ Κάθε κάδος εκπέμπεται, **και όταν είναι μηδέν** — αλλιώς «δεν έγινε τίποτα» = «κανείς δεν κοίταξε». */
export async function runPaymentReconcile(): Promise<CronJobResult> {
  const db = getAdminFirestore();
  const nowMs = Date.now();
  const report = await reconcilePendingCheckouts(db, nowMs);
  const refunds = await reconcileRecentRefunds(db, nowMs);
  return {
    summary:
      `pending ${report.considered}, recorded ${report.recorded}, expired ${report.expired}, ` +
      `still-open ${report.stillOpen}, failed ${report.failed}` + (report.truncated ? ', TRUNCATED' : '') +
      ` · refunds checked ${refunds.checked}, recorded ${refunds.recorded}, unmatched ${refunds.unmatched}, ` +
      `failed ${refunds.failed}` + (refunds.truncated ? ', TRUNCATED' : ''),
    metrics: {
      considered: report.considered,
      recorded: report.recorded,
      expired: report.expired,
      stillOpen: report.stillOpen,
      failed: report.failed,
      truncated: report.truncated ? 1 : 0,
      refundsChecked: refunds.checked,
      refundsRecorded: refunds.recorded,
      refundsUnmatched: refunds.unmatched,
      refundsFailed: refunds.failed,
      refundsTruncated: refunds.truncated ? 1 : 0,
    },
  };
}
