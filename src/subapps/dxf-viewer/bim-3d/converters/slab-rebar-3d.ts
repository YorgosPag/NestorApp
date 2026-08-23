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
// ADR-794 — ΕΝΑΣ βρόχος για όλους τους χώρους· ο χώρος δηλώνεται ρητά.
import { bboxOf } from '../../bim/geometry/shared/xy-bounds';
import type { PlanRectM } from '../../types/coordinate-space';
import type { PlanarPoint } from '../../bim/types/bim-base';
import { scalePoints } from '../../rendering/entities/shared/geometry-vector-utils';
import { resolveActiveSlabReinforcementForEntity } from '../../bim/structural/active-reinforcement';
import { stampBimIdentity } from './bim-three-shape-helpers';
import {
  MM_TO_M,
  MIN_RADIUS,
  addRods,
  toThree,
  type Seg,
} from './rebar-3d-shared';

/**
 * Το κουτί του outline σε **ΑΠΟΛΥΤΑ ΜΕΤΡΑ** κάτοψης, ή `null` σε εκφυλισμένο πολύγωνο.
 *
 * 🔴 Ο **ίδιος** βρόχος με το SSoT — αλλά ο **χώρος δηλώνεται** (`plan-m`), γιατί ο
 * ρητά «mirror» αδελφός `rebar-segments-3d-grid.ts` τρέχει τον ίδιο υπολογισμό σε
 * **scene units**. Πριν το ADR-794 και οι δύο δήλωναν τον ίδιο ανώνυμο τοπικό τύπο και
 * **κανένα εργαλείο δεν μπορούσε να τους ξεχωρίσει** — η ίδια κατηγορία με το σφάλμα
 * 1000× του ADR-793.
 */
function outlineRectM(verts: readonly PlanarPoint[]): PlanRectM | null {
  if (verts.length < 3) return null;
  return bboxOf<'plan-m'>(verts);
}

function radiusOf(diameterMm: number): number {
  return Math.max(MIN_RADIUS, (diameterMm / 2) * MM_TO_M);
}

/**
 * Οριζόντιες ράβδοι σε στάθμη `yLevel` εντός του bbox − cover, βήμα `spacingM`.
 * `dir='x'`: ράβδοι // X (σταθερό plan-Y), βήμα κατά Y· `dir='y'`: το κατοπτρικό.
 */
function bboxBars(bb: PlanRectM, yLevel: number, spacingM: number, coverM: number, dir: 'x' | 'y'): Seg[] {
  const x0 = bb.minX + coverM, x1 = bb.maxX - coverM;
  const y0 = bb.minY + coverM, y1 = bb.maxY - coverM;
  if (x1 <= x0 || y1 <= y0 || spacingM <= 0) return [];
  const segs: Seg[] = [];
  if (dir === 'x') {
    for (let y = y0; y <= y1 + 1e-9; y += spacingM) {
      segs.push({ a: toThree({ x: x0, y }, yLevel), b: toThree({ x: x1, y }, yLevel) });
    }
  } else {
    for (let x = x0; x <= x1 + 1e-9; x += spacingM) {
      segs.push({ a: toThree({ x, y: y0 }, yLevel), b: toThree({ x, y: y1 }, yLevel) });
    }
  }
  return segs;
}

/** Μία δι-διευθυντική σχάρα (X+Y) σε στάθμη `yLevel`. */
function addMesh(group: THREE.Group, bb: PlanRectM, yLevel: number, meshX: RebarMesh, meshY: RebarMesh, coverM: number): void {
  addRods(group, bboxBars(bb, yLevel, meshX.spacingMm * MM_TO_M, coverM, 'x'), radiusOf(meshX.diameterMm));
  addRods(group, bboxBars(bb, yLevel, meshY.spacingMm * MM_TO_M, coverM, 'y'), radiusOf(meshY.diameterMm));
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
  const bb = outlineRectM(verts);
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
  stampBimIdentity(group, { bimId: slab.id, bimType: 'slab', levelId });
  group.userData['reinforcement'] = true;
  return group;
}
