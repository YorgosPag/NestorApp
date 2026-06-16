/**
 * ADR-463 — Footing reinforcement detail · PLAN view builder (pure SSoT).
 *
 * Produces the drawing primitives (sheet-mm) for the footing plan region: a
 * faint concrete footprint outline, the reinforcement in plan (mesh bars /
 * distribution bars / stirrup outline) and the key dimensions (width / length-or-
 * span / cover) — plus the view scale caption (1:N). Mirror του
 * `column-detail-plan.ts`, kind-aware (pad / strip / tie-beam).
 *
 * Geometry-is-SSoT: οι διαστάσεις προέρχονται από το `buildFootingSectionContext`
 * (ίδιο mm space με την 2Δ κάτοψη/3Δ/ποσότητες) και ο οπλισμός από το
 * `resolveActiveFootingReinforcementForParams`. Η λεπτομέρεια σχεδιάζει το στοιχείο
 * **αξονικά** (orthographic plan, Revit/Tekla convention) — rotation/anchor/axis
 * αγνοούνται εδώ (το ίχνος ζωγραφίζεται σε καθαρό ορθογώνιο).
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/footing-detail-plan
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
} from '../reinforcement/footing-reinforcement-types';
import { pickScaleDenominator } from './detail-sheet-fit';
import type { DetailPrimitive, RectMm } from './detail-sheet-types';

// ─── Visual constants (sheet-mm / hex) — ίδια σύμβαση με την κολώνα ───────────
const CONCRETE_OUTLINE_HEX = '#b0b0b0';
const REBAR_HEX = '#c0392b';
const DIM_HEX = '#333333';
const CONCRETE_OUTLINE_WIDTH_MM = 0.18;
const MIN_BAR_WIDTH_MM = 0.3;
const DIM_WIDTH_MM = 0.13;
const DIM_TEXT_HEIGHT_MM = 2.6;

const TITLE_PAD_MM = 9;
const LEFT_DIM_PAD_MM = 14;
const BOTTOM_DIM_PAD_MM = 14;
const SIDE_PAD_MM = 7;
const WIDTH_DIM_OFFSET_MM = 6;
const DEPTH_DIM_OFFSET_MM = 6;
const COVER_DIM_OFFSET_MM = 3;

/** Καθαρές διαστάσεις του στοιχείου σε plan (mm): planW κατά X, planH κατά Y. */
interface PlanDims {
  readonly planWMm: number;
  readonly planHMm: number;
}

export interface FootingPlanResult {
  readonly primitives: readonly DetailPrimitive[];
  readonly caption?: string;
}

/** Καθαρές διαστάσεις κάτοψης ανά kind (X = πλάτος/μήκος-άξονα, Y = το άλλο). */
function planDimsOf(foundation: FoundationEntity): PlanDims | null {
  const ctx = buildFootingSectionContext(foundation);
  if (ctx.kind === 'pad') {
    return ctx.widthMm > 0 && ctx.lengthMm > 0 ? { planWMm: ctx.widthMm, planHMm: ctx.lengthMm } : null;
  }
  // strip / tie-beam: μήκος άξονα (span) κατά X, πλάτος band κατά Y.
  return ctx.spanMm > 0 && ctx.widthMm > 0 ? { planWMm: ctx.spanMm, planHMm: ctx.widthMm } : null;
}

/** Οριζόντιες (alongX) ή κατακόρυφες ράβδοι με δεδομένο βήμα, inset cover. */
function pushSpacedBars(
  out: DetailPrimitive[], alongX: boolean, spacingMm: number, coverMm: number,
  widthMm: number, d: PlanDims, toSheet: (p: Point2D) => Point2D,
): void {
  const span = alongX ? d.planHMm : d.planWMm;
  const usable = span - 2 * coverMm;
  if (usable < 0 || spacingMm <= 0) return;
  const n = Math.max(1, Math.floor(usable / spacingMm) + 1);
  const stroke = { colorHex: REBAR_HEX, widthMm };
  for (let i = 0; i < n; i++) {
    const t = coverMm + (n === 1 ? usable / 2 : (i * usable) / (n - 1));
    const a = alongX ? { x: coverMm, y: t } : { x: t, y: coverMm };
    const b = alongX ? { x: d.planWMm - coverMm, y: t } : { x: t, y: d.planHMm - coverMm };
    out.push({ kind: 'line', a: toSheet(a), b: toSheet(b), stroke });
  }
}

/** `count` ισοκατανεμημένες ράβδοι // X (κατά μήκος), inset cover. */
function pushDistributedBars(
  out: DetailPrimitive[], count: number, coverMm: number, widthMm: number,
  d: PlanDims, toSheet: (p: Point2D) => Point2D,
): void {
  if (count <= 0) return;
  const usable = Math.max(0, d.planHMm - 2 * coverMm);
  const stroke = { colorHex: REBAR_HEX, widthMm };
  for (let i = 0; i < count; i++) {
    const y = coverMm + (count === 1 ? usable / 2 : (i * usable) / (count - 1));
    out.push({
      kind: 'line',
      a: toSheet({ x: coverMm, y }),
      b: toSheet({ x: d.planWMm - coverMm, y }),
      stroke,
    });
  }
}

/** Κλειστό περίγραμμα inset κατά cover (συνδετήρας/περίμετρος). */
function pushInsetRect(
  out: DetailPrimitive[], coverMm: number, widthMm: number, d: PlanDims,
  toSheet: (p: Point2D) => Point2D,
): void {
  const x0 = coverMm, x1 = d.planWMm - coverMm, y0 = coverMm, y1 = d.planHMm - coverMm;
  if (x1 <= x0 || y1 <= y0) return;
  out.push({
    kind: 'polyline',
    points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }].map(toSheet),
    closed: true,
    stroke: { colorHex: REBAR_HEX, widthMm },
  });
}

function barWidthMm(diameterMm: number, s: number): number {
  return Math.max(MIN_BAR_WIDTH_MM, diameterMm * s);
}

function pushPadRebar(out: DetailPrimitive[], r: PadReinforcement, d: PlanDims, s: number, toSheet: (p: Point2D) => Point2D): void {
  const cover = r.coverMm;
  // bottomMeshX: ράβδοι // X (μήκος=width), βήμα κατά Y (length).
  pushSpacedBars(out, true, r.bottomMeshX.spacingMm, cover, barWidthMm(r.bottomMeshX.diameterMm, s), d, toSheet);
  // bottomMeshY: ράβδοι // Y, βήμα κατά X.
  pushSpacedBars(out, false, r.bottomMeshY.spacingMm, cover, barWidthMm(r.bottomMeshY.diameterMm, s), d, toSheet);
}

function pushStripRebar(out: DetailPrimitive[], r: StripReinforcement, d: PlanDims, s: number, toSheet: (p: Point2D) => Point2D): void {
  const cover = r.coverMm;
  // Εγκάρσιες: // Y (πλάτος), βήμα κατά X (άξονας).
  pushSpacedBars(out, false, r.transverse.spacingMm, cover, barWidthMm(r.transverse.diameterMm, s), d, toSheet);
  // Διαμήκεις διανομής: count ράβδοι // X.
  pushDistributedBars(out, r.longitudinal.count, cover, barWidthMm(r.longitudinal.diameterMm, s), d, toSheet);
  if (r.stirrups) pushInsetRect(out, cover, barWidthMm(r.stirrups.diameterMm, s), d, toSheet);
}

function pushTieBeamRebar(out: DetailPrimitive[], r: TieBeamReinforcement, d: PlanDims, s: number, toSheet: (p: Point2D) => Point2D): void {
  const cover = r.coverMm;
  // Διαμήκεις (κάτω+άνω σε κάτοψη συμπίπτουν): bottom.count ράβδοι // X.
  pushDistributedBars(out, r.bottom.count, cover, barWidthMm(r.bottom.diameterMm, s), d, toSheet);
  // Συνδετήρες: εγκάρσια ticks (// Y) με βήμα κατά X + περίγραμμα inset.
  pushSpacedBars(out, false, r.stirrups.spacingMm, cover, barWidthMm(r.stirrups.diameterMm, s), d, toSheet);
  pushInsetRect(out, cover, barWidthMm(r.stirrups.diameterMm, s), d, toSheet);
}

/**
 * Builds the plan-region primitives for a reinforced footing. Returns empty
 * primitives for missing reinforcement / degenerate geometry.
 */
export function buildFootingPlanRegion(foundation: FoundationEntity, region: RectMm): FootingPlanResult {
  const r = resolveActiveFootingReinforcementForParams(foundation.params);
  if (!r) return { primitives: [] };
  const d = planDimsOf(foundation);
  if (!d) return { primitives: [] };

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

  const out: DetailPrimitive[] = [];

  // ── Faint concrete footprint ──
  out.push({
    kind: 'polyline',
    points: [{ x: 0, y: 0 }, { x: d.planWMm, y: 0 }, { x: d.planWMm, y: d.planHMm }, { x: 0, y: d.planHMm }].map(toSheet),
    closed: true,
    stroke: { colorHex: CONCRETE_OUTLINE_HEX, widthMm: CONCRETE_OUTLINE_WIDTH_MM },
  });

  // ── Reinforcement (kind-aware) ──
  if (foundation.params.kind === 'pad' && r.kind === 'pad') pushPadRebar(out, r, d, s, toSheet);
  else if (foundation.params.kind === 'strip' && r.kind === 'strip') pushStripRebar(out, r, d, s, toSheet);
  else if (foundation.params.kind === 'tie-beam' && r.kind === 'tie-beam') pushTieBeamRebar(out, r, d, s, toSheet);

  // ── Dimensions: width-X (bottom), length/span-Y (left), cover (top-left inset) ──
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
  const coverY = Math.min(d.planHMm * 0.18, r.coverMm * 2);
  out.push({
    kind: 'dim',
    p1: toSheet({ x: 0, y: coverY }), p2: toSheet({ x: r.coverMm, y: coverY }),
    offsetMm: -COVER_DIM_OFFSET_MM, text: String(Math.round(r.coverMm)), stroke: dimStroke, textHeightMm: DIM_TEXT_HEIGHT_MM * 0.85,
  });

  return { primitives: out, caption: `1:${denom}` };
}
