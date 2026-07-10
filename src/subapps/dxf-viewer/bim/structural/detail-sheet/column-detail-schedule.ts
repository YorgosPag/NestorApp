/**
 * ADR-457 — Column reinforcement detail · SCHEDULE region builder (pure SSoT).
 *
 * Produces the steel take-off table primitives (sheet-mm) for the «ΣΤΟΙΧΕΙΑ
 * ΟΠΛΙΣΜΟΥ» region: a Revit/Tekla-style schedule with a header row, one row per
 * reinforcement family (longitudinal + stirrups/spiral), a total-weight row and
 * a footer with the longitudinal ratio ρ and the confinement factor α.
 *
 * Geometry-is-SSoT: the quantities come straight from
 * `computeColumnReinforcementQuantities` / `computeColumnConfinement` (the same
 * pure compute that drives the live BOQ) — never re-derived here. The table is
 * laid out with the shared 5-column schedule SSoT (ADR-622); no new primitive kind.
 *
 * v1: rectangular column with `reinforcement`. Other kinds → empty.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/column-detail-schedule
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import type { ColumnParams } from '../../types/column-types';
import type { ColumnSectionContext } from '../codes/structural-code-types';
import { computeColumnReinforcementQuantities } from '../reinforcement/column-reinforcement-compute';
import { computeColumnConfinement } from '../reinforcement/column-confinement';
import { resolveColumnRebarLayout } from '../reinforcement/column-rebar-layout-resolve';
import { resolveColumnReinforcementSection } from '../reinforcement/column-section-outline';
import { DEFAULT_STIRRUP_TYPE } from '../reinforcement/column-reinforcement-types';
import type { DetailPrimitive, DetailScheduleLabels, RectMm } from './detail-sheet-types';
import {
  buildScheduleTable,
  fmt1,
  type ScheduleColumn,
} from './detail-sheet-schedule-table';

export interface ColumnScheduleResult {
  readonly primitives: readonly DetailPrimitive[];
}

/** Στοιχείο | Ø | n | Μήκος | Βάρος — the column schedule's 5-column layout (mark left, the rest right). */
const COLUMN_SCHEDULE_COLUMNS: readonly ScheduleColumn[] = [
  { frac: 0, align: 'left' },
  { frac: 0.52, align: 'right' },
  { frac: 0.68, align: 'right' },
  { frac: 0.84, align: 'right' },
  { frac: 1, align: 'right' },
];

/**
 * Builds the schedule-region primitives for a rectangular reinforced column.
 * Returns empty primitives for unsupported kinds / missing reinforcement.
 */
export function buildColumnScheduleRegion(
  params: ColumnParams,
  region: RectMm,
  labels: DetailScheduleLabels,
): ColumnScheduleResult {
  const r = params.reinforcement;
  if (!r) return { primitives: [] };
  if (params.width <= 0 || params.depth <= 0 || params.height <= 0) return { primitives: [] };

  // ADR-460 — shape-correct Ac + χαρακτηριστικά μεγέθη + dispatch ανά σχήμα.
  const section = resolveColumnReinforcementSection(params);
  const ctx: ColumnSectionContext = {
    widthMm: section.bboxWidthMm, depthMm: section.bboxDepthMm, heightMm: params.height,
    grossAreaMm2: section.grossAreaMm2,
    minThicknessMm: section.minThicknessMm, maxDimensionMm: section.maxDimensionMm,
    perimeterMm: section.perimeterMm, mode: section.mode,
  };
  const q = computeColumnReinforcementQuantities(ctx, r, undefined, section);
  const conf = computeColumnConfinement(ctx, r, resolveColumnRebarLayout(r, section));
  const isSpiral = (r.stirrups.type ?? DEFAULT_STIRRUP_TYPE) === 'spiral';

  const rows: string[][] = [
    [labels.longitudinal, `Ø${r.longitudinal.diameterMm}`, String(r.longitudinal.count),
      fmt1(q.longitudinalLengthM), fmt1(q.longitudinalWeightKg)],
    [isSpiral ? labels.spiral : labels.stirrups, `Ø${r.stirrups.diameterMm}`,
      String(q.stirrupCount), fmt1(q.stirrupTotalLengthM), fmt1(q.stirrupWeightKg)],
  ];

  const primitives = buildScheduleTable({
    region,
    columns: COLUMN_SCHEDULE_COLUMNS,
    header: [labels.mark, labels.diameter, labels.count, labels.length, labels.weight],
    rows,
    total: [labels.total, '', '', '', fmt1(q.totalSteelWeightKg)],
    footers: [
      `${labels.ratio} = ${(q.ratio * 100).toFixed(2)}%`,
      `${labels.confinement} = ${conf.alpha.toFixed(2)}`,
    ],
  });

  return { primitives };
}
