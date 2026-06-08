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
import type { MepManifoldEntity } from '../../bim/types/mep-manifold-types';
import type { MepRadiatorEntity } from '../../bim/types/mep-radiator-types';
import type { MepBoilerEntity } from '../../bim/types/mep-boiler-types';
import type { MepWaterHeaterEntity } from '../../bim/types/mep-water-heater-types';
import type { Point3D } from '../../bim/types/bim-base';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import { getElementMaterial3D, getSystemTintedMaterial3D } from '../materials/MaterialCatalog3D';
import { buildDrainageGratingStrokes } from '../../bim/mep-manifolds/mep-manifold-symbol';
import { buildShape, extrudeAndRotate, tagMesh } from './bim-three-shape-helpers';
import { attachEdgesProjection } from './bim-three-edges';
import { isSanitaryKind } from '../../bim/sanitary/sanitary-symbol-spec';

const MM_TO_M = 0.001;

// ADR-408 Φ14 — the CIBSE sanitary brown shared by the drainage collector (φρεάτιο)
// body tint AND its 3D grating overlay (SSoT for both, mirrors the 2D
// `MANIFOLD_PALETTE_DRAINAGE` strokeHex '#b45309').
const DRAINAGE_TINT_HEX = 0xb45309;

// ADR-408 Φ14 — one shared line material for every φρεάτιο grating overlay; the
// grating is a schematic indicator (like the 2D thin strokes), not a lit surface,
// so a single un-lit `LineBasicMaterial` is reused across all collectors.
const DRAINAGE_GRATING_MATERIAL = new THREE.LineBasicMaterial({ color: DRAINAGE_TINT_HEX });

// Lift the grating fractionally above the basin's top face to avoid z-fighting.
const GRATING_LIFT_M = 0.0005;

/**
 * ADR-408 Φ14 — build the 3D grating overlay for a drainage collector (φρεάτιο).
 * Reuses the 2D SSoT `buildDrainageGratingStrokes` for the bar layout (zero
 * duplicated grating geometry), then projects each plan-space stroke onto the
 * basin's TOP face. Returned as a child `LineSegments` so it inherits the basin
 * mesh's vertical placement; picking is disabled so the basin box owns selection.
 *
 * Coordinate projection mirrors `extrudeAndRotate` (rot −π/2 about X): a footprint
 * point (x, y) in scene units maps to mesh-local (x·sceneToM, topY, −y·sceneToM).
 */
function buildDrainageGrating3D(
  verts: readonly Point3D[],
  sceneToM: number,
  topYm: number,
): THREE.LineSegments | null {
  if (verts.length !== 4) return null;
  const [v0, v1, v2, v3] = verts;
  const bars = buildDrainageGratingStrokes(v0, v1, v2, v3);
  const y = topYm + GRATING_LIFT_M;
  const positions: number[] = [];
  for (const bar of bars) {
    for (const p of bar) positions.push(p.x * sceneToM, y, -p.y * sceneToM);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const lines = new THREE.LineSegments(geo, DRAINAGE_GRATING_MATERIAL);
  lines.raycast = () => {}; // never a pick target — the basin box owns selection.
  return lines;
}

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
  systemColor?: number,
): THREE.Mesh | null {
  const verts = fixture.geometry.footprint.vertices;
  if (verts.length < 3) return null;

  // ADR-408 Φ14 — a floor drain (σιφώνι) renders units-safe (mm-scene correct via
  // sceneUnitsToMeters, like the φρεάτιο — NOT the light-fixture meter-scene path)
  // as a brown recessed basin with the catch-basin grating on its TOP face (floor
  // level). Reuses the 2D grating SSoT via buildDrainageGrating3D (zero duplication).
  if (fixture.params.kind === 'floor-drain') {
    const sceneToM = sceneUnitsToMeters(fixture.params.sceneUnits ?? 'mm');
    const shape = buildShape(verts.map((v) => ({ x: v.x * sceneToM, y: v.y * sceneToM, z: 0 })));
    if (!shape) return null;

    const bodyHeightM = fixture.params.bodyHeightMm * MM_TO_M;
    const geo = extrudeAndRotate(shape, bodyHeightM);
    const matId = fixture.params.material ?? 'elem-mep-fixture';
    const mesh = new THREE.Mesh(geo, getSystemTintedMaterial3D('mep-fixture', systemColor ?? DRAINAGE_TINT_HEX));
    // Top face flush with the floor (mountingElevation = FFL = 0); basin recessed DOWN.
    const topMm = floorElevationMm + fixture.params.mountingElevationMm;
    mesh.position.y = topMm * MM_TO_M - bodyHeightM + buildingBaseElevationM;
    const tagged = tagMesh(mesh, fixture.id, 'mep-fixture', matId, levelId);
    attachEdgesProjection(tagged, 'light-fixture');
    // Grating on the TOP face: the extrusion spans local y 0→bodyHeightM, so the top
    // face is at mesh-local y = bodyHeightM (the child inherits mesh.position.y).
    const grating = buildDrainageGrating3D(verts, sceneToM, bodyHeightM);
    if (grating) tagged.add(grating);
    return tagged;
  }

  // ADR-408 Φ14 — a sanitary terminal (WC/washbasin/shower/bathtub/bidet) renders
  // units-safe (like the φρεάτιο/panel) as a FLOOR-STANDING parametric box: bottom
  // face at FFL (mountingElevation = 0), extruded UP by bodyHeight. Tinted with the
  // sanitary-drainage brown by default (a System membership colour still wins). v1
  // is a simple solid box — no CC0 fixture mesh exists yet.
  if (isSanitaryKind(fixture.params.kind)) {
    const sceneToM = sceneUnitsToMeters(fixture.params.sceneUnits ?? 'mm');
    const shape = buildShape(verts.map((v) => ({ x: v.x * sceneToM, y: v.y * sceneToM, z: 0 })));
    if (!shape) return null;

    const bodyHeightM = fixture.params.bodyHeightMm * MM_TO_M;
    const geo = extrudeAndRotate(shape, bodyHeightM);
    const matId = fixture.params.material ?? 'elem-mep-fixture';
    const mesh = new THREE.Mesh(geo, getSystemTintedMaterial3D('mep-fixture', systemColor ?? DRAINAGE_TINT_HEX));
    // Floor-standing: bottom face at FFL; the extrusion (local y 0→bodyHeightM) grows UP.
    const bottomMm = floorElevationMm + fixture.params.mountingElevationMm;
    mesh.position.y = bottomMm * MM_TO_M + buildingBaseElevationM;
    const tagged = tagMesh(mesh, fixture.id, 'mep-fixture', matId, levelId);
    attachEdgesProjection(tagged, 'light-fixture');
    return tagged;
  }

  const shape = buildShape(verts);
  if (!shape) return null;

  const bodyHeightM = fixture.params.bodyHeightMm * MM_TO_M;
  const geo = extrudeAndRotate(shape, bodyHeightM);
  const matId = fixture.params.material ?? 'elem-mep-fixture';
  // ADR-408 Φ5 — colour-by-system: tint when the fixture is wired to a circuit.
  const material = systemColor !== undefined
    ? getSystemTintedMaterial3D('mep-fixture', systemColor)
    : getElementMaterial3D('mep-fixture');
  const mesh = new THREE.Mesh(geo, material);
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
  // ADR-408 Φ5 — a panel is a circuit source, not a member, so it is NOT coloured
  // by system (Revit Electrical Equipment carries no circuit colour).
  const mesh = new THREE.Mesh(geo, getElementMaterial3D('electrical-panel'));
  // Box centred vertically on the mounting elevation (wall-mounted): the extrusion
  // grows UP from mesh.position.y, so the bottom sits at centre − bodyHeight/2.
  const centerMm = floorElevationMm + panel.params.mountingElevationMm;
  mesh.position.y = centerMm * MM_TO_M - bodyHeightM / 2 + buildingBaseElevationM;
  const tagged = tagMesh(mesh, panel.id, 'electrical-panel', matId, levelId);
  attachEdgesProjection(tagged, 'electrical-panel');
  return tagged;
}

/**
 * ADR-408 Φ12 — point-based MEP plumbing manifold → solid mesh. The footprint
 * is extruded by the body height; the box is centred vertically on the mounting
 * elevation (floor-mounted). Units-safe: identical `sceneUnitsToMeters` pattern
 * as `panelToMesh` — NOT the buggy `fixtureToMesh` meter-scene assumption.
 */
export function manifoldToMesh(
  manifold: MepManifoldEntity,
  floorElevationMm = 0,
  levelId?: string,
  buildingBaseElevationM = 0,
): THREE.Mesh | null {
  const verts = manifold.geometry.footprint.vertices;
  if (verts.length < 3) return null;

  const sceneToM = sceneUnitsToMeters(manifold.params.sceneUnits ?? 'mm');
  const shape = buildShape(verts.map((v) => ({ x: v.x * sceneToM, y: v.y * sceneToM, z: 0 })));
  if (!shape) return null;

  const bodyHeightM = manifold.params.bodyHeightMm * MM_TO_M;
  const geo = extrudeAndRotate(shape, bodyHeightM);
  const matId = manifold.params.material ?? 'elem-mep-manifold';
  // ADR-408 Φ12 — a manifold is a plumbing system source, not a member: not
  // coloured by system (mirrors the panel convention for circuit sources). Φ14 — a
  // drainage collector (φρεάτιο) tints the equipment PBR brown (CIBSE sanitary).
  const isDrainCollector = manifold.params.kind === 'drainage-collector';
  const mesh = isDrainCollector
    ? new THREE.Mesh(geo, getSystemTintedMaterial3D('mep-manifold', DRAINAGE_TINT_HEX))
    : new THREE.Mesh(geo, getElementMaterial3D('mep-manifold'));
  // Box centred vertically on the mounting elevation (floor-mounted): the extrusion
  // grows UP from mesh.position.y, so the bottom sits at centre − bodyHeight/2.
  const centerMm = floorElevationMm + manifold.params.mountingElevationMm;
  mesh.position.y = centerMm * MM_TO_M - bodyHeightM / 2 + buildingBaseElevationM;
  const tagged = tagMesh(mesh, manifold.id, 'mep-manifold', matId, levelId);
  attachEdgesProjection(tagged, 'mep-manifold');
  // ADR-408 Φ14 — a drainage collector (φρεάτιο) shows its grating on the TOP face
  // (WYSIWYG with the 2D symbol), reusing the same 2D `buildDrainageGratingStrokes`
  // SSoT. The body extrusion spans local y 0→bodyHeightM, so the top face is at
  // mesh-local y = bodyHeightM (the child inherits `mesh.position.y`).
  if (isDrainCollector) {
    const grating = buildDrainageGrating3D(verts, sceneToM, bodyHeightM);
    if (grating) tagged.add(grating);
  }
  return tagged;
}

/**
 * ADR-408 Εύρος Β — point-based heating radiator → solid mesh. The footprint is
 * extruded by the body height; the box is centred vertically on the mounting
 * elevation (wall-mounted). Units-safe: identical `sceneUnitsToMeters` pattern as
 * `manifoldToMesh`. A radiator is a network MEMBER but keeps its fixed warm-red
 * heating-equipment material (not tinted by the supply/return circuit colours).
 */
export function radiatorToMesh(
  radiator: MepRadiatorEntity,
  floorElevationMm = 0,
  levelId?: string,
  buildingBaseElevationM = 0,
): THREE.Mesh | null {
  const verts = radiator.geometry.footprint.vertices;
  if (verts.length < 3) return null;

  const sceneToM = sceneUnitsToMeters(radiator.params.sceneUnits ?? 'mm');
  const shape = buildShape(verts.map((v) => ({ x: v.x * sceneToM, y: v.y * sceneToM, z: 0 })));
  if (!shape) return null;

  const bodyHeightM = radiator.params.bodyHeightMm * MM_TO_M;
  const geo = extrudeAndRotate(shape, bodyHeightM);
  const matId = radiator.params.material ?? 'elem-mep-radiator';
  const mesh = new THREE.Mesh(geo, getElementMaterial3D('mep-radiator'));
  // Box centred vertically on the mounting elevation (wall-mounted): the extrusion
  // grows UP from mesh.position.y, so the bottom sits at centre − bodyHeight/2.
  const centerMm = floorElevationMm + radiator.params.mountingElevationMm;
  mesh.position.y = centerMm * MM_TO_M - bodyHeightM / 2 + buildingBaseElevationM;
  const tagged = tagMesh(mesh, radiator.id, 'mep-radiator', matId, levelId);
  attachEdgesProjection(tagged, 'mep-radiator');
  return tagged;
}

/**
 * ADR-408 Εύρος Β — point-based heating boiler (λέβητας) → solid mesh. The
 * footprint is extruded by the body height; the box is centred vertically on the
 * mounting elevation (floor-mounted). Units-safe: identical `sceneUnitsToMeters`
 * pattern as `manifoldToMesh`/`radiatorToMesh`. A boiler is a hydronic-supply
 * source and keeps its fixed warm-red material (not tinted by circuit colours).
 */
export function boilerToMesh(
  boiler: MepBoilerEntity,
  floorElevationMm = 0,
  levelId?: string,
  buildingBaseElevationM = 0,
): THREE.Mesh | null {
  const verts = boiler.geometry.footprint.vertices;
  if (verts.length < 3) return null;

  const sceneToM = sceneUnitsToMeters(boiler.params.sceneUnits ?? 'mm');
  const shape = buildShape(verts.map((v) => ({ x: v.x * sceneToM, y: v.y * sceneToM, z: 0 })));
  if (!shape) return null;

  const bodyHeightM = boiler.params.bodyHeightMm * MM_TO_M;
  const geo = extrudeAndRotate(shape, bodyHeightM);
  const matId = boiler.params.material ?? 'elem-mep-boiler';
  const mesh = new THREE.Mesh(geo, getElementMaterial3D('mep-boiler'));
  // Box centred vertically on the mounting elevation: the extrusion
  // grows UP from mesh.position.y, so the bottom sits at centre − bodyHeight/2.
  const centerMm = floorElevationMm + boiler.params.mountingElevationMm;
  mesh.position.y = centerMm * MM_TO_M - bodyHeightM / 2 + buildingBaseElevationM;
  const tagged = tagMesh(mesh, boiler.id, 'mep-boiler', matId, levelId);
  attachEdgesProjection(tagged, 'mep-boiler');
  return tagged;
}

/**
 * ADR-408 DHW — point-based domestic hot water heater (θερμοσίφωνας) → solid mesh.
 * The footprint is extruded by the body height; the box is centred vertically on the
 * mounting elevation (wall/floor-mounted). Units-safe: identical `sceneUnitsToMeters`
 * pattern as `boilerToMesh`. A water heater is a DHW-supply source and keeps its fixed
 * domestic-blue material (colour: 0x2563eb — DHW blue, distinct from heating red).
 */
export function waterHeaterToMesh(
  waterHeater: MepWaterHeaterEntity,
  floorElevationMm = 0,
  levelId?: string,
  buildingBaseElevationM = 0,
): THREE.Mesh | null {
  const verts = waterHeater.geometry.footprint.vertices;
  if (verts.length < 3) return null;

  const sceneToM = sceneUnitsToMeters(waterHeater.params.sceneUnits ?? 'mm');
  const shape = buildShape(verts.map((v) => ({ x: v.x * sceneToM, y: v.y * sceneToM, z: 0 })));
  if (!shape) return null;

  const bodyHeightM = waterHeater.params.bodyHeightMm * MM_TO_M;
  const geo = extrudeAndRotate(shape, bodyHeightM);
  const matId = waterHeater.params.material ?? 'elem-mep-water-heater';
  const mesh = new THREE.Mesh(geo, getElementMaterial3D('mep-water-heater'));
  // Box centred vertically on the mounting elevation: the extrusion
  // grows UP from mesh.position.y, so the bottom sits at centre − bodyHeight/2.
  const centerMm = floorElevationMm + waterHeater.params.mountingElevationMm;
  mesh.position.y = centerMm * MM_TO_M - bodyHeightM / 2 + buildingBaseElevationM;
  const tagged = tagMesh(mesh, waterHeater.id, 'mep-water-heater', matId, levelId);
  attachEdgesProjection(tagged, 'mep-water-heater');
  return tagged;
}
