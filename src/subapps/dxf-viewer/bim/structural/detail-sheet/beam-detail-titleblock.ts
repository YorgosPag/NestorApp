/**
 * ADR-471 — Beam reinforcement detail · TITLE-BLOCK region builder (pure SSoT).
 *
 * Παράγει τα «ΣΤΟΙΧΕΙΑ ΣΧΕΔΙΟΥ» (drawing data) primitives (sheet-mm): λίστα
 * label : value που περιγράφει τη δοκό — διατομή (b×h), άνοιγμα, σκυρόδεμα, χάλυβας,
 * επικάλυψη και ο διαμήκης / συνδετήρων οπλισμός. Οι τιμές είναι data (αριθμοί /
 * «3Ø16 / 2Ø14» / «C20/25» / «B500C»), ΠΟΤΕ i18n· τα labels host-injected (N.11-safe).
 * Mirror του `column-detail-titleblock.ts`.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/beam-detail-titleblock
 * @see docs/centralized-systems/reference/adrs/ADR-471-unified-member-reinforcement.md §3
 */

import type { BeamEntity } from '../../types/beam-types';
import { buildBeamSectionContext } from '../section-context';
import { DEFAULT_CONCRETE_GRADE } from '../concrete-grades';
import { REBAR_GRADE } from '../rebar-catalog';
import {
  formatBeamLongitudinalLabel,
  formatBeamStirrupsLabel,
} from '../reinforcement/beam-reinforcement-compute';
import type { BeamReinforcement } from '../reinforcement/beam-reinforcement-types';
import type { BeamTitleBlockLabels, DetailPrimitive, RectMm } from './detail-sheet-types';

const TOP_PAD_MM = 11;
const SIDE_PAD_MM = 4;
const ROW_H_MM = 7;
const TEXT_MM = 2.6;
const LABEL_HEX = '#555555';
const VALUE_HEX = '#111111';

export interface BeamTitleBlockResult {
  readonly primitives: readonly DetailPrimitive[];
}

interface FieldRow {
  readonly label: string;
  readonly value: string;
}

function fieldText(x: number, rowTop: number, text: string, right: boolean): DetailPrimitive {
  return {
    kind: 'text', position: { x, y: rowTop + TEXT_MM }, text, heightMm: TEXT_MM,
    colorHex: right ? VALUE_HEX : LABEL_HEX, align: right ? 'right' : 'left', bold: right,
  };
}

/**
 * Builds the title-block field rows for a beam. Returns empty primitives for
 * missing reinforcement / degenerate geometry.
 */
export function buildBeamTitleBlockRegion(
  beam: BeamEntity,
  r: BeamReinforcement | undefined,
  region: RectMm,
  labels: BeamTitleBlockLabels,
  effectiveFlangeWidthMm?: number,
): BeamTitleBlockResult {
  if (!r) return { primitives: [] };
  // ADR-534 Φ3b — host περνά το DERIVED b_eff (καλύπτουσα πλάκα → T-beam)· buildBeamSectionContext
  // το κρατά μόνο όταν > b_w. Absent → καμία γραμμή «b_eff» (γυμνή ορθογώνια δοκός).
  const ctx = buildBeamSectionContext(beam, undefined, undefined, undefined, undefined, effectiveFlangeWidthMm);
  const round = (n: number): string => String(Math.round(n));

  const rows: FieldRow[] = [
    { label: labels.section, value: `${round(ctx.widthMm)}×${round(ctx.depthMm)}` },
    ...(ctx.effectiveFlangeWidthMm !== undefined
      ? [{ label: labels.effectiveFlangeWidth, value: round(ctx.effectiveFlangeWidthMm) }]
      : []),
    { label: labels.span, value: round(ctx.spanMm) },
    { label: labels.concrete, value: DEFAULT_CONCRETE_GRADE },
    { label: labels.steel, value: REBAR_GRADE },
    { label: labels.cover, value: round(r.coverMm) },
    { label: labels.longitudinal, value: formatBeamLongitudinalLabel(r) },
    { label: labels.stirrups, value: formatBeamStirrupsLabel(r) },
  ];

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
