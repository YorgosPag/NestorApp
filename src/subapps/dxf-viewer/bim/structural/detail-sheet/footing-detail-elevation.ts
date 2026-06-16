/**
 * ADR-463 — Footing reinforcement detail · SECTION view builder (pure SSoT).
 *
 * Παράγει την **εγκάρσια διατομή** (πλάτος × πάχος) του θεμελιακού στοιχείου σε
 * sheet-mm: λεπτό περίγραμμα σκυροδέματος, οι κύριες (κάτω) ράβδοι ως κουκκίδες
 * κατά το πλάτος στη στάθμη επικάλυψης, οι άνω ράβδοι (αν υπάρχουν) και ο
 * συνδετήρας (strip/tie-beam) ως κλειστό περίγραμμα inset — συν τις διαστάσεις
 * πλάτους/πάχους και την κλίμακα. Mirror της ΟΨΗΣ της κολώνας, αλλά εδώ είναι
 * τομή (το θεμελιακό στοιχείο φαίνεται καλύτερα σε διατομή — Revit footing detail).
 *
 * Geometry-is-SSoT: διαστάσεις από `buildFootingSectionContext`, οπλισμός από
 * `resolveActiveFootingReinforcementForParams`.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/footing-detail-elevation
 * @see docs/centralized-systems/reference/adrs/ADR-463-foundation-reinforcement-ux.md
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { FoundationEntity } from '../../types/foundation-types';
import { buildFootingSectionContext } from '../section-context';
import { resolveActiveFootingReinforcementForParams } from '../active-footing-reinforcement';
import type {
  PadReinforcement,
  StripReinforcement,
  TieBeamReinforcement,
  FootingReinforcement,
} from '../reinforcement/footing-reinforcement-types';
import { pickScaleDenominator } from './detail-sheet-fit';
import type { DetailPrimitive, RectMm } from './detail-sheet-types';

const CONCRETE_OUTLINE_HEX = '#b0b0b0';
const REBAR_HEX = '#c0392b';
const DIM_HEX = '#333333';
const CONCRETE_OUTLINE_WIDTH_MM = 0.18;
const MIN_BAR_RADIUS_MM = 0.7;
const MIN_STIRRUP_WIDTH_MM = 0.3;
const DIM_WIDTH_MM = 0.13;
const DIM_TEXT_HEIGHT_MM = 2.6;

const TITLE_PAD_MM = 9;
const LEFT_DIM_PAD_MM = 14;
const RIGHT_DIM_PAD_MM = 8;
const BOTTOM_PAD_MM = 9;
const WIDTH_DIM_OFFSET_MM = 6;
const THICK_DIM_OFFSET_MM = 6;

/** Διατομή: πλάτος × πάχος (mm) + βήμα/Ø κύριας κάτω ράβδου. */
interface SectionDims {
  readonly widthMm: number;
  readonly thicknessMm: number;
  readonly bottomSpacingMm: number;
  readonly bottomDiameterMm: number;
  readonly bottomCount: number;
}

export interface FootingElevationResult {
  readonly primitives: readonly DetailPrimitive[];
  readonly caption?: string;
}

/** Διαστάσεις διατομής + κύριας ράβδου ανά kind. */
function sectionDimsOf(foundation: FoundationEntity, r: FootingReinforcement): SectionDims | null {
  const ctx = buildFootingSectionContext(foundation);
  const thicknessMm = ctx.kind === 'tie-beam' ? ctx.depthMm : ctx.thicknessMm;
  if (ctx.widthMm <= 0 || thicknessMm <= 0) return null;
  if (r.kind === 'pad') {
    return { widthMm: ctx.widthMm, thicknessMm, bottomSpacingMm: r.bottomMeshX.spacingMm, bottomDiameterMm: r.bottomMeshX.diameterMm, bottomCount: 0 };
  }
  if (r.kind === 'strip') {
    return { widthMm: ctx.widthMm, thicknessMm, bottomSpacingMm: r.transverse.spacingMm, bottomDiameterMm: r.transverse.diameterMm, bottomCount: 0 };
  }
  return { widthMm: ctx.widthMm, thicknessMm, bottomSpacingMm: 0, bottomDiameterMm: r.bottom.diameterMm, bottomCount: r.bottom.count };
}

/** Άνω σχάρα/ράβδοι (count, Ø) αν υπάρχουν — αλλιώς null. */
function topLayerOf(r: FootingReinforcement): { count: number; diameterMm: number; spacingMm: number } | null {
  if (r.kind === 'pad') return r.topMesh ? { count: 0, diameterMm: r.topMesh.diameterMm, spacingMm: r.topMesh.spacingMm } : null;
  if (r.kind === 'tie-beam') return { count: r.top.count, diameterMm: r.top.diameterMm, spacingMm: 0 };
  return null;
}

/** Κουκκίδες ράβδων κατανεμημένες κατά το πλάτος σε σταθερή στάθμη z. */
function pushBarDots(
  out: DetailPrimitive[], spacingMm: number, count: number, coverMm: number, z: number,
  d: SectionDims, radiusMm: number, toSheet: (x: number, z: number) => Point2D,
): void {
  const usable = Math.max(0, d.widthMm - 2 * coverMm);
  const n = count > 0
    ? count
    : spacingMm > 0 ? Math.max(2, Math.floor(usable / spacingMm) + 1) : 0;
  if (n <= 0) return;
  for (let i = 0; i < n; i++) {
    const x = coverMm + (n === 1 ? usable / 2 : (i * usable) / (n - 1));
    out.push({ kind: 'circle', center: toSheet(x, z), radiusMm, fillHex: REBAR_HEX });
  }
}

/** Συνδετήρας (strip/tie-beam): κλειστό περίγραμμα inset κατά cover στη διατομή. */
function pushStirrupOutline(
  out: DetailPrimitive[], r: FootingReinforcement, coverMm: number, d: SectionDims,
  s: number, toSheet: (x: number, z: number) => Point2D,
): void {
  const stir = r.kind === 'strip' ? r.stirrups : r.kind === 'tie-beam' ? r.stirrups : undefined;
  if (!stir) return;
  const x0 = coverMm, x1 = d.widthMm - coverMm, z0 = coverMm, z1 = d.thicknessMm - coverMm;
  if (x1 <= x0 || z1 <= z0) return;
  out.push({
    kind: 'polyline',
    points: [toSheet(x0, z0), toSheet(x1, z0), toSheet(x1, z1), toSheet(x0, z1)],
    closed: true,
    stroke: { colorHex: REBAR_HEX, widthMm: Math.max(MIN_STIRRUP_WIDTH_MM, stir.diameterMm * s) },
  });
}

/**
 * Builds the section-region primitives for a reinforced footing. Returns empty
 * primitives for missing reinforcement / degenerate geometry.
 */
export function buildFootingElevationRegion(foundation: FoundationEntity, region: RectMm): FootingElevationResult {
  const r = resolveActiveFootingReinforcementForParams(foundation.params);
  if (!r) return { primitives: [] };
  const d = sectionDimsOf(foundation, r);
  if (!d) return { primitives: [] };

  const availW = region.w - LEFT_DIM_PAD_MM - RIGHT_DIM_PAD_MM;
  const availH = region.h - TITLE_PAD_MM - BOTTOM_PAD_MM;
  const denom = pickScaleDenominator(d.widthMm, d.thicknessMm, availW, availH);
  const s = 1 / denom;

  const centerX = region.x + LEFT_DIM_PAD_MM + availW / 2;
  const centerY = region.y + TITLE_PAD_MM + availH / 2;
  const bottomY = centerY + (d.thicknessMm * s) / 2;
  // local (x∈[0,width], z∈[0,thickness], z up) → sheet-mm (y down), centred.
  const toSheet = (x: number, z: number): Point2D => ({
    x: centerX + (x - d.widthMm / 2) * s,
    y: bottomY - z * s,
  });

  const cover = r.coverMm;
  const out: DetailPrimitive[] = [];

  // ── Faint concrete outline (width × thickness) ──
  out.push({
    kind: 'polyline',
    points: [toSheet(0, 0), toSheet(d.widthMm, 0), toSheet(d.widthMm, d.thicknessMm), toSheet(0, d.thicknessMm)],
    closed: true,
    stroke: { colorHex: CONCRETE_OUTLINE_HEX, widthMm: CONCRETE_OUTLINE_WIDTH_MM },
  });

  // ── Stirrup outline (strip / tie-beam) ──
  pushStirrupOutline(out, r, cover, d, s, toSheet);

  // ── Bottom main bars (dots) at cover level ──
  const bottomR = Math.max(MIN_BAR_RADIUS_MM, (d.bottomDiameterMm / 2) * s);
  pushBarDots(out, d.bottomSpacingMm, d.bottomCount, cover, cover, d, bottomR, toSheet);

  // ── Top bars (dots) — pad top mesh / tie-beam top layer ──
  const top = topLayerOf(r);
  if (top) {
    const topR = Math.max(MIN_BAR_RADIUS_MM, (top.diameterMm / 2) * s);
    pushBarDots(out, top.spacingMm, top.count, cover, d.thicknessMm - cover, d, topR, toSheet);
  }

  // ── Dimensions: width (bottom), thickness (left) ──
  const dimStroke = { colorHex: DIM_HEX, widthMm: DIM_WIDTH_MM };
  out.push({
    kind: 'dim',
    p1: toSheet(0, 0), p2: toSheet(d.widthMm, 0), offsetMm: WIDTH_DIM_OFFSET_MM,
    text: String(Math.round(d.widthMm)), stroke: dimStroke, textHeightMm: DIM_TEXT_HEIGHT_MM,
  });
  out.push({
    kind: 'dim',
    p1: toSheet(0, 0), p2: toSheet(0, d.thicknessMm), offsetMm: -THICK_DIM_OFFSET_MM,
    text: String(Math.round(d.thicknessMm)), stroke: dimStroke, textHeightMm: DIM_TEXT_HEIGHT_MM,
  });

  return { primitives: out, caption: `1:${denom}` };
}
