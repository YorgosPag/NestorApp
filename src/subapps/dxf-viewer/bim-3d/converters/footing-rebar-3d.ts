/**
 * ADR-463 — 3Δ οπλισμός θεμελίωσης (rebar cage): kind-aware → THREE.Group.
 *
 * Mirror του `column-rebar-3d.ts` αλλά **οριζόντιος** (οι ράβδοι σχάρας τρέχουν
 * στο επίπεδο, όχι κατακόρυφα):
 *   - `pad`      → κάτω σχάρα (X+Y bars, στάθμη bottom+cover) + προαιρετική άνω σχάρα.
 *   - `strip`    → εγκάρσιες + διαμήκεις διανομής (bottom) + προαιρετικοί κάθετοι
 *                  συνδετήρες (vertical rings ανά βήμα).
 *   - `tie-beam` → κάτω + άνω διαμήκεις ράβδοι + κάθετοι συνδετήρες.
 *
 * ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΕΙ τα shared primitives του column cage (`buildRods` InstancedMesh,
 * `REBAR_MATERIAL` singleton, `toThree` AXIS_FLIP, `MM_TO_M`) — μηδέν duplicate
 * (N.0.2). Θέσεις σε absolute world metres (ADR-462: footprint canvas units →
 * metres μέσω `scalePoints`/`sceneToM`)· κατακόρυφα από το `bottomY` (= η βάση του
 * στερεού του πεδίλου, ίδιο datum με το `foundationToMesh`).
 *
 * @see ./column-rebar-3d.ts — τα shared primitives
 * @see docs/centralized-systems/reference/adrs/ADR-463-foundation-reinforcement-ux.md
 */

import * as THREE from 'three';
import type { FoundationEntity } from '../../bim/types/foundation-types';
import type {
  PadReinforcement,
  StripReinforcement,
  TieBeamReinforcement,
} from '../../bim/structural/reinforcement/footing-reinforcement-types';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import { scalePoints } from '../../rendering/entities/shared/geometry-vector-utils';
import { resolveActiveFootingReinforcementForParams } from '../../bim/structural/active-footing-reinforcement';
import type { Point2D } from '../../rendering/types/Types';
import {
  MM_TO_M,
  MIN_RADIUS,
  REBAR_MATERIAL,
  buildRods,
  toThree,
  type Seg,
} from './rebar-3d-shared';

/** Ορθογώνιο πλαίσιο σε absolute world-metre plan coords (origin + 2 μοναδιαίοι άξονες). */
interface Frame {
  readonly origin: Point2D;
  readonly along: Point2D;
  readonly across: Point2D;
  readonly lenAlong: number;
  readonly lenAcross: number;
}

function sub(a: Point2D, b: Point2D): Point2D { return { x: a.x - b.x, y: a.y - b.y }; }
function lenOf(a: Point2D): number { return Math.hypot(a.x, a.y); }
function unit(a: Point2D): Point2D { const l = lenOf(a); return l > 0 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 }; }

/** plan point = origin + along·a + across·c (metre coords). */
function planAt(f: Frame, a: number, c: number): Point2D {
  return {
    x: f.origin.x + f.along.x * a + f.across.x * c,
    y: f.origin.y + f.along.y * a + f.across.y * c,
  };
}

function frameOf(verts: readonly Point2D[]): Frame | null {
  if (verts.length < 4) return null;
  const along = sub(verts[1], verts[0]);
  const across = sub(verts[3], verts[0]);
  const lenAlong = lenOf(along);
  const lenAcross = lenOf(across);
  if (lenAlong <= 0 || lenAcross <= 0) return null;
  return { origin: verts[0], along: unit(along), across: unit(across), lenAlong, lenAcross };
}

function radiusOf(diameterMm: number): number {
  return Math.max(MIN_RADIUS, (diameterMm / 2) * MM_TO_M);
}

/** Οριζόντιες ράβδοι // along (μήκος lenAlong−2cover), βήμα `spacingM` κατά across. */
function matSegs(f: Frame, yLevel: number, spacingM: number, coverM: number): Seg[] {
  const usable = f.lenAcross - 2 * coverM;
  if (usable < 0 || spacingM <= 0) return [];
  const n = Math.max(1, Math.floor(usable / spacingM) + 1);
  const a0 = coverM, a1 = f.lenAlong - coverM;
  const segs: Seg[] = [];
  for (let i = 0; i < n; i++) {
    const c = coverM + (n === 1 ? usable / 2 : (i * usable) / (n - 1));
    segs.push({ a: toThree(planAt(f, a0, c), yLevel), b: toThree(planAt(f, a1, c), yLevel) });
  }
  return segs;
}

/** `count` οριζόντιες ράβδοι // along, ισοκατανεμημένες κατά across (inset cover). */
function distributedSegs(f: Frame, yLevel: number, count: number, coverM: number): Seg[] {
  if (count <= 0) return [];
  const usable = Math.max(0, f.lenAcross - 2 * coverM);
  const a0 = coverM, a1 = f.lenAlong - coverM;
  const segs: Seg[] = [];
  for (let i = 0; i < count; i++) {
    const c = coverM + (count === 1 ? usable / 2 : (i * usable) / (count - 1));
    segs.push({ a: toThree(planAt(f, a0, c), yLevel), b: toThree(planAt(f, a1, c), yLevel) });
  }
  return segs;
}

/** Κάθετοι κλειστοί συνδετήρες (ορθογ. δαχτυλίδια στη διατομή) ανά βήμα κατά τον άξονα. */
function stirrupRingSegs(
  f: Frame,
  bottomY: number,
  topY: number,
  coverM: number,
  spacingM: number,
): Seg[] {
  const usable = f.lenAlong - 2 * coverM;
  if (usable < 0 || spacingM <= 0) return [];
  const n = Math.max(1, Math.floor(usable / spacingM) + 1);
  const c0 = coverM, c1 = f.lenAcross - coverM;
  const yb = bottomY + coverM, yt = topY - coverM;
  if (c1 <= c0 || yt <= yb) return [];
  const segs: Seg[] = [];
  for (let i = 0; i < n; i++) {
    const a = coverM + (n === 1 ? usable / 2 : (i * usable) / (n - 1));
    const left = planAt(f, a, c0), right = planAt(f, a, c1);
    const p0 = toThree(left, yb), p1 = toThree(right, yb);
    const p2 = toThree(right, yt), p3 = toThree(left, yt);
    segs.push({ a: p0, b: p1 }, { a: p1, b: p2 }, { a: p2, b: p3 }, { a: p3, b: p0 });
  }
  return segs;
}

function addRods(group: THREE.Group, segs: readonly Seg[], radius: number): void {
  const mesh = buildRods(segs, radius, REBAR_MATERIAL);
  if (mesh) group.add(mesh);
}

function buildPadCage(group: THREE.Group, f: Frame, r: PadReinforcement, bottomY: number, topY: number): void {
  const cover = r.coverMm * MM_TO_M;
  const yBottom = bottomY + cover;
  // bottomMeshX: ράβδοι // along (πλάτος), βήμα κατά across.
  addRods(group, matSegs(f, yBottom, r.bottomMeshX.spacingMm * MM_TO_M, cover), radiusOf(r.bottomMeshX.diameterMm));
  // bottomMeshY: ράβδοι // across → εναλλαγή αξόνων frame.
  const fSwap: Frame = { origin: f.origin, along: f.across, across: f.along, lenAlong: f.lenAcross, lenAcross: f.lenAlong };
  addRods(group, matSegs(fSwap, yBottom, r.bottomMeshY.spacingMm * MM_TO_M, cover), radiusOf(r.bottomMeshY.diameterMm));
  if (r.topMesh) {
    const yTop = topY - cover;
    addRods(group, matSegs(f, yTop, r.topMesh.spacingMm * MM_TO_M, cover), radiusOf(r.topMesh.diameterMm));
    addRods(group, matSegs(fSwap, yTop, r.topMesh.spacingMm * MM_TO_M, cover), radiusOf(r.topMesh.diameterMm));
  }
}

function buildStripCage(group: THREE.Group, f: Frame, r: StripReinforcement, bottomY: number, topY: number): void {
  const cover = r.coverMm * MM_TO_M;
  const yBottom = bottomY + cover;
  // Εγκάρσιες: // across (πλάτος), βήμα κατά τον άξονα → swapped frame.
  const fTrans: Frame = { origin: f.origin, along: f.across, across: f.along, lenAlong: f.lenAcross, lenAcross: f.lenAlong };
  addRods(group, matSegs(fTrans, yBottom, r.transverse.spacingMm * MM_TO_M, cover), radiusOf(r.transverse.diameterMm));
  // Διαμήκεις διανομής: // άξονα στη βάση.
  addRods(group, distributedSegs(f, yBottom, r.longitudinal.count, cover), radiusOf(r.longitudinal.diameterMm));
  if (r.stirrups) {
    addRods(group, stirrupRingSegs(f, bottomY, topY, cover, r.stirrups.spacingMm * MM_TO_M), radiusOf(r.stirrups.diameterMm));
  }
}

function buildTieBeamCage(group: THREE.Group, f: Frame, r: TieBeamReinforcement, bottomY: number, topY: number): void {
  const cover = r.coverMm * MM_TO_M;
  // Κάτω + άνω διαμήκεις ράβδοι // άξονα.
  addRods(group, distributedSegs(f, bottomY + cover, r.bottom.count, cover), radiusOf(r.bottom.diameterMm));
  addRods(group, distributedSegs(f, topY - cover, r.top.count, cover), radiusOf(r.top.diameterMm));
  // Κάθετοι συνδετήρες ανά βήμα.
  addRods(group, stirrupRingSegs(f, bottomY, topY, cover, r.stirrups.spacingMm * MM_TO_M), radiusOf(r.stirrups.diameterMm));
}

/**
 * Χτίζει τον κλωβό οπλισμού ενός θεμελιακού στοιχείου ως `THREE.Group`, ή `null` αν
 * δεν έχει οπλισμό / εκφυλισμένη γεωμετρία. `bottomY` = absolute world Y της βάσης
 * του στερεού (= `mesh.position.y` του `foundationToMesh`).
 */
export function buildFootingRebarCage(
  foundation: FoundationEntity,
  bottomY: number,
  levelId?: string,
): THREE.Group | null {
  const p = foundation.params;
  const r = resolveActiveFootingReinforcementForParams(p);
  if (!r) return null;
  const sceneToM = sceneUnitsToMeters(p.sceneUnits ?? 'mm');
  const verts = scalePoints(foundation.geometry.footprint.vertices, sceneToM);
  const f = frameOf(verts);
  if (!f) return null;
  const topY = bottomY + Math.max(0, p.thicknessMm) * MM_TO_M;

  const group = new THREE.Group();
  if (p.kind === 'pad' && r.kind === 'pad') buildPadCage(group, f, r, bottomY, topY);
  else if (p.kind === 'strip' && r.kind === 'strip') buildStripCage(group, f, r, bottomY, topY);
  else if (p.kind === 'tie-beam' && r.kind === 'tie-beam') buildTieBeamCage(group, f, r, bottomY, topY);

  if (group.children.length === 0) return null;
  group.userData['bimId'] = foundation.id;
  group.userData['bimType'] = 'foundation';
  group.userData['reinforcement'] = true;
  if (levelId !== undefined) group.userData['levelId'] = levelId;
  return group;
}
