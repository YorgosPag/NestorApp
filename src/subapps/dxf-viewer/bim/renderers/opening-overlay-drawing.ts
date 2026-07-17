/**
 * Opening 2D plan-symbol overlays (ADR-421 SLICE B).
 *
 * Pure SSoT για ΟΛΑ τα plan-view overlay σύμβολα κουφωμάτων. Ο `OpeningRenderer`
 * καλεί `drawOpeningPlanOverlay()` με ένα thin drawing context (ctx + world→screen
 * mapper + line width)· εδώ γίνεται το dispatch μέσω `OPENING_PLAN_SYMBOL` (το
 * μοναδικό per-kind discriminator στο `opening-types.ts`).
 *
 * Όλα τα σύμβολα παράγονται από `geometry.outline` (+ `hingeArc` για swing) —
 * καμία αποθήκευση overlay geometry, καμία υποκατηγορία state. Industry-standard
 * symbolic plan (AutoCAD / Revit): swing arc, sliding rail, accordion zig-zag,
 * sectional lines, revolving cross, glazing double-line + operation marks.
 *
 * ADR-040: pure module (zero store subscriptions). Καλείται από leaf renderer.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-421-bim-opening-types-revit-grade.md §A5
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import type { OpeningEntity } from '../types/opening-types';
import { OPENING_PLAN_SYMBOL } from '../types/opening-types';
import type { Point3D } from '../types/bim-base';
import { HINGE_ARC_SUBDIVISIONS } from '../geometry/opening-geometry';

const HINGE_DASH: readonly number[] = [4, 3];
const SLIDING_DASH: readonly number[] = [10, 4];
const POCKET_DASH: readonly number[] = [5, 4];
const GLAZING_INSET_RATIO = 0.25;
/** Handle glyph: fraction of leaf length from hinge at which the handle sits. */
const HANDLE_LEAF_FRACTION = 0.86;
/** Handle tick half-length as a fraction of leaf length (Revit-discreet). */
const HANDLE_TICK_RATIO = 0.08;
/** Bay projection depth ως κλάσμα του πλάτους (parametric· editable depth → SLICE C). */
const BAY_PROJECTION_RATIO = 0.4;
const BAY_PROJECTION_MAX_RATIO = 1.2; // cap vs thickness-half
const OVERHEAD_PANEL_LINES = 4;

type Pt = { readonly x: number; readonly y: number };

/** Drawing context handed by the renderer (no store coupling). */
export interface OverlayDrawContext {
  readonly ctx: CanvasRenderingContext2D;
  /** World (scene-unit) point → device screen point. */
  readonly toScreen: (p: Pt) => Pt;
  /** Resolved overlay line width (px). */
  readonly lineWidth: number;
}

/**
 * Cached geometric frame of an opening outline: centroid + axis/perp unit
 * vectors + half-extents. Outline vertex order (computeOpeningGeometry):
 * `[start−perp, end−perp, end+perp, start+perp]`.
 */
interface OutlineFrame {
  readonly cx: number;
  readonly cy: number;
  readonly ux: number; readonly uy: number; // axis (start→end)
  readonly px: number; readonly py: number; // perp (−perp side→+perp side)
  readonly halfLen: number;
  readonly halfThk: number;
  readonly v: readonly Point3D[];
}

// ─── Public dispatch ─────────────────────────────────────────────────────────

/** Draw the kind-specific plan overlay for `opening` (SSoT dispatch). */
export function drawOpeningPlanOverlay(opening: OpeningEntity, dc: OverlayDrawContext): void {
  switch (OPENING_PLAN_SYMBOL[opening.kind]) {
    case 'swing':             drawSwing(opening, dc); return;
    case 'sliding':           drawSliding(opening, dc); return;
    case 'folding':           drawFolding(opening, dc); return;
    case 'overhead':          drawOverhead(opening, dc); return;
    case 'revolving':         drawRevolving(opening, dc); return;
    case 'glazing':           drawGlazing(opening, dc); return;
    case 'glazing-slide-h':   drawGlazing(opening, dc); drawSlideArrow(opening, dc, 'axis'); return;
    case 'glazing-slide-v':   drawGlazing(opening, dc); drawSlideArrow(opening, dc, 'perp'); return;
    case 'glazing-awning':    drawGlazing(opening, dc); drawSashMark(opening, dc, 'top'); return;
    case 'glazing-hopper':    drawGlazing(opening, dc); drawSashMark(opening, dc, 'bottom'); return;
    case 'glazing-tilt-turn': drawGlazing(opening, dc); drawSashMark(opening, dc, 'tilt-turn'); return;
    case 'bay':               drawBay(opening, dc); return;
  }
}

// ─── κάσα frame outlines (ADR-611) ────────────────────────────────────────────

/**
 * Draw the constant-cross-section κάσα jamb outlines (ADR-611). Each frame
 * outline is a plan-view rectangle (4 CCW vertices, world coords) produced by
 * `computeOpeningGeometry` — one jamb at each end of the opening. Stroked with
 * the caller's resolved opening style (no hardcoded colour; caller sets
 * `ctx.strokeStyle` + `dc.lineWidth`). Additive + zero-regression: legacy
 * openings whose geometry has no `frameOutlines` draw nothing.
 */
export function drawOpeningFrameOutlines(opening: OpeningEntity, dc: OverlayDrawContext): void {
  const frames = opening.geometry?.frameOutlines;
  if (!frames || frames.length === 0) return;
  const { ctx } = dc;
  ctx.save();
  ctx.lineWidth = dc.lineWidth;
  ctx.setLineDash([]);
  for (const poly of frames) {
    const vtx = poly.vertices;
    if (!vtx || vtx.length < 3) continue;
    worldPolyline(dc, [...vtx, vtx[0]]);
  }
  ctx.restore();
}

// ─── Frame helper ────────────────────────────────────────────────────────────

function frameOf(opening: OpeningEntity): OutlineFrame | null {
  const v = opening.geometry?.outline?.vertices;
  if (!v || v.length < 4) return null;
  const startMid = mid(v[0], v[3]);
  const endMid = mid(v[1], v[2]);
  let ax = endMid.x - startMid.x, ay = endMid.y - startMid.y;
  const len = Math.hypot(ax, ay) || 1;
  ax /= len; ay /= len;
  let pxv = v[3].x - v[0].x, pyv = v[3].y - v[0].y;
  const thk = Math.hypot(pxv, pyv) || 1;
  pxv /= thk; pyv /= thk;
  return {
    cx: (v[0].x + v[1].x + v[2].x + v[3].x) / 4,
    cy: (v[0].y + v[1].y + v[2].y + v[3].y) / 4,
    ux: ax, uy: ay, px: pxv, py: pyv,
    halfLen: len / 2, halfThk: thk / 2, v,
  };
}

function mid(a: Point3D, b: Point3D): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Point at axis offset `a` + perp offset `p` from the frame centroid. */
function at(f: OutlineFrame, a: number, p: number): Pt {
  return { x: f.cx + f.ux * a + f.px * p, y: f.cy + f.uy * a + f.py * p };
}

// ─── Swing (door / double-door / french-door) ────────────────────────────────

function drawSwing(opening: OpeningEntity, dc: OverlayDrawContext): void {
  const arc = opening.geometry?.hingeArc;
  const hinge = opening.geometry?.hingeAnchor;
  if (!arc || arc.points.length < 2 || !hinge) return;
  const { ctx } = dc;
  const hinge2 = opening.geometry?.hingeAnchor2;
  ctx.save();
  ctx.setLineDash(HINGE_DASH as number[]);
  ctx.lineWidth = dc.lineWidth;
  worldPolyline(dc, arc.points);
  ctx.setLineDash([]);
  worldLine(dc, hinge, arc.points[HINGE_ARC_SUBDIVISIONS]);
  if (hinge2 && arc.points.length > HINGE_ARC_SUBDIVISIONS + 1) {
    worldLine(dc, hinge2, arc.points[HINGE_ARC_SUBDIVISIONS + 1]);
  }
  drawHandleGlyph(dc, hinge, arc.points[HINGE_ARC_SUBDIVISIONS]);
  if (hinge2 && arc.points.length > HINGE_ARC_SUBDIVISIONS + 1) {
    drawHandleGlyph(dc, hinge2, arc.points[HINGE_ARC_SUBDIVISIONS + 1]);
  }
  ctx.restore();
}

/**
 * Draw a small handle tick near a swing leaf's latch (free) end. `hinge`→`tip`
 * is the leaf line (world coords); the tick is a short segment perpendicular to
 * the leaf, centred at HANDLE_LEAF_FRACTION along it. Latch side is inherent in
 * the geometry (tip = free end), matching the 3D hardware convention
 * (`latchSign` in the hardware builder) — no handing re-derivation here.
 */
function drawHandleGlyph(dc: OverlayDrawContext, hinge: Pt, tip: Pt): void {
  const lx = tip.x - hinge.x, ly = tip.y - hinge.y;
  const len = Math.hypot(lx, ly);
  if (len < 1e-6) return;
  const ux = lx / len, uy = ly / len;      // leaf unit vector
  const nx = -uy, ny = ux;                  // perpendicular
  const cx = hinge.x + ux * (len * HANDLE_LEAF_FRACTION);
  const cy = hinge.y + uy * (len * HANDLE_LEAF_FRACTION);
  const h = len * HANDLE_TICK_RATIO;
  dc.ctx.setLineDash([]);
  worldLine(dc, { x: cx - nx * h, y: cy - ny * h }, { x: cx + nx * h, y: cy + ny * h });
}

// ─── Sliding family (sliding / double-sliding / pocket) ───────────────────────

function drawSliding(opening: OpeningEntity, dc: OverlayDrawContext): void {
  const f = frameOf(opening);
  if (!f) return;
  const { ctx } = dc;
  const off = f.halfThk * 0.5;
  ctx.save();
  ctx.lineWidth = dc.lineWidth;
  if (opening.kind === 'double-sliding-door') {
    panel(dc, f, -f.halfLen, 0, off);
    panel(dc, f, 0, f.halfLen, -off);
  } else if (opening.kind === 'pocket-door') {
    panel(dc, f, -f.halfLen * 0.2, f.halfLen, off);
    pocket(dc, f);
  } else {
    panel(dc, f, -f.halfLen, f.halfLen * 0.1, off);
  }
  // Center rail (dashed).
  ctx.setLineDash(SLIDING_DASH as number[]);
  worldLine(dc, at(f, -f.halfLen, 0), at(f, f.halfLen, 0));
  ctx.restore();
}

/** Solid leaf-face line along the axis at a perp offset. */
function panel(dc: OverlayDrawContext, f: OutlineFrame, aStart: number, aEnd: number, perp: number): void {
  dc.ctx.setLineDash([]);
  worldLine(dc, at(f, aStart, perp), at(f, aEnd, perp));
}

/** Dashed pocket cavity extending past the start jamb into the wall. */
function pocket(dc: OverlayDrawContext, f: OutlineFrame): void {
  dc.ctx.setLineDash(POCKET_DASH as number[]);
  const a0 = -f.halfLen, a1 = -f.halfLen - f.halfLen * 1.6;
  worldLine(dc, at(f, a0, f.halfThk * 0.7), at(f, a1, f.halfThk * 0.7));
  worldLine(dc, at(f, a0, -f.halfThk * 0.7), at(f, a1, -f.halfThk * 0.7));
  worldLine(dc, at(f, a1, f.halfThk * 0.7), at(f, a1, -f.halfThk * 0.7));
}

// ─── Folding (bifold) ────────────────────────────────────────────────────────

function drawFolding(opening: OpeningEntity, dc: OverlayDrawContext): void {
  const f = frameOf(opening);
  if (!f) return;
  const dir = opening.params.handing === 'right' ? -1 : 1;
  const peak = f.halfThk * 0.85 * dir;
  const pts: Pt[] = [
    at(f, -f.halfLen, 0),
    at(f, -f.halfLen * 0.5, peak),
    at(f, 0, 0),
    at(f, f.halfLen * 0.5, peak),
    at(f, f.halfLen, 0),
  ];
  dc.ctx.save();
  dc.ctx.lineWidth = dc.lineWidth;
  dc.ctx.setLineDash([]);
  worldPolyline(dc, pts);
  dc.ctx.restore();
}

// ─── Overhead (sectional garage) ─────────────────────────────────────────────

function drawOverhead(opening: OpeningEntity, dc: OverlayDrawContext): void {
  const f = frameOf(opening);
  if (!f) return;
  dc.ctx.save();
  dc.ctx.lineWidth = dc.lineWidth;
  dc.ctx.setLineDash(POCKET_DASH as number[]);
  for (let i = 0; i < OVERHEAD_PANEL_LINES; i++) {
    const t = (i + 1) / (OVERHEAD_PANEL_LINES + 1); // 0..1 across thickness
    const p = (t - 0.5) * 2 * f.halfThk * 0.9;
    worldLine(dc, at(f, -f.halfLen, p), at(f, f.halfLen, p));
  }
  dc.ctx.restore();
}

// ─── Revolving (4-blade cross + drum circle) ─────────────────────────────────

function drawRevolving(opening: OpeningEntity, dc: OverlayDrawContext): void {
  const f = frameOf(opening);
  if (!f) return;
  const r = f.halfLen;
  const { ctx } = dc;
  ctx.save();
  ctx.lineWidth = dc.lineWidth;
  ctx.setLineDash([]);
  // Drum circle (polygon approximation in world → screen).
  const ring: Pt[] = [];
  const SEG = 32;
  for (let i = 0; i <= SEG; i++) {
    const a = (i / SEG) * Math.PI * 2;
    ring.push(at(f, Math.cos(a) * r, Math.sin(a) * r));
  }
  worldPolyline(dc, ring);
  // 4-blade cross.
  worldLine(dc, at(f, -r, 0), at(f, r, 0));
  worldLine(dc, at(f, 0, -r), at(f, 0, r));
  ctx.restore();
}

// ─── Glazing (window / fixed base) ───────────────────────────────────────────

function drawGlazing(opening: OpeningEntity, dc: OverlayDrawContext): void {
  const v = opening.geometry?.outline?.vertices;
  if (!v || v.length < 4) return;
  const cx = (v[0].x + v[1].x + v[2].x + v[3].x) / 4;
  const cy = (v[0].y + v[1].y + v[2].y + v[3].y) / 4;
  const inset = v.map((p) => ({
    x: p.x + (cx - p.x) * GLAZING_INSET_RATIO,
    y: p.y + (cy - p.y) * GLAZING_INSET_RATIO,
  }));
  dc.ctx.save();
  dc.ctx.lineWidth = dc.lineWidth;
  dc.ctx.setLineDash([]);
  worldPolyline(dc, [...inset, inset[0]]);
  dc.ctx.restore();
}

// ─── Sliding window arrow (↔ axis / ↕ perp) ───────────────────────────────────

function drawSlideArrow(opening: OpeningEntity, dc: OverlayDrawContext, axis: 'axis' | 'perp'): void {
  const f = frameOf(opening);
  if (!f) return;
  const half = axis === 'axis' ? f.halfLen * 0.5 : f.halfThk * 0.55;
  const head = Math.min(f.halfLen, f.halfThk) * 0.25;
  const dirX = axis === 'axis' ? f.ux : f.px;
  const dirY = axis === 'axis' ? f.uy : f.py;
  const a = { x: f.cx - dirX * half, y: f.cy - dirY * half };
  const b = { x: f.cx + dirX * half, y: f.cy + dirY * half };
  dc.ctx.save();
  dc.ctx.lineWidth = dc.lineWidth;
  dc.ctx.setLineDash([]);
  worldLine(dc, a, b);
  arrowHead(dc, b, dirX, dirY, head);
  arrowHead(dc, a, -dirX, -dirY, head);
  dc.ctx.restore();
}

function arrowHead(dc: OverlayDrawContext, tip: Pt, dirX: number, dirY: number, size: number): void {
  // Perp of (dirX,dirY) is (-dirY,dirX).
  const bx = tip.x - dirX * size, by = tip.y - dirY * size;
  worldLine(dc, tip, { x: bx - dirY * size * 0.6, y: by + dirX * size * 0.6 });
  worldLine(dc, tip, { x: bx + dirY * size * 0.6, y: by - dirX * size * 0.6 });
}

// ─── Sash operation mark (awning ▲ / hopper ▼ / tilt-turn L) ──────────────────

function drawSashMark(opening: OpeningEntity, dc: OverlayDrawContext, mode: 'top' | 'bottom' | 'tilt-turn'): void {
  const f = frameOf(opening);
  if (!f) return;
  const apex = mode === 'bottom' ? -f.halfThk * 0.7 : f.halfThk * 0.7;
  const base = f.halfLen * 0.55;
  dc.ctx.save();
  dc.ctx.lineWidth = dc.lineWidth;
  dc.ctx.setLineDash([]);
  // Triangle: hinge apex on one face, base across the axis.
  worldPolyline(dc, [
    at(f, -base, 0),
    at(f, 0, apex),
    at(f, base, 0),
  ]);
  if (mode === 'tilt-turn') {
    // Add the "turn" diagonal (side-hung component).
    worldLine(dc, at(f, -base, 0), at(f, base, -apex));
  }
  dc.ctx.restore();
}

// ─── Bay (projecting polygonal outline) ──────────────────────────────────────

function drawBay(opening: OpeningEntity, dc: OverlayDrawContext): void {
  const f = frameOf(opening);
  if (!f) return;
  const proj = Math.min(f.halfLen * 2 * BAY_PROJECTION_RATIO, f.halfThk * 2 * BAY_PROJECTION_MAX_RATIO + f.halfLen);
  const inset = f.halfLen * 0.25;
  dc.ctx.save();
  dc.ctx.lineWidth = dc.lineWidth;
  dc.ctx.setLineDash([]);
  // Trapezoid projecting toward +perp (exterior). Open on the wall side.
  worldPolyline(dc, [
    at(f, -f.halfLen, f.halfThk),
    at(f, -f.halfLen + inset, f.halfThk + proj),
    at(f, f.halfLen - inset, f.halfThk + proj),
    at(f, f.halfLen, f.halfThk),
  ]);
  // Center mullion hint.
  worldLine(dc, at(f, 0, f.halfThk), at(f, 0, f.halfThk + proj));
  dc.ctx.restore();
}

// ─── Low-level world→screen drawing primitives ────────────────────────────────

function worldLine(dc: OverlayDrawContext, a: Pt, b: Pt): void {
  const sa = dc.toScreen(a);
  const sb = dc.toScreen(b);
  dc.ctx.beginPath();
  dc.ctx.moveTo(sa.x, sa.y);
  dc.ctx.lineTo(sb.x, sb.y);
  dc.ctx.stroke();
}

function worldPolyline(dc: OverlayDrawContext, pts: ReadonlyArray<Pt>): void {
  if (pts.length < 2) return;
  dc.ctx.beginPath();
  const first = dc.toScreen(pts[0]);
  dc.ctx.moveTo(first.x, first.y);
  for (let i = 1; i < pts.length; i++) {
    const s = dc.toScreen(pts[i]);
    dc.ctx.lineTo(s.x, s.y);
  }
  dc.ctx.stroke();
}
