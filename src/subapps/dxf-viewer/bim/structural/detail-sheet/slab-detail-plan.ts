/**
 * ADR-476 — Slab reinforcement detail · PLAN view builder (pure SSoT).
 *
 * Παράγει τα drawing primitives (sheet-mm) της κάτοψης πλάκας: το πραγματικό
 * περίγραμμα (outline polygon, bbox-fit) + δι-διευθυντική **κάτω** σχάρα (συμπαγείς
 * γραμμές) + **άνω** σχάρα (διακεκομμένες — Revit «top mark») + οι διαστάσεις
 * πλάτους/μήκους/επικάλυψης και η κλίμακα (1:N). Mirror του `footing-detail-plan.ts`,
 * αλλά **outline-based** (η πλάκα είναι πολύγωνο, το πέδιλο ήταν ορθογώνιο).
 *
 * Geometry-is-SSoT: διαστάσεις από `buildSlabFoundationSectionContext`, οπλισμός από
 * `resolveActiveSlabReinforcementForEntity` (auto-aware → detail === panel === 2Δ === 3Δ).
 * Οι σχάρες σχεδιάζονται στο περιβάλλον ορθογώνιο (bbox − cover) — ίδια σύμβαση με
 * τον 3Δ κλωβό (`buildSlabRebarCage`, bbox-based). True polygon-clip = DEFER (ADR-476 §4).
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/slab-detail-plan
 * @see docs/centralized-systems/reference/adrs/ADR-476-unified-slab-reinforcement.md
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { SlabEntity } from '../../types/slab-types';
import type { RebarMesh } from '../reinforcement/slab-foundation-reinforcement-types';
import { mmToSceneUnits } from '../../../utils/scene-units';
import { resolveActiveSlabReinforcementForEntity } from '../active-reinforcement';
import { pickScaleDenominator } from './detail-sheet-fit';
import type { DetailPrimitive, RectMm } from './detail-sheet-types';
// ADR-471 Slice 6 — χρώμα οπλισμού από το ΕΝΑ SSoT (πρώην inline literal σε 10 αρχεία).
import { REBAR_COLOR_HEX as REBAR_HEX } from '../rebar-catalog';

const CONCRETE_OUTLINE_HEX = '#b0b0b0';
const DIM_HEX = '#333333';
const CONCRETE_OUTLINE_WIDTH_MM = 0.18;
const MIN_BAR_WIDTH_MM = 0.3;
const DIM_WIDTH_MM = 0.13;
const DIM_TEXT_HEIGHT_MM = 2.6;
/** Διακεκομμένη διαδρομή άνω σχάρας (sheet-mm), Revit «top mark». */
const TOP_MESH_DASH_MM: readonly number[] = [2.4, 1.6];

const TITLE_PAD_MM = 9;
const LEFT_DIM_PAD_MM = 14;
const BOTTOM_DIM_PAD_MM = 14;
const SIDE_PAD_MM = 7;
const WIDTH_DIM_OFFSET_MM = 6;
const DEPTH_DIM_OFFSET_MM = 6;
const COVER_DIM_OFFSET_MM = 3;

/** Καθαρές διαστάσεις κάτοψης (mm): planW κατά X, planH κατά Y (bbox). */
interface PlanDims {
  readonly planWMm: number;
  readonly planHMm: number;
}

export interface SlabPlanResult {
  readonly primitives: readonly DetailPrimitive[];
  readonly caption?: string;
}

function barWidthMm(diameterMm: number, s: number): number {
  return Math.max(MIN_BAR_WIDTH_MM, diameterMm * s);
}

/**
 * Στρώνει μία δι-διευθυντική σχάρα (ράβδοι // X + // Y) στο bbox − cover (local mm).
 * `meshX` = γραμμές // X (constant y, βήμα κατά Y)· `meshY` = γραμμές // Y. `dashMm`
 * undefined → συμπαγής (κάτω σχάρα)· ορισμένο → διακεκομμένη (άνω σχάρα).
 */
function pushMesh(
  out: DetailPrimitive[], meshX: RebarMesh, meshY: RebarMesh, coverMm: number,
  d: PlanDims, s: number, toSheet: (p: Point2D) => Point2D, dashMm?: readonly number[],
): void {
  const x0 = coverMm, x1 = d.planWMm - coverMm, y0 = coverMm, y1 = d.planHMm - coverMm;
  if (x1 <= x0 || y1 <= y0) return;

  // Ράβδοι // X: οριζόντιες γραμμές σε διαδοχικά y (βήμα meshX.spacing).
  if (meshX.spacingMm > 0) {
    const stroke = { colorHex: REBAR_HEX, widthMm: barWidthMm(meshX.diameterMm, s), dashMm };
    for (let y = y0; y <= y1 + 1e-6; y += meshX.spacingMm) {
      out.push({ kind: 'line', a: toSheet({ x: x0, y }), b: toSheet({ x: x1, y }), stroke });
    }
  }
  // Ράβδοι // Y: κατακόρυφες γραμμές σε διαδοχικά x (βήμα meshY.spacing).
  if (meshY.spacingMm > 0) {
    const stroke = { colorHex: REBAR_HEX, widthMm: barWidthMm(meshY.diameterMm, s), dashMm };
    for (let x = x0; x <= x1 + 1e-6; x += meshY.spacingMm) {
      out.push({ kind: 'line', a: toSheet({ x, y: y0 }), b: toSheet({ x, y: y1 }), stroke });
    }
  }
}

/**
 * Builds the plan-region primitives for a reinforced slab. Returns empty
 * primitives for missing reinforcement / degenerate geometry.
 */
export function buildSlabPlanRegion(slab: SlabEntity, region: RectMm): SlabPlanResult {
  const r = resolveActiveSlabReinforcementForEntity(slab);
  if (!r) return { primitives: [] };

  const verts = slab.params.outline.vertices;
  if (verts.length < 3) return { primitives: [] };
  const perScene = mmToSceneUnits(slab.params.sceneUnits ?? 'mm');
  if (perScene <= 0) return { primitives: [] };

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of verts) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }
  const d: PlanDims = { planWMm: (maxX - minX) / perScene, planHMm: (maxY - minY) / perScene };
  if (d.planWMm <= 0 || d.planHMm <= 0) return { primitives: [] };

  const availW = region.w - LEFT_DIM_PAD_MM - SIDE_PAD_MM;
  const availH = region.h - TITLE_PAD_MM - BOTTOM_DIM_PAD_MM;
  const denom = pickScaleDenominator(d.planWMm, d.planHMm, availW, availH);
  const s = 1 / denom; // sheet-mm per real-mm

  const drawW = d.planWMm * s;
  const drawH = d.planHMm * s;
  const x0 = region.x + LEFT_DIM_PAD_MM + (availW - drawW) / 2;
  const y0 = region.y + TITLE_PAD_MM + (availH - drawH) / 2;
  // local (x∈[0,planW], y∈[0,planH], y down) → sheet-mm.
  const toSheet = (p: Point2D): Point2D => ({ x: x0 + p.x * s, y: y0 + p.y * s });
  // outline vertex (scene units) → local mm (origin at bbox min, y down).
  const vertToLocal = (v: { x: number; y: number }): Point2D => ({
    x: (v.x - minX) / perScene,
    y: (v.y - minY) / perScene,
  });

  const out: DetailPrimitive[] = [];

  // ── Faint concrete footprint (πραγματικό outline polygon) ──
  out.push({
    kind: 'polyline',
    points: verts.map((v) => toSheet(vertToLocal(v))),
    closed: true,
    stroke: { colorHex: CONCRETE_OUTLINE_HEX, widthMm: CONCRETE_OUTLINE_WIDTH_MM },
  });

  // ── Reinforcement: κάτω σχάρα (συμπαγής) + άνω σχάρα (διακεκομμένη) ──
  const cover = r.coverMm;
  pushMesh(out, r.bottomMeshX, r.bottomMeshY, cover, d, s, toSheet);
  pushMesh(out, r.topMeshX, r.topMeshY, cover, d, s, toSheet, TOP_MESH_DASH_MM);

  // ── Dimensions: width-X (bottom), length-Y (left), cover (top-left inset) ──
  const dimStroke = { colorHex: DIM_HEX, widthMm: DIM_WIDTH_MM };
  out.push({
    kind: 'dim',
    p1: toSheet({ x: 0, y: d.planHMm }), p2: toSheet({ x: d.planWMm, y: d.planHMm }),
    offsetMm: WIDTH_DIM_OFFSET_MM, text: String(Math.round(d.planWMm)), stroke: dimStroke, textHeightMm: DIM_TEXT_HEIGHT_MM,
  });
  out.push({
    kind: 'dim',
    p1: toSheet({ x: 0, y: 0 }), p2: toSheet({ x: 0, y: d.planHMm }),
    offsetMm: DEPTH_DIM_OFFSET_MM, text: String(Math.round(d.planHMm)), stroke: dimStroke, textHeightMm: DIM_TEXT_HEIGHT_MM,
  });
  const coverY = Math.min(d.planHMm * 0.18, cover * 2);
  out.push({
    kind: 'dim',
    p1: toSheet({ x: 0, y: coverY }), p2: toSheet({ x: cover, y: coverY }),
    offsetMm: -COVER_DIM_OFFSET_MM, text: String(Math.round(cover)), stroke: dimStroke, textHeightMm: DIM_TEXT_HEIGHT_MM * 0.85,
  });

  return { primitives: out, caption: `1:${denom}` };
}
