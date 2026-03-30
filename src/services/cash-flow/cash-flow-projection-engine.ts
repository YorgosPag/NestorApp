/**
 * @fileoverview Cash Flow Projection Engine — ADR-268 Phase 8
 * @description Pure functions for cash flow forecasting. Zero side effects.
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, <500 lines, <40 lines/fn
 */

import type {
  CashFlowMonthRow,
  ScenarioProjection,
  CashFlowScenario,
  RecurringPayment,
  RawCashFlowData,
  RawInstallment,
  RawCheque,
  RawPurchaseOrder,
  RawInvoice,
  RawEFKA,
} from './cash-flow.types';

import { SCENARIO_RATES } from './cash-flow.types';

// =============================================================================
// MONTH UTILITIES
// =============================================================================

/** Generate array of 'YYYY-MM' keys for N months starting from today */
export function generateMonthKeys(count: number, startDate?: Date): string[] {
  const start = startDate ?? new Date();
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    keys.push(formatMonthKey(d));
  }
  return keys;
}

/** Format Date → 'YYYY-MM' */
export function formatMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Human-readable month label: 'YYYY-MM' → 'Jan 2026' */
export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** Extract 'YYYY-MM' from ISO date string */
export function extractMonthKey(isoDate: string): string {
  return isoDate.substring(0, 7);
}

// =============================================================================
// BUCKETING — Generic monthly aggregation
// =============================================================================

/** Bucket items into months, summing amounts */
export function bucketByMonth<T>(
  items: T[],
  dateExtractor: (item: T) => string,
  amountExtractor: (item: T) => number,
  monthKeys: string[],
): Map<string, number> {
  const buckets = new Map<string, number>();
  for (const key of monthKeys) {
    buckets.set(key, 0);
  }
  for (const item of items) {
    const key = extractMonthKey(dateExtractor(item));
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + amountExtractor(item));
    }
  }
  return buckets;
}

/** Count items per month */
export function countByMonth<T>(
  items: T[],
  dateExtractor: (item: T) => string,
  monthKeys: string[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const key of monthKeys) {
    counts.set(key, 0);
  }
  for (const item of items) {
    const key = extractMonthKey(dateExtractor(item));
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

// =============================================================================
// RECURRING PAYMENTS EXPANSION (Q4)
// =============================================================================

/** Expand recurring payments into monthly amounts */
export function expandRecurringPayments(
  payments: RecurringPayment[],
  monthKeys: string[],
): Map<string, number> {
  const result = new Map<string, number>();
  for (const key of monthKeys) {
    result.set(key, 0);
  }

  for (const payment of payments) {
    const startKey = extractMonthKey(payment.startDate);
    const endKey = payment.endDate ? extractMonthKey(payment.endDate) : null;

    for (const key of monthKeys) {
      if (key < startKey) continue;
      if (endKey && key > endKey) continue;
      if (isPaymentDueInMonth(payment, key)) {
        result.set(key, (result.get(key) ?? 0) + payment.amount);
      }
    }
  }

  return result;
}

/** Check if a recurring payment falls in a specific month */
function isPaymentDueInMonth(
  payment: RecurringPayment,
  monthKey: string,
): boolean {
  const [, monthNum] = monthKey.split('-').map(Number);

  switch (payment.frequency) {
    case 'monthly':
      return true;
    case 'quarterly':
      return monthNum % 3 === 0;
    case 'annual': {
      const startMonth = Number(payment.startDate.substring(5, 7));
      return monthNum === startMonth;
    }
    default:
      return false;
  }
}

// =============================================================================
// INFLOW / OUTFLOW COMPUTATION
// =============================================================================

interface MonthlyInflows {
  installments: Map<string, number>;
  cheques: Map<string, number>;
  chequeCounts: Map<string, number>;
}

/** Compute inflow buckets from installments + cheques */
export function computeInflows(
  installments: RawInstallment[],
  cheques: RawCheque[],
  monthKeys: string[],
): MonthlyInflows {
  const pendingInstallments = installments.filter(
    (i) => i.status === 'pending' || i.status === 'due',
  );
  const activeCheques = cheques.filter(
    (c) =>
      c.direction === 'incoming' &&
      !['cleared', 'bounced', 'cancelled', 'expired', 'replaced'].includes(c.status),
  );

  return {
    installments: bucketByMonth(
      pendingInstallments,
      (i) => i.dueDate,
      (i) => i.amount - i.paidAmount,
      monthKeys,
    ),
    cheques: bucketByMonth(
      activeCheques,
      (c) => c.maturityDate,
      (c) => c.amount,
      monthKeys,
    ),
    chequeCounts: countByMonth(
      activeCheques,
      (c) => c.maturityDate,
      monthKeys,
    ),
  };
}

interface MonthlyOutflows {
  purchaseOrders: Map<string, number>;
  invoices: Map<string, number>;
  efka: Map<string, number>;
  recurring: Map<string, number>;
}

/** Compute outflow buckets from POs, invoices, EFKA, recurring */
export function computeOutflows(
  pos: RawPurchaseOrder[],
  invoices: RawInvoice[],
  efka: RawEFKA[],
  recurringPayments: RecurringPayment[],
  monthKeys: string[],
): MonthlyOutflows {
  const activePOs = pos.filter(
    (p) => p.paymentDueDate && !['closed', 'cancelled'].includes(p.status),
  );
  const unpaidInvoices = invoices.filter(
    (inv) => inv.paymentStatus !== 'paid' && inv.dueDate,
  );
  const pendingEFKA = efka.filter(
    (e) => e.status !== 'paid' && e.status !== 'keao',
  );

  return {
    purchaseOrders: bucketByMonth(
      activePOs,
      (p) => p.paymentDueDate,
      (p) => p.total,
      monthKeys,
    ),
    invoices: bucketByMonth(
      unpaidInvoices,
      (inv) => inv.dueDate,
      (inv) => inv.balanceDue,
      monthKeys,
    ),
    efka: bucketByMonth(
      pendingEFKA,
      (e) => e.dueDate,
      (e) => e.amount,
      monthKeys,
    ),
    recurring: expandRecurringPayments(recurringPayments, monthKeys),
  };
}

// =============================================================================
// PROJECTION BUILDER
// =============================================================================

/** Build a single scenario projection */
export function buildProjection(
  inflows: MonthlyInflows,
  outflows: MonthlyOutflows,
  initialBalance: number,
  scenario: CashFlowScenario,
  monthKeys: string[],
): ScenarioProjection {
  const rate = SCENARIO_RATES[scenario];
  const months: CashFlowMonthRow[] = [];

  let runningBalance = initialBalance;
  let totalInflow = 0;
  let totalOutflow = 0;
  let lowestBalance = initialBalance;
  let lowestBalanceMonth = monthKeys[0] ?? '';

  for (const key of monthKeys) {
    const openingBalance = runningBalance;

    const installmentsDue = (inflows.installments.get(key) ?? 0) * rate;
    const chequeAmt = inflows.cheques.get(key) ?? 0;
    const chequeCnt = inflows.chequeCounts.get(key) ?? 0;
    const inflow = installmentsDue + chequeAmt;

    const poAmt = outflows.purchaseOrders.get(key) ?? 0;
    const invAmt = outflows.invoices.get(key) ?? 0;
    const efkaAmt = outflows.efka.get(key) ?? 0;
    const recurAmt = outflows.recurring.get(key) ?? 0;
    const outflow = poAmt + invAmt + efkaAmt + recurAmt;

    const net = inflow - outflow;
    runningBalance += net;
    totalInflow += inflow;
    totalOutflow += outflow;

    if (runningBalance < lowestBalance) {
      lowestBalance = runningBalance;
      lowestBalanceMonth = key;
    }

    months.push({
      month: key,
      label: monthLabel(key),
      openingBalance,
      installmentsDue,
      chequesMaturingAmount: chequeAmt,
      chequesMaturingCount: chequeCnt,
      otherInflows: 0,
      totalInflow: inflow,
      purchaseOrders: poAmt,
      invoicesDue: invAmt,
      efka: efkaAmt,
      recurringPayments: recurAmt,
      totalOutflow: outflow,
      netCashFlow: net,
      closingBalance: runningBalance,
    });
  }

  const avgMonthlyOutflow =
    monthKeys.length > 0 ? totalOutflow / monthKeys.length : 0;
  const cashRunwayMonths =
    avgMonthlyOutflow > 0
      ? Math.floor(runningBalance / avgMonthlyOutflow)
      : 999;

  return {
    scenario,
    collectionRate: rate,
    months,
    totalInflow,
    totalOutflow,
    endingBalance: runningBalance,
    lowestBalance,
    lowestBalanceMonth,
    cashRunwayMonths,
  };
}

// =============================================================================
// ORCHESTRATOR — Build all 3 scenarios
// =============================================================================

const SCENARIOS: CashFlowScenario[] = ['optimistic', 'realistic', 'pessimistic'];

/** Build all 3 scenario projections from raw data */
export function buildAllScenarios(
  rawData: RawCashFlowData,
  monthCount: number = 12,
  startDate?: Date,
): ScenarioProjection[] {
  const monthKeys = generateMonthKeys(monthCount, startDate);
  const inflows = computeInflows(rawData.installments, rawData.cheques, monthKeys);
  const outflows = computeOutflows(
    rawData.purchaseOrders,
    rawData.invoices,
    rawData.efka,
    rawData.config.recurringPayments,
    monthKeys,
  );

  return SCENARIOS.map((scenario) =>
    buildProjection(inflows, outflows, rawData.config.initialBalance, scenario, monthKeys),
  );
}

