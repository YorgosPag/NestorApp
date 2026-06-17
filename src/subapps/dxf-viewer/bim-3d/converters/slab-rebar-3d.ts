/**
 * ADR-476 — 3Δ οπλισμός πλάκας (rebar cage): universal → THREE.Group.
 *
 * Mirror του `footing-rebar-3d.ts` (οριζόντιες σχάρες), για ΟΛΑ τα είδη πλάκας
 * (εδαφόπλακα + αναρτημένη): δι-διευθυντική **κάτω** σχάρα (στάθμη bottom+cover) +
 * **άνω** σχάρα (στάθμη top−cover). Οι ράβδοι εκτείνονται στο bbox του outline − cover
 * (πλακοειδής σύμβαση — μικρή υπέρβαση σε μη-ορθογώνια πλάκα αμελητέα σε 3Δ).
 *
 * ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΕΙ τα shared primitives (`buildRods` InstancedMesh, `REBAR_MATERIAL`
 * singleton, `toThree` AXIS_FLIP, `MM_TO_M`) — μηδέν duplicate (N.0.2). `bottomY` =
 * absolute world Y της κάτω παρειάς (= `mesh.position.y` του `slabToMesh`, μέσω
 * `hangDownMeshY`). auto-aware: re-derive από την τρέχουσα γεωμετρία.
 *
 * @see ./footing-rebar-3d.ts — ο δίδυμος του πεδίλου (mesh cage SSoT pattern)
 * @see ./rebar-3d-shared.ts — τα shared primitives
 * @see docs/centralized-systems/reference/adrs/ADR-476-unified-slab-reinforcement.md
 */

import * as THREE from 'three';
import type { SlabEntity } from '../../bim/types/slab-types';
import type { RebarMesh } from '../../bim/structural/reinforcement/slab-foundation-reinforcement-types';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import { scalePoints } from '../../rendering/entities/shared/geometry-vector-utils';
import { resolveActiveSlabReinforcementForEntity } from '../../bim/structural/active-reinforcement';
import {
  MM_TO_M,
  MIN_RADIUS,
  REBAR_MATERIAL,
  buildRods,
  toThree,
  type Seg,
} from './rebar-3d-shared';

/** Axis-aligned bbox σε absolute world-metre plan coords. */
interface Bbox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

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

function radiusOf(diameterMm: number): number {
  return Math.max(MIN_RADIUS, (diameterMm / 2) * MM_TO_M);
}

/** Οριζόντιες ράβδοι // X (constant plan-Y), βήμα `spacingM` κατά Y, inset cover. */
function barsAlongX(bb: Bbox, yLevel: number, spacingM: number, coverM: number): Seg[] {
  const x0 = bb.minX + coverM, x1 = bb.maxX - coverM;
  const y0 = bb.minY + coverM, y1 = bb.maxY - coverM;
  if (x1 <= x0 || y1 <= y0 || spacingM <= 0) return [];
  const segs: Seg[] = [];
  for (let y = y0; y <= y1 + 1e-9; y += spacingM) {
    segs.push({ a: toThree({ x: x0, y }, yLevel), b: toThree({ x: x1, y }, yLevel) });
  }
  return segs;
}

/** Οριζόντιες ράβδοι // Y (constant plan-X), βήμα `spacingM` κατά X, inset cover. */
function barsAlongY(bb: Bbox, yLevel: number, spacingM: number, coverM: number): Seg[] {
  const x0 = bb.minX + coverM, x1 = bb.maxX - coverM;
  const y0 = bb.minY + coverM, y1 = bb.maxY - coverM;
  if (x1 <= x0 || y1 <= y0 || spacingM <= 0) return [];
  const segs: Seg[] = [];
  for (let x = x0; x <= x1 + 1e-9; x += spacingM) {
    segs.push({ a: toThree({ x, y: y0 }, yLevel), b: toThree({ x, y: y1 }, yLevel) });
  }
  return segs;
}

function addRods(group: THREE.Group, segs: readonly Seg[], radius: number): void {
  const mesh = buildRods(segs, radius, REBAR_MATERIAL);
  if (mesh) group.add(mesh);
}

/** Μία δι-διευθυντική σχάρα (X+Y) σε στάθμη `yLevel`. */
function addMesh(group: THREE.Group, bb: Bbox, yLevel: number, meshX: RebarMesh, meshY: RebarMesh, coverM: number): void {
  addRods(group, barsAlongX(bb, yLevel, meshX.spacingMm * MM_TO_M, coverM), radiusOf(meshX.diameterMm));
  addRods(group, barsAlongY(bb, yLevel, meshY.spacingMm * MM_TO_M, coverM), radiusOf(meshY.diameterMm));
}

/**
 * Χτίζει τον κλωβό οπλισμού μιας πλάκας ως `THREE.Group`, ή `null` αν δεν έχει
 * οπλισμό / εκφυλισμένη γεωμετρία. `bottomY` = absolute world Y της κάτω παρειάς
 * (= `mesh.position.y` του `slabToMesh`).
 */
export function buildSlabRebarCage(
  slab: SlabEntity,
  bottomY: number,
  levelId?: string,
): THREE.Group | null {
  const r = resolveActiveSlabReinforcementForEntity(slab);
  if (!r) return null;
  const sceneToM = sceneUnitsToMeters(slab.params.sceneUnits ?? 'mm');
  const verts = scalePoints(slab.params.outline.vertices, sceneToM);
  const bb = bboxOf(verts);
  if (!bb) return null;
  const cover = r.coverMm * MM_TO_M;
  const thicknessM = Math.max(0, slab.params.thickness) * MM_TO_M;
  const yBottom = bottomY + cover;
  const yTop = bottomY + thicknessM - cover;
  if (yTop <= yBottom) return null;

  const group = new THREE.Group();
  addMesh(group, bb, yBottom, r.bottomMeshX, r.bottomMeshY, cover);
  addMesh(group, bb, yTop, r.topMeshX, r.topMeshY, cover);

  if (group.children.length === 0) return null;
  group.userData['bimId'] = slab.id;
  group.userData['bimType'] = 'slab';
  group.userData['reinforcement'] = true;
  if (levelId !== undefined) group.userData['levelId'] = levelId;
  return group;
}
