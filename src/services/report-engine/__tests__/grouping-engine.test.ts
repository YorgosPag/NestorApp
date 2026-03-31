/**
 * @tests Grouping Engine — ADR-268 Phase 2
 * Tests grouping, aggregation, sorting, percent of total, chart suggest, KPI generation.
 */

import {
  groupRows,
  computeAggregate,
  extractNumericValues,
  aggregateKey,
  sortGroupsByAggregate,
  computePercentOfTotal,
  suggestChartType,
  generateKPIs,
} from '../grouping-engine';
import type {
  GroupByConfig,
  FieldDefinition,
  GroupedRow,
} from '@/config/report-builder/report-builder-types';

// ============================================================================
// Test Data
// ============================================================================

const UNIT_FIELDS: FieldDefinition[] = [
  { key: 'name', labelKey: 'name', type: 'text', filterable: true, sortable: true, defaultVisible: true },
  { key: 'commercialStatus', labelKey: 'status', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: ['available', 'reserved', 'sold'] },
  { key: 'type', labelKey: 'type', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: ['apartment', 'office', 'store'] },
  { key: 'areas.gross', labelKey: 'grossArea', type: 'number', filterable: true, sortable: true, defaultVisible: true },
  { key: 'commercial.askingPrice', labelKey: 'askingPrice', type: 'currency', filterable: true, sortable: true, defaultVisible: true },
  { key: 'progress', labelKey: 'progress', type: 'percentage', filterable: true, sortable: true, defaultVisible: false },
  { key: 'isActive', labelKey: 'active', type: 'boolean', filterable: true, sortable: true, defaultVisible: false },
];

const SAMPLE_ROWS: Record<string, unknown>[] = [
  { id: '1', name: 'Unit A', commercialStatus: 'sold', type: 'apartment', areas: { gross: 100 }, commercial: { askingPrice: 150000 }, progress: 80, isActive: true },
  { id: '2', name: 'Unit B', commercialStatus: 'sold', type: 'office', areas: { gross: 200 }, commercial: { askingPrice: 300000 }, progress: 100, isActive: true },
  { id: '3', name: 'Unit C', commercialStatus: 'available', type: 'apartment', areas: { gross: 150 }, commercial: { askingPrice: 200000 }, progress: 50, isActive: false },
  { id: '4', name: 'Unit D', commercialStatus: 'available', type: 'store', areas: { gross: 80 }, commercial: { askingPrice: 120000 }, progress: 30, isActive: true },
  { id: '5', name: 'Unit E', commercialStatus: 'reserved', type: 'apartment', areas: { gross: 120 }, commercial: { askingPrice: 180000 }, progress: 60, isActive: true },
];

// ============================================================================
// groupRows
// ============================================================================

describe('groupRows', () => {
  it('groups by 1 enum field correctly', () => {
    const config: GroupByConfig = {
      level1: 'commercialStatus',
      aggregations: [{ fieldKey: 'commercial.askingPrice', function: 'SUM' }],
    };
    const result = groupRows(SAMPLE_ROWS, config, UNIT_FIELDS);

    expect(result.groups).toHaveLength(3); // sold, available, reserved
    expect(result.totalRowCount).toBe(5);

    const soldGroup = result.groups.find(g => g.groupKey === 'sold');
    expect(soldGroup).toBeDefined();
    expect(soldGroup!.rowCount).toBe(2);
    expect(soldGroup!.depth).toBe(0);
    expect(soldGroup!.groupField).toBe('commercialStatus');
  });

  it('groups by 2 levels (enum + enum)', () => {
    const config: GroupByConfig = {
      level1: 'commercialStatus',
      level2: 'type',
      aggregations: [{ fieldKey: 'areas.gross', function: 'SUM' }],
    };
    const result = groupRows(SAMPLE_ROWS, config, UNIT_FIELDS);

    expect(result.groups).toHaveLength(3);

    const soldGroup = result.groups.find(g => g.groupKey === 'sold')!;
    // sold has apartment + office sub-groups
    const l2Children = soldGroup.children as GroupedRow[];
    expect(l2Children).toHaveLength(2);
    expect(l2Children[0].depth).toBe(1);
    expect(l2Children[0].groupField).toBe('type');
  });

  it('computes COUNT aggregation', () => {
    const config: GroupByConfig = {
      level1: 'commercialStatus',
      aggregations: [],
    };
    const result = groupRows(SAMPLE_ROWS, config, UNIT_FIELDS);

    const soldGroup = result.groups.find(g => g.groupKey === 'sold')!;
    expect(soldGroup.aggregates[aggregateKey('COUNT', '*')]).toBe(2);
  });

  it('computes SUM aggregation for currency field', () => {
    const config: GroupByConfig = {
      level1: 'commercialStatus',
      aggregations: [{ fieldKey: 'commercial.askingPrice', function: 'SUM' }],
    };
    const result = groupRows(SAMPLE_ROWS, config, UNIT_FIELDS);

    const soldGroup = result.groups.find(g => g.groupKey === 'sold')!;
    expect(soldGroup.aggregates[aggregateKey('SUM', 'commercial.askingPrice')]).toBe(450000);
  });

  it('computes AVG aggregation correctly', () => {
    const config: GroupByConfig = {
      level1: 'commercialStatus',
      aggregations: [{ fieldKey: 'areas.gross', function: 'AVG' }],
    };
    const result = groupRows(SAMPLE_ROWS, config, UNIT_FIELDS);

    const soldGroup = result.groups.find(g => g.groupKey === 'sold')!;
    expect(soldGroup.aggregates[aggregateKey('AVG', 'areas.gross')]).toBe(150); // (100+200)/2
  });

  it('computes MIN/MAX for number fields', () => {
    const config: GroupByConfig = {
      level1: 'commercialStatus',
      aggregations: [
        { fieldKey: 'areas.gross', function: 'MIN' },
        { fieldKey: 'areas.gross', function: 'MAX' },
      ],
    };
    const result = groupRows(SAMPLE_ROWS, config, UNIT_FIELDS);

    const soldGroup = result.groups.find(g => g.groupKey === 'sold')!;
    expect(soldGroup.aggregates[aggregateKey('MIN', 'areas.gross')]).toBe(100);
    expect(soldGroup.aggregates[aggregateKey('MAX', 'areas.gross')]).toBe(200);
  });

  it('computes grandTotals correctly', () => {
    const config: GroupByConfig = {
      level1: 'commercialStatus',
      aggregations: [{ fieldKey: 'commercial.askingPrice', function: 'SUM' }],
    };
    const result = groupRows(SAMPLE_ROWS, config, UNIT_FIELDS);

    expect(result.grandTotals[aggregateKey('COUNT', '*')]).toBe(5);
    expect(result.grandTotals[aggregateKey('SUM', 'commercial.askingPrice')]).toBe(950000);
  });

  it('handles empty rows array', () => {
    const config: GroupByConfig = {
      level1: 'commercialStatus',
      aggregations: [{ fieldKey: 'areas.gross', function: 'SUM' }],
    };
    const result = groupRows([], config, UNIT_FIELDS);

    expect(result.groups).toHaveLength(0);
    expect(result.totalRowCount).toBe(0);
    expect(result.grandTotals[aggregateKey('COUNT', '*')]).toBe(0);
  });

  it('handles null/undefined values in group-by field', () => {
    const rowsWithNull = [
      ...SAMPLE_ROWS,
      { id: '6', name: 'Unit F', commercialStatus: null, type: 'apartment', areas: { gross: 90 }, commercial: { askingPrice: 100000 } },
    ];
    const config: GroupByConfig = {
      level1: 'commercialStatus',
      aggregations: [],
    };
    const result = groupRows(rowsWithNull as Record<string, unknown>[], config, UNIT_FIELDS);

    const unknownGroup = result.groups.find(g => g.groupKey === '__unknown__');
    expect(unknownGroup).toBeDefined();
    expect(unknownGroup!.rowCount).toBe(1);
  });

  it('handles dot-path nested fields for grouping', () => {
    const config: GroupByConfig = {
      level1: 'isActive',
      aggregations: [{ fieldKey: 'areas.gross', function: 'SUM' }],
    };
    const result = groupRows(SAMPLE_ROWS, config, UNIT_FIELDS);

    const activeGroup = result.groups.find(g => g.groupKey === 'true')!;
    expect(activeGroup.rowCount).toBe(4);
    expect(activeGroup.aggregates[aggregateKey('SUM', 'areas.gross')]).toBe(500);
  });
});

// ============================================================================
// computeAggregate
// ============================================================================

describe('computeAggregate', () => {
  it('COUNT returns length', () => {
    expect(computeAggregate([1, 2, 3], 'COUNT')).toBe(3);
  });

  it('SUM with mixed values', () => {
    expect(computeAggregate([100, 200, 50], 'SUM')).toBe(350);
  });

  it('AVG with empty array returns 0', () => {
    expect(computeAggregate([], 'AVG')).toBe(0);
  });

  it('MIN/MAX with values', () => {
    expect(computeAggregate([10, 30, 20], 'MIN')).toBe(10);
    expect(computeAggregate([10, 30, 20], 'MAX')).toBe(30);
  });
});

// ============================================================================
// sortGroupsByAggregate
// ============================================================================

describe('sortGroupsByAggregate', () => {
  it('sorts descending by SUM', () => {
    const groups: GroupedRow[] = [
      { groupKey: 'a', groupField: 'f', depth: 0, aggregates: { 'SUM:price': 100 }, children: [], rowCount: 1 },
      { groupKey: 'b', groupField: 'f', depth: 0, aggregates: { 'SUM:price': 300 }, children: [], rowCount: 1 },
      { groupKey: 'c', groupField: 'f', depth: 0, aggregates: { 'SUM:price': 200 }, children: [], rowCount: 1 },
    ];
    sortGroupsByAggregate(groups, 'SUM:price', 'desc');
    expect(groups.map(g => g.groupKey)).toEqual(['b', 'c', 'a']);
  });

  it('sorts ascending by COUNT', () => {
    const groups: GroupedRow[] = [
      { groupKey: 'x', groupField: 'f', depth: 0, aggregates: { 'COUNT:*': 5 }, children: [], rowCount: 5 },
      { groupKey: 'y', groupField: 'f', depth: 0, aggregates: { 'COUNT:*': 2 }, children: [], rowCount: 2 },
    ];
    sortGroupsByAggregate(groups, 'COUNT:*', 'asc');
    expect(groups.map(g => g.groupKey)).toEqual(['y', 'x']);
  });
});

// ============================================================================
// computePercentOfTotal
// ============================================================================

describe('computePercentOfTotal', () => {
  it('computes correct percentages summing to ~100', () => {
    const groups: GroupedRow[] = [
      { groupKey: 'sold', groupField: 'f', depth: 0, aggregates: {}, children: [], rowCount: 3 },
      { groupKey: 'available', groupField: 'f', depth: 0, aggregates: {}, children: [], rowCount: 7 },
    ];
    const pct = computePercentOfTotal(groups, 10);
    expect(pct.get('sold')).toBe(30);
    expect(pct.get('available')).toBe(70);
  });

  it('handles empty total', () => {
    const pct = computePercentOfTotal([], 0);
    expect(pct.size).toBe(0);
  });
});

// ============================================================================
// suggestChartType
// ============================================================================

describe('suggestChartType', () => {
  it('enum with <=8 groups returns pie', () => {
    expect(suggestChartType('enum', 5)).toBe('pie');
  });

  it('enum with >8 groups returns bar', () => {
    expect(suggestChartType('enum', 12)).toBe('bar');
  });

  it('date returns line', () => {
    expect(suggestChartType('date', 10)).toBe('line');
  });

  it('boolean returns pie', () => {
    expect(suggestChartType('boolean', 2)).toBe('pie');
  });

  it('text with <=5 groups returns pie', () => {
    expect(suggestChartType('text', 3)).toBe('pie');
  });

  it('text with >5 groups returns bar', () => {
    expect(suggestChartType('text', 10)).toBe('bar');
  });

  it('number defaults to bar', () => {
    expect(suggestChartType('number', 5)).toBe('bar');
  });
});

// ============================================================================
// generateKPIs
// ============================================================================

describe('generateKPIs', () => {
  it('generates max 4 KPIs', () => {
    const config: GroupByConfig = {
      level1: 'commercialStatus',
      aggregations: [
        { fieldKey: 'commercial.askingPrice', function: 'SUM' },
        { fieldKey: 'areas.gross', function: 'AVG' },
      ],
    };
    const result = groupRows(SAMPLE_ROWS, config, UNIT_FIELDS);
    const kpis = generateKPIs(result, config, 'properties', ['commercial.askingPrice', 'areas.gross'], UNIT_FIELDS);

    expect(kpis.length).toBeLessThanOrEqual(4);
    expect(kpis.length).toBeGreaterThanOrEqual(1);
    // First KPI is always Total
    expect(kpis[0].title).toBe('Total');
    expect(kpis[0].value).toBe(5);
  });

  it('generates domain-specific KPI for units + commercialStatus', () => {
    const config: GroupByConfig = {
      level1: 'commercialStatus',
      aggregations: [{ fieldKey: 'commercial.askingPrice', function: 'SUM' }],
    };
    const result = groupRows(SAMPLE_ROWS, config, UNIT_FIELDS);
    const kpis = generateKPIs(result, config, 'properties', ['commercial.askingPrice'], UNIT_FIELDS);

    const soldKPI = kpis.find(k => k.title === 'Sold %');
    expect(soldKPI).toBeDefined();
    expect(soldKPI!.value).toBe('40.0%'); // 2/5 = 40%
  });
});

// ============================================================================
// extractNumericValues
// ============================================================================

describe('extractNumericValues', () => {
  it('extracts nested numeric values', () => {
    const values = extractNumericValues(SAMPLE_ROWS, 'areas.gross');
    expect(values).toEqual([100, 200, 150, 80, 120]);
  });

  it('skips non-numeric values', () => {
    const rows = [
      { price: 100 },
      { price: 'not a number' },
      { price: null },
      { price: 200 },
    ];
    expect(extractNumericValues(rows as Record<string, unknown>[], 'price')).toEqual([100, 200]);
  });
});
