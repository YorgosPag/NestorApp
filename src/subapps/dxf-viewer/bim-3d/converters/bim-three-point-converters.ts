/**
 * bim-three-point-converters — point-based BIM entity → THREE.Mesh.
 *
 * Extracted from BimToThreeConverter.ts (Google file-size SSoT, N.7.1).
 * Covers the single-point family-placed elements:
 *   - MEP fixture (ADR-406) — solid hangs DOWN from a ceiling-relative mounting elevation.
 *   - Electrical panel (ADR-408 Φ3) — box centred on a wall-mounted elevation, units-safe.
 *
 * Coordinate convention + scaling identical to BimToThreeConverter (see header there).
 */
import * as THREE from 'three';
import type { MepFixtureEntity } from '../../bim/types/mep-fixture-types';
import type { ElectricalPanelEntity } from '../../bim/types/electrical-panel-types';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import { getElementMaterial3D } from '../materials/MaterialCatalog3D';
import { buildShape, extrudeAndRotate, tagMesh } from './bim-three-shape-helpers';
import { attachEdgesProjection } from './bim-three-edges';

const MM_TO_M = 0.001;

/**
 * ADR-406 — point-based MEP fixture → solid mesh. The footprint is extruded by
 * the body thickness; the solid is positioned so its TOP face sits at the
 * mounting elevation (ceiling-relative, Revit work-plane placement) — i.e. it
 * hangs down from the ceiling by `bodyHeightMm`. Mirror of `beamToMesh` (which
 * also hangs down from a top elevation).
 */
export function fixtureToMesh(
  fixture: MepFixtureEntity,
  floorElevationMm = 0,
  levelId?: string,
  buildingBaseElevationM = 0,
): THREE.Mesh | null {
  const verts = fixture.geometry.footprint.vertices;
  if (verts.length < 3) return null;

  const shape = buildShape(verts);
  if (!shape) return null;

  const bodyHeightM = fixture.params.bodyHeightMm * MM_TO_M;
  const geo = extrudeAndRotate(shape, bodyHeightM);
  const matId = fixture.params.material ?? 'elem-mep-fixture';
  const mesh = new THREE.Mesh(geo, getElementMaterial3D('mep-fixture'));
  // Top face at the mounting elevation; body hangs DOWN by bodyHeight.
  const topMm = floorElevationMm + fixture.params.mountingElevationMm;
  mesh.position.y = topMm * MM_TO_M - bodyHeightM + buildingBaseElevationM;
  const tagged = tagMesh(mesh, fixture.id, 'mep-fixture', matId, levelId);
  attachEdgesProjection(tagged, 'light-fixture');
  return tagged;
}

/**
 * ADR-408 Φ3 — point-based electrical panel → solid mesh. The footprint is
 * extruded by the body height; the box is centred vertically on the mounting
 * elevation (wall-mounted). Units-safe: the footprint (scene units) is converted
 * to meters via `sceneUnitsToMeters` (the StairToThreeConverter pattern), NOT the
 * fixture's latent meter-scene assumption (`fixtureToMesh` consumes the footprint
 * unscaled, so it only renders correctly in meter scenes).
 */
export function panelToMesh(
  panel: ElectricalPanelEntity,
  floorElevationMm = 0,
  levelId?: string,
  buildingBaseElevationM = 0,
): THREE.Mesh | null {
  const verts = panel.geometry.footprint.vertices;
  if (verts.length < 3) return null;

  const sceneToM = sceneUnitsToMeters(panel.params.sceneUnits ?? 'mm');
  const shape = buildShape(verts.map((v) => ({ x: v.x * sceneToM, y: v.y * sceneToM, z: 0 })));
  if (!shape) return null;

  const bodyHeightM = panel.params.bodyHeightMm * MM_TO_M;
  const geo = extrudeAndRotate(shape, bodyHeightM);
  const matId = panel.params.material ?? 'elem-electrical-panel';
  const mesh = new THREE.Mesh(geo, getElementMaterial3D('electrical-panel'));
  // Box centred vertically on the mounting elevation (wall-mounted): the extrusion
  // grows UP from mesh.position.y, so the bottom sits at centre − bodyHeight/2.
  const centerMm = floorElevationMm + panel.params.mountingElevationMm;
  mesh.position.y = centerMm * MM_TO_M - bodyHeightM / 2 + buildingBaseElevationM;
  const tagged = tagMesh(mesh, panel.id, 'electrical-panel', matId, levelId);
  attachEdgesProjection(tagged, 'electrical-panel');
  return tagged;
}
