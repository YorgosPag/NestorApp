/**
 * Aging Calculator — Pure Functions
 *
 * Payment aging bucket υπολογισμοί χωρίς side effects.
 * 5 buckets: 0-30, 31-60, 61-90, 91-120, 120+ ημέρες
 * Ευθυγραμμισμένο με ReportAgingTable.tsx component.
 *
 * @module services/report-engine/aging-calculator
 * @see ADR-265 §8.6 (Aging Report)
 */

import type { Installment } from '@/types/payment-plan';

// ============================================================================
// TYPES
// ============================================================================

/** 5 standard aging bucket keys — matches ReportAgingTable */
export type AgingBucketKey =
  | 'current'
  | 'days31to60'
  | 'days61to90'
  | 'days91to120'
  | 'days120plus';

/** Single aging bucket result */
export interface AgingBucketResult {
  key: AgingBucketKey;
  count: number;
  amount: number;
  /** Percentage of total overdue amount (0-100) */
  percentage: number;
}

/** Complete aging analysis for a specific entity (buyer, project, etc.) */
export interface AgingAnalysis {
  entityId: string;
  entityName: string;
  buckets: AgingBucketResult[];
  /** Total overdue amount across all buckets */
  totalOverdue: number;
  /** Total amount (including non-overdue) */
  totalAmount: number;
  /** Overdue as percentage of total (0-100) */
  overduePercentage: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Ordered bucket definitions for consistent iteration */
const BUCKET_RANGES: ReadonlyArray<{
  key: AgingBucketKey;
  min: number;
  max: number;
}> = [
  { key: 'current', min: 0, max: 30 },
  { key: 'days31to60', min: 31, max: 60 },
  { key: 'days61to90', min: 61, max: 90 },
  { key: 'days91to120', min: 91, max: 120 },
  { key: 'days120plus', min: 121, max: Infinity },
];

const MS_PER_DAY = 86_400_000;

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Υπολογισμός ημερών καθυστέρησης.
 * Επιστρέφει 0 αν η δόση δεν έχει λήξει ακόμα.
 */
export function computeDaysOverdue(dueDate: string, asOfDate: Date = new Date()): number {
  const due = new Date(dueDate);
  const diff = asOfDate.getTime() - due.getTime();
  return diff > 0 ? Math.floor(diff / MS_PER_DAY) : 0;
}

/** Κατάταξη ημερών σε aging bucket */
export function classifyIntoBucket(daysOverdue: number): AgingBucketKey {
  if (daysOverdue <= 30) return 'current';
  if (daysOverdue <= 60) return 'days31to60';
  if (daysOverdue <= 90) return 'days61to90';
  if (daysOverdue <= 120) return 'days91to120';
  return 'days120plus';
}

/**
 * Ομαδοποίηση installments σε 5 aging buckets.
 *
 * Φιλτράρει μόνο overdue installments (status !== 'paid' | 'waived', dueDate < asOfDate).
 * Χρησιμοποιεί (amount - paidAmount) για partial payments.
 * Επιστρέφει πάντα 5 buckets (zero-filled αν δεν υπάρχουν).
 */
export function computeAgingBuckets(
  installments: Installment[],
  asOfDate: Date = new Date(),
): AgingBucketResult[] {
  const accumulators: Record<AgingBucketKey, { count: number; amount: number }> = {
    current: { count: 0, amount: 0 },
    days31to60: { count: 0, amount: 0 },
    days61to90: { count: 0, amount: 0 },
    days91to120: { count: 0, amount: 0 },
    days120plus: { count: 0, amount: 0 },
  };

  for (const inst of installments) {
    if (inst.status === 'paid' || inst.status === 'waived') continue;

    const daysOverdue = computeDaysOverdue(inst.dueDate, asOfDate);
    if (daysOverdue <= 0) continue;

    const outstanding = Math.max(0, inst.amount - inst.paidAmount);
    if (outstanding <= 0) continue;

    const bucket = classifyIntoBucket(daysOverdue);
    accumulators[bucket].count += 1;
    accumulators[bucket].amount += outstanding;
  }

  const totalOverdue = BUCKET_RANGES.reduce(
    (sum, { key }) => sum + accumulators[key].amount,
    0,
  );

  return BUCKET_RANGES.map(({ key }) => ({
    key,
    count: accumulators[key].count,
    amount: accumulators[key].amount,
    percentage: totalOverdue > 0
      ? Math.round((accumulators[key].amount / totalOverdue) * 100)
      : 0,
  }));
}

/**
 * Full aging analysis για ένα entity (buyer, project, κλπ.)
 */
export function computeAgingForEntity(
  entityId: string,
  entityName: string,
  installments: Installment[],
  asOfDate: Date = new Date(),
): AgingAnalysis {
  const buckets = computeAgingBuckets(installments, asOfDate);
  const totalOverdue = buckets.reduce((sum, b) => sum + b.amount, 0);
  const totalAmount = installments.reduce((sum, i) => sum + i.amount, 0);

  return {
    entityId,
    entityName,
    buckets,
    totalOverdue,
    totalAmount,
    overduePercentage: totalAmount > 0
      ? Math.round((totalOverdue / totalAmount) * 100)
      : 0,
  };
}
