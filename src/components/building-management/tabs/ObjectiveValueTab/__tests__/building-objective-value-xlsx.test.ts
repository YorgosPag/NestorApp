/**
 * ADR-898 Φ4β — **η εξαγωγή XLSX της αντικειμενικής του κτιρίου**, πάνω στο ΠΡΑΓΜΑΤΙΚΟ βιβλίο του ExcelJS (στέλεχος
 * μόνο το κατέβασμα). Τι αποδεικνύει: (1) σύνολο ως `SUM` **μόνο** όταν είναι πλήρες — αλλιώς «λείπουν», κανένας
 * αριθμός · (2) η σειρά των γραμμών = η σειρά της οθόνης · (3) αριθμοί μένουν αριθμοί, όρια σε δικές τους στήλες ·
 * (4) κάθε συντελεστής με την παραπομπή του · (5) η ημέρα αποτίμησης γράφεται στο αρχείο.
 */

import type ExcelJS from 'exceljs';

import type { BuildingUnitObjectiveValue } from '@/lib/objective-value/building-objective-value';
import { readBuildingObjectiveValueFacts } from '@/lib/objective-value/building-objective-value-facts';
import type { BuildingObjectiveValues, BuildingObjectiveValueRow } from '@/lib/objective-value/building-objective-values-contract';

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
  rowName: (row) => row.name ?? row.id,
  kind: (kind) => `kind:${kind}`,
  position: (kind, position) => `${kind}:${position}`,
  floor: (floor) => `floor:${floor}`,
  stage: (stage) => `stage:${stage}`,
  inherited: (facts) => facts.join('+'),
  otherBuilding: (ref) => ref.label ?? 'other',
  ownerElsewhere: (unitName, ref) => `${unitName ?? '?'}@${ref.label ?? 'other'}`,
  referenceName: (reference) => reference.name ?? reference.id,
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

const row = (id: string, floor: number, value: BuildingUnitObjectiveValue): BuildingObjectiveValueRow => ({
  id,
  kind: 'unit',
  name: id,
  type: null,
  floor,
  value,
  space: null,
});

/** Θέση στάθμευσης της μονάδας `ownerUnitId` (§19). */
const parkingOf = (id: string, ownerUnitId: string, value: BuildingUnitObjectiveValue): BuildingObjectiveValueRow => ({
  ...row(id, -1, value),
  kind: 'parking',
  space: {
    ownerUnitId,
    ownerUnitName: null,
    ownerElsewhere: null,
    inclusion: 'included',
    declaredPosition: null,
    position: { kind: 'fixed', position: 'closedBasement', source: 'floor' },
  },
});

function data(
  rows: readonly BuildingObjectiveValueRow[],
  total: BuildingObjectiveValues['total'],
  references: BuildingObjectiveValues['references'] = [],
): BuildingObjectiveValues {
  return { valuationDate: '2026-10-02', stage: { source: 'schedule', stage: 'frame' }, facts: readBuildingObjectiveValueFacts({}), rows, references, total, questions: [] };
}

async function exportOf(values: BuildingObjectiveValues) {
  downloaded.length = 0;
  await exportBuildingObjectiveValuesXlsx({
    data: values,
    buildingName: 'Κτίριο Α',
    columns: buildingObjectiveValueColumns(labels, values.rows, () => undefined),
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
    const { workbook, filename } = await exportOf(data([row('A1', 1, exact(1000)), row('B1', 2, exact(250))], { kind: 'exact', value: 1250, items: 2 }));
    expect(filename).toBe('objective-value:building.export.filename::{"building":"Κτίριο Α","date":"2026-10-02"}.xlsx');
    const units = workbook.worksheets[0];
    expect(rowsOf(units).slice(1, 3).map((cells) => cells[0])).toEqual(['B1', 'A1']);
    const footer = units.getRow(units.rowCount);
    // Στήλες: ακίνητο · είδος · παρακολούθημα του · όροφος · αξία (5η).
    expect(footer.getCell(5).value).toEqual({ formula: 'SUM(E2:E3)', result: 1250 });
    expect(units.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
  });

  it('ελλιπές ⇒ ΚΑΝΕΝΑΣ αριθμός συνόλου, μόνο «λείπουν» · τα όρια σε δικές τους αριθμητικές στήλες', async () => {
    const { workbook } = await exportOf(data([row('A1', 1, exact(1000)), row('A2', 1, range)], { kind: 'incomplete', pending: 1, items: 2 }));
    const units = workbook.worksheets[0];
    const footer = units.getRow(units.rowCount).values as unknown[];
    expect(footer.some((cell) => typeof cell === 'number' || (typeof cell === 'object' && cell !== null))).toBe(false);
    expect(footer).toContain('objective-value:building.total.incomplete::{"pending":1,"items":2}');
    const a2 = rowsOf(units).find((cells) => cells[0] === 'A2');
    expect(a2?.slice(4, 7)).toEqual([undefined, 100, 120]);
  });

  it('συντελεστές με παραπομπή · παραδοχές με την ημέρα αποτίμησης και την πηγή του σταδίου', async () => {
    const { workbook } = await exportOf(data([row('A1', 1, exact(1000))], { kind: 'exact', value: 1000, items: 1 }));
    const [, floors, factors, assumptions] = workbook.worksheets;
    expect(rowsOf(floors)[1]).toEqual(['floor:1', 1, 1000, 'objective-value:building.export.floorComplete']);
    expect(rowsOf(factors)).toContainEqual(['A1', 'factor:floor', 1.1, 'ΠΟΛ.1149/1994 άρθ.2 §8']);
    const facts = rowsOf(assumptions);
    expect(facts).toContainEqual(['objective-value:building.export.assumptions.valuationDate', '2026-10-02']);
    // Ναι/Όχι/«δεν δηλώθηκε» με τις ΙΔΙΕΣ λέξεις του χειριστηρίου `YesNo` (ADR-898 §18.1 · §18.3) — όχι δεύτερος κατάλογος.
    expect(facts).toContainEqual(['objective-value:building.facts.hasCentralHeating', 'objective-value:questions.unset.undeclared']);
    expect(facts).toContainEqual(['objective-value:building.facts.hasElevator', 'objective-value:questions.unset.undeclared']);
    expect(facts).toContainEqual(['objective-value:building.facts.stage', 'objective-value:building.export.assumptions.stageFrom.schedule::{"stage":"stage:frame"}']);
    expect(facts).toContainEqual(['objective-value:building.facts.basementStorageEntrance', 'objective-value:questions.unset.undeclared']);
  });

  it('παρακολούθημα ⇒ ΜΙΑ γραμμή με τη μονάδα του · ο τύπος SUM μετρά κάθε γραμμή μία φορά (§19)', async () => {
    const rows = [row('A1', 1, exact(1000)), parkingOf('P1', 'A1', exact(250))];
    const { workbook } = await exportOf(data(rows, { kind: 'exact', value: 1250, items: 2 }));
    const sheet = workbook.worksheets[0];
    const p1 = rowsOf(sheet).find((cells) => cells[0] === 'P1');
    expect(p1?.slice(1, 3)).toEqual(['kind:parking', 'A1']);
    expect(rowsOf(sheet).filter((cells) => cells[0] === 'P1')).toHaveLength(1);
    expect(sheet.getRow(sheet.rowCount).getCell(5).value).toEqual({ formula: 'SUM(E2:E3)', result: 1250 });
  });

  it('χώρος σε ΑΛΛΟ κτίριο ⇒ δικό του φύλλο ΧΩΡΙΣ αριθμό · ΕΚΤΟΣ του φύλλου «Ακίνητα» και του SUM (§20)', async () => {
    const reference = { id: 'P5', kind: 'parking' as const, name: 'Π-5', ownerUnitId: 'A1', ownerUnitName: 'A1', locatedIn: { buildingId: 'bld_2', label: 'Κτίριο Β' } };
    const { workbook } = await exportOf(data([row('A1', 1, exact(1000))], { kind: 'exact', value: 1000, items: 1 }, [reference]));
    const [units, elsewhere] = workbook.worksheets;
    expect(rowsOf(units).some((cells) => cells[0] === 'Π-5')).toBe(false);
    expect(units.getRow(units.rowCount).getCell(5).value).toEqual({ formula: 'SUM(E2:E2)', result: 1000 });
    // Πέμπτο φύλλο, μόνο επειδή υπάρχει αναφορά (το όνομα το κόβει το Excel στους 31 χαρακτήρες).
    expect(workbook.worksheets).toHaveLength(5);
    expect(rowsOf(elsewhere)[1]).toEqual(['Π-5', 'kind:parking', 'A1', 'Κτίριο Β']);
    expect(rowsOf(elsewhere).flat().some((cell) => typeof cell === 'number')).toBe(false);
  });

  it('κάτοχος σε ΑΛΛΟ κτίριο ⇒ «Παρακολούθημα του» λέει ποιος και πού, όχι «Χωρίς μονάδα» (§20)', async () => {
    const base = parkingOf('P9', 'U9', exact(250));
    const elsewhere = { buildingId: 'bld_A', label: 'Κτίριο Α' };
    const p9: BuildingObjectiveValueRow = { ...base, space: base.space && { ...base.space, ownerUnitName: 'Α3', ownerElsewhere: elsewhere } };
    const { workbook } = await exportOf(data([p9], { kind: 'exact', value: 250, items: 1 }));
    expect(rowsOf(workbook.worksheets[0]).find((cells) => cells[0] === 'P9')?.[2]).toBe('Α3@Κτίριο Α');
  });
});
