/**
 * @fileoverview Cash Flow Analysis — Actuals, PDC Calendar, Alerts
 * @description Extracted from projection engine for SRP (<500 lines per file).
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, <500 lines
 */

import type {
  ScenarioProjection,
  ActualVsForecast,
  PDCCalendarDay,
  CashFlowAlert,
  AlertThresholds,
  RawBankTransaction,
  RawCheque,
} from './cash-flow.types';

import { DEFAULT_ALERT_THRESHOLDS } from './cash-flow.types';
import { formatMonthKey, extractMonthKey } from './cash-flow-projection-engine';

// =============================================================================
// FORECAST VS ACTUAL (Q9)
// =============================================================================

/** Compare forecast with actual bank transactions for past months */
export function computeActualVsForecast(
  realisticProjection: ScenarioProjection,
  bankTransactions: RawBankTransaction[],
): ActualVsForecast[] {
  const now = new Date();
  const currentMonthKey = formatMonthKey(now);
  const pastMonths = realisticProjection.months.filter(
    (m) => m.month < currentMonthKey,
  );

  return pastMonths.map((forecastMonth) => {
    const monthTxns = bankTransactions.filter(
      (t) => extractMonthKey(t.valueDate) === forecastMonth.month,
    );
    const actualInflow = monthTxns
      .filter((t) => t.direction === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);
    const actualOutflow = monthTxns
      .filter((t) => t.direction === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);

    const inflowVar = actualInflow - forecastMonth.totalInflow;
    const outflowVar = actualOutflow - forecastMonth.totalOutflow;

    return {
      month: forecastMonth.month,
      label: forecastMonth.label,
      forecastInflow: forecastMonth.totalInflow,
      actualInflow,
      inflowVariance: inflowVar,
      inflowVariancePct: safePct(inflowVar, forecastMonth.totalInflow),
      forecastOutflow: forecastMonth.totalOutflow,
      actualOutflow,
      outflowVariance: outflowVar,
      outflowVariancePct: safePct(outflowVar, forecastMonth.totalOutflow),
      forecastBalance: forecastMonth.closingBalance,
      actualBalance: actualInflow - actualOutflow,
    };
  });
}

function safePct(variance: number, base: number): number {
  if (base === 0) return 0;
  return Math.round((variance / base) * 10000) / 100;
}

// =============================================================================
// PDC CALENDAR (Q6)
// =============================================================================

/** Group incoming cheques by maturity date for calendar view */
export function buildPDCCalendar(cheques: RawCheque[]): PDCCalendarDay[] {
  const incoming = cheques.filter(
    (c) =>
      c.direction === 'incoming' &&
      !['cleared', 'bounced', 'cancelled', 'expired', 'replaced'].includes(c.status),
  );

  const dayMap = new Map<string, PDCCalendarDay>();

  for (const cheque of incoming) {
    const dateKey = cheque.maturityDate.substring(0, 10);
    const existing = dayMap.get(dateKey);

    if (existing) {
      existing.totalAmount += cheque.amount;
      existing.chequeCount += 1;
      existing.cheques.push({
        id: cheque.chequeId,
        amount: cheque.amount,
        drawerName: cheque.drawerName,
        status: cheque.status,
        chequeNumber: cheque.chequeNumber,
      });
    } else {
      dayMap.set(dateKey, {
        date: dateKey,
        totalAmount: cheque.amount,
        chequeCount: 1,
        cheques: [{
          id: cheque.chequeId,
          amount: cheque.amount,
          drawerName: cheque.drawerName,
          status: cheque.status,
          chequeNumber: cheque.chequeNumber,
        }],
      });
    }
  }

  return Array.from(dayMap.values()).sort(
    (a, b) => a.date.localeCompare(b.date),
  );
}

// =============================================================================
// ALERTS (Q10)
// =============================================================================

/** Generate alerts based on projection data */
export function generateAlerts(
  scenarios: ScenarioProjection[],
  cheques: RawCheque[],
  thresholds: AlertThresholds = DEFAULT_ALERT_THRESHOLDS,
): CashFlowAlert[] {
  const alerts: CashFlowAlert[] = [];
  const realistic = scenarios.find((s) => s.scenario === 'realistic');
  if (!realistic) return alerts;

  generateLowCashAlerts(realistic, thresholds, alerts);
  generatePDCAlerts(cheques, thresholds, alerts);
  generateCollectionRateAlerts(realistic, thresholds, alerts);

  return alerts;
}

function generateLowCashAlerts(
  projection: ScenarioProjection,
  thresholds: AlertThresholds,
  alerts: CashFlowAlert[],
): void {
  for (const month of projection.months) {
    if (month.closingBalance < thresholds.lowCashCritical) {
      alerts.push({
        type: 'low-cash',
        severity: 'critical',
        message: `Balance drops below ${thresholds.lowCashCritical} in ${month.label}`,
        month: month.month,
        value: month.closingBalance,
        threshold: thresholds.lowCashCritical,
      });
      break;
    }
    if (month.closingBalance < thresholds.lowCashWarning) {
      alerts.push({
        type: 'low-cash',
        severity: 'warning',
        message: `Balance drops below ${thresholds.lowCashWarning} in ${month.label}`,
        month: month.month,
        value: month.closingBalance,
        threshold: thresholds.lowCashWarning,
      });
      break;
    }
  }
}

function generatePDCAlerts(
  cheques: RawCheque[],
  thresholds: AlertThresholds,
  alerts: CashFlowAlert[],
): void {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + thresholds.pdcMaturityDays);
  const cutoffISO = cutoff.toISOString().substring(0, 10);
  const nowISO = now.toISOString().substring(0, 10);

  const maturing = cheques.filter(
    (c) =>
      c.direction === 'incoming' &&
      c.maturityDate.substring(0, 10) >= nowISO &&
      c.maturityDate.substring(0, 10) <= cutoffISO &&
      !['cleared', 'bounced', 'cancelled', 'expired', 'replaced'].includes(c.status),
  );

  if (maturing.length > 0) {
    const totalAmt = maturing.reduce((s, c) => s + c.amount, 0);
    alerts.push({
      type: 'pdc-maturity',
      severity: 'warning',
      message: `${maturing.length} cheques (€${totalAmt.toLocaleString()}) maturing in the next ${thresholds.pdcMaturityDays} days`,
      value: totalAmt,
    });
  }
}

function generateCollectionRateAlerts(
  projection: ScenarioProjection,
  thresholds: AlertThresholds,
  alerts: CashFlowAlert[],
): void {
  const collectionPct = projection.collectionRate * 100;
  if (collectionPct < thresholds.collectionRateMinPct) {
    alerts.push({
      type: 'collection-rate-drop',
      severity: 'warning',
      message: `Collection rate (${collectionPct}%) is below threshold (${thresholds.collectionRateMinPct}%)`,
      value: collectionPct,
      threshold: thresholds.collectionRateMinPct,
    });
  }
}
