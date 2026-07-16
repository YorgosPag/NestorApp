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
import { FACE_POLYGON_OFFSET_FACTOR, FACE_POLYGON_OFFSET_UNITS } from './material-depth-priority';

export function buildMat(def: PbrMaterialDef): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: def.color,
    roughness: def.roughness,
    metalness: def.metalness,
    transparent: def.transparent ?? false,
    opacity: def.opacity ?? 1,
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
  });
}
