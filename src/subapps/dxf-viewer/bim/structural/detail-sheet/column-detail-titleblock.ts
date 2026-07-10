/**
 * ADR-457 — Column reinforcement detail · TITLE-BLOCK region builder (pure SSoT).
 *
 * Produces the «ΣΤΟΙΧΕΙΑ ΣΧΕΔΙΟΥ» (drawing data) primitives (sheet-mm): a simple
 * label : value field list describing the column — section, height, concrete
 * grade, steel grade, cover and the longitudinal / stirrup callouts. Values are
 * data (numbers / «4Ø16» / «C25/30» / «B500C»), never i18n; the field labels are
 * host-injected (N.11-safe). Laid out with `text` primitives only.
 *
 * v1: rectangular column. Reinforcement-dependent rows are omitted when the
 * column has no reinforcement yet.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/column-detail-titleblock
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import type { ColumnParams } from '../../types/column-types';
import { DEFAULT_CONCRETE_GRADE } from '../concrete-grades';
import { REBAR_GRADE } from '../rebar-catalog';
import {
  formatLongitudinalLabel,
  formatStirrupsLabel,
} from '../reinforcement/column-reinforcement-compute';
import type { DetailPrimitive, DetailTitleBlockLabels, RectMm } from './detail-sheet-types';
import { buildFieldBlock, roundMm, type FieldRow } from './detail-sheet-field-block';

export interface ColumnTitleBlockResult {
  readonly primitives: readonly DetailPrimitive[];
}

/**
 * Builds the title-block field rows for a rectangular column. Returns empty
 * primitives for unsupported kinds.
 */
export function buildColumnTitleBlockRegion(
  params: ColumnParams,
  region: RectMm,
  labels: DetailTitleBlockLabels,
): ColumnTitleBlockResult {
  const r = params.reinforcement;
  // ADR-460 — ετικέτα διατομής ανά σχήμα: κυκλική → Ø{d}· αλλιώς {W}×{D} (bbox).
  const sectionLabel = params.kind === 'circular'
    ? `Ø${roundMm(params.width)}`
    : `${roundMm(params.width)}×${roundMm(params.depth)}`;

  const rows: FieldRow[] = [
    { label: labels.section, value: sectionLabel },
    { label: labels.height, value: roundMm(params.height) },
    { label: labels.concrete, value: params.concreteGrade ?? DEFAULT_CONCRETE_GRADE },
    { label: labels.steel, value: REBAR_GRADE },
  ];
  if (r) {
    rows.push({ label: labels.cover, value: roundMm(r.coverMm) });
    rows.push({ label: labels.longitudinal, value: formatLongitudinalLabel(r) });
    rows.push({ label: labels.stirrups, value: formatStirrupsLabel(r) });
  }

  return { primitives: buildFieldBlock(region, rows) };
}
