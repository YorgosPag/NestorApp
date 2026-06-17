/**
 * ADR-476 — Slab reinforcement detail · SECTION view builder (pure SSoT).
 *
 * Παράγει την **τυπική τομή** (αντιπροσωπευτικό 1m strip × πάχος) της πλάκας σε
 * sheet-mm: λεπτό περίγραμμα σκυροδέματος, οι ράβδοι της **κάτω** σχάρας ως κουκκίδες
 * στη στάθμη επικάλυψης + οι ράβδοι της **άνω** σχάρας ως κουκκίδες στη στάθμη
 * (πάχος − cover), συν τις διαστάσεις πλάτους-strip/πάχους και την κλίμακα. Revit/Tekla
 * «typical slab section» — το 1m strip κρατά λογική κλίμακα όταν η πλάκα είναι πλατιά
 * & λεπτή. Οι κουκκίδες = οι εγκάρσιες ράβδοι (// Y) που τέμνουν την τομή, βήμα = το
 * βήμα της αντίστοιχης σχάρας. Mirror του `footing-detail-elevation.ts`.
 *
 * Geometry-is-SSoT: διαστάσεις από `buildSlabFoundationSectionContext`, οπλισμός από
 * `resolveActiveSlabReinforcementForEntity` (auto-aware).
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/slab-detail-section
 * @see docs/centralized-systems/reference/adrs/ADR-476-unified-slab-reinforcement.md
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { SlabEntity } from '../../types/slab-types';
import type { RebarMesh, SlabFoundationReinforcement } from '../reinforcement/slab-foundation-reinforcement-types';
import { buildSlabFoundationSectionContext } from '../section-context';
import { resolveActiveSlabReinforcementForEntity } from '../active-reinforcement';
import { pickScaleDenominator } from './detail-sheet-fit';
import type { DetailPrimitive, RectMm } from './detail-sheet-types';
// ADR-471 Slice 6 — χρώμα οπλισμού από το ΕΝΑ SSoT (πρώην inline literal σε 10 αρχεία).
import { REBAR_COLOR_HEX as REBAR_HEX } from '../rebar-catalog';

const CONCRETE_OUTLINE_HEX = '#b0b0b0';
const DIM_HEX = '#333333';
const CONCRETE_OUTLINE_WIDTH_MM = 0.18;
const MIN_BAR_RADIUS_MM = 0.7;
const DIM_WIDTH_MM = 0.13;
const DIM_TEXT_HEIGHT_MM = 2.6;
/** Αντιπροσωπευτικό πλάτος strip τομής (mm) — Revit/Tekla typical slab section. */
const REP_STRIP_MM = 1000;

const TITLE_PAD_MM = 9;
const LEFT_DIM_PAD_MM = 14;
const RIGHT_DIM_PAD_MM = 8;
const BOTTOM_PAD_MM = 9;
const WIDTH_DIM_OFFSET_MM = 6;
const THICK_DIM_OFFSET_MM = 6;

export interface SlabSectionResult {
  readonly primitives: readonly DetailPrimitive[];
  readonly caption?: string;
}

/** Τομή: πλάτος strip × πάχος (mm). */
interface SectionDims {
  readonly stripWidthMm: number;
  readonly thicknessMm: number;
}

/** Κουκκίδες ράβδων κατανεμημένες κατά το strip σε σταθερή στάθμη z. */
function pushBarDots(
  out: DetailPrimitive[], mesh: RebarMesh, coverMm: number, z: number,
  d: SectionDims, s: number, toSheet: (x: number, z: number) => Point2D,
): void {
  const usable = Math.max(0, d.stripWidthMm - 2 * coverMm);
  if (usable <= 0 || mesh.spacingMm <= 0) return;
  const n = Math.max(2, Math.floor(usable / mesh.spacingMm) + 1);
  const radiusMm = Math.max(MIN_BAR_RADIUS_MM, (mesh.diameterMm / 2) * s);
  for (let i = 0; i < n; i++) {
    const x = coverMm + (n === 1 ? usable / 2 : (i * usable) / (n - 1));
    out.push({ kind: 'circle', center: toSheet(x, z), radiusMm, fillHex: REBAR_HEX });
  }
}

/**
 * Builds the section-region primitives for a reinforced slab. Returns empty
 * primitives for missing reinforcement / degenerate geometry.
 */
export function buildSlabSectionRegion(slab: SlabEntity, region: RectMm): SlabSectionResult {
  const r: SlabFoundationReinforcement | undefined = resolveActiveSlabReinforcementForEntity(slab);
  if (!r) return { primitives: [] };
  const ctx = buildSlabFoundationSectionContext(slab);
  if (ctx.widthMm <= 0 || ctx.thicknessMm <= 0) return { primitives: [] };

  const d: SectionDims = {
    stripWidthMm: Math.min(ctx.widthMm, REP_STRIP_MM),
    thicknessMm: ctx.thicknessMm,
  };

  const availW = region.w - LEFT_DIM_PAD_MM - RIGHT_DIM_PAD_MM;
  const availH = region.h - TITLE_PAD_MM - BOTTOM_PAD_MM;
  const denom = pickScaleDenominator(d.stripWidthMm, d.thicknessMm, availW, availH);
  const s = 1 / denom;

  const centerX = region.x + LEFT_DIM_PAD_MM + availW / 2;
  const centerY = region.y + TITLE_PAD_MM + availH / 2;
  const bottomY = centerY + (d.thicknessMm * s) / 2;
  // local (x∈[0,strip], z∈[0,thickness], z up) → sheet-mm (y down), centred.
  const toSheet = (x: number, z: number): Point2D => ({
    x: centerX + (x - d.stripWidthMm / 2) * s,
    y: bottomY - z * s,
  });

  const cover = r.coverMm;
  const out: DetailPrimitive[] = [];

  // ── Faint concrete outline (strip × thickness) ──
  out.push({
    kind: 'polyline',
    points: [toSheet(0, 0), toSheet(d.stripWidthMm, 0), toSheet(d.stripWidthMm, d.thicknessMm), toSheet(0, d.thicknessMm)],
    closed: true,
    stroke: { colorHex: CONCRETE_OUTLINE_HEX, widthMm: CONCRETE_OUTLINE_WIDTH_MM },
  });

  // ── Bottom mesh dots (στο cover) + top mesh dots (στο thickness − cover) ──
  pushBarDots(out, r.bottomMeshY, cover, cover, d, s, toSheet);
  pushBarDots(out, r.topMeshY, cover, d.thicknessMm - cover, d, s, toSheet);

  // ── Dimensions: strip width (bottom), thickness (left) ──
  const dimStroke = { colorHex: DIM_HEX, widthMm: DIM_WIDTH_MM };
  out.push({
    kind: 'dim',
    p1: toSheet(0, 0), p2: toSheet(d.stripWidthMm, 0), offsetMm: WIDTH_DIM_OFFSET_MM,
    text: String(Math.round(d.stripWidthMm)), stroke: dimStroke, textHeightMm: DIM_TEXT_HEIGHT_MM,
  });
  out.push({
    kind: 'dim',
    p1: toSheet(0, 0), p2: toSheet(0, d.thicknessMm), offsetMm: -THICK_DIM_OFFSET_MM,
    text: String(Math.round(d.thicknessMm)), stroke: dimStroke, textHeightMm: DIM_TEXT_HEIGHT_MM,
  });

  return { primitives: out, caption: `1:${denom}` };
}
