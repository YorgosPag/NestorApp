/* eslint-disable no-restricted-syntax */
/**
 * =============================================================================
 * Aging Calculator — Unit Tests (ADR-265)
 * =============================================================================
 *
 * Pure-function tests for payment aging bucket calculations.
 * Covers: days overdue, bucket classification, aging buckets, entity analysis.
 *
 * @module tests/report-engine/aging-calculator
 * @see ADR-265 §8.6 (Aging Report)
 */

import type { Installment } from '@/types/payment-plan';
import {
  computeDaysOverdue,
  classifyIntoBucket,
  computeAgingBuckets,
  computeAgingForEntity,
} from '../aging-calculator';

// ─── Test Data Factory ─────────────────────────────────────────────────

function makeInstallment(overrides: Partial<Installment> = {}): Installment {
  return {
    index: 0,
    label: 'Installment 1',
    type: 'custom',
    amount: 10000,
    percentage: 0,
    dueDate: '2026-01-15',
    status: 'due',
    paidAmount: 0,
    paidDate: null,
    paymentIds: [],
    notes: null,
    ...overrides,
  } as Installment;
}

// ============================================================================
// computeDaysOverdue
// ============================================================================

describe('computeDaysOverdue', () => {
  it('returns positive days when past due', () => {
    const result = computeDaysOverdue('2026-01-01', new Date('2026-01-31'));
    expect(result).toBe(30);
  });

  it('returns 0 when due date is in the future', () => {
    const result = computeDaysOverdue('2026-12-31', new Date('2026-01-01'));
    expect(result).toBe(0);
  });

  it('returns 0 when due date is today', () => {
    const today = new Date('2026-03-15');
    expect(computeDaysOverdue('2026-03-15', today)).toBe(0);
  });

  it('handles large overdue periods', () => {
    const result = computeDaysOverdue('2025-01-01', new Date('2026-01-01'));
    expect(result).toBe(365);
  });
});

// ============================================================================
// classifyIntoBucket
// ============================================================================

describe('classifyIntoBucket', () => {
  it('classifies 0-30 days as current', () => {
    expect(classifyIntoBucket(0)).toBe('current');
    expect(classifyIntoBucket(1)).toBe('current');
    expect(classifyIntoBucket(30)).toBe('current');
  });

  it('classifies 31-60 days as days31to60', () => {
    expect(classifyIntoBucket(31)).toBe('days31to60');
    expect(classifyIntoBucket(45)).toBe('days31to60');
    expect(classifyIntoBucket(60)).toBe('days31to60');
  });

  it('classifies 61-90 days as days61to90', () => {
    expect(classifyIntoBucket(61)).toBe('days61to90');
    expect(classifyIntoBucket(90)).toBe('days61to90');
  });

  it('classifies 91-120 days as days91to120', () => {
    expect(classifyIntoBucket(91)).toBe('days91to120');
    expect(classifyIntoBucket(120)).toBe('days91to120');
  });

  it('classifies 120+ days as days120plus', () => {
    expect(classifyIntoBucket(121)).toBe('days120plus');
    expect(classifyIntoBucket(365)).toBe('days120plus');
    expect(classifyIntoBucket(1000)).toBe('days120plus');
  });
});

// ============================================================================
// computeAgingBuckets
// ============================================================================

describe('computeAgingBuckets', () => {
  const asOf = new Date('2026-06-01');

  it('returns 5 buckets, zero-filled when no installments', () => {
    const result = computeAgingBuckets([], asOf);
    expect(result).toHaveLength(5);
    result.forEach(b => {
      expect(b.count).toBe(0);
      expect(b.amount).toBe(0);
      expect(b.percentage).toBe(0);
    });
  });

  it('skips paid installments', () => {
    const installments = [
      makeInstallment({ status: 'paid', dueDate: '2026-01-01', amount: 5000 }),
      makeInstallment({ status: 'waived', dueDate: '2026-01-01', amount: 3000 }),
    ];
    const result = computeAgingBuckets(installments, asOf);
    expect(result.every(b => b.count === 0)).toBe(true);
  });

  it('skips installments not yet due', () => {
    const installments = [
      makeInstallment({ dueDate: '2026-12-01', amount: 5000 }),
    ];
    const result = computeAgingBuckets(installments, asOf);
    expect(result.every(b => b.count === 0)).toBe(true);
  });

  it('classifies overdue installment into correct bucket', () => {
    // 45 days overdue → days31to60 bucket
    const installments = [
      makeInstallment({ dueDate: '2026-04-17', amount: 10000, paidAmount: 0 }),
    ];
    const result = computeAgingBuckets(installments, asOf);
    const bucket = result.find(b => b.key === 'days31to60');
    expect(bucket?.count).toBe(1);
    expect(bucket?.amount).toBe(10000);
    expect(bucket?.percentage).toBe(100);
  });

  it('uses outstanding amount (amount - paidAmount) for partial payments', () => {
    // Partially paid — 7000 out of 10000 paid
    const installments = [
      makeInstallment({ dueDate: '2026-05-15', amount: 10000, paidAmount: 7000 }),
    ];
    const result = computeAgingBuckets(installments, asOf);
    const currentBucket = result.find(b => b.key === 'current');
    expect(currentBucket?.amount).toBe(3000); // outstanding = 10000 - 7000
  });

  it('distributes multiple installments across buckets', () => {
    const installments = [
      makeInstallment({ dueDate: '2026-05-20', amount: 1000, paidAmount: 0 }), // ~12 days → current
      makeInstallment({ dueDate: '2026-04-01', amount: 2000, paidAmount: 0 }), // ~61 days → days61to90
      makeInstallment({ dueDate: '2026-01-01', amount: 3000, paidAmount: 0 }), // ~151 days → days120plus
    ];
    const result = computeAgingBuckets(installments, asOf);

    expect(result.find(b => b.key === 'current')?.count).toBe(1);
    expect(result.find(b => b.key === 'days61to90')?.count).toBe(1);
    expect(result.find(b => b.key === 'days120plus')?.count).toBe(1);
  });

  it('calculates percentages correctly', () => {
    const installments = [
      makeInstallment({ dueDate: '2026-05-20', amount: 2000, paidAmount: 0 }), // current
      makeInstallment({ dueDate: '2026-01-01', amount: 8000, paidAmount: 0 }), // 120+
    ];
    const result = computeAgingBuckets(installments, asOf);
    const total = 2000 + 8000;
    const currentPct = Math.round((2000 / total) * 100);
    const plusPct = Math.round((8000 / total) * 100);

    expect(result.find(b => b.key === 'current')?.percentage).toBe(currentPct);
    expect(result.find(b => b.key === 'days120plus')?.percentage).toBe(plusPct);
  });
});

// ============================================================================
// computeAgingForEntity
// ============================================================================

describe('computeAgingForEntity', () => {
  const asOf = new Date('2026-06-01');

  it('returns complete aging analysis with entity info', () => {
    const installments = [
      makeInstallment({ dueDate: '2026-04-01', amount: 5000, paidAmount: 0 }),
    ];
    const result = computeAgingForEntity('buyer_1', 'Γιάννης', installments, asOf);

    expect(result.entityId).toBe('buyer_1');
    expect(result.entityName).toBe('Γιάννης');
    expect(result.buckets).toHaveLength(5);
    expect(result.totalOverdue).toBe(5000);
    expect(result.totalAmount).toBe(5000);
    expect(result.overduePercentage).toBe(100);
  });

  it('calculates overduePercentage correctly with mixed installments', () => {
    const installments = [
      makeInstallment({ dueDate: '2026-04-01', amount: 3000, paidAmount: 0 }), // overdue
      makeInstallment({ dueDate: '2026-12-01', amount: 7000, paidAmount: 0 }), // not due
    ];
    const result = computeAgingForEntity('buyer_2', 'Μαρία', installments, asOf);

    expect(result.totalOverdue).toBe(3000);
    expect(result.totalAmount).toBe(10000);
    expect(result.overduePercentage).toBe(30);
  });

  it('returns 0% overdue when all installments are paid', () => {
    const installments = [
      makeInstallment({ dueDate: '2026-01-01', amount: 5000, status: 'paid' }),
    ];
    const result = computeAgingForEntity('buyer_3', 'Κώστας', installments, asOf);

    expect(result.totalOverdue).toBe(0);
    expect(result.overduePercentage).toBe(0);
  });

  it('handles empty installments', () => {
    const result = computeAgingForEntity('buyer_4', 'Empty', [], asOf);
    expect(result.totalOverdue).toBe(0);
    expect(result.totalAmount).toBe(0);
    expect(result.overduePercentage).toBe(0);
  });
});
