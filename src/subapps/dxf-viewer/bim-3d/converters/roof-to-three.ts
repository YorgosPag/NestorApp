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
import type { Point3D } from '../../bim/types/bim-base';
import type { RoofEntity, RoofFace, RoofRidgeLine } from '../../bim/types/roof-types';
import {
  DEFAULT_EAVE_MATERIAL_ID,
  DEFAULT_FASCIA_HEIGHT_MM,
  DEFAULT_ROOF_TILE_SIZE_M,
  DEFAULT_SOFFIT_MODE,
} from '../../bim/types/roof-types';
import type { SlabDnaLayer } from '../../bim/types/slab-dna-types';
import { tileSizeMForMaterialId } from '../../bim/materials/bim-texture-registry';
import { mmToSceneUnits, sceneUnitsToMeters } from '../../utils/scene-units';
import { getElementMaterial3D, getMaterial3D } from '../materials/MaterialCatalog3D';
import { setSlopeAlignedTileUvs, type SlopeTileUvOptions } from './bim-uv-helpers';
import { toWorld } from './roof-world-transform';
import { buildRoundedRidgeCap, findAdjacentFaces } from './roof-ridge-cap';
import {
  buildRoofEaveDetail,
  extendRidgeToOverhang,
  roofOverhangOffsetLines,
  type RoofOverhangOffsetLine,
} from '../../bim/geometry/roof-eave-detail';
import { buildEaveQuadGeometry } from './roof-eave-detail-mesh';

/** ADR-417 — clay ridge/hip caps («κορφιάδες») use the roof-tile material. */
const RIDGE_CAP_MATERIAL_ID = 'mat-roof-tile';

/** ADR-417 #5 — roof-level tile appearance (physical W×H + rotation). */
interface RoofTileAppearance {
  readonly tileLengthM?: number;
  readonly tileWidthM?: number;
  readonly tileRotate90?: boolean;
}

/**
 * ADR-417 #5 — slope-aligned UV scales for ONE material. The shared texture
 * singleton tiles at `repeat = 1/baseTileSizeM`; scaling the world-meter UVs by
 * `baseTileSizeM / desiredTileSizeM` makes the final texcoord span exactly one
 * tile per `desiredTileSizeM` metres — so a 0.42 m × 0.33 m tile renders at that
 * physical size without touching the texture pipeline (walls/floors unaffected).
 * Undefined dims → square at the material's natural size (scale 1). Pure.
 */
function resolveRoofTileUvOpts(materialId: string, appearance: RoofTileAppearance): SlopeTileUvOptions {
  const baseTileSizeM = tileSizeMForMaterialId(materialId) ?? DEFAULT_ROOF_TILE_SIZE_M;
  return {
    scaleU: baseTileSizeM / (appearance.tileWidthM ?? baseTileSizeM),
    scaleV: baseTileSizeM / (appearance.tileLengthM ?? baseTileSizeM),
    rotate90: appearance.tileRotate90,
  };
}

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
  tileOpts: SlopeTileUvOptions,
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
  // ADR-417 #5 — slope-aligned tile UVs: grooves run down-slope + physical sizing.
  setSlopeAlignedTileUvs(flat, tileOpts);
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
  appearance: RoofTileAppearance,
): RoofLayerSolid[] {
  const out: RoofLayerSolid[] = [];
  let topDepthMm = 0;
  for (const layer of layers) {
    const botDepthMm = topDepthMm + layer.thickness;
    const tileOpts = resolveRoofTileUvOpts(layer.materialId, appearance);
    const geo = buildDepthPrism(face, topDepthMm, botDepthMm, sceneToM, baseElevationM, tileOpts);
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
  /** ADR-417 #5 — roof-level tile sizing/rotation (physical W×H). */
  readonly tileAppearance: RoofTileAppearance;
}

/**
 * Emit the meshes for ONE face. With a DNA build-up → one sub-solid PER LAYER,
 * each painted with its layer material (Revit «Fine» — the perimeter edge reveals
 * the layered stack, full realism). Without DNA → a single monolithic solid. All
 * meshes carry the roof id, so picking any layer selects the whole roof.
 */
function addFaceMeshes(group: THREE.Group, face: RoofFace, ctx: RoofFaceMeshContext): void {
  if (ctx.layers) {
    for (const ls of buildFaceLayerSolids(face, ctx.layers, ctx.sceneToM, ctx.baseElevationM, ctx.tileAppearance)) {
      const mesh = new THREE.Mesh(ls.geo, getMaterial3D(ls.materialId));
      tagRoofMesh(mesh, ctx.roofId, ls.materialId, ctx.levelId);
      group.add(mesh);
    }
    return;
  }
  const monoTileOpts = resolveRoofTileUvOpts(ctx.monoMaterialId ?? 'elem-roof', ctx.tileAppearance);
  const geo = buildDepthPrism(face, 0, ctx.thicknessMm, ctx.sceneToM, ctx.baseElevationM, monoTileOpts);
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
  footprint: readonly Point3D[],
  offLines: readonly RoofOverhangOffsetLine[],
): void {
  // Ο κορφιάς ακολουθεί το υλικό της κορυφαίας επιφάνειας της στέγης (Revit «η
  // εμφάνιση = η εξωτερική κάλυψη») — ίδιο pattern με την προεξοχή/γείσο· fallback
  // σε κεραμίδι μόνο αν δεν υπάρχει surface material.
  const capMaterialId = ctx.monoMaterialId ?? RIDGE_CAP_MATERIAL_ID;
  for (const line of ridges) {
    if (line.kind !== 'ridge' && line.kind !== 'hip') continue;
    // findAdjacentFaces με την ΑΡΧΙΚΗ γραμμή (ταιριάζει στις κορυφές των faces)·
    // μετά επεκτείνουμε τα eave άκρα ώστε ο cap να καλύπτει ΚΑΙ την προέκταση
    // (τα άπειρα επίπεδα των νερών κρατούν τον cap «καθισμένο» στις κλίσεις).
    const adj = findAdjacentFaces(line, faces);
    const extLine = offLines.length > 0 ? extendRidgeToOverhang(line, footprint, offLines) : line;
    const cap = buildRoundedRidgeCap(extLine, adj, ctx.sceneToM, ctx.baseElevationM);
    if (!cap) continue;
    const mesh = new THREE.Mesh(cap, getMaterial3D(capMaterialId));
    tagRoofMesh(mesh, ctx.roofId, capMaterialId, ctx.levelId);
    group.add(mesh);
  }
}

/**
 * ADR-417 Φ2b — Emit the eave detailing («γείσο») meshes around EVERY perimeter
 * footprint edge: overhang strip + fascia board + soffit lining. Hides the cut
 * DNA stack that otherwise reveals the layers around the roof edge (Revit «Fine»).
 * The pure SSoT core (`buildRoofEaveDetail`) is shared with the 2D renderer. All
 * meshes carry the roof id for picking.
 */
function addEaveDetails(group: THREE.Group, roof: RoofEntity, ctx: RoofFaceMeshContext): void {
  const s = mmToSceneUnits(roof.params.sceneUnits ?? 'mm');
  const detail = buildRoofEaveDetail({
    outline: roof.geometry!.footprint.vertices,
    edges: roof.params.edges,
    ridges: roof.geometry!.ridges, // split rake/αέτωμα στον κορφιά → ακολουθεί την κλίση
    slopeUnit: roof.params.slopeUnit,
    basePivotZ: roof.params.basePivotZ,
    thicknessMm: ctx.thicknessMm,
    s,
    fasciaHeightMm: roof.params.fasciaHeightMm ?? DEFAULT_FASCIA_HEIGHT_MM,
    soffitMode: roof.params.soffitMode ?? DEFAULT_SOFFIT_MODE,
    overhangMaterialId: ctx.monoMaterialId ?? RIDGE_CAP_MATERIAL_ID,
    fasciaMaterialId: roof.params.fasciaMaterial ?? DEFAULT_EAVE_MATERIAL_ID,
    soffitMaterialId: roof.params.soffitMaterial ?? DEFAULT_EAVE_MATERIAL_ID,
  });
  // ADR-417 #5 — η προεξοχή (overhang) ΣΥΝΕΧΙΖΕΙ το νερό → ίδια slope-aligned tile
  // UV με την κύρια στέγη (συνεχόμενα κεραμίδια). fascia/soffit μένουν box-UV.
  const overhangTileOpts = resolveRoofTileUvOpts(ctx.monoMaterialId ?? RIDGE_CAP_MATERIAL_ID, ctx.tileAppearance);
  for (const q of detail.quads) {
    const geo = buildEaveQuadGeometry(
      q,
      ctx.sceneToM,
      ctx.baseElevationM,
      q.role === 'overhang' ? overhangTileOpts : undefined,
    );
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, getMaterial3D(q.materialId));
    tagRoofMesh(mesh, ctx.roofId, q.materialId, ctx.levelId);
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
    tileAppearance: {
      tileLengthM: roof.params.tileLengthM,
      tileWidthM: roof.params.tileWidthM,
      tileRotate90: roof.params.tileRotate90,
    },
  };

  // Όριο προέκτασης γείσου ανά footprint edge → επεκτείνει τους κορφιάδες/hips
  // ώστε να καλύπτουν ΚΑΙ την προέκταση (#4).
  const footprint = roof.geometry.footprint.vertices;
  const offLines = roofOverhangOffsetLines(
    footprint,
    roof.params.edges,
    mmToSceneUnits(roof.params.sceneUnits ?? 'mm'),
  );

  const group = new THREE.Group();
  for (const face of roof.geometry.faces) addFaceMeshes(group, face, ctx);
  addRidgeCaps(group, roof.geometry.ridges, roof.geometry.faces, ctx, footprint, offLines); // κορφιάδες on ridge + hip lines (+ προέκταση)
  addEaveDetails(group, roof, ctx); // γείσο: overhang + fascia + soffit (όλες οι περιμετρικές ακμές)

  if (group.children.length === 0) return null;

  group.userData['bimId'] = roof.id;
  group.userData['bimType'] = 'roof';
  if (levelId !== undefined) group.userData['levelId'] = levelId;
  return group;
}
