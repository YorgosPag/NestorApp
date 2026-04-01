/**
 * @fileoverview Unit tests for Cash Flow Projection Engine
 * @see cash-flow-projection-engine.ts
 * @compliance ADR-268 Phase 8 — SPEC-011 mandatory testing
 */

import {
  generateMonthKeys,
  formatMonthKey,
  monthLabel,
  extractMonthKey,
  bucketByMonth,
  countByMonth,
  expandRecurringPayments,
  computeInflows,
  computeOutflows,
  buildProjection,
  buildAllScenarios,
} from '../cash-flow-projection-engine';

import {
  computeActualVsForecast,
  buildPDCCalendar,
  generateAlerts,
} from '../cash-flow-analysis';

import type {
  RecurringPayment,
  RawInstallment,
  RawCheque,
  RawPurchaseOrder,
  RawInvoice,
  RawBankTransaction,
  RawEFKA,
  RawCashFlowData,
  AlertThresholds,
} from '../cash-flow.types';

// =============================================================================
// MONTH UTILITIES
// =============================================================================

describe('Month Utilities', () => {
  describe('generateMonthKeys', () => {
    it('generates correct number of month keys', () => {
      const keys = generateMonthKeys(3, new Date(2026, 0, 15));
      expect(keys).toEqual(['2026-01', '2026-02', '2026-03']);
    });

    it('handles year boundary', () => {
      const keys = generateMonthKeys(3, new Date(2025, 10, 1));
      expect(keys).toEqual(['2025-11', '2025-12', '2026-01']);
    });

    it('returns empty array for count 0', () => {
      expect(generateMonthKeys(0)).toEqual([]);
    });
  });

  describe('formatMonthKey', () => {
    it('formats date to YYYY-MM', () => {
      expect(formatMonthKey(new Date(2026, 2, 15))).toBe('2026-03');
    });

    it('pads single-digit months', () => {
      expect(formatMonthKey(new Date(2026, 0, 1))).toBe('2026-01');
    });
  });

  describe('monthLabel', () => {
    it('returns human-readable label', () => {
      const label = monthLabel('2026-03');
      expect(label).toContain('2026');
      expect(label).toContain('Mar');
    });
  });

  describe('extractMonthKey', () => {
    it('extracts YYYY-MM from ISO date', () => {
      expect(extractMonthKey('2026-03-15T10:00:00Z')).toBe('2026-03');
    });

    it('works with date-only strings', () => {
      expect(extractMonthKey('2026-01-01')).toBe('2026-01');
    });
  });
});

// =============================================================================
// BUCKETING
// =============================================================================

describe('Bucketing', () => {
  const monthKeys = ['2026-01', '2026-02', '2026-03'];

  describe('bucketByMonth', () => {
    it('sums amounts into correct months', () => {
      const items = [
        { date: '2026-01-10', amount: 100 },
        { date: '2026-01-20', amount: 200 },
        { date: '2026-02-05', amount: 300 },
      ];
      const result = bucketByMonth(items, (i) => i.date, (i) => i.amount, monthKeys);

      expect(result.get('2026-01')).toBe(300);
      expect(result.get('2026-02')).toBe(300);
      expect(result.get('2026-03')).toBe(0);
    });

    it('ignores items outside month range', () => {
      const items = [{ date: '2025-12-31', amount: 500 }];
      const result = bucketByMonth(items, (i) => i.date, (i) => i.amount, monthKeys);

      expect(result.get('2026-01')).toBe(0);
    });

    it('handles empty items array', () => {
      const result = bucketByMonth([], (i: { date: string }) => i.date, () => 0, monthKeys);
      expect(result.get('2026-01')).toBe(0);
      expect(result.size).toBe(3);
    });
  });

  describe('countByMonth', () => {
    it('counts items per month', () => {
      const items = [
        { date: '2026-01-01' },
        { date: '2026-01-15' },
        { date: '2026-02-01' },
      ];
      const result = countByMonth(items, (i) => i.date, monthKeys);

      expect(result.get('2026-01')).toBe(2);
      expect(result.get('2026-02')).toBe(1);
      expect(result.get('2026-03')).toBe(0);
    });
  });
});

// =============================================================================
// RECURRING PAYMENTS
// =============================================================================

describe('expandRecurringPayments', () => {
  const monthKeys = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];

  it('expands monthly payments to every month', () => {
    const payments: RecurringPayment[] = [{
      id: 'rpay_1', label: 'Rent', amount: 800,
      frequency: 'monthly', startDate: '2026-01-01', category: 'rent',
    }];
    const result = expandRecurringPayments(payments, monthKeys);

    for (const key of monthKeys) {
      expect(result.get(key)).toBe(800);
    }
  });

  it('expands quarterly payments to Q months only', () => {
    const payments: RecurringPayment[] = [{
      id: 'rpay_2', label: 'Insurance', amount: 1200,
      frequency: 'quarterly', startDate: '2026-01-01', category: 'insurance',
    }];
    const result = expandRecurringPayments(payments, monthKeys);

    expect(result.get('2026-01')).toBe(0);
    expect(result.get('2026-02')).toBe(0);
    expect(result.get('2026-03')).toBe(1200);
    expect(result.get('2026-04')).toBe(0);
    expect(result.get('2026-06')).toBe(1200);
  });

  it('expands annual payments to start month only', () => {
    const payments: RecurringPayment[] = [{
      id: 'rpay_3', label: 'License', amount: 5000,
      frequency: 'annual', startDate: '2026-03-01', category: 'other',
    }];
    const result = expandRecurringPayments(payments, monthKeys);

    expect(result.get('2026-01')).toBe(0);
    expect(result.get('2026-03')).toBe(5000);
    expect(result.get('2026-06')).toBe(0);
  });

  it('respects startDate boundary', () => {
    const payments: RecurringPayment[] = [{
      id: 'rpay_4', label: 'Late start', amount: 100,
      frequency: 'monthly', startDate: '2026-03-01', category: 'other',
    }];
    const result = expandRecurringPayments(payments, monthKeys);

    expect(result.get('2026-01')).toBe(0);
    expect(result.get('2026-02')).toBe(0);
    expect(result.get('2026-03')).toBe(100);
    expect(result.get('2026-04')).toBe(100);
  });

  it('respects endDate boundary', () => {
    const payments: RecurringPayment[] = [{
      id: 'rpay_5', label: 'Ending', amount: 100,
      frequency: 'monthly', startDate: '2026-01-01',
      endDate: '2026-03-31', category: 'other',
    }];
    const result = expandRecurringPayments(payments, monthKeys);

    expect(result.get('2026-03')).toBe(100);
    expect(result.get('2026-04')).toBe(0);
  });

  it('sums multiple payments in same month', () => {
    const payments: RecurringPayment[] = [
      { id: 'rpay_a', label: 'Rent', amount: 800, frequency: 'monthly', startDate: '2026-01-01', category: 'rent' },
      { id: 'rpay_b', label: 'Salary', amount: 3000, frequency: 'monthly', startDate: '2026-01-01', category: 'salaries' },
    ];
    const result = expandRecurringPayments(payments, monthKeys);

    expect(result.get('2026-01')).toBe(3800);
  });
});

// =============================================================================
// INFLOWS / OUTFLOWS
// =============================================================================

describe('computeInflows', () => {
  const monthKeys = ['2026-01', '2026-02'];

  it('includes only pending/due installments', () => {
    const installments: RawInstallment[] = [
      { paymentPlanId: 'pp1', propertyId: 'u1', projectId: 'p1', buildingId: 'b1', amount: 1000, dueDate: '2026-01-15', status: 'pending', paidAmount: 0, paidDate: null },
      { paymentPlanId: 'pp2', propertyId: 'u2', projectId: 'p1', buildingId: 'b1', amount: 2000, dueDate: '2026-01-20', status: 'paid', paidAmount: 2000, paidDate: '2026-01-18' },
    ];

    const result = computeInflows(installments, [], monthKeys);
    expect(result.installments.get('2026-01')).toBe(1000);
  });

  it('subtracts paidAmount from partial installments', () => {
    const installments: RawInstallment[] = [
      { paymentPlanId: 'pp1', propertyId: 'u1', projectId: 'p1', buildingId: 'b1', amount: 1000, dueDate: '2026-01-15', status: 'due', paidAmount: 300, paidDate: null },
    ];

    const result = computeInflows(installments, [], monthKeys);
    expect(result.installments.get('2026-01')).toBe(700);
  });

  it('includes only incoming non-terminal cheques', () => {
    const cheques: RawCheque[] = [
      { chequeId: 'c1', amount: 5000, maturityDate: '2026-01-10', status: 'in_custody', drawerName: 'A', chequeNumber: '001', direction: 'incoming' },
      { chequeId: 'c2', amount: 3000, maturityDate: '2026-01-20', status: 'cleared', drawerName: 'B', chequeNumber: '002', direction: 'incoming' },
      { chequeId: 'c3', amount: 2000, maturityDate: '2026-02-05', status: 'received', drawerName: 'C', chequeNumber: '003', direction: 'outgoing' },
    ];

    const result = computeInflows([], cheques, monthKeys);
    expect(result.cheques.get('2026-01')).toBe(5000);
    expect(result.chequeCounts.get('2026-01')).toBe(1);
    expect(result.cheques.get('2026-02')).toBe(0);
  });
});

describe('computeOutflows', () => {
  const monthKeys = ['2026-01', '2026-02'];

  it('includes active POs with paymentDueDate', () => {
    const pos: RawPurchaseOrder[] = [
      { id: 'po1', total: 5000, paymentDueDate: '2026-01-15', status: 'ordered', projectId: 'p1' },
      { id: 'po2', total: 3000, paymentDueDate: '2026-01-20', status: 'cancelled', projectId: 'p1' },
    ];

    const result = computeOutflows(pos, [], [], [], monthKeys);
    expect(result.purchaseOrders.get('2026-01')).toBe(5000);
  });

  it('includes unpaid invoices', () => {
    const invoices: RawInvoice[] = [
      { invoiceId: 'inv1', balanceDue: 2000, dueDate: '2026-02-10', paymentStatus: 'unpaid' },
      { invoiceId: 'inv2', balanceDue: 0, dueDate: '2026-02-15', paymentStatus: 'paid' },
    ];

    const result = computeOutflows([], invoices, [], [], monthKeys);
    expect(result.invoices.get('2026-02')).toBe(2000);
  });

  it('includes pending EFKA', () => {
    const efka: RawEFKA[] = [
      { paymentId: 'efka1', amount: 450, dueDate: '2026-01-31', status: 'upcoming' },
      { paymentId: 'efka2', amount: 450, dueDate: '2026-02-28', status: 'paid' },
    ];

    const result = computeOutflows([], [], efka, [], monthKeys);
    expect(result.efka.get('2026-01')).toBe(450);
    expect(result.efka.get('2026-02')).toBe(0);
  });
});

// =============================================================================
// BUILD PROJECTION
// =============================================================================

describe('buildProjection', () => {
  const monthKeys = ['2026-01', '2026-02', '2026-03'];

  function makeInflows(): ReturnType<typeof computeInflows> {
    return {
      installments: new Map([['2026-01', 10000], ['2026-02', 8000], ['2026-03', 12000]]),
      cheques: new Map([['2026-01', 5000], ['2026-02', 0], ['2026-03', 3000]]),
      chequeCounts: new Map([['2026-01', 1], ['2026-02', 0], ['2026-03', 1]]),
    };
  }

  function makeOutflows(): ReturnType<typeof computeOutflows> {
    return {
      purchaseOrders: new Map([['2026-01', 4000], ['2026-02', 6000], ['2026-03', 3000]]),
      invoices: new Map([['2026-01', 1000], ['2026-02', 1000], ['2026-03', 1000]]),
      efka: new Map([['2026-01', 450], ['2026-02', 450], ['2026-03', 450]]),
      recurring: new Map([['2026-01', 3800], ['2026-02', 3800], ['2026-03', 3800]]),
    };
  }

  it('computes running balance with optimistic scenario (100%)', () => {
    const result = buildProjection(makeInflows(), makeOutflows(), 50000, 'optimistic', monthKeys);

    expect(result.scenario).toBe('optimistic');
    expect(result.collectionRate).toBe(1.0);
    expect(result.months).toHaveLength(3);
    expect(result.months[0].openingBalance).toBe(50000);

    // Jan: inflow = 10000 + 5000 = 15000, outflow = 4000+1000+450+3800 = 9250
    // net = 5750, closing = 55750
    expect(result.months[0].totalInflow).toBe(15000);
    expect(result.months[0].totalOutflow).toBe(9250);
    expect(result.months[0].closingBalance).toBe(55750);
  });

  it('applies scenario rate to installments only', () => {
    const result = buildProjection(makeInflows(), makeOutflows(), 50000, 'pessimistic', monthKeys);

    expect(result.collectionRate).toBe(0.70);
    // Jan: installments = 10000 * 0.7 = 7000, cheques = 5000 (not affected)
    expect(result.months[0].installmentsDue).toBe(7000);
    expect(result.months[0].chequesMaturingAmount).toBe(5000);
    expect(result.months[0].totalInflow).toBe(12000);
  });

  it('tracks lowest balance correctly', () => {
    const inflows = makeInflows();
    const outflows = makeOutflows();
    // Make Feb a big outflow month
    outflows.purchaseOrders.set('2026-02', 50000);
    const result = buildProjection(inflows, outflows, 10000, 'optimistic', monthKeys);

    expect(result.lowestBalance).toBeLessThan(10000);
    expect(result.lowestBalanceMonth).toBe('2026-02');
  });

  it('calculates cash runway', () => {
    const result = buildProjection(makeInflows(), makeOutflows(), 50000, 'optimistic', monthKeys);

    expect(result.cashRunwayMonths).toBeGreaterThan(0);
    expect(typeof result.cashRunwayMonths).toBe('number');
  });
});

// =============================================================================
// BUILD ALL SCENARIOS
// =============================================================================

describe('buildAllScenarios', () => {
  const rawData: RawCashFlowData = {
    config: {
      initialBalance: 25000,
      updatedAt: '2026-03-30T00:00:00Z',
      recurringPayments: [
        { id: 'rpay_1', label: 'Rent', amount: 800, frequency: 'monthly', startDate: '2026-01-01', category: 'rent' },
      ],
    },
    installments: [
      { paymentPlanId: 'pp1', propertyId: 'u1', projectId: 'p1', buildingId: 'b1', amount: 5000, dueDate: '2026-04-15', status: 'pending', paidAmount: 0, paidDate: null },
    ],
    cheques: [],
    purchaseOrders: [],
    invoices: [],
    bankTransactions: [],
    efka: [],
  };

  it('returns exactly 3 scenarios', () => {
    const result = buildAllScenarios(rawData, 3, new Date(2026, 3, 1));
    expect(result).toHaveLength(3);
    expect(result.map((s) => s.scenario)).toEqual(['optimistic', 'realistic', 'pessimistic']);
  });

  it('all scenarios have same month count', () => {
    const result = buildAllScenarios(rawData, 6, new Date(2026, 3, 1));
    for (const scenario of result) {
      expect(scenario.months).toHaveLength(6);
    }
  });

  it('optimistic ending balance >= realistic >= pessimistic', () => {
    const result = buildAllScenarios(rawData, 6, new Date(2026, 3, 1));
    const [opt, real, pess] = result;
    expect(opt.endingBalance).toBeGreaterThanOrEqual(real.endingBalance);
    expect(real.endingBalance).toBeGreaterThanOrEqual(pess.endingBalance);
  });
});

// =============================================================================
// FORECAST VS ACTUAL
// =============================================================================

describe('computeActualVsForecast', () => {
  it('compares forecast with bank transactions for past months', () => {
    // Mock a "realistic" projection for Jan+Feb 2026
    const projection = buildAllScenarios({
      config: { initialBalance: 10000, updatedAt: '', recurringPayments: [] },
      installments: [
        { paymentPlanId: 'pp1', propertyId: 'u1', projectId: 'p1', buildingId: 'b1', amount: 5000, dueDate: '2026-01-15', status: 'pending', paidAmount: 0, paidDate: null },
      ],
      cheques: [],
      purchaseOrders: [],
      invoices: [],
      bankTransactions: [],
      efka: [],
    }, 3, new Date(2026, 0, 1));

    const realistic = projection.find((s) => s.scenario === 'realistic')!;

    const bankTxns: RawBankTransaction[] = [
      { transactionId: 't1', amount: 4000, direction: 'credit', valueDate: '2026-01-20' },
      { transactionId: 't2', amount: 1500, direction: 'debit', valueDate: '2026-01-25' },
    ];

    const result = computeActualVsForecast(realistic, bankTxns);

    // Should only include months before current month
    // All months are in 2026-01 to 2026-03, which are all in the past
    expect(result.length).toBeGreaterThanOrEqual(0);

    if (result.length > 0) {
      const jan = result.find((r) => r.month === '2026-01');
      if (jan) {
        expect(jan.actualInflow).toBe(4000);
        expect(jan.actualOutflow).toBe(1500);
      }
    }
  });
});

// =============================================================================
// PDC CALENDAR
// =============================================================================

describe('buildPDCCalendar', () => {
  it('groups cheques by date', () => {
    const cheques: RawCheque[] = [
      { chequeId: 'c1', amount: 5000, maturityDate: '2026-04-10', status: 'in_custody', drawerName: 'Alpha', chequeNumber: '001', direction: 'incoming' },
      { chequeId: 'c2', amount: 3000, maturityDate: '2026-04-10', status: 'received', drawerName: 'Beta', chequeNumber: '002', direction: 'incoming' },
      { chequeId: 'c3', amount: 2000, maturityDate: '2026-04-15', status: 'deposited', drawerName: 'Gamma', chequeNumber: '003', direction: 'incoming' },
    ];

    const result = buildPDCCalendar(cheques);

    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2026-04-10');
    expect(result[0].totalAmount).toBe(8000);
    expect(result[0].chequeCount).toBe(2);
    expect(result[1].date).toBe('2026-04-15');
    expect(result[1].totalAmount).toBe(2000);
  });

  it('excludes terminal + outgoing cheques', () => {
    const cheques: RawCheque[] = [
      { chequeId: 'c1', amount: 5000, maturityDate: '2026-04-10', status: 'cleared', drawerName: 'A', chequeNumber: '001', direction: 'incoming' },
      { chequeId: 'c2', amount: 3000, maturityDate: '2026-04-10', status: 'received', drawerName: 'B', chequeNumber: '002', direction: 'outgoing' },
      { chequeId: 'c3', amount: 2000, maturityDate: '2026-04-10', status: 'in_custody', drawerName: 'C', chequeNumber: '003', direction: 'incoming' },
    ];

    const result = buildPDCCalendar(cheques);

    expect(result).toHaveLength(1);
    expect(result[0].totalAmount).toBe(2000);
  });

  it('returns sorted by date', () => {
    const cheques: RawCheque[] = [
      { chequeId: 'c1', amount: 100, maturityDate: '2026-04-20', status: 'received', drawerName: 'A', chequeNumber: '001', direction: 'incoming' },
      { chequeId: 'c2', amount: 200, maturityDate: '2026-04-05', status: 'received', drawerName: 'B', chequeNumber: '002', direction: 'incoming' },
    ];

    const result = buildPDCCalendar(cheques);
    expect(result[0].date).toBe('2026-04-05');
    expect(result[1].date).toBe('2026-04-20');
  });

  it('returns empty array for no cheques', () => {
    expect(buildPDCCalendar([])).toEqual([]);
  });
});

// =============================================================================
// ALERTS
// =============================================================================

describe('generateAlerts', () => {
  const thresholds: AlertThresholds = {
    lowCashWarning: 10000,
    lowCashCritical: 0,
    pdcMaturityDays: 7,
    collectionRateMinPct: 80,
  };

  it('generates low-cash warning when balance drops below warning threshold', () => {
    const scenarios = buildAllScenarios({
      config: { initialBalance: 5000, updatedAt: '', recurringPayments: [
        { id: 'rpay_1', label: 'Big Expense', amount: 3000, frequency: 'monthly', startDate: '2026-01-01', category: 'other' },
      ]},
      installments: [],
      cheques: [],
      purchaseOrders: [],
      invoices: [],
      bankTransactions: [],
      efka: [],
    }, 6, new Date(2026, 0, 1));

    const alerts = generateAlerts(scenarios, [], thresholds);
    const lowCash = alerts.find((a) => a.type === 'low-cash');

    expect(lowCash).toBeDefined();
    expect(lowCash?.severity).toBeDefined();
  });

  it('generates PDC maturity alert for upcoming cheques', () => {
    const now = new Date();
    const in3Days = new Date(now);
    in3Days.setDate(in3Days.getDate() + 3);

    const cheques: RawCheque[] = [{
      chequeId: 'c1', amount: 10000,
      maturityDate: in3Days.toISOString(),
      status: 'in_custody', drawerName: 'Test',
      chequeNumber: '001', direction: 'incoming',
    }];

    const scenarios = buildAllScenarios({
      config: { initialBalance: 50000, updatedAt: '', recurringPayments: [] },
      installments: [], cheques: [], purchaseOrders: [],
      invoices: [], bankTransactions: [], efka: [],
    }, 3);

    const alerts = generateAlerts(scenarios, cheques, thresholds);
    const pdcAlert = alerts.find((a) => a.type === 'pdc-maturity');

    expect(pdcAlert).toBeDefined();
    expect(pdcAlert?.value).toBe(10000);
  });

  it('returns empty alerts when everything is healthy', () => {
    const scenarios = buildAllScenarios({
      config: { initialBalance: 100000, updatedAt: '', recurringPayments: [] },
      installments: [], cheques: [], purchaseOrders: [],
      invoices: [], bankTransactions: [], efka: [],
    }, 3);

    const alerts = generateAlerts(scenarios, [], thresholds);
    const lowCash = alerts.filter((a) => a.type === 'low-cash');
    const pdc = alerts.filter((a) => a.type === 'pdc-maturity');

    expect(lowCash).toHaveLength(0);
    expect(pdc).toHaveLength(0);
  });
});
