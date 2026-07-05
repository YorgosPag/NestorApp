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
import { sceneUnitsToMeters } from '../../utils/scene-units';

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
/**
 * `baseHeightM` (ADR-404 — pieces/prism path): floor-local ύψος της **βάσης** του
 * geometry (Y=0) πάνω από το pivot της κλίσης. Στον **solid path** το geometry Y=0
 * είναι ήδη στη βάση του στοιχείου → `baseHeightM = 0` (default, byte-for-byte).
 * Στον **pieces/prism path** το geometry ζει σε floor-local Y και το mesh ανεβαίνει
 * κατά `mesh.position.y = yOffset`· εκεί `baseHeightM = yOffset − floorY`, ώστε το
 * `heightAboveBase = pos.getY(i) + baseHeightM` να είναι το πραγματικό ύψος πάνω από
 * τη βάση (anchor=0 στο FFL — ίδιο datum με το 2Δ cut-plane & τον solid path).
 */
function applyHorizontalTiltShear(
  geo: THREE.BufferGeometry,
  shearAt: (heightM: number) => { readonly dx: number; readonly dy: number },
  baseHeightM = 0,
): void {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const { dx, dy } = shearAt(pos.getY(i) + baseHeightM);
    pos.setX(i, pos.getX(i) + dx);
    pos.setZ(i, pos.getZ(i) - dy);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

/**
 * ADR-404 — the world-space `Matrix4` FORM of {@link applyHorizontalTiltShear}, and its SSoT sibling.
 *
 * When the shear is LINEAR in height (`shearAt(h) = h · shearAt(1)` — exactly the case for
 * wall/column tilt: `mag = h·tan(angle)`), the whole per-vertex transform collapses into ONE shear
 * matrix. Use it to tilt a POSITIONED / ORIENTED `Object3D` (e.g. an opening body: a group with its
 * own basis + placement) WITHOUT mutating geometry — the per-vertex applier can't reach a rotated
 * child frame. IDENTICAL convention to `applyHorizontalTiltShear` (worldX += dx, worldZ += −dy) with
 * the base anchored at `floorY` (`heightAboveBase = worldY − floorY`, so the base stays put).
 *
 * ⚠️ Valid ONLY for a linear `shearAt` (a single matrix cannot express a non-linear height-shear —
 * for those use the per-vertex {@link applyHorizontalTiltShear}). Reuse the amount SSoT
 * (`wallTiltShearAt` / `columnTiltShearAt`) for `shearAt` — never re-derive the tilt maths here.
 */
export function horizontalTiltShearMatrix(
  shearAt: (heightM: number) => { readonly dx: number; readonly dy: number },
  floorY = 0,
): THREE.Matrix4 {
  const { dx, dy } = shearAt(1); // per-unit-height shift (linear → exact for any height)
  return new THREE.Matrix4().set(
    1, dx, 0, -dx * floorY,
    0, 1, 0, 0,
    0, -dy, 1, dy * floorY,
    0, 0, 0, 1,
  );
}

/**
 * Raking column shear. `baseHeightM` (default 0 = solid path· >0 = attached prism /
 * pieces piece το οποίο ζει σε floor-local Y, βλ. `applyHorizontalTiltShear`).
 */
export function applyColumnTilt(
  geo: THREE.BufferGeometry,
  params: ColumnEntity['params'],
  baseHeightM = 0,
): void {
  if (!isColumnTilted(params)) return;
  applyHorizontalTiltShear(geo, (h) => columnTiltShearAt(params, h), baseHeightM);
}

/**
 * ADR-404 Bug A — εφαρμόζει το ΙΔΙΟ raking-column shear σε ένα σύνολο 3Δ **σημείων**
 * (`THREE.Vector3`), αντί για BufferGeometry. Το χρειάζονται meshes που ΔΕΝ έχουν
 * shearable position buffer — π.χ. ο κλωβός οπλισμού (`column-rebar-3d`), που είναι
 * InstancedMesh χτισμένος από segment endpoints. Καταναλώνει τον ΙΔΙΟ shear SSoT
 * (`columnTiltShearAt`) + την ίδια ROT_X_NEG_90 σύμβαση (`worldX += dx`, `worldZ += −dy`)
 * με το `applyHorizontalTiltShear` — μηδέν διπλή μαθηματική πηγή.
 *
 * `baseY` = world-Y datum της βάσης της κολώνας → ύψος-πάνω-από-βάση = `p.y − baseY`
 * (world metres, ίδια μονάδα με το shift → unit-safe). **Dedup by reference**: κοινά
 * endpoints (π.χ. αλυσίδα `spiralSegments` όπου `seg[i].b === seg[i+1].a`) shear-άρονται
 * ΜΙΑ φορά. No-op fast-path όταν η κολώνα δεν είναι κεκλιμένη.
 */
export function applyColumnTiltToPoints(
  points: Iterable<THREE.Vector3>,
  params: ColumnEntity['params'],
  baseY: number,
): void {
  if (!isColumnTilted(params)) return;
  const seen = new Set<THREE.Vector3>();
  for (const p of points) {
    if (seen.has(p)) continue;
    seen.add(p);
    const { dx, dy } = columnTiltShearAt(params, p.y - baseY);
    p.x += dx;
    p.z -= dy;
  }
}

/**
 * Battered wall shear. `baseHeightM` (default 0 = solid path· >0 = piece το οποίο
 * ξεκινά ψηλότερα στο floor-local Y, π.χ. πρέκι/wedge, βλ. `applyHorizontalTiltShear`).
 */
export function applyWallTilt(
  geo: THREE.BufferGeometry,
  params: WallEntity['params'],
  baseHeightM = 0,
): void {
  if (!isWallTilted(params)) return;
  applyHorizontalTiltShear(geo, (h) => wallTiltShearAt(params, h), baseHeightM);
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
  // ADR-462 — δεν χρειάζεται μετατροπή των plan coords: το `beamSlopeOffsetZmm` είναι
  // scale-invariant (αδιάστατο κλάσμα κατά μήκος του άξονα), άρα δουλεύει είτε το XZ
  // είναι σε μέτρα είτε σε canvas units. (Αντίθετα το slab-slope — δες `applySlabSlope`.)
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
  // ADR-462 — μετά το canonical-mm scaling το geometry XZ είναι σε ΜΕΤΡΑ. Το
  // `slabSlopeOffsetZmm` ΔΕΝ είναι scale-invariant (περιμένει plan coords στις
  // μονάδες του `params.outline` = canvas/mm)· οπότε μετατρέπουμε πίσω σε canvas
  // units (÷ sceneToM) ΠΡΙΝ το lookup. (Αντίθετα το `beamSlopeOffsetZmm` είναι
  // scale-invariant — δες `applyBeamSlope`.)
  const sceneToM = sceneUnitsToMeters(params.sceneUnits ?? 'mm');
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const sx = pos.getX(i) / sceneToM;
    const sy = -pos.getZ(i) / sceneToM;
    const offsetM = slabSlopeOffsetZmm(params, { x: sx, y: sy }) * MM_TO_M;
    pos.setY(i, pos.getY(i) + offsetM);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}
