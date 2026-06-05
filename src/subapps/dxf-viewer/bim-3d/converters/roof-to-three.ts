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
import type { RoofEntity, RoofFace, RoofRidgeLine } from '../../bim/types/roof-types';
import type { SlabDnaLayer } from '../../bim/types/slab-dna-types';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import { getElementMaterial3D, getMaterial3D } from '../materials/MaterialCatalog3D';
import { setBoxWorldUvs } from './bim-uv-helpers';
import { toWorld } from './roof-world-transform';
import { buildRoundedRidgeCap, findAdjacentFaces } from './roof-ridge-cap';

/** ADR-417 — clay ridge/hip caps («κορφιάδες») use the roof-tile material. */
const RIDGE_CAP_MATERIAL_ID = 'mat-roof-tile';

// ─── Per-face solid ───────────────────────────────────────────────────────────

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
 * One face DNA-layer sub-solid: its geometry + the materialId to paint it with.
 * The perimeter (side quads) of each layer shows ITS material → the roof edge
 * reveals the layered stack (Revit «Fine» — full realism), exactly like the
 * per-DNA-layer wall sub-solids (ADR-413).
 */
interface RoofLayerSolid {
  readonly geo: THREE.BufferGeometry;
  readonly materialId: string;
}

/**
 * Builds ONE prism for a face between two vertical DEPTHS below the top surface
 * (mm). `topDepthMm`/`botDepthMm` are measured down from each vertex's own slope
 * z, so the prism stays parallel to the slope. Null for a degenerate (<3) outline.
 */
function buildDepthPrism(
  face: RoofFace,
  topDepthMm: number,
  botDepthMm: number,
  sceneToM: number,
  baseElevationM: number,
): THREE.BufferGeometry | null {
  if (face.outline.length < 3) return null;
  const top: THREE.Vector3[] = [];
  const bot: THREE.Vector3[] = [];
  for (const v of face.outline) {
    const zMm = v.z ?? 0;
    const t = toWorld(v.x, v.y, zMm - topDepthMm, sceneToM); t.y += baseElevationM;
    const b = toWorld(v.x, v.y, zMm - botDepthMm, sceneToM); b.y += baseElevationM;
    top.push(t);
    bot.push(b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(packRingPositions(top, bot), 3));
  geo.setIndex(buildPrismIndex(top));
  // toNonIndexed → per-face flat normals (mirror of column-piece-geometry.ts).
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  // ADR-413/417 — per-face world-meter UVs so the PBR sets tile physically + uv2.
  setBoxWorldUvs(flat);
  return flat;
}

/**
 * Slice a face into its DNA layers (top→bottom), each a sub-prism with its own
 * material. The cumulative vertical depth walks down from the top surface; the
 * layer thicknesses sum to the roof thickness (`dna.totalThickness`).
 */
function buildFaceLayerSolids(
  face: RoofFace,
  layers: readonly SlabDnaLayer[],
  sceneToM: number,
  baseElevationM: number,
): RoofLayerSolid[] {
  const out: RoofLayerSolid[] = [];
  let topDepthMm = 0;
  for (const layer of layers) {
    const botDepthMm = topDepthMm + layer.thickness;
    const geo = buildDepthPrism(face, topDepthMm, botDepthMm, sceneToM, baseElevationM);
    if (geo) out.push({ geo, materialId: layer.materialId });
    topDepthMm = botDepthMm;
  }
  return out;
}

// ─── Material resolution ───────────────────────────────────────────────────────

/**
 * ADR-417 — the visible roof-surface material id. The roof «νερά» show their
 * COVERING = the outermost (top) DNA layer (Revit: a roof's appearance is its top
 * finish — κεραμίδι/μεμβράνη). Falls back to the monolithic `material` library id,
 * then to the generic `elem-roof` clay default when neither is present.
 */
function resolveRoofSurfaceMaterialId(roof: RoofEntity): string | null {
  const topLayer = roof.params.dna?.layers[0]?.materialId;
  if (topLayer) return topLayer;
  if (roof.params.material) return roof.params.material;
  return null;
}

// ─── Tag helper ──────────────────────────────────────────────────────────────

function tagRoofMesh(
  mesh: THREE.Mesh,
  id: string,
  matId: string,
  levelId?: string,
): void {
  mesh.userData['bimId'] = id;
  mesh.userData['bimType'] = 'roof';
  mesh.userData['matId'] = matId;
  if (levelId !== undefined) mesh.userData['levelId'] = levelId;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
}

// ─── Per-face emission ──────────────────────────────────────────────────────────

interface RoofFaceMeshContext {
  readonly roofId: string;
  /** DNA layers (top→bottom) for per-layer realism, or null for a monolithic deck. */
  readonly layers: readonly SlabDnaLayer[] | null;
  /** Monolithic surface material id (no DNA) — null → generic `elem-roof`. */
  readonly monoMaterialId: string | null;
  readonly thicknessMm: number;
  readonly sceneToM: number;
  readonly baseElevationM: number;
  readonly levelId?: string;
}

/**
 * Emit the meshes for ONE face. With a DNA build-up → one sub-solid PER LAYER,
 * each painted with its layer material (Revit «Fine» — the perimeter edge reveals
 * the layered stack, full realism). Without DNA → a single monolithic solid. All
 * meshes carry the roof id, so picking any layer selects the whole roof.
 */
function addFaceMeshes(group: THREE.Group, face: RoofFace, ctx: RoofFaceMeshContext): void {
  if (ctx.layers) {
    for (const ls of buildFaceLayerSolids(face, ctx.layers, ctx.sceneToM, ctx.baseElevationM)) {
      const mesh = new THREE.Mesh(ls.geo, getMaterial3D(ls.materialId));
      tagRoofMesh(mesh, ctx.roofId, ls.materialId, ctx.levelId);
      group.add(mesh);
    }
    return;
  }
  const geo = buildDepthPrism(face, 0, ctx.thicknessMm, ctx.sceneToM, ctx.baseElevationM);
  if (!geo) return;
  const mat = ctx.monoMaterialId ? getMaterial3D(ctx.monoMaterialId) : getElementMaterial3D('roof');
  const mesh = new THREE.Mesh(geo, mat);
  tagRoofMesh(mesh, ctx.roofId, ctx.monoMaterialId ?? 'elem-roof', ctx.levelId);
  group.add(mesh);
}

/**
 * Emit the clay ridge/hip cap meshes («κορφιάδες») straddling the roof's ridge +
 * hip lines (eave/valley lines get no cap). All carry the roof id for picking.
 */
function addRidgeCaps(
  group: THREE.Group,
  ridges: readonly RoofRidgeLine[],
  faces: readonly RoofFace[],
  ctx: RoofFaceMeshContext,
): void {
  for (const line of ridges) {
    if (line.kind !== 'ridge' && line.kind !== 'hip') continue;
    const cap = buildRoundedRidgeCap(line, findAdjacentFaces(line, faces), ctx.sceneToM, ctx.baseElevationM);
    if (!cap) continue;
    const mesh = new THREE.Mesh(cap, getMaterial3D(RIDGE_CAP_MATERIAL_ID));
    tagRoofMesh(mesh, ctx.roofId, RIDGE_CAP_MATERIAL_ID, ctx.levelId);
    group.add(mesh);
  }
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

  const layers = roof.params.dna?.layers ?? null;
  const ctx: RoofFaceMeshContext = {
    roofId: roof.id,
    layers: layers && layers.length > 0 ? layers : null,
    monoMaterialId: resolveRoofSurfaceMaterialId(roof),
    thicknessMm: roof.params.thickness,
    sceneToM: sceneUnitsToMeters(roof.params.sceneUnits ?? 'mm'),
    baseElevationM: buildingBaseElevationM,
    levelId,
  };

  const group = new THREE.Group();
  for (const face of roof.geometry.faces) addFaceMeshes(group, face, ctx);
  addRidgeCaps(group, roof.geometry.ridges, roof.geometry.faces, ctx); // κορφιάδες on ridge + hip lines

  if (group.children.length === 0) return null;

  group.userData['bimId'] = roof.id;
  group.userData['bimType'] = 'roof';
  if (levelId !== undefined) group.userData['levelId'] = levelId;
  return group;
}
