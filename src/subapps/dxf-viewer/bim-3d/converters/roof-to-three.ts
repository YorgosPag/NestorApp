/**
 * roof-to-three — ADR-417. Pure converter: `RoofEntity` → `THREE.Group`.
 *
 * Χτίζει 3D στερεό κατάστρωμα (deck) στέγης από τα κεκλιμένα «νερά» (faces) της
 * `RoofGeometry`. Κάθε face παράγει ένα πλήρες solid: ανώτατη επιφάνεια ακολουθεί
 * την κλίση, κατώτατη = ίδιο πολύγωνο μετατοπισμένο κατά `thickness` προς τα κάτω
 * (global Z — σταθερό κατακόρυφο πάχος, Φ1 acceptable), πλευρές = quads περιμέτρου.
 *
 * **UNITS-SAFE** (pattern από `railing-to-three.ts`, ΟΧΙ `fixtureToMesh`):
 *   - canvas-unit XY  → μέτρα via `sceneUnitsToMeters(units)`
 *   - mm Z / thickness → μέτρα via `MM_TO_M`
 *   Σωστό για mm / cm / m scenes.
 *
 * Axis convention (ίδιο με BimToThreeConverter, column-piece-geometry, railing):
 *   DXF plan: X = East, Y = North
 *   Three.js world (Y-up, μέτρα): x = East, y = Up, z = -North
 *
 * Τριγωνοποίηση: `THREE.ShapeUtils.triangulateShape` (ίδιο με column-piece-geometry.ts
 * — concave-safe ear-clip, γνωστό pattern στο codebase).
 *
 * Υλικό: `getElementMaterial3D('slab')` — concrete deck fallback για Φ1·
 * η DNA/τύπος υλικού επεκτείνεται σε Φ2 (per-layer).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md
 * @see railing-to-three.ts     — units-safe pattern (ΟΧΙ fixtureToMesh)
 * @see column-piece-geometry.ts — triangulateShape + prism solid SSoT
 */

import * as THREE from 'three';
import type { RoofEntity, RoofFace } from '../../bim/types/roof-types';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import { getElementMaterial3D } from '../materials/MaterialCatalog3D';

const MM_TO_M = 0.001;

// ─── Vertex helpers ───────────────────────────────────────────────────────────

/** canvas-unit XY + mm Z → Three.js world position (m, Y-up, z = -North). */
function toWorld(
  x: number,
  y: number,
  zMm: number,
  sceneToM: number,
): THREE.Vector3 {
  return new THREE.Vector3(x * sceneToM, zMm * MM_TO_M, -y * sceneToM);
}

// ─── Per-face solid ───────────────────────────────────────────────────────────

/** Top + bottom world rings for a face (bottom = top offset down by thickness). */
function buildFaceRings(
  face: RoofFace,
  thicknessMm: number,
  sceneToM: number,
  baseElevationM: number,
): { top: THREE.Vector3[]; bot: THREE.Vector3[] } {
  const top: THREE.Vector3[] = [];
  const bot: THREE.Vector3[] = [];
  for (const v of face.outline) {
    const zMm = v.z ?? 0;
    const t = toWorld(v.x, v.y, zMm, sceneToM);
    const b = toWorld(v.x, v.y, zMm - thicknessMm, sceneToM);
    t.y += baseElevationM;
    b.y += baseElevationM;
    top.push(t);
    bot.push(b);
  }
  return { top, bot };
}

/** Pack 2n world positions: [0..n) top ring, [n..2n) bottom ring. */
function packRingPositions(top: THREE.Vector3[], bot: THREE.Vector3[]): Float32Array {
  const n = top.length;
  const positions = new Float32Array(2 * n * 3);
  for (let i = 0; i < n; i++) {
    positions[i * 3] = top[i].x; positions[i * 3 + 1] = top[i].y; positions[i * 3 + 2] = top[i].z;
    positions[(n + i) * 3] = bot[i].x; positions[(n + i) * 3 + 1] = bot[i].y; positions[(n + i) * 3 + 2] = bot[i].z;
  }
  return positions;
}

/**
 * Triangle index for the prism: top cap (+Y), bottom cap (−Y, reversed) +
 * perimeter side quads. Winding mirrors `column-piece-geometry.ts`. Caps are
 * triangulated in the (x, z) plan plane (world z = −North; CCW canvas stays CCW).
 */
function buildPrismIndex(top: THREE.Vector3[]): number[] {
  const n = top.length;
  const index: number[] = [];
  const contour2d = top.map((p) => new THREE.Vector2(p.x, p.z));
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour2d, [])) {
    index.push(n + a, n + c, n + b); // bottom cap (reversed — faces down)
    index.push(a, b, c);             // top cap (direct — faces up/outward)
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    index.push(n + i, n + j, j);
    index.push(n + i, j, i);
  }
  return index;
}

/**
 * Builds a thin sloped deck solid for ONE roof face. Top ring follows the slope,
 * bottom ring offset down by `thicknessM` (constant vertical, Φ1). Returns null
 * for a degenerate (< 3 vertex) outline.
 */
function buildFaceSolid(
  face: RoofFace,
  thicknessM: number,
  sceneToM: number,
  buildingBaseElevationM: number,
): THREE.BufferGeometry | null {
  if (face.outline.length < 3) return null;
  const { top, bot } = buildFaceRings(face, thicknessM / MM_TO_M, sceneToM, buildingBaseElevationM);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(packRingPositions(top, bot), 3));
  geo.setIndex(buildPrismIndex(top));
  // toNonIndexed → per-face flat normals (mirror of column-piece-geometry.ts).
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

// ─── Tag helper ──────────────────────────────────────────────────────────────

function tagRoofMesh(
  mesh: THREE.Mesh,
  id: string,
  levelId?: string,
): void {
  mesh.userData['bimId'] = id;
  mesh.userData['bimType'] = 'roof';
  mesh.userData['matId'] = 'elem-slab';
  if (levelId !== undefined) mesh.userData['levelId'] = levelId;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * ADR-417 — sloped roof entity → `THREE.Group` (one mesh per face / «νερό»).
 * Returns null for degenerate roof (no faces, or all faces < 3 vertices).
 *
 * @param roof             The RoofEntity (must carry computed `geometry`).
 * @param levelId          Optional storey ID — forwarded to userData for picking.
 * @param buildingBaseElevationM  World Y offset of the building origin (m).
 *                                Applies uniformly to all Z values (mirrors railing).
 */
export function roofToMesh(
  roof: RoofEntity,
  levelId?: string,
  buildingBaseElevationM = 0,
): THREE.Group | null {
  if (!roof.geometry || roof.geometry.faces.length === 0) return null;

  const sceneToM = sceneUnitsToMeters(roof.params.sceneUnits ?? 'mm');
  const thicknessM = roof.params.thickness * MM_TO_M;
  const material = getElementMaterial3D('slab');

  const group = new THREE.Group();

  for (const face of roof.geometry.faces) {
    const geo = buildFaceSolid(face, thicknessM, sceneToM, buildingBaseElevationM);
    if (!geo) continue;

    const mesh = new THREE.Mesh(geo, material);
    tagRoofMesh(mesh, roof.id, levelId);
    group.add(mesh);
  }

  if (group.children.length === 0) return null;

  group.userData['bimId'] = roof.id;
  group.userData['bimType'] = 'roof';
  if (levelId !== undefined) group.userData['levelId'] = levelId;
  return group;
}
