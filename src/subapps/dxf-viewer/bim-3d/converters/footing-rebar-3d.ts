/**
 * ADR-463 — 3Δ οπλισμός θεμελίωσης (rebar cage): kind-aware → THREE.Group.
 *
 * Mirror του `column-rebar-3d.ts` αλλά **οριζόντιος** (οι ράβδοι σχάρας τρέχουν
 * στο επίπεδο, όχι κατακόρυφα):
 *   - `pad`      → κάτω σχάρα (X+Y bars, στάθμη bottom+cover) + προαιρετική άνω σχάρα.
 *   - `strip`    → εγκάρσιες + διαμήκεις διανομής (bottom) + προαιρετικοί κάθετοι
 *                  συνδετήρες (vertical rings ανά βήμα).
 *   - `tie-beam` → ΕΙΝΑΙ δοκός (ADR-477): delegate στο beam rebar cage core
 *                  (`buildLinearMemberRebarCage`) → EC8 κρίσιμες ζώνες συνδετήρων.
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
import type { FoundationEntity, TieBeamParams } from '../../bim/types/foundation-types';
import type {
  PadReinforcement,
  StripReinforcement,
  TieBeamReinforcement,
} from '../../bim/structural/reinforcement/footing-reinforcement-types';
import { DEFAULT_STIRRUP_TYPE } from '../../bim/structural/reinforcement/beam-reinforcement-types';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import { scalePoints } from '../../rendering/entities/shared/geometry-vector-utils';
import { resolveActiveFootingReinforcementForParams } from '../../bim/structural/active-footing-reinforcement';
// ADR-477 Slice 2 — η συνδετήρια δοκός τροφοδοτεί το ΙΔΙΟ beam rebar cage core (EC8 ζώνες).
import { buildLinearMemberRebarCage } from './linear-member-rebar-3d';
import { stampBimIdentity } from './bim-three-shape-helpers';
import { tieBeamRebarLayout, tieBeamAxisPoints } from '../../bim/structural/reinforcement/tie-beam-linear-member';
import type { Point2D } from '../../rendering/types/Types';
import {
  MM_TO_M,
  MIN_RADIUS,
  addRods,
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

/**
 * `count` ράβδοι που τρέχουν // along (a0→a1), ισοκατανεμημένες κατά across εντός
 * `usable` (μία στο κέντρο αν count===1, αλλιώς inset cover στα άκρα). Ο κοινός πυρήνας
 * των `matSegs` (βήμα→count) και `distributedSegs` (ρητό count).
 */
function acrossBars(f: Frame, yLevel: number, a0: number, a1: number, count: number, usable: number, coverM: number): Seg[] {
  if (count <= 0) return [];
  const segs: Seg[] = [];
  for (let i = 0; i < count; i++) {
    const c = coverM + (count === 1 ? usable / 2 : (i * usable) / (count - 1));
    segs.push({ a: toThree(planAt(f, a0, c), yLevel), b: toThree(planAt(f, a1, c), yLevel) });
  }
  return segs;
}

/** Οριζόντιες ράβδοι // along (μήκος lenAlong−2cover), βήμα `spacingM` κατά across. */
function matSegs(f: Frame, yLevel: number, spacingM: number, coverM: number): Seg[] {
  const usable = f.lenAcross - 2 * coverM;
  if (usable < 0 || spacingM <= 0) return [];
  const n = Math.max(1, Math.floor(usable / spacingM) + 1);
  return acrossBars(f, yLevel, coverM, f.lenAlong - coverM, n, usable, coverM);
}

/** `count` οριζόντιες ράβδοι // along, ισοκατανεμημένες κατά across (inset cover). */
function distributedSegs(f: Frame, yLevel: number, count: number, coverM: number): Seg[] {
  const usable = Math.max(0, f.lenAcross - 2 * coverM);
  return acrossBars(f, yLevel, coverM, f.lenAlong - coverM, count, usable, coverM);
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

/**
 * ADR-477 Slice 2 — η συνδετήρια δοκός ΕΙΝΑΙ δοκός: χτίζει τον κλωβό μέσω του ΙΔΙΟΥ
 * beam rebar core (`buildLinearMemberRebarCage`) → EC8 κρίσιμες ζώνες συνδετήρων +
 * layered διαμήκεις (πρώην bespoke ομοιόμορφο βήμα — διαγράφηκε, μηδέν duplicate). Ο
 * core παράγει absolute world metres (axisPts canvas × sceneToM) — ίδιο datum με τα
 * pad/strip cages· `bottomY` = κάτω παρειά (centerY = bottomY + βάθος/2). Ο `r` είναι
 * footing-resolved (μεγαλύτερο cover) — δεν ξανα-resolve-άρεται μέσω beam suggester.
 */
function buildTieBeamCage(group: THREE.Group, p: TieBeamParams, r: TieBeamReinforcement, bottomY: number): void {
  const layout = tieBeamRebarLayout(p, r);
  if (!layout) return;
  const cage = buildLinearMemberRebarCage({
    axisPts: tieBeamAxisPoints(p),
    sceneUnits: p.sceneUnits,
    layout,
    stirrupType: r.stirrups.type ?? DEFAULT_STIRRUP_TYPE,
    bottomFaceY: bottomY,
  });
  if (cage) group.add(cage);
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
  else if (p.kind === 'tie-beam' && r.kind === 'tie-beam') buildTieBeamCage(group, p, r, bottomY);

  if (group.children.length === 0) return null;
  stampBimIdentity(group, { bimId: foundation.id, bimType: 'foundation', levelId });
  group.userData['reinforcement'] = true;
  return group;
}
