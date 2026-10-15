/**
 * @fileoverview AR Aging Report Generator (Phase 2c)
 * @description Ηλικίωση Απαιτήσεων — ανοιχτά στοιχεία ΟΛΩΝ των χρήσεων στο τέλος κάθε περιόδου σύγκρισης
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q6 (Report #3)
 * @see ADR-ACC-010 §2.1.1 (Φάση 3, 2026-10-15)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 *
 * 🔴 Ως 2026-10-15 διάβαζε `listCustomerBalances(έτος)` ×3: ερώτημα ΧΩΡΙΣ δείκτη (σφάλμα ⇒ fallback ⇒ αναφορά
 *   ΠΑΝΤΑ κενή), πάνω σε έγγραφα όπου κάθε χρήση έσβηνε την άλλη. Τώρα: ΜΙΑ σάρωση των παραστατικών ως την πιο
 *   πρόσφατη ημερομηνία αναφοράς, και η εικόνα ΚΑΘΕ περιόδου ξαναχτίζεται από τα πρωτογενή «όπως ήταν τότε»
 *   (πληρωμές και πιστωτικά ως εκείνη την ημέρα) — αυτό που η «as at» αναφορά του Xero δεν κάνει.
 */

import type { AgingBuckets } from '../../types/customer-balance';
import type { Invoice } from '../../types/invoice';
import type {
  ReportGeneratorDeps,
  ResolvedPeriods,
  ReportResult,
  ARAgingData,
  ARAgingCustomerRow,
} from '../../types/reports';
import { buildComparative, buildNumericComparative } from './comparative-engine';
import { nowISO } from '@/lib/date-local';
import { accountingToday } from '../../utils/accounting-day';
import { roundToTwo } from '../../utils/math';
import {
  groupInvoicesByCustomer,
  sumAgingBuckets,
  summarizeReceivables,
} from '../receivables/receivables-ledger';

/** Generate AR Aging report with comparative analysis */
export async function generateARAgingReport(
  deps: ReportGeneratorDeps,
  periods: ResolvedPeriods
): Promise<ReportResult<ARAgingData>> {
  const today = deps.asOf ?? accountingToday();
  const asOf = {
    current: agingDateOf(periods.current.to, today),
    previous: agingDateOf(periods.previousPeriod.to, today),
    yoy: agingDateOf(periods.yearOverYear.to, today),
  };
  const latest = [asOf.current, asOf.previous, asOf.yoy].reduce((a, b) => (a > b ? a : b));
  const invoices = await deps.repository.collectInvoices({ scope: { kind: 'receivables', asOf: latest } });
  const { byCustomer } = groupInvoicesByCustomer(invoices);

  const current = agingRowsAsOf(byCustomer, asOf.current);
  const previous = agingRowsAsOf(byCustomer, asOf.previous);
  const yoy = agingRowsAsOf(byCustomer, asOf.yoy);

  return {
    reportType: 'ar_aging',
    generatedAt: nowISO(),
    period: periods,
    data: {
      customers: buildComparative(current, previous, yoy, sumOutstanding),
      totals: buildComparative(totalsOf(current), totalsOf(previous), totalsOf(yoy), totalFromBuckets),
      totalOutstanding: buildNumericComparative(sumOutstanding(current), sumOutstanding(previous), sumOutstanding(yoy)),
    },
  };
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/** Η ηλικίωση μιας περιόδου μετριέται στο τέλος της — όχι στο μέλλον (περίοδος σε εξέλιξη ⇒ σήμερα). */
function agingDateOf(periodEnd: string, today: string): string {
  const end = periodEnd.slice(0, 10);
  return end < today ? end : today;
}

/** Οι πελάτες που ΜΑΣ ΟΦΕΙΛΟΥΝ στις `asOf`, μεγαλύτερη οφειλή πρώτη. */
function agingRowsAsOf(byCustomer: ReadonlyMap<string, Invoice[]>, asOf: string): ARAgingCustomerRow[] {
  const rows: ARAgingCustomerRow[] = [];
  for (const [customerId, invoices] of byCustomer) {
    const position = summarizeReceivables(customerId, invoices, asOf);
    if (position.netBalance <= 0) continue;
    rows.push({
      customerId,
      customerName: position.customerName,
      aging: position.aging,
      totalOutstanding: position.netBalance,
      invoiceCount: position.invoiceCount,
    });
  }
  return rows.sort((a, b) => b.totalOutstanding - a.totalOutstanding);
}

function sumOutstanding(rows: readonly ARAgingCustomerRow[]): number {
  return roundToTwo(rows.reduce((sum, r) => sum + r.totalOutstanding, 0));
}

function totalsOf(rows: readonly ARAgingCustomerRow[]): AgingBuckets {
  return sumAgingBuckets(rows.map((r) => r.aging));
}

function totalFromBuckets(buckets: AgingBuckets): number {
  return roundToTwo(buckets.current + buckets.days1_30 + buckets.days31_60
    + buckets.days61_90 + buckets.days91_120 + buckets.days120plus);
}
