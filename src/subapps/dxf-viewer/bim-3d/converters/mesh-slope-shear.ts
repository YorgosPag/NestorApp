/**
 * mesh-slope-shear.ts — per-vertex slope/tilt shear για BIM 3D meshes.
 *
 * Εξήχθη από `BimToThreeConverter.ts` (ADR-404 P1 — file-size split, N.7.1).
 * Συγκεντρώνει τις πέντε «εφάρμοσε κλίση σε ένα extruded BufferGeometry»
 * συναρτήσεις, ώστε ο converter να μένει < 500 γρ. και η λογική κλίσης να έχει
 * ΕΝΑ σπίτι (SSoT):
 *
 *   - **Οριζόντια στοιχεία** (δοκάρι/πλάκα) → shear του **world-Y** βάσει plan-θέσης
 *     (`applyBeamSlope`/`applySlabSlope`, ADR-401).
 *   - **Κατακόρυφα στοιχεία** (κολώνα/τοίχος) → shear του **world X/Z** βάσει ύψους
 *     (`applyColumnTilt`/`applyWallTilt`, ADR-404).
 *
 * Όλες οι συναρτήσεις είναι **no-op fast-path** όταν δεν υπάρχει κλίση και δουλεύουν
 * σε coords **μετά** το `ROT_X_NEG_90` του `extrudeAndRotate`: `shape(sx, sy) →
 * world(sx, z, −sy)`, άρα plan-point = `{x: worldX, y: −worldZ}` και η ανύψωση =
 * `pos.getY(i)`.
 *
 * @see ../../bim/geometry/beam-slope.ts / slab-slope.ts / column-tilt.ts / wall-tilt.ts (SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-404-3d-bim-element-tilt.md
 */

import * as THREE from 'three';
import type { WallEntity } from '../../bim/types/wall-types';
import type { ColumnEntity } from '../../bim/types/column-types';
import type { BeamEntity } from '../../bim/types/beam-types';
import type { SlabParams } from '../../bim/types/slab-types';
import { slabSlopeOffsetZmm } from '../../bim/geometry/slab-slope';
import { beamSlopeOffsetZmm, isBeamTilted } from '../../bim/geometry/beam-slope';
import { columnTiltShearAt, isColumnTilted } from '../../bim/geometry/column-tilt';
import { wallTiltShearAt, isWallTilted } from '../../bim/geometry/wall-tilt';

/** mm → world-metres (ίδιο factor με `BimToThreeConverter`). */
const MM_TO_M = 0.001;

/**
 * ADR-404 — 3Δ κλίση κολώνας/τοίχου (raking/battered) ως **οριζόντιο shear**:
 * αντίθετα από beam/slab (που shear-άρουν το world-Y βάσει plan-θέσης), τα
 * **κατακόρυφα** στοιχεία shear-άρουν το world X/Z **βάσει του ύψους** (`pos.getY`)
 * → η κορυφή γέρνει, η βάση μένει. Coords μετά το ROT_X_NEG_90: shape(sx,sy) →
 * world(sx, z, −sy), άρα plan→world: `worldX += dx`, `worldZ += −dy`. Το
 * `heightAboveBase = pos.getY(i)` είναι world-metres → το SSoT επιστρέφει την ίδια
 * μονάδα (unit-safe). `pos.getY(0 στη βάση)` → μηδέν → η βάση μένει αγκυρωμένη.
 */
function applyHorizontalTiltShear(
  geo: THREE.BufferGeometry,
  shearAt: (heightM: number) => { readonly dx: number; readonly dy: number },
): void {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const { dx, dy } = shearAt(pos.getY(i));
    pos.setX(i, pos.getX(i) + dx);
    pos.setZ(i, pos.getZ(i) - dy);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

/** Raking column shear (flat solid path only — attached prism path = follow-up). */
export function applyColumnTilt(geo: THREE.BufferGeometry, params: ColumnEntity['params']): void {
  if (!isColumnTilted(params)) return;
  applyHorizontalTiltShear(geo, (h) => columnTiltShearAt(params, h));
}

/** Battered wall shear (flat solid path only — pieces/attached path = follow-up). */
export function applyWallTilt(geo: THREE.BufferGeometry, params: WallEntity['params']): void {
  if (!isWallTilted(params)) return;
  applyHorizontalTiltShear(geo, (h) => wallTiltShearAt(params, h));
}

/**
 * ADR-401 Phase E/(β) — κεκλιμένη δοκός (sloped beam).
 *
 * Καθρέφτης του `applySlabSlope`: η πάνω παρειά γέρνει γραμμικά κατά μήκος του
 * άξονα (`topElevation`→`topElevationEnd`) → per-vertex shear στο world-Y που
 * καταναλώνει το `beamSlopeOffsetZmm` SSoT (την ΙΔΙΑ ποσότητα με τον
 * `wall-top-profile` resolver → ο attached τοίχος εφάπτεται). Top & bottom face
 * γέρνουν ίσα → σταθερό βάθος. Flat (μη-tilted) → no-op fast-path.
 *
 * Coords είναι μετα-rotation (ROT_X_NEG_90): shape(sx,sy) → world(sx, z, −sy),
 * άρα plan-point = `{x: worldX, y: −worldZ}`. Το offset (mm) × MM_TO_M δίνει
 * world-meters. Στο `startPoint` (f=0) → offset 0 → η `mesh.position.y`
 * (nominal, top-at-start) μένει αμετάβλητη· στο `endPoint` (f=1) → +Δ.
 */
export function applyBeamSlope(geo: THREE.BufferGeometry, params: BeamEntity['params']): void {
  if (!isBeamTilted(params)) return;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const sx = pos.getX(i);
    const sy = -pos.getZ(i);
    const offsetM = beamSlopeOffsetZmm(params, { x: sx, y: sy }) * MM_TO_M;
    pos.setY(i, pos.getY(i) + offsetM);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

/**
 * ADR-401 Phase E2 / ADR-369 §9 Q7 — κεκλιμένη πλάκα/στέγη (tilted).
 *
 * Η κλίση είναι **ένα affine επίπεδο** → η επίπεδη extruded πλάκα γίνεται
 * κεκλιμένο prism με per-vertex shear στο world-Y, καταναλώνοντας το
 * `slabSlopeOffsetZmm` SSoT (την ΙΔΙΑ ποσότητα με τον `wall-top-profile`
 * resolver → ο attached τοίχος εφάπτεται). Top & bottom face γέρνουν ίσα →
 * σταθερό πάχος· holes/openings διατηρούνται (shear στα κοινά vertices).
 *
 * Coords είναι μετα-rotation (ROT_X_NEG_90): shape(sx,sy) → world(sx, z, −sy),
 * άρα plan-point = `{x: worldX, y: −worldZ}`. Το offset (mm) × MM_TO_M δίνει
 * world-meters (ίδια μετατροπή με τον τοίχο). Pivot offset = 0 → η πλάκα γέρνει
 * γύρω από το pivot, η `mesh.position.y` (nominal) μένει αμετάβλητη.
 * `geometryType !== 'tilted'` → no-op fast-path (byte-for-byte η επίπεδη πλάκα).
 */
export function applySlabSlope(geo: THREE.BufferGeometry, params: SlabParams): void {
  if (params.geometryType !== 'tilted' || !params.slope) return;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const sx = pos.getX(i);
    const sy = -pos.getZ(i);
    const offsetM = slabSlopeOffsetZmm(params, { x: sx, y: sy }) * MM_TO_M;
    pos.setY(i, pos.getY(i) + offsetM);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}
