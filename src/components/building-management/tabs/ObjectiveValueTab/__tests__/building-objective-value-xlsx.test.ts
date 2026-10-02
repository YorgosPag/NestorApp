/**
 * ADR-898 Φ4β — **η εξαγωγή XLSX της αντικειμενικής του κτιρίου**, πάνω στο ΠΡΑΓΜΑΤΙΚΟ βιβλίο του ExcelJS (στέλεχος
 * μόνο το κατέβασμα). Τι αποδεικνύει: (1) σύνολο ως `SUM` **μόνο** όταν είναι πλήρες — αλλιώς «λείπουν», κανένας
 * αριθμός · (2) η σειρά των γραμμών = η σειρά της οθόνης · (3) αριθμοί μένουν αριθμοί, όρια σε δικές τους στήλες ·
 * (4) κάθε συντελεστής με την παραπομπή του · (5) η ημέρα αποτίμησης γράφεται στο αρχείο.
 */

import type ExcelJS from 'exceljs';

import type { BuildingUnitObjectiveValue } from '@/lib/objective-value/building-objective-value';
import { readBuildingObjectiveValueFacts } from '@/lib/objective-value/building-objective-value-facts';
import type { BuildingObjectiveValues, BuildingUnitObjectiveValueRow } from '@/lib/objective-value/building-objective-values-contract';

import { buildingObjectiveValueColumns } from '../building-objective-value-columns';
import { exportBuildingObjectiveValuesXlsx } from '../building-objective-value-xlsx';
import type { BuildingObjectiveValueLabels } from '../useBuildingObjectiveValueLabels';

const downloaded: { workbook: ExcelJS.Workbook; filename: string }[] = [];
jest.mock('@/lib/export/excel-workbook', () => {
  const actual = jest.requireActual('@/lib/export/excel-workbook');
  return {
    ...actual,
    // Ο σκελετός (`exportWorkbook`) ελέγχεται στο `lib/export` — εδώ κρατάμε το ΠΡΑΓΜΑΤΙΚΟ βιβλίο που γέμισε ο εξαγωγέας.
    exportWorkbook: async ({ fileBaseName, build }: { fileBaseName: string; build: (workbook: ExcelJS.Workbook) => void }) => {
      const RealExcelJS: typeof ExcelJS = jest.requireActual('exceljs');
      const workbook = new RealExcelJS.Workbook();
      build(workbook);
      downloaded.push({ workbook, filename: `${fileBaseName}.xlsx` });
    },
  };
});

const t = (key: string, params?: Record<string, unknown>) => (params ? `${key}::${JSON.stringify(params)}` : key);
const labels: BuildingObjectiveValueLabels = {
  t,
  amount: () => null,
  status: (value) => `status:${value.kind}`,
  unitName: (row) => row.name ?? row.id,
  floor: (floor) => `floor:${floor}`,
  stage: (stage) => `stage:${stage}`,
  inherited: (facts) => facts.join('+'),
};

const exact = (value: number): BuildingUnitObjectiveValue => ({
  kind: 'evaluated',
  bounds: {
    kind: 'exact',
    commercialityAssumed: false,
    result: { kind: 'computed', form: 'residence', value, zonePrice: 2000, area: 90, factors: [{ key: 'floor', factor: 1.1, ref: 'ΠΟΛ.1149/1994 άρθ.2 §8' }] },
  },
  levelBasis: { kind: 'single' },
  assumptions: [],
  inherited: ['stage'],
});

const range: BuildingUnitObjectiveValue = {
  kind: 'evaluated',
  bounds: { kind: 'range', low: 100, high: 120, open: ['hasElevator'], commercialityAssumed: false },
  levelBasis: { kind: 'single' },
  assumptions: [],
  inherited: [],
};

const row = (id: string, floor: number, value: BuildingUnitObjectiveValue): BuildingUnitObjectiveValueRow => ({ id, name: id, type: null, floor, value });

function data(units: readonly BuildingUnitObjectiveValueRow[], total: BuildingObjectiveValues['total']): BuildingObjectiveValues {
  return { valuationDate: '2026-10-02', stage: { source: 'schedule', stage: 'frame' }, facts: readBuildingObjectiveValueFacts({}), units, total, questions: [] };
}

async function exportOf(values: BuildingObjectiveValues) {
  downloaded.length = 0;
  await exportBuildingObjectiveValuesXlsx({
    data: values,
    buildingName: 'Κτίριο Α',
    columns: buildingObjectiveValueColumns(labels, () => undefined),
    sort: { key: 'floor', direction: 'desc' },
    labels,
    factorLabel: (factor) => `factor:${factor.key}`,
    exportedOn: '2026-10-03',
  });
  return downloaded[0];
}

const rowsOf = (sheet: ExcelJS.Worksheet) => sheet.getSheetValues().slice(1).map((values) => (Array.isArray(values) ? values.slice(1) : []));

describe('exportBuildingObjectiveValuesXlsx', () => {
  it('πλήρες ⇒ το σύνολο είναι τύπος SUM με το αποτέλεσμα του server · σειρά = η σειρά της οθόνης', async () => {
    const { workbook, filename } = await exportOf(data([row('A1', 1, exact(1000)), row('B1', 2, exact(250))], { kind: 'exact', value: 1250, units: 2 }));
    expect(filename).toBe('objective-value:building.export.filename::{"building":"Κτίριο Α","date":"2026-10-02"}.xlsx');
    const units = workbook.worksheets[0];
    expect(rowsOf(units).slice(1, 3).map((cells) => cells[0])).toEqual(['B1', 'A1']);
    const footer = units.getRow(units.rowCount);
    expect(footer.getCell(3).value).toEqual({ formula: 'SUM(C2:C3)', result: 1250 });
    expect(units.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
  });

  it('ελλιπές ⇒ ΚΑΝΕΝΑΣ αριθμός συνόλου, μόνο «λείπουν» · τα όρια σε δικές τους αριθμητικές στήλες', async () => {
    const { workbook } = await exportOf(data([row('A1', 1, exact(1000)), row('A2', 1, range)], { kind: 'incomplete', pending: 1, units: 2 }));
    const units = workbook.worksheets[0];
    const footer = units.getRow(units.rowCount).values as unknown[];
    expect(footer.some((cell) => typeof cell === 'number' || (typeof cell === 'object' && cell !== null))).toBe(false);
    expect(footer).toContain('objective-value:building.total.incomplete::{"pending":1,"units":2}');
    const a2 = rowsOf(units).find((cells) => cells[0] === 'A2');
    expect(a2?.slice(2, 5)).toEqual([undefined, 100, 120]);
  });

  it('συντελεστές με παραπομπή · παραδοχές με την ημέρα αποτίμησης και την πηγή του σταδίου', async () => {
    const { workbook } = await exportOf(data([row('A1', 1, exact(1000))], { kind: 'exact', value: 1000, units: 1 }));
    const [, floors, factors, assumptions] = workbook.worksheets;
    expect(rowsOf(floors)[1]).toEqual(['floor:1', 1, 1000, 'objective-value:building.export.floorComplete']);
    expect(rowsOf(factors)).toContainEqual(['A1', 'factor:floor', 1.1, 'ΠΟΛ.1149/1994 άρθ.2 §8']);
    const facts = rowsOf(assumptions);
    expect(facts).toContainEqual(['objective-value:building.export.assumptions.valuationDate', '2026-10-02']);
    // Ναι/Όχι/«δεν δηλώθηκε» με τις ΙΔΙΕΣ λέξεις του χειριστηρίου `YesNo` (ADR-898 §18.1 · §18.3) — όχι δεύτερος κατάλογος.
    expect(facts).toContainEqual(['objective-value:building.facts.hasCentralHeating', 'objective-value:questions.unset.undeclared']);
    expect(facts).toContainEqual(['objective-value:building.facts.hasElevator', 'objective-value:questions.unset.undeclared']);
    expect(facts).toContainEqual(['objective-value:building.facts.stage', 'objective-value:building.export.assumptions.stageFrom.schedule::{"stage":"stage:frame"}']);
  });
});
