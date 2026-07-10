/**
 * detail-sheet-field-block — SSoT for the «ΣΤΟΙΧΕΙΑ ΣΧΕΔΙΟΥ» (drawing-data)
 * label : value field block shared by every structural detail sheet title block.
 *
 * ADR-622 — the beam / column / footing / slab title-block builders all hand-rolled
 * the SAME field list (padding/row/text constants, the `FieldRow` type, the
 * `fieldText` primitive, the `round` mm formatter, and the label-left / value-right
 * layout loop), differing ONLY in which rows they emit. This module owns the layout;
 * each `build*TitleBlockRegion` now formats its rows and calls {@link buildFieldBlock}.
 * All `build*TitleBlockRegion` signatures + Result types are preserved.
 *
 * @see ADR-457/463/471/476 — the per-member reinforcement detail sheets
 */

import type { DetailPrimitive, RectMm } from './detail-sheet-types';

const TOP_PAD_MM = 11; // clears the region heading
const SIDE_PAD_MM = 4;
const ROW_H_MM = 7;
const TEXT_MM = 2.6;
const LABEL_HEX = '#555555';
const VALUE_HEX = '#111111';

/** A label : value field row (empty value → value text not rendered). */
export interface FieldRow {
  readonly label: string;
  readonly value: string;
}

/** Rounded-integer string for a millimetre dimension. */
export function roundMm(n: number): string {
  return String(Math.round(n));
}

/** A text primitive whose baseline sits `TEXT_MM` below the row top (value = right/bold, label = left). */
function fieldText(x: number, rowTop: number, text: string, right: boolean): DetailPrimitive {
  return {
    kind: 'text',
    position: { x, y: rowTop + TEXT_MM },
    text,
    heightMm: TEXT_MM,
    colorHex: right ? VALUE_HEX : LABEL_HEX,
    align: right ? 'right' : 'left',
    bold: right,
  };
}

/** Lay out a field block: each row = label (left) + value (right, if non-empty), one row height apart. */
export function buildFieldBlock(region: RectMm, rows: readonly FieldRow[]): DetailPrimitive[] {
  const x0 = region.x + SIDE_PAD_MM;
  const xR = region.x + region.w - SIDE_PAD_MM;
  const out: DetailPrimitive[] = [];
  let y = region.y + TOP_PAD_MM;
  for (const row of rows) {
    out.push(fieldText(x0, y, row.label, false));
    if (row.value) out.push(fieldText(xR, y, row.value, true));
    y += ROW_H_MM;
  }
  return out;
}
