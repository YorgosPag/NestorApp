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

const TOP_PAD_MM = 11;       // clears the region heading
const SIDE_PAD_MM = 4;
const ROW_H_MM = 7;
const TEXT_MM = 2.6;
const LABEL_HEX = '#555555';
const VALUE_HEX = '#111111';

export interface ColumnTitleBlockResult {
  readonly primitives: readonly DetailPrimitive[];
}

/** A label : value field row (value omitted → not rendered). */
interface FieldRow {
  readonly label: string;
  readonly value: string;
}

/** A text primitive whose baseline sits `TEXT_MM` below the row top. */
function fieldText(x: number, rowTop: number, text: string, right: boolean): DetailPrimitive {
  return {
    kind: 'text',
    position: { x, y: rowTop + TEXT_MM },
    text, heightMm: TEXT_MM,
    colorHex: right ? VALUE_HEX : LABEL_HEX,
    align: right ? 'right' : 'left',
    bold: right,
  };
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
  if (params.kind !== 'rectangular') return { primitives: [] };
  const r = params.reinforcement;
  const round = (n: number): string => String(Math.round(n));

  const rows: FieldRow[] = [
    { label: labels.section, value: `${round(params.width)}×${round(params.depth)}` },
    { label: labels.height, value: round(params.height) },
    { label: labels.concrete, value: params.concreteGrade ?? DEFAULT_CONCRETE_GRADE },
    { label: labels.steel, value: REBAR_GRADE },
  ];
  if (r) {
    rows.push({ label: labels.cover, value: round(r.coverMm) });
    rows.push({ label: labels.longitudinal, value: formatLongitudinalLabel(r) });
    rows.push({ label: labels.stirrups, value: formatStirrupsLabel(r) });
  }

  const x0 = region.x + SIDE_PAD_MM;
  const xR = region.x + region.w - SIDE_PAD_MM;
  const out: DetailPrimitive[] = [];
  let y = region.y + TOP_PAD_MM;
  for (const row of rows) {
    out.push(fieldText(x0, y, row.label, false));
    if (row.value) out.push(fieldText(xR, y, row.value, true));
    y += ROW_H_MM;
  }
  return { primitives: out };
}
