/**
 * ADR-422 L5 — Μηχανολογική Μελέτη Θέρμανσης: Report builder (PURE SSoT).
 *
 * ΔΕΝ υπολογίζει τίποτα νέο — **συγκεντρώνει** τα 4 read-models (L1 φορτία χώρων · L2
 * διαστασιολόγηση σωμάτων · L3 διαστασιολόγηση σωληνώσεων · L4 υδραυλική εξισορρόπηση) σε
 * ένα εκτυπώσιμο `ThermalStudyReport` (σύνοψη + 4 πίνακες) όπως η Revit «Schedules/Reports»
 * / 4M-FineHEAT printout μελέτης. Όλα derived, μηδέν persist.
 *
 * ΜΟΝΑΔΕΣ (read-model → πίνακας): Φ/φορτία W (ακέραια)· DN mm (ακέραιο)· v m/s· R Pa/m·
 * παροχή kg/s· πιέσεις Pa→kPa (÷1000). Pure/idempotent, full unit-testable.
 *
 * @see ./thermal-study-report-types · ../../schedule/exporters/value-formatters (reuse)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L5)
 */

import { compareStrings } from '@/lib/array-utils';
import type { SpaceHeatLoads } from '../../../hooks/data/useSpaceHeatLoads';
import type {
  RadiatorSizingMap,
  RadiatorSizingViewResult,
} from '../../../hooks/data/useRadiatorSizing';
import type { PipeSizingMap } from '../sizing/pipe-network-sizing';
import type { HydraulicBalancingResult } from '../balancing/circuit-balancing';
import type { ClimateZone } from '../kenak-thermal-config';
import { deriveEnvelopeCompliance } from '../heat-load/derive-envelope-compliance';
import {
  deriveAnnualHeating,
  type AnnualEnergyRow,
  type AnnualHeatingResult,
} from '../heat-load/derive-annual-energy';
import type { HeatLoadBoundaryKind } from '../heat-load/heat-load-types';
import type { ThermalSpaceEntity } from '../../types/thermal-space-types';
import type {
  ReportColumn,
  ReportRow,
  ReportSection,
  ThermalStudyReport,
} from './thermal-study-report-types';

const PA_PER_KPA = 1000;
/** Σύμβολα κατάστασης (μη-μεταφράσιμα). */
const MARK_OK = '✓';
const MARK_FAIL = '✗';
const MARK_INDEX = '★';
const MARK_NONE = '—';

/** Resolver labels χώρων + header context — injected (i18n SSoT μένει στον caller). */
export interface ThermalStudyLookups {
  readonly buildingLabel: string;
  readonly floorLabel: string;
  /** name override → use-type label → fallback. Pure, παρέχεται από το widget. */
  readonly spaceLabel: (space: ThermalSpaceEntity) => string;
  /** Μεταφρασμένη ετικέτα τύπου δομικού στοιχείου (L6 ΚΕΝΑΚ· τοίχος/κούφωμα/…). */
  readonly boundaryKindLabel: (kind: HeatLoadBoundaryKind) => string;
}

/** Όρισμα του builder — τα 4 resolved read-models + lookups + ζώνη (L6). */
export interface ThermalStudyReportInput {
  readonly spaceLoads: SpaceHeatLoads | null;
  readonly radiatorSizing: RadiatorSizingMap;
  readonly pipeSizing: PipeSizingMap;
  readonly balancing: HydraulicBalancingResult;
  /** Κλιματική ζώνη — για τον ΚΕΝΑΚ έλεγχο κελύφους (L6). `null` ⇒ παράλειψη. */
  readonly climateZone: ClimateZone | null;
  readonly lookups: ThermalStudyLookups;
}

const K = {
  sections: 'thermalStudyReport.sections',
  columns: 'thermalStudyReport.columns',
  summary: 'thermalStudyReport.summary',
} as const;

function col(
  key: string,
  i18nLeaf: string,
  valueType: ReportColumn['valueType'],
  align: ReportColumn['align'],
): ReportColumn {
  return { key, i18nKey: `${K.columns}.${i18nLeaf}`, valueType, align };
}

// ─── Σύνοψη (KPI section — 1 row) ──────────────────────────────────────────────

function buildSummarySection(input: ThermalStudyReportInput): ReportSection {
  const { spaceLoads, radiatorSizing, balancing } = input;
  let floorLoadW = 0;
  if (spaceLoads) for (const r of spaceLoads.results.values()) floorLoadW += r.totalW;
  let requiredPowerW = 0;
  let totalFlowKgS = 0;
  for (const r of radiatorSizing.values()) requiredPowerW += r.requiredNominalW;
  for (const tb of balancing.terminals.values()) totalFlowKgS += tb.massFlowKgS;
  const indexTb = balancing.indexTerminalId
    ? balancing.terminals.get(balancing.indexTerminalId)
    : null;
  const annual = resolveAnnualHeating(input);

  const columns: ReportColumn[] = [
    { key: 'floorLoad', i18nKey: `${K.summary}.floorLoad`, valueType: 'count', align: 'right' },
    { key: 'requiredPower', i18nKey: `${K.summary}.requiredPower`, valueType: 'count', align: 'right' },
    { key: 'indexDrop', i18nKey: `${K.summary}.indexDrop`, valueType: 'number', align: 'right' },
    { key: 'pumpHead', i18nKey: `${K.summary}.pumpHead`, valueType: 'number', align: 'right' },
    { key: 'circuits', i18nKey: `${K.summary}.circuits`, valueType: 'count', align: 'right' },
    { key: 'totalFlow', i18nKey: `${K.summary}.totalFlow`, valueType: 'number', align: 'right' },
    { key: 'grossEnergy', i18nKey: `${K.summary}.grossEnergy`, valueType: 'count', align: 'right' },
    { key: 'annualEnergy', i18nKey: `${K.summary}.annualEnergy`, valueType: 'count', align: 'right' },
    { key: 'specificDemand', i18nKey: `${K.summary}.specificDemand`, valueType: 'number', align: 'right' },
    { key: 'energyClass', i18nKey: `${K.summary}.energyClass`, valueType: 'text', align: 'center' },
  ];
  const row: ReportRow = {
    floorLoad: Math.round(floorLoadW),
    requiredPower: Math.round(requiredPowerW),
    indexDrop: indexTb ? indexTb.circuitDropPa / PA_PER_KPA : null,
    pumpHead: balancing.pumpHeadPa / PA_PER_KPA,
    circuits: balancing.terminals.size,
    totalFlow: totalFlowKgS,
    grossEnergy: annual ? Math.round(annual.totalGrossKWh) : 0,
    annualEnergy: annual ? Math.round(annual.totalAnnualKWh) : 0,
    specificDemand: annual ? annual.specificDemandKWhM2 : null,
    energyClass: annual ? annual.energyClass : MARK_NONE,
  };
  return { titleKey: `${K.sections}.summary`, columns, rows: [row] };
}

// ─── L1 — Θερμικά φορτία ανά χώρο ──────────────────────────────────────────────

function buildLoadsSection(input: ThermalStudyReportInput): ReportSection {
  const { spaceLoads, lookups } = input;
  const columns: ReportColumn[] = [
    col('space', 'space', 'text', 'left'),
    col('loadW', 'loadW', 'count', 'right'),
    col('specific', 'specific', 'number', 'right'),
    col('transmission', 'transmission', 'count', 'right'),
    col('thermalBridge', 'thermalBridge', 'count', 'right'),
    col('ventilation', 'ventilation', 'count', 'right'),
    col('reheat', 'reheat', 'count', 'right'),
  ];
  const rows: ReportRow[] = [];
  if (spaceLoads) {
    const spaces = [...spaceLoads.spaces].sort((a, b) => compareStrings(a.id, b.id));
    for (const space of spaces) {
      const r = spaceLoads.results.get(space.id);
      if (!r) continue;
      rows.push({
        space: lookups.spaceLabel(space),
        loadW: Math.round(r.totalW),
        specific: r.specificLoadWperM2,
        transmission: Math.round(r.transmissionW),
        thermalBridge: Math.round(r.thermalBridgeW),
        ventilation: Math.round(r.ventilationW),
        reheat: Math.round(r.reheatW),
      });
    }
  }
  return { titleKey: `${K.sections}.loads`, columns, rows };
}

// ─── L2 — Διαστασιολόγηση σωμάτων ──────────────────────────────────────────────

function adequacyMark(adequate: boolean | null): string {
  if (adequate === null) return MARK_NONE;
  return adequate ? MARK_OK : MARK_FAIL;
}

function radiatorRow(
  r: RadiatorSizingViewResult,
  spaceLabelById: ReadonlyMap<string, string>,
): ReportRow {
  return {
    space: spaceLabelById.get(r.spaceId) ?? r.spaceId,
    regime: r.regime.label,
    deltaT: r.deltaTActualK,
    requiredNominal: Math.round(r.requiredNominalW),
    catalogue: r.catalogueW === null ? null : Math.round(r.catalogueW),
    adequate: adequacyMark(r.adequate),
  };
}

function buildRadiatorsSection(
  input: ThermalStudyReportInput,
  spaceLabelById: ReadonlyMap<string, string>,
): ReportSection {
  const columns: ReportColumn[] = [
    col('space', 'space', 'text', 'left'),
    col('regime', 'regime', 'text', 'center'),
    col('deltaT', 'deltaT', 'number', 'right'),
    col('requiredNominal', 'requiredNominal', 'count', 'right'),
    col('catalogue', 'catalogue', 'count', 'right'),
    col('adequate', 'adequate', 'text', 'center'),
  ];
  const ids = [...input.radiatorSizing.keys()].sort(compareStrings);
  const rows = ids.map((id) => radiatorRow(input.radiatorSizing.get(id)!, spaceLabelById));
  return { titleKey: `${K.sections}.radiators`, columns, rows };
}

// ─── L3 — Διαστασιολόγηση σωληνώσεων ───────────────────────────────────────────

function buildPipesSection(input: ThermalStudyReportInput): ReportSection {
  const columns: ReportColumn[] = [
    col('seq', 'seq', 'count', 'right'),
    col('dn', 'dn', 'count', 'right'),
    col('massFlow', 'massFlow', 'number', 'right'),
    col('velocity', 'velocity', 'number', 'right'),
    col('friction', 'friction', 'number', 'right'),
  ];
  const ids = [...input.pipeSizing.keys()].sort(compareStrings);
  const rows: ReportRow[] = ids.map((id, i) => {
    const s = input.pipeSizing.get(id)!;
    return {
      seq: i + 1,
      dn: s.dnMm,
      massFlow: s.massFlowKgS,
      velocity: s.velocityMS,
      friction: s.frictionPaM,
    };
  });
  return { titleKey: `${K.sections}.pipes`, columns, rows };
}

// ─── L4 — Υδραυλική εξισορρόπηση ───────────────────────────────────────────────

function buildBalancingSection(
  input: ThermalStudyReportInput,
  spaceLabelById: ReadonlyMap<string, string>,
): ReportSection {
  const { balancing, radiatorSizing } = input;
  const columns: ReportColumn[] = [
    col('space', 'space', 'text', 'left'),
    col('circuitDrop', 'circuitDrop', 'number', 'right'),
    col('isIndex', 'isIndex', 'text', 'center'),
    col('surplus', 'surplus', 'number', 'right'),
    col('kv', 'kv', 'number', 'right'),
  ];
  const ids = [...balancing.terminals.keys()].sort(compareStrings);
  const rows: ReportRow[] = ids.map((id) => {
    const tb = balancing.terminals.get(id)!;
    const spaceId = radiatorSizing.get(id)?.spaceId;
    return {
      space: (spaceId && spaceLabelById.get(spaceId)) ?? id,
      circuitDrop: tb.circuitDropPa / PA_PER_KPA,
      isIndex: tb.isIndex ? MARK_INDEX : '',
      surplus: tb.surplusPa / PA_PER_KPA,
      kv: tb.requiredKv,
    };
  });
  return { titleKey: `${K.sections}.balancing`, columns, rows };
}

// ─── L6 — Έλεγχος συμμόρφωσης κελύφους ΚΕΝΑΚ ───────────────────────────────────

function complianceRow(
  row: { spaceId: string; kind: HeatLoadBoundaryKind; uValue: number; uMax: number; compliant: boolean },
  input: ThermalStudyReportInput,
  spaceLabelById: ReadonlyMap<string, string>,
): ReportRow {
  return {
    space: spaceLabelById.get(row.spaceId) ?? row.spaceId,
    element: input.lookups.boundaryKindLabel(row.kind),
    uValue: row.uValue,
    uMax: row.uMax,
    compliant: row.compliant ? MARK_OK : MARK_FAIL,
  };
}

function buildComplianceSection(
  input: ThermalStudyReportInput,
  spaceLabelById: ReadonlyMap<string, string>,
): ReportSection {
  const columns: ReportColumn[] = [
    col('space', 'space', 'text', 'left'),
    col('element', 'element', 'text', 'left'),
    col('uValue', 'uValue', 'number', 'right'),
    col('uMax', 'uMax', 'number', 'right'),
    col('compliant', 'compliant', 'text', 'center'),
  ];
  const { spaceLoads, climateZone } = input;
  if (!spaceLoads || !climateZone) {
    return { titleKey: `${K.sections}.compliance`, columns, rows: [] };
  }
  const { rows } = deriveEnvelopeCompliance(spaceLoads.results, climateZone);
  return {
    titleKey: `${K.sections}.compliance`,
    columns,
    rows: rows.map((r) => complianceRow(r, input, spaceLabelById)),
  };
}

// ─── L7 — Ετήσια ενεργειακή ζήτηση θέρμανσης (ενδεικτική) ──────────────────────

/**
 * Υπολογίζει το ετήσιο read-model (μέθοδος βαθμοημερών) όταν υπάρχουν φορτία + ζώνη·
 * `null` αλλιώς. Shared από σύνοψη (KPIs) + πίνακα L7 (μία πηγή αλήθειας ανά report).
 */
function resolveAnnualHeating(input: ThermalStudyReportInput): AnnualHeatingResult | null {
  const { spaceLoads, climateZone } = input;
  if (!spaceLoads || !climateZone) return null;
  return deriveAnnualHeating(spaceLoads.results, spaceLoads.spaces, climateZone);
}

/** %  — ο συντελεστής αξιοποίησης (0-1) σε ποσοστό για το report (×100). */
const UTILISATION_PERCENT = 100;

function annualEnergyRow(
  row: AnnualEnergyRow,
  spaceLabelById: ReadonlyMap<string, string>,
): ReportRow {
  return {
    space: spaceLabelById.get(row.spaceId) ?? row.spaceId,
    lossCoeff: row.lossCoefficientWperK,
    floorArea: row.floorAreaM2,
    grossDemand: Math.round(row.grossDemandKWh),
    gains: Math.round(row.internalGainKWh + row.solarGainKWh),
    utilisation: row.utilisation * UTILISATION_PERCENT,
    annualDemand: Math.round(row.annualDemandKWh),
    specificDemand: row.specificDemandKWhM2,
  };
}

function buildAnnualEnergySection(
  input: ThermalStudyReportInput,
  spaceLabelById: ReadonlyMap<string, string>,
): ReportSection {
  const columns: ReportColumn[] = [
    col('space', 'space', 'text', 'left'),
    col('lossCoeff', 'lossCoeff', 'number', 'right'),
    col('floorArea', 'floorArea', 'area-m2', 'right'),
    col('grossDemand', 'grossDemand', 'count', 'right'),
    col('gains', 'gains', 'count', 'right'),
    col('utilisation', 'utilisation', 'number', 'right'),
    col('annualDemand', 'annualDemand', 'count', 'right'),
    col('specificDemand', 'specificDemand', 'number', 'right'),
  ];
  const annual = resolveAnnualHeating(input);
  if (!annual) {
    return { titleKey: `${K.sections}.annualEnergy`, columns, rows: [] };
  }
  return {
    titleKey: `${K.sections}.annualEnergy`,
    columns,
    rows: annual.rows.map((r) => annualEnergyRow(r, spaceLabelById)),
  };
}

// ─── Public builder ────────────────────────────────────────────────────────────

/** spaceId → label, από τους χώρους του ορόφου (για L2/L4 lookup). */
function buildSpaceLabelIndex(input: ThermalStudyReportInput): Map<string, string> {
  const index = new Map<string, string>();
  if (!input.spaceLoads) return index;
  for (const space of input.spaceLoads.spaces) {
    index.set(space.id, input.lookups.spaceLabel(space));
  }
  return index;
}

/**
 * Συγκεντρώνει τα 4 read-models σε `ThermalStudyReport`. Pure — μηδέν side effects.
 */
export function buildThermalStudyReport(input: ThermalStudyReportInput): ThermalStudyReport {
  const spaceLabelById = buildSpaceLabelIndex(input);

  const summary = buildSummarySection(input);
  const loads = buildLoadsSection(input);
  const radiators = buildRadiatorsSection(input, spaceLabelById);
  const pipes = buildPipesSection(input);
  const balancing = buildBalancingSection(input, spaceLabelById);
  const compliance = buildComplianceSection(input, spaceLabelById);
  const annualEnergy = buildAnnualEnergySection(input, spaceLabelById);

  const isEmpty =
    loads.rows.length === 0 &&
    radiators.rows.length === 0 &&
    pipes.rows.length === 0 &&
    balancing.rows.length === 0;

  return {
    header: { buildingLabel: input.lookups.buildingLabel, floorLabel: input.lookups.floorLabel },
    sections: [summary, loads, radiators, pipes, balancing, compliance, annualEnergy],
    isEmpty,
  };
}
