/**
 * terrain-materials-3d — ADR-650 M4/M10c/M10d — the topographic surface + contour materials.
 *
 * N.7.1 size split (ADR-665): moved out of `MaterialCatalog3D` (499/500 lines). The terrain is a
 * SURVEY DATA surface, not a BIM solid, and its materials are terrain-EXCLUSIVE — that exclusivity
 * is now a load-bearing invariant, not an incidental one (see `withTerrainFaceMode`).
 *
 * N.18 — do NOT re-export these from `MaterialCatalog3D`; one import path per symbol.
 *
 * @module bim-3d/materials/terrain-materials-3d
 */

import * as THREE from 'three';
import { MATERIAL_DEFS } from '../../bim/materials/material-catalog-defs';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import type { TerrainSurfaceStyle } from '../../systems/topography/topo-types'; // ADR-650 M4 (types only)
import { TOPO_MAJOR_COLOR, TOPO_MINOR_COLOR } from '../../systems/topography/contour-config'; // ADR-650 M10d
import { buildMat } from './pbr-material-builder';
import {
  buildHiddenLineFaceMaterial,
  buildInvisibleFaceMaterial,
  getConsistentVariant,
} from './face-mode-materials';

/** ADR-650 M10c — unlit analysis-style terrain materials (hypsometric / cut-fill), cached per style. */
const TERRAIN_ANALYSIS_CACHE = new Map<string, THREE.MeshBasicMaterial>();

/** ADR-650 M4 — the lit `shaded` (earth) terrain base. Terrain-exclusive; nothing else asks for it. */
const TERRAIN_SHADED_CACHE = new Map<string, THREE.MeshStandardMaterial>();

/** ADR-650 M10d — unlit contour-line materials (major / minor), cached per class. */
const TERRAIN_CONTOUR_CACHE = new Map<string, THREE.LineBasicMaterial>();

/** ADR-665 — the terrain's OWN faces-hidden / hidden-line instances, cached per mode. */
const TERRAIN_FACE_CACHE = new Map<'none' | 'hidden-line', THREE.MeshStandardMaterial>();

/**
 * ADR-650 M10d — apply a 0..1 transparency to a terrain-exclusive material IN PLACE (Civil 3D
 * «Surface Style transparency»). A transparent surface also stops writing depth so the BIM / ground
 * behind it shows through (standard see-through compositing). Mutating in place is safe: these
 * materials belong to the single terrain / contour layer and are never shared with a BIM entity.
 */
function applyTerrainOpacity(mat: THREE.Material, opacity: number): void {
  const transparent = opacity < 1;
  if (mat.opacity === opacity && mat.transparent === transparent) return;
  mat.opacity = opacity;
  mat.transparent = transparent;
  mat.depthWrite = !transparent;
  mat.needsUpdate = true;
}

/**
 * ADR-665 — the terrain's Visual Style FACES variant, ALWAYS a terrain-EXCLUSIVE instance.
 *
 * WHY this exists instead of the shared `withFaceMode`: three.js clipping is PER-MATERIAL. In
 * faceMode `'none'`/`'hidden-line'` the shared helper returns app-wide singletons that EVERY BIM
 * mesh holds, so writing the terrain's level-cut plane onto the returned material would cut the
 * whole building — the exact opposite of the requirement («το κτίριο μένει ακέραιο»).
 *
 * The parameters are byte-identical to the BIM singletons (same `build*` factories) → the terrain
 * looks EXACTLY as it does today. Only the instance identity differs. `'consistent'` already
 * yields an exclusive clone (`CONSISTENT_CACHE` is keyed by the terrain base's uuid), so it passes
 * straight through.
 */
function withTerrainFaceMode(base: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const faceMode = useBimRenderSettingsStore.getState().faceMode;
  if (faceMode === 'consistent') return getConsistentVariant(base);
  if (faceMode !== 'none' && faceMode !== 'hidden-line') return base; // 'realistic' | 'shaded'

  let mat = TERRAIN_FACE_CACHE.get(faceMode);
  if (!mat) {
    mat = faceMode === 'none' ? buildInvisibleFaceMaterial() : buildHiddenLineFaceMaterial();
    TERRAIN_FACE_CACHE.set(faceMode, mat);
  }
  return mat;
}

/**
 * ADR-650 M4/M10c — topographic terrain surface material.
 *
 * DoubleSide for every style: every other BIM solid is a CLOSED extrusion whose inner faces are
 * unreachable, but a TIN is an OPEN surface. A camera that drops below the hill (or inside a cut)
 * would look straight through a back-face-culled terrain and see the void — so it renders
 * `DoubleSide`, exactly as Civil 3D 3D-faces and a Revit Toposolid do. The cost is bounded: one
 * surface, not the whole model, so the ADR-366 §B.5 overdraw argument does not apply.
 * (ADR-665 relies on this: the level cut shows the terrain's UNDERSIDE, not a see-through void,
 * which is why v1 ships without a stencil cap.)
 *
 * `shaded` (earth) is LIT: there the lighting IS the read — hillshade gives the surface its 3D
 * form — so it belongs in the PBR pipeline like every other solid, and honours the Visual Style
 * FACES axis via `withTerrainFaceMode`.
 *
 * The ANALYSIS styles (`hypsometric` elevation banding, `cutfill`, ADR-650 M6) are UNLIT
 * (`MeshBasicMaterial` + per-vertex colours). Civil 3D / Revit render an analysis style as a DATA
 * visualisation, never a lit surface: the banding colours must read TRUE regardless of scene
 * lighting or shadow. Crucially this is also the M10c FIX — a lit `MeshStandardMaterial` (white
 * base + vertex colours + `receiveShadow`) rendered fully BLACK, hence invisible, whenever the
 * survey surface fell outside the directional light's shadow/light frustum (it floats at the real
 * survey elevation, far above the building). An unlit material cannot be darkened into oblivion.
 * Cached per style; the `shaded` PBR singleton is never mutated into a vertex-colour material.
 */
export function getTerrainMaterial3D(style: TerrainSurfaceStyle, opacity = 1): THREE.Material {
  if (style !== 'shaded') {
    let analysis = TERRAIN_ANALYSIS_CACHE.get(style);
    if (!analysis) {
      // No polygonOffset: an isolated survey surface has no coplanar geometry to z-fight, and a
      // positive offset at the surface's floating far-distance depth slope pushed it out of the
      // depth range → invisible (M10c regression). Kept identical to the verified live-fix config.
      analysis = new THREE.MeshBasicMaterial({
        vertexColors: true, // the per-vertex banding / cut-fill colours the converter baked in
        side: THREE.DoubleSide,
      });
      TERRAIN_ANALYSIS_CACHE.set(style, analysis);
    }
    applyTerrainOpacity(analysis, opacity); // ADR-650 M10d — per-style surface transparency
    return analysis;
  }

  const cacheKey = `elem-terrain:${style}`;
  let mat = TERRAIN_SHADED_CACHE.get(cacheKey);
  if (!mat) {
    mat = buildMat(MATERIAL_DEFS['elem-terrain']!);
    mat.side = THREE.DoubleSide;
    TERRAIN_SHADED_CACHE.set(cacheKey, mat);
  }
  // ADR-650 M10d — applied to the terrain-exclusive base before the FACES axis; the shaded/realistic
  // default returns that base, so the transparency shows (the none/hidden-line face modes swap in
  // flat/invisible variants and deliberately do not carry terrain opacity — a data surface, not a solid).
  applyTerrainOpacity(mat, opacity);
  return withTerrainFaceMode(mat);
}

/**
 * ADR-650 M10d — the 3D topographic CONTOUR line material (major index vs minor intermediate).
 *
 * Unlit `LineBasicMaterial` in the AutoCAD/Civil 3D brown family (the SAME palette the 2D plan
 * contours use, `contour-config`), so the hill you orbit and the lines in plan read as one product.
 * Lit shading is meaningless for a 1-px line and would let the survey surface's floating far-depth
 * darken them into oblivion (the same trap that made the analysis mesh vanish, M10c). Cached per
 * class for the app lifetime — the geometry is rebuilt on every survey edit, the material is not.
 *
 * ADR-665 — `LineBasicMaterial` ships three.js' clipping chunks, so these ARE clipped, but ONLY
 * under the `'topo'` clip scope (see `section-clip-applicator`): the ~20 other `LineBasicMaterial`
 * users in `bim-3d/` (gizmos, dimensions, focus outlines) must stay unclipped.
 */
export function getTopoContourMaterial3D(isMajor: boolean, opacity = 1): THREE.LineBasicMaterial {
  const key = isMajor ? 'major' : 'minor';
  let mat = TERRAIN_CONTOUR_CACHE.get(key);
  if (!mat) {
    mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(isMajor ? TOPO_MAJOR_COLOR : TOPO_MINOR_COLOR).getHex(),
    });
    TERRAIN_CONTOUR_CACHE.set(key, mat);
  }
  applyTerrainOpacity(mat, opacity); // ADR-650 M10d — contour-line transparency
  return mat;
}

/**
 * ADR-650 M10c/M10d + ADR-665 — dispose every terrain-exclusive material. Called by
 * `disposeMaterialCatalog3D` on full app teardown only.
 */
export function disposeTerrainMaterials3D(): void {
  for (const mat of TERRAIN_ANALYSIS_CACHE.values()) mat.dispose();
  TERRAIN_ANALYSIS_CACHE.clear();
  for (const mat of TERRAIN_SHADED_CACHE.values()) mat.dispose();
  TERRAIN_SHADED_CACHE.clear();
  for (const mat of TERRAIN_CONTOUR_CACHE.values()) mat.dispose();
  TERRAIN_CONTOUR_CACHE.clear();
  for (const mat of TERRAIN_FACE_CACHE.values()) mat.dispose();
  TERRAIN_FACE_CACHE.clear();
}
