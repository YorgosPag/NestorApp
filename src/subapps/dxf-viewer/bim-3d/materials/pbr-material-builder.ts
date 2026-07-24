/**
 * pbr-material-builder — the SOLE factory that turns a `PbrMaterialDef` into a
 * `THREE.MeshStandardMaterial` (ADR-366 §B.5).
 *
 * N.7.1 size split (ADR-665): extracted verbatim from `MaterialCatalog3D` — which sat at
 * 499/500 lines — so that BOTH the BIM catalog and the terrain catalog
 * (`terrain-materials-3d`) can build a face material from the SAME factory without an
 * import cycle (`MaterialCatalog3D → terrain-materials-3d → MaterialCatalog3D`) and
 * without a second copy of the constructor config (N.18 / ADR-584).
 *
 * @module bim-3d/materials/pbr-material-builder
 */

import * as THREE from 'three';
import type { PbrMaterialDef } from '../../bim/materials/material-catalog-defs';
import type { LoadedTextureSet } from './bim-texture-cache';
import { FACE_POLYGON_OFFSET_FACTOR, FACE_POLYGON_OFFSET_UNITS } from './material-depth-priority';
import type { GlassQuality } from '../../config/bim-visual-style';
import { clamp } from '../../utils/scalar-math';

/**
 * ADR-687 Φ5 — a def needs the (heavier) `MeshPhysicalMaterial` ONLY when it has an
 * ACTIVE physical effect: clearcoat (βερνίκι/λούστρο) or transmission (γυαλί/refraction).
 * `ior`/`thickness` on their own are no-ops without transmission, and `appearanceToDef`
 * always fills `ior: 1.5` — so presence alone must NOT trigger physical, or every user
 * material would upgrade. The thousands of BIM solids (κατηγορία-driven defs, no clearcoat/
 * transmission) stay on the cheaper `MeshStandardMaterial` → zero live-viewport perf regression.
 */
function needsPhysical(def: PbrMaterialDef): boolean {
  return (def.clearcoat ?? 0) > 0 || (def.transmission ?? 0) > 0;
}

export function buildMat(def: PbrMaterialDef): THREE.MeshStandardMaterial {
  // Shared base config — ONE object for both material tiers (N.18: no duplicated params).
  const base: THREE.MeshStandardMaterialParameters = {
    color: def.color,
    roughness: def.roughness,
    metalness: def.metalness,
    transparent: def.transparent ?? false,
    opacity: def.opacity ?? 1,
    // ADR-687 Φ4 — self-illumination (Revit «Self-illumination»): emissive colour × strength.
    // Default black/1 = no glow (emissive black makes emissiveIntensity a no-op).
    emissive: def.emissive ?? 0x000000,
    emissiveIntensity: def.emissiveIntensity ?? 1,
    // ADR-366 §B.5 perf — FrontSide (backface culling) on the SOLE face factory. BIM
    // solids (walls/columns/slabs/beams/roofs/mep) are CLOSED extrusions with outward
    // CCW winding, so the inner faces are never seen from outside; DoubleSide doubled
    // the fragment-shader work and disabled culling → ~2× overdraw on a fill-rate-bound
    // GPU (browser-verified «3D βαρύ»). Section-cut interiors stay solid via the stencil
    // cap pipeline (section-stencil-renderer), and the hidden-line / occluder variants
    // keep their explicit DoubleSide where both faces must write depth. Like Revit /
    // Cinema4D realtime viewports (single-sided shading + caps for cuts).
    // The terrain overrides this to DoubleSide — a TIN is an OPEN surface (ADR-650 M10c).
    side: THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: FACE_POLYGON_OFFSET_FACTOR,
    polygonOffsetUnits: FACE_POLYGON_OFFSET_UNITS,
  };

  // ADR-687 Φ5 — clearcoat (car-paint/lacquer) + transmission (γυαλί/refraction) need
  // `MeshPhysicalMaterial` (superset of Standard). Built ONLY when active (see needsPhysical),
  // so the return-type contract (MeshStandardMaterial) holds and consumers stay unchanged.
  if (needsPhysical(def)) {
    return new THREE.MeshPhysicalMaterial({
      ...base,
      clearcoat: def.clearcoat ?? 0,
      clearcoatRoughness: def.clearcoatRoughness ?? 0,
      transmission: def.transmission ?? 0,
      ior: def.ior ?? 1.5,
      thickness: def.thickness ?? 0,
    });
  }

  return new THREE.MeshStandardMaterial(base);
}

/**
 * ADR-687 Φ9 — map a material def to the **live-viewport** def under a glass-quality
 * setting. Pure (`PbrMaterialDef → PbrMaterialDef`), zero side-effects.
 *
 * `accurate` (or any non-glass def, `transmission <= 0`) → the def is returned **by
 * identity** (same reference) — so the thousands of non-glass BIM solids build EXACTLY
 * as before (zero allocation, zero behavioural change). Only a real glass material under
 * `light` is transformed: its (expensive, extra-render-pass) `transmission` refraction is
 * swapped for a cheap `opacity` alpha-blend, dropping the material back to
 * `MeshStandardMaterial` (`needsPhysical` → false). Revit's realistic viewport does the
 * same — refraction is a render-quality option, not always-on.
 *
 * Opacity: a glass material that already carries an explicit `opacity < 1` (e.g. the Φ4
 * glass seed 0.35) keeps it; otherwise it is derived from the transmission strength
 * (`1 - transmission*0.6`, clamped to a visible-but-transparent 0.2..0.85). Every other
 * channel (clearcoat/emissive/metalness/roughness/colour) is preserved verbatim.
 *
 * NOTE: viewport-only. The material-editor preview sphere, the swatches and the 3Δ export
 * bypass this (they build from the raw def / force accurate) → always full refraction.
 */
export function viewportGlassDef(def: PbrMaterialDef, glass: GlassQuality): PbrMaterialDef {
  const transmission = def.transmission ?? 0;
  if (glass === 'accurate' || transmission <= 0) return def;
  const opacity = def.opacity != null && def.opacity < 1
    ? def.opacity
    : clamp(1 - transmission * 0.6, 0.2, 0.85);
  return { ...def, transmission: 0, opacity, transparent: true };
}

/**
 * Attach a loaded PBR texture set onto a flat material def → textured material. SSoT
 * shared by the 3D catalog (`MaterialCatalog3D`) and the offscreen material-thumbnail
 * sphere (ADR-687 Φ7) — ONE apply path (N.18 / N.0.2), extracted verbatim from the catalog.
 */
export function applyTextureSet(def: PbrMaterialDef, set: LoadedTextureSet): THREE.MeshStandardMaterial {
  const mat = buildMat(def);
  mat.map = set.map;
  // PBR contract: when an albedo map is present the base color must be white so
  // the texture shows its natural colour (no double-tinting). The def.color is the
  // flat-mode colour; with a texture it would multiply and incorrectly darken.
  mat.color.set(0xffffff);
  if (set.normalMap) mat.normalMap = set.normalMap;
  if (set.roughnessMap) mat.roughnessMap = set.roughnessMap;
  // aoMap needs uv2 — the geometry layer ensures one; three ignores it gracefully
  // when absent (ADR-413 contract).
  // aoMapIntensity < 1 because our gradient env has no bounce light; full
  // intensity (1.0) creates pitch-black crevices without a real HDRI fill.
  if (set.aoMap) { mat.aoMap = set.aoMap; mat.aoMapIntensity = 0.5; }
  mat.needsUpdate = true;
  return mat;
}
