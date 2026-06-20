/**
 * ADR-505 (finish/rebar export) — Γεωμετρία οπλισμού ΘΕΜΕΛΙΩΣΗΣ σε κάτοψη (pure SSoT).
 *
 * Το «σώμα» του πρώην `drawFootingRebar2D` ΠΡΙΝ το ctx, kind-aware:
 *   - `pad`      → δι-διευθυντική κάτω σχάρα (γραμμές // X και // Y, inset cover).
 *   - `strip`    → εγκάρσιες ράβδοι + διαμήκεις διανομής + προαιρετικό περίγραμμα.
 *   - `tie-beam` → ΕΙΝΑΙ δοκός → delegate στον linear-member core (EC8 ζώνες).
 *
 * Όλη η γεωμετρία υπολογίζεται από τις γωνίες του footprint (SSoT
 * `computeFoundationGeometry`) σε **world coords** — καμία νέα μαθηματική.
 *
 * Καταναλώνεται από: `footing-rebar-2d.ts` (canvas) + `overlay-dxf-collector.ts` (DXF).
 *
 * @see ../../renderers/footing-rebar-2d.ts — ο canvas consumer
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { FoundationParams, TieBeamParams } from '../../types/foundation-types';
import type {
  PadReinforcement,
  StripReinforcement,
  TieBeamReinforcement,
} from './footing-reinforcement-types';
import { computeFoundationGeometry } from '../../geometry/foundation-geometry';
import { mmToSceneUnits } from '../../../utils/scene-units';
import { resolveActiveFootingReinforcementForParams } from '../active-footing-reinforcement';
import { DEFAULT_STIRRUP_TYPE } from './beam-reinforcement-types';
import { tieBeamRebarLayout, tieBeamAxisPoints } from './tie-beam-linear-member';
import { collectLinearMemberRebarPlanGeometry } from './linear-member-rebar-plan-geometry';
import type { RebarPlanGeometry, RebarPlanPath } from './rebar-plan-geometry-types';
import { EMPTY_REBAR_PLAN_GEOMETRY } from './rebar-plan-geometry-types';

interface Vec { readonly x: number; readonly y: number }
function sub(a: Vec, b: Vec): Vec { return { x: a.x - b.x, y: a.y - b.y }; }
function add(a: Vec, b: Vec): Vec { return { x: a.x + b.x, y: a.y + b.y }; }
function scale(a: Vec, k: number): Vec { return { x: a.x * k, y: a.y * k }; }
function len(a: Vec): number { return Math.hypot(a.x, a.y); }
function unit(a: Vec): Vec { const l = len(a); return l > 0 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 }; }

/** Τοπικό πλαίσιο ορθογωνίου footprint: origin + 2 μοναδιαίοι άξονες + μήκη (canvas). */
interface RectFrame {
  readonly origin: Vec;
  readonly along: Vec;
  readonly across: Vec;
  readonly lenAlong: number;
  readonly lenAcross: number;
}

function rectFrame(verts: readonly { x: number; y: number }[]): RectFrame | null {
  if (verts.length < 4) return null;
  const along = sub(verts[1], verts[0]);
  const across = sub(verts[3], verts[0]);
  const lenAlong = len(along);
  const lenAcross = len(across);
  if (lenAlong <= 0 || lenAcross <= 0) return null;
  return { origin: verts[0], along: unit(along), across: unit(across), lenAlong, lenAcross };
}

/** Ράβδοι // along, μήκος `lenAlong − 2·cover`, βήμα `spacing` κατά across (inset cover). */
function barsAlong(
  f: RectFrame,
  spacingCanvas: number,
  coverCanvas: number,
  diameterMm: number,
  out: RebarPlanPath[],
): void {
  const usableAcross = f.lenAcross - 2 * coverCanvas;
  if (usableAcross < 0 || spacingCanvas <= 0) return;
  const n = Math.max(1, Math.floor(usableAcross / spacingCanvas) + 1);
  const a0 = coverCanvas;
  const a1 = f.lenAlong - coverCanvas;
  for (let i = 0; i < n; i++) {
    const across = coverCanvas + (n === 1 ? usableAcross / 2 : (i * usableAcross) / (n - 1));
    const base = add(f.origin, scale(f.across, across));
    out.push({
      points: [add(base, scale(f.along, a0)), add(base, scale(f.along, a1))],
      closed: false,
      diameterMm,
    });
  }
}

/** `count` ράβδοι // along, ισοκατανεμημένες κατά across (inset cover). */
function distributedAlong(
  f: RectFrame,
  count: number,
  coverCanvas: number,
  diameterMm: number,
  out: RebarPlanPath[],
): void {
  if (count <= 0) return;
  const usableAcross = Math.max(0, f.lenAcross - 2 * coverCanvas);
  const a0 = coverCanvas;
  const a1 = f.lenAlong - coverCanvas;
  for (let i = 0; i < count; i++) {
    const across = coverCanvas + (count === 1 ? usableAcross / 2 : (i * usableAcross) / (count - 1));
    const base = add(f.origin, scale(f.across, across));
    out.push({
      points: [add(base, scale(f.along, a0)), add(base, scale(f.along, a1))],
      closed: false,
      diameterMm,
    });
  }
}

/** Περίγραμμα ορθογωνίου inset κατά cover (συνδετήρας/περίμετρος) → κλειστή path. */
function insetRect(f: RectFrame, coverCanvas: number, diameterMm: number, out: RebarPlanPath[]): void {
  const x0 = coverCanvas, x1 = f.lenAlong - coverCanvas;
  const y0 = coverCanvas, y1 = f.lenAcross - coverCanvas;
  if (x1 <= x0 || y1 <= y0) return;
  const at = (a: number, c: number): Vec => add(f.origin, add(scale(f.along, a), scale(f.across, c)));
  out.push({ points: [at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1)], closed: true, diameterMm });
}

/** Frame με εναλλαγμένους άξονες (ράβδοι κατά την άλλη διεύθυνση). */
function swapFrame(f: RectFrame): RectFrame {
  return { origin: f.origin, along: f.across, across: f.along, lenAlong: f.lenAcross, lenAcross: f.lenAlong };
}

function padPaths(f: RectFrame, r: PadReinforcement, s: number): RebarPlanPath[] {
  const cover = r.coverMm * s;
  const out: RebarPlanPath[] = [];
  // bottomMeshX: ράβδοι // along (width), βήμα κατά across.
  barsAlong(f, r.bottomMeshX.spacingMm * s, cover, r.bottomMeshX.diameterMm, out);
  // bottomMeshY: ράβδοι // across — εναλλαγή frame αξόνων.
  barsAlong(swapFrame(f), r.bottomMeshY.spacingMm * s, cover, r.bottomMeshY.diameterMm, out);
  return out;
}

function stripPaths(f: RectFrame, r: StripReinforcement, s: number): RebarPlanPath[] {
  const cover = r.coverMm * s;
  const out: RebarPlanPath[] = [];
  // Εγκάρσιες: ράβδοι // across (πλάτος), βήμα κατά along.
  barsAlong(swapFrame(f), r.transverse.spacingMm * s, cover, r.transverse.diameterMm, out);
  // Διαμήκεις διανομής: count ράβδοι // along.
  distributedAlong(f, r.longitudinal.count, cover, r.longitudinal.diameterMm, out);
  if (r.stirrups) insetRect(f, cover, r.stirrups.diameterMm, out);
  return out;
}

/** Tie-beam → linear-member core (ίδιο SSoT με τη δοκό). */
function tieBeamGeometry(p: TieBeamParams, r: TieBeamReinforcement): RebarPlanGeometry {
  const layout = tieBeamRebarLayout(p, r);
  if (!layout) return EMPTY_REBAR_PLAN_GEOMETRY;
  return collectLinearMemberRebarPlanGeometry({
    axisPts: tieBeamAxisPoints(p),
    sceneUnits: p.sceneUnits,
    layout,
    stirrupType: r.stirrups.type ?? DEFAULT_STIRRUP_TYPE,
  });
}

/**
 * Γεωμετρία οπλισμού θεμελιακού στοιχείου στην κάτοψη (world coords). `null` όταν δεν
 * έχει ενεργό οπλισμό ή εκφυλισμένη γεωμετρία.
 */
export function collectFootingRebarPlanGeometry(p: FoundationParams): RebarPlanGeometry | null {
  const r = resolveActiveFootingReinforcementForParams(p);
  if (!r) return null;
  const s = mmToSceneUnits(p.sceneUnits ?? 'mm');
  if (s <= 0) return null;

  if (p.kind === 'tie-beam' && r.kind === 'tie-beam') {
    const geo = tieBeamGeometry(p, r);
    return geo.paths.length === 0 ? null : geo;
  }

  const f = rectFrame(computeFoundationGeometry(p).footprint.vertices);
  if (!f) return null;
  if (p.kind === 'pad' && r.kind === 'pad') return { paths: padPaths(f, r, s), dots: [] };
  if (p.kind === 'strip' && r.kind === 'strip') return { paths: stripPaths(f, r, s), dots: [] };
  return null;
}
