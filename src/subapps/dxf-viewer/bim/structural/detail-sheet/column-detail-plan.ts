/**
 * ADR-457 — Column reinforcement detail · PLAN view builder (pure SSoT).
 *
 * Produces the drawing primitives (sheet-mm) for the column plan region: a
 * faint concrete footprint outline, the reinforcement in plan (stirrup ring +
 * 135° hooks + longitudinal bar dots) and the key dimensions (width / depth /
 * cover) — plus the view scale caption (1:N).
 *
 * Geometry is the SSoT: the rebar comes straight from
 * `computeColumnRebarLayout` (the same LOCAL-mm geometry the live 2D canvas and
 * the 3D cage consume), mapped LOCAL-mm → sheet-mm by a single fit transform.
 * The detail draws the column un-rotated (orthographic plan, Revit/Tekla
 * convention) — column rotation/anchor are deliberately ignored here.
 *
 * v1: rectangular column with `reinforcement`. Other kinds → empty (the region
 * keeps its heading only).
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/column-detail-plan
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { ColumnParams } from '../../types/column-types';
import { materializeColumnLocalPolygonMm } from '../../geometry/column-geometry';
import { computeColumnRebarLayout } from '../reinforcement/column-rebar-layout';
import { buildColumnCrossTies } from '../reinforcement/column-cross-ties';
import { DEFAULT_STIRRUP_TYPE } from '../reinforcement/column-reinforcement-types';
import { assignColumnBarNumbers } from './column-rebar-bar-marks';
import { pickScaleDenominator } from './detail-sheet-fit';
import type { DetailPrimitive, RectMm } from './detail-sheet-types';

// ─── Visual constants (sheet-mm / hex) ───────────────────────────────────────
const CONCRETE_OUTLINE_HEX = '#b0b0b0';
const REBAR_HEX = '#c0392b';
const DIM_HEX = '#333333';
const CONCRETE_OUTLINE_WIDTH_MM = 0.18;
const MIN_STIRRUP_WIDTH_MM = 0.3;
const MIN_BAR_RADIUS_MM = 0.7;
const DIM_WIDTH_MM = 0.13;
const DIM_TEXT_HEIGHT_MM = 2.6;
// Bar-mark labels (#1…#N) — shared SSoT numbering, navy to match the 3D marks.
const BAR_MARK_HEX = '#14387f';
const BAR_MARK_TEXT_MM = 2.2;
const BAR_MARK_GAP_MM = 0.6;

// Padding (sheet-mm) reserved inside the region for heading + dimension lines.
const TITLE_PAD_MM = 9;
const LEFT_DIM_PAD_MM = 14;
const BOTTOM_DIM_PAD_MM = 14;
const SIDE_PAD_MM = 7;

// Offsets (sheet-mm) of the dimension lines from the footprint edges.
const WIDTH_DIM_OFFSET_MM = 6;
const DEPTH_DIM_OFFSET_MM = 6;
const COVER_DIM_OFFSET_MM = 3;

export interface ColumnPlanResult {
  readonly primitives: readonly DetailPrimitive[];
  /** Scale caption (e.g. "1:20"); omitted when nothing was drawn. */
  readonly caption?: string;
}

interface BBox { minX: number; minY: number; maxX: number; maxY: number; }

function bboxOf(points: readonly Point2D[]): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Builds the plan-region primitives for a rectangular reinforced column.
 * Returns empty primitives for unsupported kinds / missing reinforcement.
 */
export function buildColumnPlanRegion(params: ColumnParams, region: RectMm): ColumnPlanResult {
  const r = params.reinforcement;
  if (params.kind !== 'rectangular' || !r) return { primitives: [] };
  const layout = computeColumnRebarLayout(r, params.width, params.depth);
  if (!layout) return { primitives: [] };

  const footprintLocal = materializeColumnLocalPolygonMm(params);
  if (footprintLocal.length < 3) return { primitives: [] };
  const bbox = bboxOf(footprintLocal);
  const fpWidthMm = bbox.maxX - bbox.minX;
  const fpDepthMm = bbox.maxY - bbox.minY;
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;

  // Drawable area inside the region (heading + dim gutters reserved).
  const availW = region.w - LEFT_DIM_PAD_MM - SIDE_PAD_MM;
  const availH = region.h - TITLE_PAD_MM - BOTTOM_DIM_PAD_MM;
  const denom = pickScaleDenominator(fpWidthMm, fpDepthMm, availW, availH);
  const s = 1 / denom; // sheet-mm per real-mm

  // Centre the footprint inside the drawable area.
  const drawCenterX = region.x + LEFT_DIM_PAD_MM + availW / 2;
  const drawCenterY = region.y + TITLE_PAD_MM + availH / 2;
  const toSheet = (p: Point2D): Point2D => ({
    x: drawCenterX + (p.x - cx) * s,
    y: drawCenterY + (p.y - cy) * s,
  });

  const primitives: DetailPrimitive[] = [];

  // ── Faint concrete footprint ──
  primitives.push({
    kind: 'polyline',
    points: footprintLocal.map(toSheet),
    closed: true,
    stroke: { colorHex: CONCRETE_OUTLINE_HEX, widthMm: CONCRETE_OUTLINE_WIDTH_MM },
  });

  // ── Stirrup ring (rounded closed path — same SSoT as live 2D/3D) ──
  if (layout.stirrupPathMm.length >= 4) {
    primitives.push({
      kind: 'polyline',
      points: layout.stirrupPathMm.map(toSheet),
      closed: true,
      stroke: {
        colorHex: REBAR_HEX,
        widthMm: Math.max(MIN_STIRRUP_WIDTH_MM, layout.stirrupDiameterMm * s),
      },
    });
    // 135° hooks — only for closed-hooked stirrups (welded/spiral: clean ring).
    if ((r.stirrups.type ?? DEFAULT_STIRRUP_TYPE) === 'closed-hooked') {
      for (const end of layout.stirrupHookEndsMm) {
        if (end.length < 2) continue;
        primitives.push({
          kind: 'polyline',
          points: end.map(toSheet),
          closed: false,
          stroke: { colorHex: REBAR_HEX, widthMm: MIN_STIRRUP_WIDTH_MM },
        });
      }
    }
  }

  // ── Cross-ties (internal hoops / diamond) — SAME SSoT as the live 2D canvas &
  //    the 3D cage (`buildColumnCrossTies`). Without this the plan was missing the
  //    interior ties shown everywhere else (ADR-456). ──
  const hooked = (r.stirrups.type ?? DEFAULT_STIRRUP_TYPE) === 'closed-hooked';
  const crossTieWidthMm = Math.max(MIN_STIRRUP_WIDTH_MM, layout.stirrupDiameterMm * s);
  const crossTies = buildColumnCrossTies(
    layout.longitudinalBarsMm,
    layout.stirrupDiameterMm,
    layout.barDiameterMm,
    r.crossTiePattern,
  );
  for (const tie of crossTies) {
    if (tie.pathMm.length >= 2) {
      primitives.push({
        kind: 'polyline',
        points: tie.pathMm.map(toSheet),
        closed: tie.closed,
        stroke: { colorHex: REBAR_HEX, widthMm: crossTieWidthMm },
      });
    }
    if (!hooked) continue;
    for (const end of tie.hookEndsMm) {
      if (end.length < 2) continue;
      primitives.push({
        kind: 'polyline',
        points: end.map(toSheet),
        closed: false,
        stroke: { colorHex: REBAR_HEX, widthMm: MIN_STIRRUP_WIDTH_MM },
      });
    }
  }

  // ── Longitudinal bars (filled dots) + bar marks (#1…#N, shared SSoT order) ──
  const barRadiusMm = Math.max(MIN_BAR_RADIUS_MM, (layout.barDiameterMm / 2) * s);
  const barNumbers = assignColumnBarNumbers(params);
  layout.longitudinalBarsMm.forEach((bar, i) => {
    const center = toSheet(bar);
    primitives.push({ kind: 'circle', center, radiusMm: barRadiusMm, fillHex: REBAR_HEX });
    if (barNumbers) {
      primitives.push({
        kind: 'text',
        position: { x: center.x + barRadiusMm + BAR_MARK_GAP_MM, y: center.y + BAR_MARK_TEXT_MM * 0.35 },
        text: String(barNumbers[i]),
        heightMm: BAR_MARK_TEXT_MM,
        colorHex: BAR_MARK_HEX,
        align: 'left',
        bold: true,
      });
    }
  });

  // ── Dimensions: width (bottom), depth (left), cover (top-left inset) ──
  const tl = toSheet({ x: bbox.minX, y: bbox.minY });
  const bl = toSheet({ x: bbox.minX, y: bbox.maxY });
  const br = toSheet({ x: bbox.maxX, y: bbox.maxY });
  const dimStroke = { colorHex: DIM_HEX, widthMm: DIM_WIDTH_MM };

  primitives.push({
    kind: 'dim',
    p1: bl, p2: br, offsetMm: WIDTH_DIM_OFFSET_MM,
    text: String(Math.round(fpWidthMm)), stroke: dimStroke, textHeightMm: DIM_TEXT_HEIGHT_MM,
  });
  primitives.push({
    kind: 'dim',
    p1: tl, p2: bl, offsetMm: DEPTH_DIM_OFFSET_MM,
    text: String(Math.round(fpDepthMm)), stroke: dimStroke, textHeightMm: DIM_TEXT_HEIGHT_MM,
  });

  // Cover: short horizontal dim from the left face inward by cover, near the top.
  const coverY = bbox.minY + Math.min(fpDepthMm * 0.18, r.coverMm * 2);
  primitives.push({
    kind: 'dim',
    p1: toSheet({ x: bbox.minX, y: coverY }),
    p2: toSheet({ x: bbox.minX + r.coverMm, y: coverY }),
    offsetMm: -COVER_DIM_OFFSET_MM,
    text: String(Math.round(r.coverMm)), stroke: dimStroke, textHeightMm: DIM_TEXT_HEIGHT_MM * 0.85,
  });

  return { primitives, caption: `1:${denom}` };
}
