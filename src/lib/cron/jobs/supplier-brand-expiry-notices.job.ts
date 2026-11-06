/**
 * =============================================================================
 * JOB: supplier-brand-expiry-notices — **Η ΜΑΡΚΑ ΣΑΣ ΛΗΓΕΙ** (ADR-923 §16)
 * =============================================================================
 *
 * Η εγκεκριμένη μάρκα ενός χώρου λήγει σε 30 · 7 ημέρες · σήμερα, ή έληξε ⇒ οι διαχειριστές του χώρου μαθαίνουν, ώστε να
 * ανεβάσουν νέα απόδειξη πριν φύγει η μάρκα από τη δημόσια σελίδα. Ένα μήνυμα ανά σκαλί.
 *
 * 🔑 **Καμία νέα υποδομή** (ADR-740): περιοδική εκτέλεση, ταυτότητα, lease, monitor και catch-up υπάρχουν όλα. Εδώ
 * δηλώνεται **ποια** εργασία είναι.
 *
 * @module lib/cron/jobs/supplier-brand-expiry-notices.job
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { sweepSupplierBrandExpiryNotices } from '@/server/catalog/supplier-brand-expiry-notices.server';
import type { CronJobResult } from '@/types/cron-schedule';

export async function runSupplierBrandExpiryNotices(): Promise<CronJobResult> {
  const report = await sweepSupplierBrandExpiryNotices(getAdminFirestore());
  return {
    summary:
      `considered ${report.considered}, notified ${report.notified}, skipped ${report.skipped}, failed ${report.failed}`
      + (report.truncated ? ', TRUNCATED' : ''),
    metrics: {
      considered: report.considered,
      notified: report.notified,
      skipped: report.skipped,
      failed: report.failed,
      truncated: report.truncated ? 1 : 0,
    },
  };
}
