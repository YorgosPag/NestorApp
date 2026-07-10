/**
 * ADR-463 — Footing reinforcement detail · TITLE-BLOCK region builder (pure SSoT).
 *
 * Παράγει τα «ΣΤΟΙΧΕΙΑ ΣΧΕΔΙΟΥ» (drawing data) primitives (sheet-mm): λίστα
 * label : value που περιγράφει το θεμελιακό στοιχείο — τύπος, διατομή, πάχος/ύψος,
 * σκυρόδεμα, χάλυβας, επικάλυψη και ο κύριος / δευτερεύων οπλισμός. Οι τιμές είναι
 * data (αριθμοί / «Ø12/200» / «C20/25» / «B500C»), ΠΟΤΕ i18n· τα labels host-injected
 * (N.11-safe). Mirror του `column-detail-titleblock.ts`, kind-aware.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/footing-detail-titleblock
 * @see docs/centralized-systems/reference/adrs/ADR-463-foundation-reinforcement-ux.md
 */

import type { FoundationEntity } from '../../types/foundation-types';
import { buildFootingSectionContext } from '../section-context';
import { resolveActiveFootingReinforcementForParams } from '../active-footing-reinforcement';
import { DEFAULT_CONCRETE_GRADE } from '../concrete-grades';
import { REBAR_GRADE } from '../rebar-catalog';
import { formatFootingMainLabel } from '../reinforcement/footing-reinforcement-compute';
import {
  formatMeshLabel,
  type FootingReinforcement,
} from '../reinforcement/footing-reinforcement-types';
import type { DetailPrimitive, FootingTitleBlockLabels, RectMm } from './detail-sheet-types';
import { buildFieldBlock, roundMm, type FieldRow } from './detail-sheet-field-block';

export interface FootingTitleBlockResult {
  readonly primitives: readonly DetailPrimitive[];
}

/** Ετικέτα δευτερεύοντος οπλισμού (άνω σχάρα / διαμήκεις / άνω ράβδοι) ή κενό. */
function secondaryLabel(r: FootingReinforcement): string {
  if (r.kind === 'pad') return r.topMesh ? formatMeshLabel(r.topMesh) : '';
  if (r.kind === 'strip') return `${r.longitudinal.count}Ø${r.longitudinal.diameterMm}`;
  return `${r.top.count}Ø${r.top.diameterMm}`;
}

/**
 * Builds the title-block field rows for a footing. Returns empty primitives for
 * missing reinforcement / degenerate geometry.
 */
export function buildFootingTitleBlockRegion(
  foundation: FoundationEntity,
  region: RectMm,
  labels: FootingTitleBlockLabels,
  kindValue: string,
): FootingTitleBlockResult {
  const r = resolveActiveFootingReinforcementForParams(foundation.params);
  if (!r) return { primitives: [] };
  const ctx = buildFootingSectionContext(foundation);
  const thicknessMm = ctx.kind === 'tie-beam' ? ctx.depthMm : ctx.thicknessMm;
  // Διατομή: pad → W×L (ίχνος)· strip/tie-beam → W×H (band διατομή).
  const sectionLabel = ctx.kind === 'pad'
    ? `${roundMm(ctx.widthMm)}×${roundMm(ctx.lengthMm)}`
    : `${roundMm(ctx.widthMm)}×${roundMm(thicknessMm)}`;

  const concrete = foundation.params.catalogProfile ?? DEFAULT_CONCRETE_GRADE;
  const rows: FieldRow[] = [
    { label: labels.kind, value: kindValue },
    { label: labels.section, value: sectionLabel },
    { label: labels.thickness, value: roundMm(thicknessMm) },
    { label: labels.concrete, value: concrete },
    { label: labels.steel, value: REBAR_GRADE },
    { label: labels.cover, value: roundMm(r.coverMm) },
    { label: labels.main, value: formatFootingMainLabel(r) },
  ];
  const secondary = secondaryLabel(r);
  if (secondary) rows.push({ label: labels.secondary, value: secondary });

  return { primitives: buildFieldBlock(region, rows) };
}
