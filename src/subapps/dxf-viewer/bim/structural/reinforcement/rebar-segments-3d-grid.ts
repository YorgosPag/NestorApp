/**
 * ADR-505 (finish/rebar phase D) — 3Δ rebar SEGMENTS θεμελίωσης + πλάκας (pure SSoT).
 *
 * Mirror της segment-assembly των 3Δ mesh builders (`footing-rebar-3d` / `slab-rebar-3d`)
 * αλλά σε **scene units + zMm σχετικό με τη βάση** (DXF pseudo-3D χώρος). Reuse ΟΛΟΥ του
 * rebar **math** (resolveActive* + footprint/bbox + cover/spacing) — μόνο η σύνδεση σε
 * segments εκφράζεται στον DXF χώρο. tie-beam → delegate στον linear core (EC8 ζώνες).
 *
 * @see ../../../bim-3d/converters/footing-rebar-3d.ts · slab-rebar-3d.ts — οι 3Δ mesh δίδυμοι
 */

import type { Point2D } from '../../../rendering/types/Types';
import { mmToSceneUnits } from '../../../utils/scene-units';
import type { FoundationEntity, FoundationParams, TieBeamParams } from '../../types/foundation-types';
import type { SlabEntity } from '../../types/slab-types';
import type {
  PadReinforcement,
  StripReinforcement,
  TieBeamReinforcement,
} from './footing-reinforcement-types';
import type { RebarMesh } from './slab-foundation-reinforcement-types';
import { computeFoundationGeometry } from '../../geometry/foundation-geometry';
import { resolveActiveFootingReinforcementForParams } from '../active-footing-reinforcement';
import { resolveActiveSlabReinforcementForEntity } from '../active-reinforcement';
import { DEFAULT_STIRRUP_TYPE } from './beam-reinforcement-types';
import { tieBeamRebarLayout, tieBeamAxisPoints } from './tie-beam-linear-member';
import { collectLinearMemberRebarSegments3D } from './rebar-segments-3d-linear';
import type { RebarSeg3D, RebarPoint3D } from './rebar-plan-geometry-types';

const pt = (p: Point2D, zMm: number): RebarPoint3D => ({ x: p.x, y: p.y, zMm });

// ── Frame (scene-unit ορθογώνιο πλαίσιο footprint) ─────────────────────────────
interface Frame { origin: Point2D; along: Point2D; across: Point2D; lenAlong: number; lenAcross: number }
const sub = (a: Point2D, b: Point2D): Point2D => ({ x: a.x - b.x, y: a.y - b.y });
const lenOf = (a: Point2D): number => Math.hypot(a.x, a.y);
const unit = (a: Point2D): Point2D => { const l = lenOf(a); return l > 0 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 }; };
const planAt = (f: Frame, a: number, c: number): Point2D => ({
  x: f.origin.x + f.along.x * a + f.across.x * c,
  y: f.origin.y + f.along.y * a + f.across.y * c,
});

function frameOf(verts: readonly Point2D[]): Frame | null {
  if (verts.length < 4) return null;
  const along = sub(verts[1], verts[0]);
  const across = sub(verts[3], verts[0]);
  const lenAlong = lenOf(along);
  const lenAcross = lenOf(across);
  if (lenAlong <= 0 || lenAcross <= 0) return null;
  return { origin: verts[0], along: unit(along), across: unit(across), lenAlong, lenAcross };
}

const swap = (f: Frame): Frame => ({ origin: f.origin, along: f.across, across: f.along, lenAlong: f.lenAcross, lenAcross: f.lenAlong });

/** Ράβδοι // along (μήκος lenAlong−2cover), βήμα `spacing` κατά across, σε στάθμη zMm. */
function matSegs(f: Frame, zMm: number, spacing: number, cover: number, out: RebarSeg3D[]): void {
  const usable = f.lenAcross - 2 * cover;
  if (usable < 0 || spacing <= 0) return;
  const n = Math.max(1, Math.floor(usable / spacing) + 1);
  const a0 = cover, a1 = f.lenAlong - cover;
  for (let i = 0; i < n; i++) {
    const c = cover + (n === 1 ? usable / 2 : (i * usable) / (n - 1));
    out.push({ a: pt(planAt(f, a0, c), zMm), b: pt(planAt(f, a1, c), zMm) });
  }
}

/** `count` ράβδοι // along, ισοκατανεμημένες κατά across, σε στάθμη zMm. */
function distributedSegs(f: Frame, zMm: number, count: number, cover: number, out: RebarSeg3D[]): void {
  if (count <= 0) return;
  const usable = Math.max(0, f.lenAcross - 2 * cover);
  const a0 = cover, a1 = f.lenAlong - cover;
  for (let i = 0; i < count; i++) {
    const c = cover + (count === 1 ? usable / 2 : (i * usable) / (count - 1));
    out.push({ a: pt(planAt(f, a0, c), zMm), b: pt(planAt(f, a1, c), zMm) });
  }
}

/** Κάθετοι κλειστοί συνδετήρες (ορθογώνια στη διατομή plan-along × z) ανά βήμα. */
function stirrupRings(f: Frame, zBottomMm: number, zTopMm: number, cover: number, spacing: number, out: RebarSeg3D[]): void {
  const usable = f.lenAlong - 2 * cover;
  if (usable < 0 || spacing <= 0 || zTopMm <= zBottomMm) return;
  const n = Math.max(1, Math.floor(usable / spacing) + 1);
  const c0 = cover, c1 = f.lenAcross - cover;
  if (c1 <= c0) return;
  for (let i = 0; i < n; i++) {
    const a = cover + (n === 1 ? usable / 2 : (i * usable) / (n - 1));
    const left = planAt(f, a, c0), right = planAt(f, a, c1);
    out.push(
      { a: pt(left, zBottomMm), b: pt(right, zBottomMm) },
      { a: pt(right, zBottomMm), b: pt(right, zTopMm) },
      { a: pt(right, zTopMm), b: pt(left, zTopMm) },
      { a: pt(left, zTopMm), b: pt(left, zBottomMm) },
    );
  }
}

function padSegs(f: Frame, r: PadReinforcement, s: number, thicknessMm: number, out: RebarSeg3D[]): void {
  const cover = r.coverMm * s;
  matSegs(f, r.coverMm, r.bottomMeshX.spacingMm * s, cover, out);
  matSegs(swap(f), r.coverMm, r.bottomMeshY.spacingMm * s, cover, out);
  if (r.topMesh) {
    const zTop = thicknessMm - r.coverMm;
    matSegs(f, zTop, r.topMesh.spacingMm * s, cover, out);
    matSegs(swap(f), zTop, r.topMesh.spacingMm * s, cover, out);
  }
}

function stripSegs(f: Frame, r: StripReinforcement, s: number, thicknessMm: number, out: RebarSeg3D[]): void {
  const cover = r.coverMm * s;
  matSegs(swap(f), r.coverMm, r.transverse.spacingMm * s, cover, out); // εγκάρσιες // across
  distributedSegs(f, r.coverMm, r.longitudinal.count, cover, out);     // διαμήκεις διανομής
  if (r.stirrups) stirrupRings(f, r.coverMm, thicknessMm - r.coverMm, cover, r.stirrups.spacingMm * s, out);
}

function tieBeamSegs(p: TieBeamParams, r: TieBeamReinforcement): RebarSeg3D[] {
  const layout = tieBeamRebarLayout(p, r);
  if (!layout) return [];
  return collectLinearMemberRebarSegments3D({
    axisPts: tieBeamAxisPoints(p),
    sceneUnits: p.sceneUnits,
    layout,
    stirrupType: r.stirrups.type ?? DEFAULT_STIRRUP_TYPE,
  });
}

/** 3Δ segments οπλισμού θεμελίωσης (scene units + zMm σχετικό με τη βάση). `[]` αν χωρίς οπλισμό. */
export function collectFootingRebarSegments3D(foundation: FoundationEntity): RebarSeg3D[] {
  const p: FoundationParams = foundation.params;
  const r = resolveActiveFootingReinforcementForParams(p);
  if (!r) return [];
  const s = mmToSceneUnits(p.sceneUnits ?? 'mm');
  if (s <= 0) return [];

  if (p.kind === 'tie-beam' && r.kind === 'tie-beam') return tieBeamSegs(p, r);

  const f = frameOf(computeFoundationGeometry(p).footprint.vertices);
  if (!f) return [];
  const thicknessMm = Math.max(0, p.thicknessMm);
  const out: RebarSeg3D[] = [];
  if (p.kind === 'pad' && r.kind === 'pad') padSegs(f, r, s, thicknessMm, out);
  else if (p.kind === 'strip' && r.kind === 'strip') stripSegs(f, r, s, thicknessMm, out);
  return out;
}

// ── Slab (bbox-based, mirror slab-rebar-3d) ────────────────────────────────────
interface Bbox { minX: number; minY: number; maxX: number; maxY: number }
function bboxOf(verts: readonly { x: number; y: number }[]): Bbox | null {
  if (verts.length < 3) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of verts) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }
  return { minX, minY, maxX, maxY };
}

function slabMesh(bb: Bbox, zMm: number, meshX: RebarMesh, meshY: RebarMesh, cover: number, s: number, out: RebarSeg3D[]): void {
  const x0 = bb.minX + cover, x1 = bb.maxX - cover;
  const y0 = bb.minY + cover, y1 = bb.maxY - cover;
  if (x1 <= x0 || y1 <= y0) return;
  const stepY = meshX.spacingMm * s;
  if (stepY > 0) for (let y = y0; y <= y1 + 1e-6; y += stepY) out.push({ a: pt({ x: x0, y }, zMm), b: pt({ x: x1, y }, zMm) });
  const stepX = meshY.spacingMm * s;
  if (stepX > 0) for (let x = x0; x <= x1 + 1e-6; x += stepX) out.push({ a: pt({ x, y: y0 }, zMm), b: pt({ x, y: y1 }, zMm) });
}

/** 3Δ segments οπλισμού πλάκας (κάτω σχάρα στο cover, άνω σχάρα στο thickness−cover). */
export function collectSlabRebarSegments3D(slab: SlabEntity): RebarSeg3D[] {
  const r = resolveActiveSlabReinforcementForEntity(slab);
  if (!r) return [];
  const bb = bboxOf(slab.params.outline.vertices);
  if (!bb) return [];
  const s = mmToSceneUnits(slab.params.sceneUnits ?? 'mm');
  if (s <= 0) return [];
  const cover = r.coverMm * s;
  const thicknessMm = Math.max(0, slab.params.thickness);
  const zTop = thicknessMm - r.coverMm;
  if (zTop <= r.coverMm) return [];

  const out: RebarSeg3D[] = [];
  slabMesh(bb, r.coverMm, r.bottomMeshX, r.bottomMeshY, cover, s, out);
  slabMesh(bb, zTop, r.topMeshX, r.topMeshY, cover, s, out);
  return out;
}
