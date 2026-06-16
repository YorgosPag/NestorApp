/**
 * Multi-layer SOLID slab builder (ADR-416) — per-layer vertical split for a
 * composite Floor/Slab Type (Revit Compound Structure / IFC IfcMaterialLayerSet).
 *
 * The slab analogue of `wall-multilayer-solid-3d.ts`. Whereas a multi-layer WALL
 * splits HORIZONTALLY (across its thickness, exterior→interior via lerped edges),
 * a multi-layer SLAB splits VERTICALLY (down its depth, top→bottom along world Y):
 * every layer shares the SAME plan footprint (and the same opening holes) but
 * occupies a different Y slice of the total thickness.
 *
 * Each band is a self-contained extrude of the layer's own thickness, positioned
 * so the stack exactly fills [slab bottom, slab top = FFL]. The slope shear is
 * applied per band: `applySlabSlope` offsets world-Y by a function of PLAN position
 * only (not of Y), so every layer shears by the same plane → constant per-layer
 * thickness and a coherent tilted stack (top & bottom faces of each band tilt
 * equally — same guarantee as the single-extrude path).
 *
 * Coordinate convention: identical to `BimToThreeConverter.slabToMesh` — plan
 * `(x, y)` → world `(x, height, -y)`; `extrudeAndRotate` lifts local Z to world Y;
 * the slab's top face sits at the FFL (`levelElevation`) and it hangs DOWN by the
 * total thickness (ADR-369 §2.1).
 *
 * @see slab-dna-types.ts — `SlabDna` + `isMultiLayerSlab` (per-kind build-ups)
 * @see layered-buildup.ts — `buildupBoundaryFractions` (shared thickness math SSoT)
 * @see wall-multilayer-solid-3d.ts — the wall sibling (horizontal split)
 * @see docs/centralized-systems/reference/adrs/ADR-416-slab-layered-buildup.md
 */

import * as THREE from 'three';
import type { SlabEntity } from '../../bim/types/slab-types';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import type { SlabDnaLayer } from '../../bim/types/slab-dna-types';
import { isMultiLayerSlab } from '../../bim/types/slab-dna-types';
import { buildupBoundaryFractions } from '../../bim/types/layered-buildup';
import { getMaterial3D } from '../materials/MaterialCatalog3D';
import { buildShape, extrudeAndRotate, tagMesh, pushHoles } from './bim-three-shape-helpers';
import { attachEdgesProjection } from './bim-three-edges';
import { applySlabSlope } from './mesh-slope-shear';
import { ensureWorldUvs } from './bim-uv-helpers';
import { sceneUnitsToMeters } from '../../utils/scene-units';

const MM_TO_M = 0.001;

/**
 * Per-layer composite slab. Returns null on degenerate input / single-layer DNA
 * (so the caller falls back to the single-extrude `slabToMesh` solid).
 */
export function buildMultiLayerSlabSolid(
  slab: SlabEntity,
  openings: readonly SlabOpeningEntity[],
  levelId: string | undefined,
  buildingBaseElevationM: number,
): THREE.Group | null {
  const dna = slab.params.dna;
  if (!isMultiLayerSlab(dna)) return null;
  const verts = slab.params.outline.vertices;
  if (verts.length < 3) return null;
  // ADR-462 — outline + opening holes (canvas units) → world metres (shared by every band).
  const sceneToM = sceneUnitsToMeters(slab.params.sceneUnits ?? 'mm');

  // Cumulative boundary fractions [0, f1, …, 1] measured from the TOP layer.
  const fracs = buildupBoundaryFractions(dna);
  // thickness === dna.totalThickness (schema-enforced); use it as the single SSoT
  // so the stack fills exactly the same envelope as the single-extrude path.
  const totalThicknessM = slab.params.thickness * MM_TO_M;
  // World Y of the slab's BOTTOM face (top face = FFL, hangs down by thickness).
  const slabTopMm = slab.params.levelElevation + (slab.params.heightOffsetFromLevel ?? 0);
  const slabBottomY = (slabTopMm - slab.params.thickness) * MM_TO_M + buildingBaseElevationM;

  const group = new THREE.Group();
  for (let i = 0; i < dna.layers.length; i++) {
    const layerThicknessM = totalThicknessM * (fracs[i + 1] - fracs[i]);
    if (layerThicknessM < 1e-9) continue;
    // Distance of THIS layer's bottom above the slab bottom: fractions run top→bottom,
    // so the bottom boundary of layer i is `fracs[i+1]` from the top.
    const layerBottomY = slabBottomY + totalThicknessM * (1 - fracs[i + 1]);
    addSlabLayerBand(group, slab, openings, layerThicknessM, layerBottomY, dna.layers[i], levelId, sceneToM);
  }
  if (group.children.length === 0) return null;
  group.userData['bimId'] = slab.id;
  group.userData['bimType'] = 'slab';
  return group;
}

/** Extrude + tag one layer band into the group (no-op when the shape is degenerate). */
function addSlabLayerBand(
  group: THREE.Group,
  slab: SlabEntity,
  openings: readonly SlabOpeningEntity[],
  layerThicknessM: number,
  bottomY: number,
  layer: SlabDnaLayer,
  levelId: string | undefined,
  sceneToM: number,
): void {
  // ADR-462 — outline XY (canvas units) → world metres.
  const shape = buildShape(
    slab.params.outline.vertices.map((v) => ({ x: v.x * sceneToM, y: v.y * sceneToM, z: v.z })),
  );
  if (!shape) return;
  pushHoles(shape, openings, sceneToM); // all layers share the slab footprint → same openings.
  const geo = extrudeAndRotate(shape, layerThicknessM);
  ensureWorldUvs(geo); // ADR-413 — aoMap uv2 (ExtrudeGeometry auto-UVs in meters).
  applySlabSlope(geo, slab.params); // plan-position shear → same plane for every band.
  const mesh = new THREE.Mesh(geo, getMaterial3D(layer.materialId));
  mesh.position.y = bottomY;
  tagMesh(mesh, slab.id, 'slab', layer.materialId, levelId);
  mesh.userData['layerId'] = layer.id;
  attachEdgesProjection(mesh, 'slab', 'common-edges');
  group.add(mesh);
}
