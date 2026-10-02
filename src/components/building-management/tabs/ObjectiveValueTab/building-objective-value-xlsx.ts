/**
 * @fileoverview **Εξαγωγή XLSX της αντικειμενικής του κτιρίου** (ADR-898 Φ4β · §20) — Ακίνητα — μονάδες και χώροι (ό,τι βλέπει ο
 * άνθρωπος, με την ίδια σειρά) · Σε άλλο κτίριο (αναφορές χωρίς ποσό, μόνο όταν υπάρχουν) · Όροφοι · Συντελεστές (κάθε
 * συντελεστής με την παραπομπή του) · Παραδοχές.
 * @related `lib/export/excel-workbook.ts` (`addScheduleSheet` · `downloadWorkbook` — το SSoT) ·
 *   `shared/space-table-export.ts` (στήλες πίνακα → φύλλο)
 * @module components/building-management/tabs/ObjectiveValueTab/building-objective-value-xlsx
 *
 * ⛔ **Υπολογισμένο, ΟΧΙ αποθηκευμένο** (ADR-889 §10.2): το αρχείο γράφει **την ημέρα αποτίμησης** — οι τιμές ζώνης
 *   αναθεωρούνται, και ένα ποσό χωρίς ημερομηνία θα διαβαζόταν ως διαχρονικό.
 * 🔑 **Σύνολο μόνο όταν είναι αληθινό**: πλήρες ⇒ τύπος `SUM` με το αποτέλεσμα του server (επαληθεύσιμο στο Excel) ·
 *   ελλιπές ⇒ «λείπουν Ν από Μ», **κανένας** αριθμός.
 */

import type ExcelJS from 'exceljs';

import { PRODUCT_NAME } from '@/constants/product-identity';
import { compareSortValues } from '@/lib/array-utils';
import { addKeyValueSheet, addScheduleSheet, exportWorkbook, type KeyValueRow, type ScheduleCell, type ScheduleFooterCell } from '@/lib/export/excel-workbook';
import { buildingObjectiveValueTotal } from '@/lib/objective-value/building-objective-value';
import type { BuildingObjectiveValues, BuildingObjectiveValueRow } from '@/lib/objective-value/building-objective-values-contract';
import { AADE_MYPROPERTY_URL } from '@/lib/objective-value/objective-value-page-sections';
import type { AppliedFactor, BasementStoragePosition } from '@/lib/objective-value/objective-value-types';

import { spaceScheduleSpec } from '../../shared/space-table-export';
import type { SortState } from '../../shared/space-table-sort';
import type { SpaceColumn } from '../../shared/types';
import { exactValueOf, STATUS_COLUMN_KEY, VALUE_COLUMN_KEY } from './building-objective-value-columns';
import type { BuildingObjectiveValueLabels } from './useBuildingObjectiveValueLabels';

const B = 'objective-value:building';
const E = `${B}.export`;

export interface BuildingObjectiveValueExport {
  readonly data: BuildingObjectiveValues;
  readonly buildingName: string;
  readonly columns: readonly SpaceColumn<BuildingObjectiveValueRow>[];
  readonly sort: SortState | null;
  readonly labels: BuildingObjectiveValueLabels;
  readonly factorLabel: (factor: AppliedFactor) => string;
  /** `YYYY-MM-DD` — πότε κατέβηκε το αρχείο (η ημέρα αποτίμησης είναι άλλο πράγμα: του server). */
  readonly exportedOn: string;
}

/** Η γραμμή συνόλου: `SUM` όταν είναι πλήρες, αλλιώς **κανένας** αριθμός — μόνο πόσες λείπουν. */
function unitsFooter({ data, labels }: BuildingObjectiveValueExport): Readonly<Record<string, ScheduleFooterCell>> {
  const { t } = labels;
  const { total } = data;
  const label = { unit: t(`${B}.total.label`) };
  if (total.kind === 'incomplete') return { ...label, [STATUS_COLUMN_KEY]: t(`${B}.total.incomplete`, { pending: total.pending, items: total.items }) };
  return { ...label, [VALUE_COLUMN_KEY]: { sum: total.value } };
}

function addFloorsSheet(workbook: ExcelJS.Workbook, { data, labels }: BuildingObjectiveValueExport): void {
  const { t } = labels;
  const floors = [...new Set(data.rows.map((row) => row.floor))].sort((a, b) => compareSortValues(a, b, 'asc'));
  const rows = floors.map((floor): ScheduleCell[] => {
    const total = buildingObjectiveValueTotal(data.rows.filter((row) => row.floor === floor));
    const incomplete = total.kind === 'incomplete';
    const status = incomplete ? t(`${E}.floorIncomplete`, { pending: total.pending, items: total.items }) : t(`${E}.floorComplete`);
    return [labels.floor(floor), total.items, incomplete ? null : total.value, status];
  });
  addScheduleSheet(workbook, {
    name: t(`${E}.sheets.floors`),
    columns: [
      { header: t(`${B}.columns.floor`), format: 'text' },
      { header: t(`${E}.columns.items`), format: 'number' },
      { header: t(`${E}.columns.subtotal`), format: 'currency' },
      { header: t(`${B}.columns.status`), format: 'text', width: 40 },
    ],
    rows,
  });
}

/** Μία μονάδα με ακριβές ποσό → η βάση της (τιμή ζώνης · επιφάνεια) και κάθε συντελεστής με την παραπομπή του. */
function factorRowsOf(row: BuildingObjectiveValueRow, input: BuildingObjectiveValueExport): ScheduleCell[][] {
  const { value } = row;
  if (value.kind !== 'evaluated' || value.bounds.kind !== 'exact') return [];
  const { result } = value.bounds;
  const { labels, factorLabel } = input;
  const name = labels.rowName(row);
  return [
    [name, labels.t(`${E}.zonePrice`), result.zonePrice, null],
    [name, labels.t(`${E}.area`), result.area, null],
    ...result.factors.map((factor): ScheduleCell[] => [name, factorLabel(factor), factor.factor, factor.ref]),
    [name, labels.t(`${B}.columns.value`), exactValueOf(value), null],
  ];
}

function addFactorsSheet(workbook: ExcelJS.Workbook, input: BuildingObjectiveValueExport): void {
  const { t } = input.labels;
  addScheduleSheet(workbook, {
    name: t(`${E}.sheets.factors`),
    columns: [
      { header: t(`${B}.columns.unit`), format: 'text' },
      { header: t(`${E}.columns.factor`), format: 'text', width: 32 },
      { header: t(`${E}.columns.factorValue`), format: 'number' },
      { header: t(`${E}.columns.reference`), format: 'text', width: 32 },
    ],
    rows: input.data.rows.flatMap((row) => factorRowsOf(row, input)),
  });
}

/**
 * Χώροι μονάδων του κτιρίου σε **άλλο** κτίριο (ADR-898 §20) — φύλλο **χωρίς** στήλη ποσού: μετρούν στο κτίριο όπου
 * βρίσκονται, ποτέ στο `SUM` του φύλλου «Ακίνητα». Μόνο όταν υπάρχουν.
 */
function addElsewhereSheet(workbook: ExcelJS.Workbook, { data, labels }: BuildingObjectiveValueExport): void {
  if (data.references.length === 0) return;
  const { t } = labels;
  const unitName = new Map(data.rows.filter((row) => row.space === null).map((row) => [row.id, labels.rowName(row)]));
  addScheduleSheet(workbook, {
    name: t(`${E}.sheets.elsewhere`),
    columns: [
      { header: t(`${B}.columns.unit`), format: 'text' },
      { header: t(`${B}.columns.kind`), format: 'text' },
      { header: t(`${B}.columns.attachedTo`), format: 'text' },
      { header: t(`${B}.elsewhere.locatedColumn`), format: 'text', width: 32 },
    ],
    rows: data.references.map((reference): ScheduleCell[] => [
      labels.referenceName(reference),
      labels.kind(reference.kind),
      unitName.get(reference.ownerUnitId) ?? reference.ownerUnitName ?? t(`${B}.unnamed.unit`),
      labels.otherBuilding(reference.locatedIn),
    ]),
  });
}

function stageText({ data, labels }: BuildingObjectiveValueExport): string {
  const { t } = labels;
  if (data.stage.source === 'unknown') return t(`${E}.assumptions.stageUnknown`);
  return t(`${E}.assumptions.stageFrom.${data.stage.source}`, { stage: labels.stage(data.stage.stage) });
}

function addAssumptionsSheet(workbook: ExcelJS.Workbook, input: BuildingObjectiveValueExport): void {
  const { data, labels, buildingName, exportedOn } = input;
  const { t } = labels;
  // Οι ΙΔΙΕΣ λέξεις με το χειριστήριο `YesNo` (`useYesNoLabels('undeclared')`) — ένας κατάλογος, όχι δεύτερο «ναι/όχι».
  const notDeclared = t('objective-value:questions.unset.undeclared');
  const yesNo = (value: boolean | null) => (value === null ? notDeclared : t(`objective-value:questions.${value ? 'yes' : 'no'}`));
  const entranceOf = (value: BasementStoragePosition | null) => (value === null ? notDeclared : labels.position('storage', value));
  const rows: KeyValueRow[] = [
    [t(`${E}.assumptions.building`), buildingName],
    [t(`${E}.assumptions.valuationDate`), data.valuationDate],
    [t(`${E}.assumptions.exportedOn`), exportedOn],
    [t(`${B}.facts.stage`), stageText(input)],
    [t(`${B}.facts.permitDate`), data.facts.permitDate ?? notDeclared],
    [t(`${B}.facts.plotUtilisation`), data.facts.plotUtilisation ?? notDeclared],
    [t(`${B}.facts.hasElevator`), yesNo(data.facts.hasElevator)],
    [t(`${B}.facts.hasCentralHeating`), yesNo(data.facts.hasCentralHeating)],
    [t(`${B}.facts.basementStorageEntrance`), entranceOf(data.facts.basementStorageEntrance)],
    [t(`${E}.assumptions.disclaimer`), t('objective-value:result.disclaimer')],
    [t(`${E}.assumptions.myProperty`), AADE_MYPROPERTY_URL],
    [t(`${E}.assumptions.software`), PRODUCT_NAME],
  ];
  addKeyValueSheet(workbook, { name: t(`${E}.sheets.assumptions`), keyHeader: t(`${E}.columns.key`), valueHeader: t(`${E}.columns.value`), rows });
}

/** Κατέβασμα του βιβλίου — ο κοινός σκελετός (`exportWorkbook`: `exceljs` μόνο τη στιγμή της εξαγωγής). */
export function exportBuildingObjectiveValuesXlsx(input: BuildingObjectiveValueExport): Promise<void> {
  const { t } = input.labels;
  return exportWorkbook({
    title: t(`${B}.title`),
    fileBaseName: t(`${E}.filename`, { building: input.buildingName, date: input.data.valuationDate }),
    build: (workbook) => {
      addScheduleSheet(
        workbook,
        spaceScheduleSpec({ name: t(`${E}.sheets.units`), columns: input.columns, items: input.data.rows, sort: input.sort, footer: unitsFooter(input) }),
      );
      addElsewhereSheet(workbook, input);
      addFloorsSheet(workbook, input);
      addFactorsSheet(workbook, input);
      addAssumptionsSheet(workbook, input);
    },
  });
}
