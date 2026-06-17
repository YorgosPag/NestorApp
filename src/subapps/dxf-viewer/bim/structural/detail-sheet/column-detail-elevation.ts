/**
 * ADR-457 — Column reinforcement detail · ELEVATION view builder (pure SSoT).
 *
 * Produces the drawing primitives (sheet-mm) for the column elevation region: a
 * faint concrete outline (width × height), the longitudinal bars as vertical
 * lines, and the transverse reinforcement drawn **by stirrup type** at the z
 * levels given by `computeStirrupLevelsMm` (denser in the EC8 critical end
 * zones — lcr):
 *   - closed-hooked → horizontal stirrup lines with 135° end hooks
 *   - closed-welded → clean horizontal lines
 *   - spiral        → one continuous zig-zag helix
 * plus the overall height dimension, the stirrup label and the scale caption.
 *
 * Geometry is the SSoT: bar x-positions + the stirrup levels come straight from
 * the rebar layout / `computeStirrupLevelsMm` (same as the live 2D/3D). The
 * column is drawn un-rotated, base at the bottom (sheet +y is down).
 *
 * v1: rectangular column with `reinforcement`. Other kinds → empty.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/column-detail-elevation
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { ColumnParams } from '../../types/column-types';
import { computeStirrupLevelsMm } from '../reinforcement/column-rebar-layout';
import { resolveColumnRebarLayout } from '../reinforcement/column-rebar-layout-resolve';
import { resolveColumnReinforcementSection } from '../reinforcement/column-section-outline';
import { DEFAULT_STIRRUP_TYPE } from '../reinforcement/column-reinforcement-types';
import { formatStirrupsLabel } from '../reinforcement/column-reinforcement-compute';
import { pickScaleDenominator } from './detail-sheet-fit';
import { groupSpacingZones, formatSpacingZoneLabel } from './detail-sheet-spacing';
import type { DetailPrimitive, RectMm } from './detail-sheet-types';

const CONCRETE_OUTLINE_HEX = '#b0b0b0';
const REBAR_HEX = '#c0392b';
const DIM_HEX = '#333333';
const LABEL_HEX = '#444444';
const CONCRETE_OUTLINE_WIDTH_MM = 0.18;
const MIN_BAR_WIDTH_MM = 0.35;
const MIN_STIRRUP_WIDTH_MM = 0.3;
const DIM_WIDTH_MM = 0.13;
const DIM_TEXT_HEIGHT_MM = 2.6;
const LABEL_HEIGHT_MM = 2.4;

const TITLE_PAD_MM = 9;
const LEFT_DIM_PAD_MM = 15;
/** Δεξί περιθώριο — χωράει το stirrup-spacing dim string (B). */
const RIGHT_DIM_PAD_MM = 16;
const BOTTOM_LABEL_PAD_MM = 9;
const HEIGHT_DIM_OFFSET_MM = 7;
/** Offset της κατακόρυφης σειράς spacing dims, δεξιά της ΟΨΗΣ (θετικό = δεξιά). */
const SPACING_DIM_OFFSET_MM = 6;
/** Ύψος κειμένου spacing dim (μικρότερο από το height dim ώστε να χωρά δεξιά). */
const SPACING_DIM_TEXT_MM = 2;
const BAR_X_TOL_MM = 5;
/** Σημεία δειγματοληψίας ανά στροφή σπείρας — λεία ημιτονοειδής έλικα (spring look). */
const SPIRAL_SAMPLES_PER_TURN = 16;

export interface ColumnElevationResult {
  readonly primitives: readonly DetailPrimitive[];
  readonly caption?: string;
}

/** Distinct sorted x-positions of the longitudinal bars (deduped by tolerance). */
function uniqueBarXs(bars: readonly Point2D[], tolMm: number): number[] {
  const xs = bars.map((b) => b.x).sort((a, b) => a - b);
  const out: number[] = [];
  for (const x of xs) {
    if (out.length === 0 || Math.abs(x - out[out.length - 1]) > tolMm) out.push(x);
  }
  return out;
}

/**
 * Builds the elevation-region primitives for a rectangular reinforced column.
 * Returns empty primitives for unsupported kinds / missing reinforcement.
 */
export function buildColumnElevationRegion(
  params: ColumnParams,
  region: RectMm,
): ColumnElevationResult {
  const r = params.reinforcement;
  if (!r) return { primitives: [] };
  const section = resolveColumnReinforcementSection(params);
  const layout = resolveColumnRebarLayout(r, section);
  if (!layout) return { primitives: [] };

  // ADR-460 — όψη = πλάγια προβολή· πλάτος = bbox κατά X (κάθε σχήμα).
  const widthMm = section.bboxWidthMm;
  const heightMm = params.height;
  if (widthMm <= 0 || heightMm <= 0) return { primitives: [] };

  const availW = region.w - LEFT_DIM_PAD_MM - RIGHT_DIM_PAD_MM;
  const availH = region.h - TITLE_PAD_MM - BOTTOM_LABEL_PAD_MM;
  const denom = pickScaleDenominator(widthMm, heightMm, availW, availH);
  const s = 1 / denom;

  const drawnW = widthMm * s;
  const drawnH = heightMm * s;
  const centerX = region.x + LEFT_DIM_PAD_MM + availW / 2;
  const centerY = region.y + TITLE_PAD_MM + availH / 2;
  const bottomY = centerY + drawnH / 2;
  // local (x ∈ [-w/2, w/2], z ∈ [0, height], z up) → sheet-mm (y down).
  const toSheet = (localX: number, localZ: number): Point2D => ({
    x: centerX + localX * s,
    y: bottomY - localZ * s,
  });

  const halfW = widthMm / 2;
  const coverX = halfW - r.coverMm;
  const primitives: DetailPrimitive[] = [];

  // ── Faint concrete outline ──
  primitives.push({
    kind: 'polyline',
    points: [toSheet(-halfW, 0), toSheet(halfW, 0), toSheet(halfW, heightMm), toSheet(-halfW, heightMm)],
    closed: true,
    stroke: { colorHex: CONCRETE_OUTLINE_HEX, widthMm: CONCRETE_OUTLINE_WIDTH_MM },
  });

  // ── Longitudinal bars (vertical lines at the distinct bar x-positions) ──
  const barWidthMm = Math.max(MIN_BAR_WIDTH_MM, layout.barDiameterMm * s);
  for (const x of uniqueBarXs(layout.longitudinalBarsMm, BAR_X_TOL_MM)) {
    primitives.push({
      kind: 'line',
      a: toSheet(x, r.coverMm), b: toSheet(x, heightMm - r.coverMm),
      stroke: { colorHex: REBAR_HEX, widthMm: barWidthMm },
    });
  }

  // ── Transverse reinforcement (by stirrup type) at the SSoT levels ──
  // ALL types (closed & spiral) densify in the EC8 critical end zones (lcr): the
  // spiral is one continuous tie whose PITCH tightens at the ends, exactly like
  // closed stirrups — only the drawing differs (helix vs separate rings).
  const type = r.stirrups.type ?? DEFAULT_STIRRUP_TYPE;
  const levels = computeStirrupLevelsMm(r, section.bboxWidthMm, section.bboxDepthMm, heightMm);
  const stirrupWidthMm = Math.max(MIN_STIRRUP_WIDTH_MM, layout.stirrupDiameterMm * s);
  pushStirrupPrimitives(primitives, levels, coverX, type, stirrupWidthMm, toSheet);

  // ── Stirrup spacing dimensions (right side, so the fixer knows the spacing) ──
  pushStirrupSpacingDims(primitives, levels, halfW, toSheet);

  // ── Overall height dimension (left) ──
  primitives.push({
    kind: 'dim',
    p1: toSheet(-halfW, 0), p2: toSheet(-halfW, heightMm), offsetMm: -HEIGHT_DIM_OFFSET_MM,
    text: String(Math.round(heightMm)), stroke: { colorHex: DIM_HEX, widthMm: DIM_WIDTH_MM },
    textHeightMm: DIM_TEXT_HEIGHT_MM,
  });

  // ── Stirrup label (Ø8/100-200) below the elevation ──
  primitives.push({
    kind: 'text',
    position: { x: centerX, y: bottomY + BOTTOM_LABEL_PAD_MM * 0.6 },
    text: formatStirrupsLabel(r), heightMm: LABEL_HEIGHT_MM, colorHex: LABEL_HEX, align: 'center',
  });

  return { primitives, caption: `1:${denom}` };
}

/** Appends the transverse-reinforcement primitives for the chosen stirrup type. */
function pushStirrupPrimitives(
  out: DetailPrimitive[],
  levels: readonly number[],
  coverX: number,
  type: string,
  widthMm: number,
  toSheet: (x: number, z: number) => Point2D,
): void {
  const stroke = { colorHex: REBAR_HEX, widthMm };
  if (type === 'spiral') {
    pushSpiralHelix(out, levels, coverX, stroke, toSheet);
    return;
  }
  const hookLenMm = Math.min(coverX * 0.5, 40);
  for (const z of levels) {
    out.push({ kind: 'line', a: toSheet(-coverX, z), b: toSheet(coverX, z), stroke });
    if (type === 'closed-hooked') {
      // Small 135° end hooks turning inward-up at both ends.
      out.push({ kind: 'line', a: toSheet(-coverX, z), b: toSheet(-coverX + hookLenMm, z + hookLenMm), stroke });
      out.push({ kind: 'line', a: toSheet(coverX, z), b: toSheet(coverX - hookLenMm, z + hookLenMm), stroke });
    }
  }
}

/**
 * Συνεχής λεία ημιτονοειδής έλικα (spiral/φισούνα) ως ΕΝΑ polyline — η μετωπική
 * προβολή σπείρας σταθερού βήματος. Ανά gap (= μία στροφή, ομοιόμορφο από
 * `computeSpiralHelixLevelsMm`) δειγματοληπτεί `x = coverX·cos(2π·t)`: cos(0)=cos(2π)=1
 * → συνεχές στις μεταβάσεις στροφών (κανένα βίαιο άλμα, look «ελατηρίου»).
 */
function pushSpiralHelix(
  out: DetailPrimitive[],
  levels: readonly number[],
  coverX: number,
  stroke: { colorHex: string; widthMm: number },
  toSheet: (x: number, z: number) => Point2D,
): void {
  if (levels.length < 2) return;
  const points: Point2D[] = [];
  for (let L = 0; L < levels.length - 1; L++) {
    const z0 = levels[L];
    const z1 = levels[L + 1];
    for (let k = 0; k < SPIRAL_SAMPLES_PER_TURN; k++) {
      const t = k / SPIRAL_SAMPLES_PER_TURN;
      points.push(toSheet(coverX * Math.cos(2 * Math.PI * t), z0 + (z1 - z0) * t));
    }
  }
  points.push(toSheet(coverX, levels[levels.length - 1])); // κορυφή (cos(0)=1)
  out.push({ kind: 'polyline', points, closed: false, stroke });
}

/**
 * Spacing dimensions στεφανιών στο **δεξί** πλάι της ΟΨΗΣ (αντίθετα από το height
 * dim). Ομαδοποιεί διαδοχικά ίσα κενά (round mm) σε ζώνες → `count×gap` (Revit:
 * πυκνή lcr `5×100`, μέση `@200`, πυκνή lcr `5×100`)· για spiral μία ζώνη `n×pitch`.
 * Κάθε ζώνη = ΕΝΑ `dim` primitive μέσω του κοινού `resolveDimGeometry` (ίδια
 * βελάκια/γραμμές με τις υπόλοιπες διαστάσεις). Δεδομένο spacing, ΟΧΙ i18n.
 */
function pushStirrupSpacingDims(
  out: DetailPrimitive[],
  levels: readonly number[],
  rightLocalX: number,
  toSheet: (x: number, z: number) => Point2D,
): void {
  const stroke = { colorHex: DIM_HEX, widthMm: DIM_WIDTH_MM };
  for (const zone of groupSpacingZones(levels)) {
    out.push({
      kind: 'dim',
      p1: toSheet(rightLocalX, zone.start), p2: toSheet(rightLocalX, zone.end),
      offsetMm: SPACING_DIM_OFFSET_MM,
      text: formatSpacingZoneLabel(zone),
      stroke, textHeightMm: SPACING_DIM_TEXT_MM,
    });
  }
}
