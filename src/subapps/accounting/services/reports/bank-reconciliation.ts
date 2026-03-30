/**
 * @fileoverview Bank Reconciliation Report Generator (Phase 2c)
 * @description Κατάσταση Τραπεζικής Συμφωνίας — match status overview
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q6 (Report #5)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { BankTransaction } from '../../types/bank';
import type {
  ReportGeneratorDeps,
  ResolvedPeriods,
  ReportResult,
  BankReconciliationData,
  BankReconciliationItem,
} from '../../types/reports';
import { buildNumericComparative } from './comparative-engine';

const REPORT_PAGE_SIZE = 10000;

/** Generate Bank Reconciliation Statement with comparative analysis */
export async function generateBankReconciliation(
  deps: ReportGeneratorDeps,
  periods: ResolvedPeriods
): Promise<ReportResult<BankReconciliationData>> {
  const [current, previous, yoy] = await Promise.all([
    fetchBankStats(deps, periods.current),
    fetchBankStats(deps, periods.previousPeriod),
    fetchBankStats(deps, periods.yearOverYear),
  ]);

  return {
    reportType: 'bank_reconciliation',
    generatedAt: new Date().toISOString(),
    period: periods,
    data: {
      totalTransactions: buildNumericComparative(
        current.total, previous.total, yoy.total
      ),
      matchedCount: buildNumericComparative(
        current.matched, previous.matched, yoy.matched
      ),
      unmatchedCount: buildNumericComparative(
        current.unmatched, previous.unmatched, yoy.unmatched
      ),
      excludedCount: buildNumericComparative(
        current.excluded, previous.excluded, yoy.excluded
      ),
      matchRate: buildNumericComparative(
        current.matchRate, previous.matchRate, yoy.matchRate
      ),
      totalCredits: buildNumericComparative(
        current.credits, previous.credits, yoy.credits
      ),
      totalDebits: buildNumericComparative(
        current.debits, previous.debits, yoy.debits
      ),
      unmatchedItems: current.unmatchedItems,
    },
  };
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

interface BankStats {
  total: number;
  matched: number;
  unmatched: number;
  excluded: number;
  matchRate: number;
  credits: number;
  debits: number;
  unmatchedItems: BankReconciliationItem[];
}

async function fetchBankStats(
  deps: ReportGeneratorDeps,
  period: { from: string; to: string }
): Promise<BankStats> {
  const result = await deps.repository.listBankTransactions(
    { dateRange: period },
    REPORT_PAGE_SIZE
  );
  return computeStats(result.items);
}

function computeStats(transactions: BankTransaction[]): BankStats {
  let matched = 0;
  let unmatched = 0;
  let excluded = 0;
  let credits = 0;
  let debits = 0;
  const unmatchedItems: BankReconciliationItem[] = [];

  for (const txn of transactions) {
    if (txn.matchStatus === 'auto_matched' || txn.matchStatus === 'manual_matched') {
      matched++;
    } else if (txn.matchStatus === 'excluded') {
      excluded++;
    } else {
      unmatched++;
      unmatchedItems.push({
        transactionId: txn.transactionId,
        date: txn.transactionDate,
        description: txn.bankDescription,
        amount: txn.amount,
        direction: txn.direction,
      });
    }

    if (txn.direction === 'credit') {
      credits += txn.amount;
    } else {
      debits += txn.amount;
    }
  }

  const total = transactions.length;
  const matchRate = total > 0 ? (matched / total) * 100 : 0;

  return { total, matched, unmatched, excluded, matchRate, credits, debits, unmatchedItems };
}
