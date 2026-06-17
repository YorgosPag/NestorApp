/**
 * ADR-476 — Slab reinforcement detail · TITLE-BLOCK region builder (pure SSoT).
 *
 * Παράγει τα «ΣΤΟΙΧΕΙΑ ΣΧΕΔΙΟΥ» (drawing data) primitives (sheet-mm): λίστα
 * label : value που περιγράφει την πλάκα — τύπος, διάσταση κάτοψης, πάχος, σκυρόδεμα,
 * χάλυβας, επικάλυψη, κάτω/άνω σχάρα και — **μόνο για αναρτημένες** (suspended) — το
 * άνοιγμα L και το φορτίο σχεδιασμού q_Ed (οι εδαφόπλακες αγνοούν το q). Οι τιμές είναι
 * data (αριθμοί / «Ø12/200» / «C20/25» / «B500C»), ΠΟΤΕ i18n· τα labels host-injected
 * (N.11-safe). Mirror του `footing-detail-titleblock.ts`.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/slab-detail-titleblock
 * @see docs/centralized-systems/reference/adrs/ADR-476-unified-slab-reinforcement.md
 */

import type { SlabEntity } from '../../types/slab-types';
import { buildSlabFoundationSectionContext } from '../section-context';
import { resolveActiveSlabReinforcementForEntity } from '../active-reinforcement';
import { DEFAULT_CONCRETE_GRADE } from '../concrete-grades';
import { REBAR_GRADE } from '../rebar-catalog';
import {
  formatSlabFoundationMainLabel,
  formatSlabFoundationTopLabel,
} from '../reinforcement/slab-foundation-reinforcement-types';
import type { DetailPrimitive, RectMm, SlabTitleBlockLabels } from './detail-sheet-types';

const TOP_PAD_MM = 11;
const SIDE_PAD_MM = 4;
const ROW_H_MM = 7;
const TEXT_MM = 2.6;
const LABEL_HEX = '#555555';
const VALUE_HEX = '#111111';

export interface SlabTitleBlockResult {
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
 * Builds the title-block field rows for a slab. Returns empty primitives for
 * missing reinforcement / degenerate geometry. `kindValue` host-injected (N.11).
 */
export function buildSlabTitleBlockRegion(
  slab: SlabEntity,
  region: RectMm,
  labels: SlabTitleBlockLabels,
  kindValue: string,
): SlabTitleBlockResult {
  const r = resolveActiveSlabReinforcementForEntity(slab);
  if (!r) return { primitives: [] };
  const ctx = buildSlabFoundationSectionContext(slab);
  const round = (n: number): string => String(Math.round(n));

  const concrete = slab.params.concreteGrade ?? DEFAULT_CONCRETE_GRADE;
  const rows: FieldRow[] = [
    { label: labels.kind, value: kindValue },
    { label: labels.section, value: `${round(ctx.widthMm)}×${round(ctx.lengthMm)}` },
    { label: labels.thickness, value: round(ctx.thicknessMm) },
    { label: labels.concrete, value: concrete },
    { label: labels.steel, value: REBAR_GRADE },
    { label: labels.cover, value: round(r.coverMm) },
    { label: labels.bottomMesh, value: formatSlabFoundationMainLabel(r) },
    { label: labels.topMesh, value: formatSlabFoundationTopLabel(r) },
  ];
  // Άνοιγμα + φορτίο σχεδιασμού: μόνο αναρτημένες πλάκες (η εδαφόπλακα αγνοεί το q).
  if (ctx.kind === 'suspended') {
    if (ctx.maxFreeSpanMm && ctx.maxFreeSpanMm > 0) {
      rows.push({ label: labels.span, value: round(ctx.maxFreeSpanMm) });
    }
    if (ctx.designLoadKpa && ctx.designLoadKpa > 0) {
      rows.push({ label: labels.designLoad, value: ctx.designLoadKpa.toFixed(1) });
    }
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
