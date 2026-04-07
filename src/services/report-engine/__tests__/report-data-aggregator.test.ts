/* eslint-disable no-restricted-syntax */
/**
 * =============================================================================
 * Report Data Aggregator — Unit Tests (ADR-265, SPEC-011)
 * =============================================================================
 *
 * All 8 static methods: contacts, projects, sales, CRM, spaces,
 * construction, compliance, financial.
 * Each: happy path + empty results + edge cases.
 *
 * @module __tests__/report-data-aggregator
 * @see SPEC-011 §10 Q3 — ALL 8 methods tested
 */

// ── server-only mock ──
jest.mock('server-only', () => ({}));

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: jest.fn(),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// ── Real utility functions (pure) ──
jest.mock('@/utils/collection-utils', () => ({
  tallyBy: jest.fn(<T>(arr: T[], fn: (item: T) => string) => {
    const result: Record<string, number> = {};
    for (const item of arr) {
      const key = fn(item);
      result[key] = (result[key] || 0) + 1;
    }
    return result;
  }),
  sumBy: jest.fn(<T>(arr: T[], fn: (item: T) => number) =>
    arr.reduce((sum, item) => sum + fn(item), 0),
  ),
  sumByKey: jest.fn(<T>(arr: T[], keyFn: (item: T) => string, valFn: (item: T) => number) => {
    const result: Record<string, number> = {};
    for (const item of arr) {
      const key = keyFn(item);
      result[key] = (result[key] || 0) + valFn(item);
    }
    return result;
  }),
  countBy: jest.fn(<T>(arr: T[], fn: (item: T) => boolean) =>
    arr.filter(fn).length,
  ),
  rate: jest.fn((num: number, denom: number) => denom > 0 ? Math.round((num / denom) * 10000) / 10000 : 0),
  avg: jest.fn((total: number, count: number) => count > 0 ? total / count : 0),
  groupByKey: jest.fn(<T>(arr: T[], fn: (item: T) => string) => {
    const result: Record<string, T[]> = {};
    for (const item of arr) {
      const key = fn(item);
      if (!result[key]) result[key] = [];
      result[key].push(item);
    }
    return result;
  }),
}));

jest.mock('../evm-calculator', () => ({
  computeEVM: jest.fn(() => ({
    budgetAtCompletion: 100000,
    plannedValue: 60000,
    earnedValue: 55000,
    actualCost: 58000,
    costVariance: -3000,
    scheduleVariance: -5000,
    cpi: 0.95,
    spi: 0.92,
    estimateAtCompletion: 105263,
    toCompletePI: 1.07,
    cpiHealth: 'yellow',
    spiHealth: 'yellow',
    sCurveData: [],
  })),
  getTrafficLight: jest.fn((val: number) => val >= 0.95 ? 'green' : val >= 0.85 ? 'yellow' : 'red'),
}));

jest.mock('../aging-calculator', () => ({
  computeAgingBuckets: jest.fn(() => ({
    current: 50000,
    '1-30': 10000,
    '31-60': 5000,
    '61-90': 2000,
    '90+': 1000,
    total: 68000,
  })),
}));

jest.mock('../report-aggregator.helpers', () => ({
  buildNameMap: jest.fn((items: Array<{ id: string; name?: string }>) => {
    const map: Record<string, string> = {};
    for (const item of items) map[item.id] = item.name ?? item.id;
    return map;
  }),
  buildRevenueByProject: jest.fn(() => ({ proj_1: 200000 })),
  buildUnitsByBuilding: jest.fn(() => ({ bld_1: 5 })),
  buildPricePerSqm: jest.fn(() => ({ bld_1: 2500 })),
  buildBOQVariance: jest.fn(() => ({ bld_1: { estimated: 100000, actual: 95000, variance: -5000 } })),
  buildTopBuyers: jest.fn(() => [{ name: 'Buyer A', total: 150000 }]),
  computeCompleteness: jest.fn(() => 0.85),
  buildOverdueInstallments: jest.fn(() => []),
}));

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { ReportDataAggregator } from '../report-data-aggregator';
import type { ReportFilter } from '../report-aggregator.types';

// ─── Firestore Mock Infrastructure ────────────────────────────────────

interface MockDoc {
  id: string;
  data: () => Record<string, unknown>;
}

function makeMockSnap(docs: Array<Record<string, unknown>>): { docs: MockDoc[] } {
  return {
    docs: docs.map((d, i) => ({
      id: (d.id as string) ?? `doc_${i}`,
      data: () => d,
    })),
  };
}

function setupFirestoreMock(collectionData: Record<string, Array<Record<string, unknown>>>) {
  const mockWhere = jest.fn().mockReturnThis();
  const mockGet = jest.fn();

  // Track which collection is being queried
  const collectionCalls: string[] = [];

  const mockCollection = jest.fn((name: string) => {
    collectionCalls.push(name);
    const docs = collectionData[name] ?? [];
    return {
      where: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          get: jest.fn(async () => makeMockSnap(docs)),
        }),
        get: jest.fn(async () => makeMockSnap(docs)),
      }),
      get: jest.fn(async () => makeMockSnap(docs)),
    };
  });

  (getAdminFirestore as jest.Mock).mockReturnValue({
    collection: mockCollection,
  });

  return { mockCollection, collectionCalls };
}

const baseFilter: ReportFilter = {
  companyId: 'comp_001',
  dateFrom: '2026-01-01',
  dateTo: '2026-12-31',
};

// ============================================================================
// TESTS
// ============================================================================

describe('ReportDataAggregator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────
  // getContactsReport
  // ──────────────────────────────────────────────────────────────────────

  describe('getContactsReport', () => {
    it('returns aggregated contacts data', async () => {
      setupFirestoreMock({
        contacts: [
          {
            id: 'cont_001', type: 'individual', status: 'active',
            personas: [{ personaType: 'buyer' }],
            addresses: [{ city: 'Athens' }],
            createdAt: '2026-06-15',
          },
          {
            id: 'cont_002', type: 'company', status: 'active',
            personas: [{ personaType: 'supplier' }],
            addresses: [{ city: 'Athens' }],
            createdAt: '2026-03-10',
          },
        ],
        properties: [],
      });

      const result = await ReportDataAggregator.getContactsReport(baseFilter);

      expect(result.total).toBe(2);
      expect(result.byType).toEqual({ individual: 1, company: 1 });
      expect(result.byStatus).toEqual({ active: 2 });
      expect(result.byPersona).toEqual({ buyer: 1, supplier: 1 });
      expect(result.byCity).toEqual({ Athens: 2 });
      expect(result.generatedAt).toBeDefined();
    });

    it('returns zero metrics when no contacts exist', async () => {
      setupFirestoreMock({ contacts: [], properties: [] });

      const result = await ReportDataAggregator.getContactsReport(baseFilter);

      expect(result.total).toBe(0);
      expect(result.newInPeriod).toBe(0);
      expect(result.byType).toEqual({});
    });

    it('counts newInPeriod correctly based on date range', async () => {
      setupFirestoreMock({
        contacts: [
          { id: 'c1', createdAt: '2026-06-15', type: 'individual', status: 'active' },
          { id: 'c2', createdAt: '2025-06-15', type: 'individual', status: 'active' },
        ],
        properties: [],
      });

      const result = await ReportDataAggregator.getContactsReport(baseFilter);
      expect(result.newInPeriod).toBe(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // getProjectsReport
  // ──────────────────────────────────────────────────────────────────────

  describe('getProjectsReport', () => {
    it('returns aggregated projects data', async () => {
      setupFirestoreMock({
        projects: [
          { id: 'proj_1', name: 'Project A', status: 'active', type: 'residential', totalValue: 500000, progress: 60 },
          { id: 'proj_2', name: 'Project B', status: 'planning', type: 'commercial', totalValue: 800000, progress: 20 },
        ],
        properties: [
          { commercialStatus: 'sold', project: 'proj_1' },
          { commercialStatus: 'for_sale', project: 'proj_1' },
        ],
        buildings: [
          { id: 'bld_1', name: 'Building 1', projectId: 'proj_1', progress: 50 },
        ],
        boq_items: [],
      });

      const result = await ReportDataAggregator.getProjectsReport(baseFilter);

      expect(result.totalProjects).toBe(2);
      expect(result.byStatus).toEqual({ active: 1, planning: 1 });
      expect(result.totalPortfolioValue).toBe(1300000);
      expect(result.averageProgress).toBe(40); // (60+20)/2
      expect(result.totalProperties).toBe(2);
      expect(result.generatedAt).toBeDefined();
    });

    it('returns zero progress when no projects', async () => {
      setupFirestoreMock({ projects: [], properties: [], buildings: [], boq_items: [] });

      const result = await ReportDataAggregator.getProjectsReport(baseFilter);

      expect(result.totalProjects).toBe(0);
      expect(result.averageProgress).toBe(0);
      expect(result.totalPortfolioValue).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // getSalesReport
  // ──────────────────────────────────────────────────────────────────────

  describe('getSalesReport', () => {
    it('returns aggregated sales data', async () => {
      setupFirestoreMock({
        properties: [
          {
            commercialStatus: 'sold',
            commercial: { finalPrice: 150000, paymentSummary: { paidPercentage: 80 } },
          },
          {
            commercialStatus: 'for_sale',
            commercial: { askingPrice: 200000, paymentSummary: null },
          },
        ],
        cheques: [
          { status: 'pending' },
          { status: 'cleared' },
        ],
      });

      const result = await ReportDataAggregator.getSalesReport(baseFilter);

      expect(result.soldProperties).toBe(1);
      expect(result.forSaleProperties).toBe(1);
      expect(result.totalRevenue).toBe(150000);
      expect(result.pipelineValue).toBe(200000);
      expect(result.chequesByStatus).toEqual({ pending: 1, cleared: 1 });
      expect(result.generatedAt).toBeDefined();
    });

    it('returns zero when no units', async () => {
      setupFirestoreMock({ properties: [], cheques: [] });

      const result = await ReportDataAggregator.getSalesReport(baseFilter);

      expect(result.soldProperties).toBe(0);
      expect(result.totalRevenue).toBe(0);
      expect(result.pipelineValue).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // getCrmReport
  // ──────────────────────────────────────────────────────────────────────

  describe('getCrmReport', () => {
    it('returns aggregated CRM data', async () => {
      setupFirestoreMock({
        opportunities: [
          { stage: 'closed_won', estimatedValue: 100000, source: 'referral' },
          { stage: 'closed_lost', estimatedValue: 50000, source: 'website' },
          { stage: 'negotiation', estimatedValue: 75000, source: 'referral' },
        ],
        tasks: [
          { status: 'completed', priority: 'high', assignedTo: 'user_A' },
          { status: 'pending', priority: 'medium', assignedTo: 'user_B', dueDate: '2020-01-01' },
        ],
        communications: [
          { type: 'email', direction: 'outbound' },
          { type: 'phone', direction: 'inbound' },
        ],
      });

      const result = await ReportDataAggregator.getCrmReport(baseFilter);

      expect(result.totalOpportunities).toBe(3);
      expect(result.wonCount).toBe(1);
      expect(result.lostCount).toBe(1);
      expect(result.totalTasks).toBe(2);
      expect(result.overdueTasks).toBe(1);
      expect(result.totalCommunications).toBe(2);
      expect(result.generatedAt).toBeDefined();
    });

    it('returns zero win rate when no closed deals', async () => {
      setupFirestoreMock({
        opportunities: [{ stage: 'negotiation', estimatedValue: 50000 }],
        tasks: [],
        communications: [],
      });

      const result = await ReportDataAggregator.getCrmReport(baseFilter);

      expect(result.wonCount).toBe(0);
      expect(result.lostCount).toBe(0);
      expect(result.winRate).toBe(0);
      expect(result.avgDealValue).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // getSpacesReport
  // ──────────────────────────────────────────────────────────────────────

  describe('getSpacesReport', () => {
    it('returns aggregated spaces data', async () => {
      setupFirestoreMock({
        parking_spots: [
          { status: 'sold', type: 'covered', locationZone: 'A', buildingId: 'bld_1', price: 15000 },
          { status: 'available', type: 'open', locationZone: 'B', buildingId: null, price: 8000 },
        ],
        storage_units: [
          { status: 'occupied', type: 'small', buildingId: 'bld_1', area: 10, price: 5000 },
        ],
      });

      const result = await ReportDataAggregator.getSpacesReport(baseFilter);

      expect(result.parking.total).toBe(2);
      expect(result.parking.soldCount).toBe(1);
      expect(result.storage.total).toBe(1);
      expect(result.linkedSpaces).toBe(2); // bld_1 parking + bld_1 storage
      expect(result.unlinkedSpaces).toBe(1); // parking without buildingId
      expect(result.generatedAt).toBeDefined();
    });

    it('returns zero when no spaces', async () => {
      setupFirestoreMock({ parking_spots: [], storage_units: [] });

      const result = await ReportDataAggregator.getSpacesReport(baseFilter);

      expect(result.parking.total).toBe(0);
      expect(result.storage.total).toBe(0);
      expect(result.linkedSpaces).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // getConstructionReport
  // ──────────────────────────────────────────────────────────────────────

  describe('getConstructionReport', () => {
    it('returns aggregated construction data with EVM', async () => {
      setupFirestoreMock({
        construction_phases: [
          { id: 'phase_1', buildingId: 'bld_1', progress: 80, companyId: 'comp_001' },
          { id: 'phase_2', buildingId: 'bld_1', progress: 40, companyId: 'comp_001' },
        ],
        building_milestones: [
          { id: 'ms_1', buildingId: 'bld_1', status: 'completed', companyId: 'comp_001' },
          { id: 'ms_2', buildingId: 'bld_1', status: 'in_progress', companyId: 'comp_001' },
        ],
        boq_items: [
          { id: 'boq_1', buildingId: 'bld_1', companyId: 'comp_001' },
        ],
      });

      const result = await ReportDataAggregator.getConstructionReport(baseFilter);

      expect(result.phasesCount).toBe(2);
      expect(result.totalMilestones).toBe(2);
      expect(result.completedMilestones).toBe(1);
      expect(result.averagePhaseProgress).toBe(60); // (80+40)/2
      expect(result.evmByBuilding).toBeDefined();
      expect(result.generatedAt).toBeDefined();
    });

    it('returns zero when no construction data', async () => {
      setupFirestoreMock({
        construction_phases: [],
        building_milestones: [],
        boq_items: [],
      });

      const result = await ReportDataAggregator.getConstructionReport(baseFilter);

      expect(result.phasesCount).toBe(0);
      expect(result.totalMilestones).toBe(0);
      expect(result.averagePhaseProgress).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // getComplianceReport
  // ──────────────────────────────────────────────────────────────────────

  describe('getComplianceReport', () => {
    it('returns aggregated compliance data', async () => {
      setupFirestoreMock({
        attendance_events: [
          { eventType: 'check_in', method: 'qr', companyId: 'comp_001' },
          { eventType: 'check_out', method: 'qr', companyId: 'comp_001' },
          { eventType: 'check_in', method: 'manual', companyId: 'comp_001' },
        ],
        employment_records: [
          { contactId: 'cont_001', totalHoursWorked: 160, overtimeHours: 8, stampsCount: 22, insuranceClassNumber: 101 },
          { contactId: 'cont_002', totalHoursWorked: 120, overtimeHours: 4, stampsCount: 18, insuranceClassNumber: 105 },
        ],
      });

      const result = await ReportDataAggregator.getComplianceReport(baseFilter);

      expect(result.totalWorkers).toBe(2);
      expect(result.totalHoursLogged).toBe(280);
      expect(result.totalOvertimeHours).toBe(12);
      expect(result.totalStamps).toBe(40);
      expect(result.checkInsByMethod).toEqual({ qr: 1, manual: 1 });
      expect(result.generatedAt).toBeDefined();
    });

    it('returns zero when no attendance data', async () => {
      setupFirestoreMock({ attendance_events: [], employment_records: [] });

      const result = await ReportDataAggregator.getComplianceReport(baseFilter);

      expect(result.totalWorkers).toBe(0);
      expect(result.totalHoursLogged).toBe(0);
      expect(result.attendanceRate).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // getFinancialReport
  // ──────────────────────────────────────────────────────────────────────

  describe('getFinancialReport', () => {
    it('returns aggregated financial data', async () => {
      setupFirestoreMock({
        properties: [
          {
            commercial: {
              paymentSummary: { totalAmount: 200000, paidAmount: 150000 },
            },
          },
        ],
        // Construction data for portfolio EVM
        construction_phases: [],
        building_milestones: [],
        boq_items: [],
      });

      const result = await ReportDataAggregator.getFinancialReport(baseFilter);

      expect(result.totalReceivables).toBe(200000);
      expect(result.totalCollected).toBe(150000);
      expect(result.agingBuckets).toBeDefined();
      expect(result.generatedAt).toBeDefined();
    });

    it('returns zero receivables when no units', async () => {
      setupFirestoreMock({
        properties: [],
        construction_phases: [],
        building_milestones: [],
        boq_items: [],
      });

      const result = await ReportDataAggregator.getFinancialReport(baseFilter);

      expect(result.totalReceivables).toBe(0);
      expect(result.totalCollected).toBe(0);
      expect(result.collectionRate).toBe(0);
    });
  });
});
