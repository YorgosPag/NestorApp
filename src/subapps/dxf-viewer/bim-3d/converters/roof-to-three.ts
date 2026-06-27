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
import { DEFAULT_EAVE_MATERIAL_ID, DEFAULT_FASCIA_HEIGHT_MM, DEFAULT_ROOF_TILE_SIZE_M, DEFAULT_SOFFIT_MODE } from '../../bim/types/roof-types';
import type { SlabDnaLayer } from '../../bim/types/slab-dna-types';
import { tileSizeMForMaterialId } from '../../bim/materials/bim-texture-registry';
import { mmToSceneUnits, sceneUnitsToMeters } from '../../utils/scene-units';
import { getElementMaterial3D, getMaterial3D, getRoofTileMaterial3D } from '../materials/MaterialCatalog3D';
import { setSlopeAlignedTileUvs, type SlopeTileUvOptions } from './bim-uv-helpers';
import { toWorld } from './roof-world-transform';
import { tessellateRoofTopCap } from './roof-tile-tessellation';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import { buildRoundedRidgeCap, findAdjacentFaces } from './roof-ridge-cap';
import {
  buildRoofEaveDetail,
  extendRidgeToOverhang,
  roofOverhangOffsetLines,
  type RoofOverhangOffsetLine,
} from '../../bim/geometry/roof-eave-detail';
import { buildEaveQuadGeometry } from './roof-eave-detail-mesh';
// ADR-539 Φ3b — Cinema 4D «Polygon Mode»: per-«νερό» (face) appearance override.
import type { FaceAppearanceMap } from '../../bim/types/face-appearance-types';
import { resolveFaceMaterial } from '../materials/face-appearance-material';
import { usePolygonMode3DStore } from '../stores/PolygonMode3DStore';

/** ADR-417 — clay ridge/hip caps («κορφιάδες») use the roof-tile material. */
const RIDGE_CAP_MATERIAL_ID = 'mat-roof-tile';

/** ADR-417 #5+#6 — roof-level tile appearance (physical W×H + rotation + relief depth). */
interface RoofTileAppearance {
  readonly tileLengthM?: number;
  readonly tileWidthM?: number;
  readonly tileRotate90?: boolean;
  /** mm. Displacement relief depth (ADR-417 #6). 0 = flat (no tessellation). */
  readonly tileReliefMm?: number;
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
 *
 * @param skipTop  When true, omit the top cap triangles (used when the top cap is
 *                 replaced by a tessellated displacement mesh — ADR-417 #6).
 */
function buildPrismIndex(top: THREE.Vector3[], skipTop = false): number[] {
  const n = top.length;
  const index: number[] = [];
  const contour2d = top.map((p) => new THREE.Vector2(p.x, p.z));
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour2d, [])) {
    index.push(n + a, n + c, n + b); // bottom cap (reversed — faces down)
    if (!skipTop) index.push(a, b, c); // top cap (direct — faces up/outward)
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
 *
 * `reliefMm` is set for the tessellated top-cap mesh (ADR-417 #6): the caller uses
 * `getRoofTileMaterial3D(materialId, reliefMm)` to bind a displacement material.
 */
interface RoofLayerSolid {
  readonly geo: THREE.BufferGeometry;
  readonly materialId: string;
  /** When set, bind a displacement material with this relief depth (ADR-417 #6). */
  readonly reliefMm?: number;
}

/**
 * Builds ONE prism for a face between two vertical DEPTHS below the top surface
 * (mm). `topDepthMm`/`botDepthMm` are measured down from each vertex's own slope
 * z, so the prism stays parallel to the slope. Null for a degenerate (<3) outline.
 *
 * @param skipTop  When true, emit only the bottom cap + perimeter sides — the top
 *                 cap is omitted because it will be replaced by a tessellated
 *                 displacement mesh (ADR-417 #6). UVs are skipped too (sides/bottom
 *                 are hidden behind the eave detail and need no tile pattern).
 */
function buildDepthPrism(
  face: RoofFace,
  topDepthMm: number,
  botDepthMm: number,
  sceneToM: number,
  baseElevationM: number,
  tileOpts: SlopeTileUvOptions,
  skipTop = false,
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
  geo.setIndex(buildPrismIndex(top, skipTop));
  // toNonIndexed → per-face flat normals (mirror of column-piece-geometry.ts).
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  // ADR-417 #5 — slope-aligned tile UVs: grooves run down-slope + physical sizing.
  // Skipped when skipTop=true: sides/bottom are hidden and need no tile pattern.
  if (!skipTop) setSlopeAlignedTileUvs(flat, tileOpts);
  return flat;
}

/**
 * Slice a face into its DNA layers (top→bottom), each a sub-prism with its own
 * material. The cumulative vertical depth walks down from the top surface; the
 * layer thicknesses sum to the roof thickness (`dna.totalThickness`).
 *
 * When `wantRelief=true` (ADR-417 #6), the top layer is split into two solids:
 *   (a) tessellated top cap (dense grid, displacement-ready) — tagged with `reliefMm`
 *   (b) sides+bottom prism (simple, no top cap)
 * Lower layers are always simple prisms (sides not visible, no relief needed).
 */
function buildFaceLayerSolids(
  face: RoofFace,
  layers: readonly SlabDnaLayer[],
  sceneToM: number,
  baseElevationM: number,
  appearance: RoofTileAppearance,
  wantRelief: boolean,
): RoofLayerSolid[] {
  // ADR-417 — the tile COVERING (mat-roof-tile) is the exterior surface regardless
  // of what DNA layer[0] is (e.g. breather membrane). UV sizing and 3D material are
  // always resolved from the tile material when any tile-appearance param is set.
  const isTileMode = !!(appearance.tileReliefMm || appearance.tileLengthM || appearance.tileWidthM || appearance.tileRotate90);
  const out: RoofLayerSolid[] = [];
  let topDepthMm = 0;
  for (const layer of layers) {
    const botDepthMm = topDepthMm + layer.thickness;
    const isTopLayer = topDepthMm === 0;
    // UV sizing: always use the tile material id for correct physical tile dimensions.
    const uvMaterialId = isTopLayer && isTileMode ? RIDGE_CAP_MATERIAL_ID : layer.materialId;
    const tileOpts = resolveRoofTileUvOpts(uvMaterialId, appearance);
    // Surface material: tile covering overrides DNA structural material for the top surface.
    const surfaceMaterialId = isTopLayer && isTileMode ? RIDGE_CAP_MATERIAL_ID : layer.materialId;

    if (wantRelief && isTopLayer) {
      // Tessellated top cap: displacement map will push these vertices for barrel-tile relief.
      const topCap = tessellateRoofTopCap(face, 0, sceneToM, baseElevationM, tileOpts);
      if (topCap) out.push({ geo: topCap, materialId: surfaceMaterialId, reliefMm: appearance.tileReliefMm });
      // Sides + bottom only (top cap omitted — covered by tessellated mesh above).
      const sidesPrism = buildDepthPrism(face, 0, botDepthMm, sceneToM, baseElevationM, tileOpts, true);
      if (sidesPrism) out.push({ geo: sidesPrism, materialId: layer.materialId });
    } else {
      const geo = buildDepthPrism(face, topDepthMm, botDepthMm, sceneToM, baseElevationM, tileOpts);
      if (geo) out.push({ geo, materialId: surfaceMaterialId });
    }
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
  /**
   * ADR-539 Φ3b — true όταν το roof είναι σε Polygon Mode (έχει `faceAppearance` Ή είναι ο
   * live target): τα «νερά» γίνονται pickable per-face + βάφονται. False → legacy.
   */
  readonly faced: boolean;
  /** ADR-539 Φ3b — per-«νερό» appearance override (faceKey `sub:${i}:top`). */
  readonly faceAppearance?: FaceAppearanceMap;
}

/**
 * ADR-539 Φ3b — per-«νερό» face paint (Cinema 4D «Polygon Mode»). Σε faced roof κάθε mesh
 * του νερού `faceIndex` γίνεται pickable με faceKey `sub:${faceIndex}:top` (ο `raycastBimFace`
 * διαβάζει το `userData.faceKeyByMaterialIndex`· single-material mesh → materialIndex 0)· αν το
 * νερό έχει βαφή, το flat painted material αντικαθιστά το legacy κεραμίδι/DNA look (μηδέν νέα
 * γεωμετρία — reuse `resolveFaceMaterial` SSoT). Μη-faced roof → καμία αλλαγή (byte-for-byte).
 */
function applyRoofFacePaint(meshes: readonly THREE.Mesh[], faceIndex: number, ctx: RoofFaceMeshContext): void {
  if (!ctx.faced) return;
  const faceKey = `sub:${faceIndex}:top`;
  const appearance = ctx.faceAppearance ?? {};
  const painted = appearance[faceKey] !== undefined;
  for (const mesh of meshes) {
    mesh.userData['faceKeyByMaterialIndex'] = [faceKey];
    if (painted) mesh.material = resolveFaceMaterial(faceKey, appearance, mesh.material as THREE.Material);
  }
}

/**
 * Emit the meshes for ONE face. With a DNA build-up → one sub-solid PER LAYER,
 * each painted with its layer material (Revit «Fine» — the perimeter edge reveals
 * the layered stack, full realism). Without DNA → a single monolithic solid. All
 * meshes carry the roof id, so picking any layer selects the whole roof.
 *
 * ADR-417 #6 — when `realisticMaterials=true` AND `tileReliefMm > 0`, the top
 * layer is split: tessellated cap (displacement material) + sides-only prism.
 */
function addFaceMeshes(group: THREE.Group, face: RoofFace, ctx: RoofFaceMeshContext, faceIndex: number): void {
  const meshes = buildFaceMeshes(face, ctx);
  // ADR-539 Φ3b — tag/paint the whole «νερό» (per-face pick + paint) before adding.
  applyRoofFacePaint(meshes, faceIndex, ctx);
  for (const mesh of meshes) group.add(mesh);
}

/** Build the (1..n) meshes for ONE roof face/«νερό» (DNA layers / relief cap+sides / mono). */
function buildFaceMeshes(face: RoofFace, ctx: RoofFaceMeshContext): THREE.Mesh[] {
  const reliefMm = ctx.tileAppearance.tileReliefMm ?? 0;
  const wantRelief = reliefMm > 0 && useBimRenderSettingsStore.getState().realisticMaterials;
  const meshes: THREE.Mesh[] = [];

  if (ctx.layers) {
    for (const ls of buildFaceLayerSolids(face, ctx.layers, ctx.sceneToM, ctx.baseElevationM, ctx.tileAppearance, wantRelief)) {
      const mat = ls.reliefMm != null
        ? getRoofTileMaterial3D(ls.materialId, ls.reliefMm)
        : getMaterial3D(ls.materialId);
      const mesh = new THREE.Mesh(ls.geo, mat);
      tagRoofMesh(mesh, ctx.roofId, ls.materialId, ctx.levelId);
      meshes.push(mesh);
    }
    return meshes;
  }
  const monoTileOpts = resolveRoofTileUvOpts(ctx.monoMaterialId ?? 'elem-roof', ctx.tileAppearance);
  if (wantRelief && ctx.monoMaterialId) {
    // Monolithic roof + relief: tessellated cap + sides-only prism.
    const topCap = tessellateRoofTopCap(face, 0, ctx.sceneToM, ctx.baseElevationM, monoTileOpts);
    if (topCap) {
      const capMesh = new THREE.Mesh(topCap, getRoofTileMaterial3D(ctx.monoMaterialId, reliefMm));
      tagRoofMesh(capMesh, ctx.roofId, ctx.monoMaterialId, ctx.levelId);
      meshes.push(capMesh);
    }
    const sidesPrism = buildDepthPrism(face, 0, ctx.thicknessMm, ctx.sceneToM, ctx.baseElevationM, monoTileOpts, true);
    if (sidesPrism) {
      const sidesMesh = new THREE.Mesh(sidesPrism, getMaterial3D(ctx.monoMaterialId));
      tagRoofMesh(sidesMesh, ctx.roofId, ctx.monoMaterialId, ctx.levelId);
      meshes.push(sidesMesh);
    }
    return meshes;
  }
  const geo = buildDepthPrism(face, 0, ctx.thicknessMm, ctx.sceneToM, ctx.baseElevationM, monoTileOpts);
  if (!geo) return meshes;
  const mat = ctx.monoMaterialId ? getMaterial3D(ctx.monoMaterialId) : getElementMaterial3D('roof');
  const mesh = new THREE.Mesh(geo, mat);
  tagRoofMesh(mesh, ctx.roofId, ctx.monoMaterialId ?? 'elem-roof', ctx.levelId);
  meshes.push(mesh);
  return meshes;
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
  // Ridge/hip caps always show the tile covering material in tile-mode (ADR-417).
  const isTileMode = !!(ctx.tileAppearance.tileReliefMm || ctx.tileAppearance.tileLengthM || ctx.tileAppearance.tileWidthM || ctx.tileAppearance.tileRotate90);
  const capMaterialId = isTileMode ? RIDGE_CAP_MATERIAL_ID : (ctx.monoMaterialId ?? RIDGE_CAP_MATERIAL_ID);
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
  // ADR-417 — tile covering (mat-roof-tile) overrides DNA structural material for
  // the overhang/eave surface, exactly as it does for the main face top cap.
  const isTileMode = !!(ctx.tileAppearance.tileReliefMm || ctx.tileAppearance.tileLengthM || ctx.tileAppearance.tileWidthM || ctx.tileAppearance.tileRotate90);
  const eaveSurfaceMaterialId = isTileMode ? RIDGE_CAP_MATERIAL_ID : (ctx.monoMaterialId ?? RIDGE_CAP_MATERIAL_ID);
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
    overhangMaterialId: eaveSurfaceMaterialId,
    fasciaMaterialId: roof.params.fasciaMaterial ?? DEFAULT_EAVE_MATERIAL_ID,
    soffitMaterialId: roof.params.soffitMaterial ?? DEFAULT_EAVE_MATERIAL_ID,
  });
  // ADR-417 #5 — η προεξοχή (overhang) ΣΥΝΕΧΙΖΕΙ το νερό → ίδια slope-aligned tile
  // UV με την κύρια στέγη (συνεχόμενα κεραμίδια). fascia/soffit μένουν box-UV.
  const overhangTileOpts = resolveRoofTileUvOpts(eaveSurfaceMaterialId, ctx.tileAppearance);
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
  // ADR-539 Φ3b — faced render (per-«νερό» pick + paint) όταν το roof έχει `faceAppearance`
  // Ή είναι ο live Polygon-Mode target (faces pickable πριν από κάθε βαφή — chicken-and-egg).
  const fa = roof.faceAppearance;
  const poly = usePolygonMode3DStore.getState();
  const faced = (fa !== undefined && Object.keys(fa).length > 0) || (poly.active && poly.targetBimId === roof.id);
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
      tileReliefMm: roof.params.tileReliefMm,
    },
    faced,
    faceAppearance: fa,
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
  // ADR-539 Φ3b — ο index ταυτοποιεί κάθε «νερό» (faceKey `sub:${i}:top`) ώστε raycast + paint
  // να αντιστοιχούν ντετερμινιστικά στο ίδιο νερό (ίδια σειρά με το `roof.geometry.faces`).
  roof.geometry.faces.forEach((face, i) => addFaceMeshes(group, face, ctx, i));
  addRidgeCaps(group, roof.geometry.ridges, roof.geometry.faces, ctx, footprint, offLines); // κορφιάδες on ridge + hip lines (+ προέκταση)
  addEaveDetails(group, roof, ctx); // γείσο: overhang + fascia + soffit (όλες οι περιμετρικές ακμές)

  if (group.children.length === 0) return null;

  group.userData['bimId'] = roof.id;
  group.userData['bimType'] = 'roof';
  if (levelId !== undefined) group.userData['levelId'] = levelId;
  return group;
}
