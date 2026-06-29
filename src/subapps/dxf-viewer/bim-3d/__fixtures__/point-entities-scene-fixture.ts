/**
 * @file point-entities-scene-fixture.ts
 *
 * Deterministic 3D render fixture for the ADR-550 Φ2 golden-image harness
 * (/test-harness/bim-3d).
 *
 * One instance of each of the 11 BIM point/area entity families is provided
 * with fully-computed `geometry`, so `BimSceneLayer.sync()` produces a non-null
 * THREE.Object3D for every slot. Entities are laid out on a sparse grid
 * (~2 500 mm step) so their bounding boxes never overlap within ~12 m × ~9 m.
 *
 * All coordinates are in mm; sceneUnits = 'mm' throughout (1 canvas unit = 1 mm).
 *
 * @see ADR-550 Φ2 — auto-wiring των 11 point-entity families μέσω POINT_ENTITY_CONTRACTS.
 */

import {
  EMPTY_BIM_ENTITIES,
  type Bim3DEntities,
} from '../stores/Bim3DEntitiesStore';
import type { BimValidation } from '../../bim/types/bim-base';

// ── 1. Foundation ─────────────────────────────────────────────────────────────
import type { FoundationEntity } from '../../bim/types/foundation-types';
import {
  buildDefaultFoundationParams,
  FOUNDATION_IFC_MAP,
} from '../../bim/types/foundation-types';
import { computeFoundationGeometry } from '../../bim/geometry/foundation-geometry';

// ── 2. Electrical Panel ────────────────────────────────────────────────────────
import type { ElectricalPanelEntity } from '../../bim/types/electrical-panel-types';
import {
  DEFAULT_PANEL_WIDTH_MM,
  DEFAULT_PANEL_LENGTH_MM,
  DEFAULT_PANEL_BODY_HEIGHT_MM,
  DEFAULT_PANEL_MOUNTING_ELEVATION_MM,
} from '../../bim/types/electrical-panel-types';
import { computeElectricalPanelGeometry } from '../../bim/electrical-panels/electrical-panel-geometry';

// ── 3. MEP Manifold ────────────────────────────────────────────────────────────
import type { MepManifoldEntity } from '../../bim/types/mep-manifold-types';
import {
  DEFAULT_MANIFOLD_WIDTH_MM,
  DEFAULT_MANIFOLD_LENGTH_MM,
  DEFAULT_MANIFOLD_BODY_HEIGHT_MM,
  DEFAULT_MANIFOLD_MOUNTING_ELEVATION_MM,
  DEFAULT_MANIFOLD_OUTLET_COUNT,
  DEFAULT_MANIFOLD_INLET_DIAMETER_MM,
  DEFAULT_MANIFOLD_OUTLET_DIAMETER_MM,
  resolveManifoldIfcType,
} from '../../bim/types/mep-manifold-types';
import { computeMepManifoldGeometry } from '../../bim/mep-manifolds/mep-manifold-geometry';

// ── 4. MEP Radiator ────────────────────────────────────────────────────────────
import type { MepRadiatorEntity } from '../../bim/types/mep-radiator-types';
import {
  DEFAULT_RADIATOR_WIDTH_MM,
  DEFAULT_RADIATOR_LENGTH_MM,
  DEFAULT_RADIATOR_BODY_HEIGHT_MM,
  DEFAULT_RADIATOR_MOUNTING_ELEVATION_MM,
  DEFAULT_RADIATOR_CONNECTOR_DIAMETER_MM,
} from '../../bim/types/mep-radiator-types';
import { computeMepRadiatorGeometry } from '../../bim/mep-radiators/mep-radiator-geometry';

// ── 5. MEP Boiler ──────────────────────────────────────────────────────────────
import type { MepBoilerEntity } from '../../bim/types/mep-boiler-types';
import {
  DEFAULT_BOILER_WIDTH_MM,
  DEFAULT_BOILER_LENGTH_MM,
  DEFAULT_BOILER_BODY_HEIGHT_MM,
  DEFAULT_BOILER_MOUNTING_ELEVATION_MM,
  DEFAULT_BOILER_CONNECTOR_DIAMETER_MM,
} from '../../bim/types/mep-boiler-types';
import { computeMepBoilerGeometry } from '../../bim/mep-boilers/mep-boiler-geometry';

// ── 6. MEP Water Heater ────────────────────────────────────────────────────────
import type { MepWaterHeaterEntity } from '../../bim/types/mep-water-heater-types';
import {
  DEFAULT_WATER_HEATER_WIDTH_MM,
  DEFAULT_WATER_HEATER_LENGTH_MM,
  DEFAULT_WATER_HEATER_BODY_HEIGHT_MM,
  DEFAULT_WATER_HEATER_MOUNTING_ELEVATION_MM,
  DEFAULT_WATER_HEATER_CONNECTOR_DIAMETER_MM,
} from '../../bim/types/mep-water-heater-types';
import { computeMepWaterHeaterGeometry } from '../../bim/mep-water-heaters/mep-water-heater-geometry';

// ── 7. Railing ─────────────────────────────────────────────────────────────────
import type { RailingEntity } from '../../bim/types/railing-types';
import {
  DEFAULT_RAILING_TYPE,
  DEFAULT_RAILING_TOTAL_HEIGHT_MM,
} from '../../bim/types/railing-types';
import { computeRailingGeometry } from '../../bim/railings/railing-geometry';

// ── 8. Roof ────────────────────────────────────────────────────────────────────
import type { RoofEntity } from '../../bim/types/roof-types';
import {
  DEFAULT_ROOF_BASE_PIVOT_Z_MM,
  DEFAULT_ROOF_THICKNESS_MM,
  DEFAULT_ROOF_SLOPE_DEG,
} from '../../bim/types/roof-types';
import {
  computeRoofGeometry,
  applyRoofShapePreset,
} from '../../bim/geometry/roof-geometry';

// ── 9. Floor Finish ────────────────────────────────────────────────────────────
import type { FloorFinishEntity } from '../../bim/types/floor-finish-types';
import {
  DEFAULT_FLOOR_FINISH_MATERIAL_ID,
  DEFAULT_FLOOR_FINISH_LAYER_THICKNESS_MM,
  DEFAULT_FLOOR_FINISH_LEVEL_MM,
  computeFloorFinishGeometry,
} from '../../bim/types/floor-finish-types';

// ── 10. MEP Underfloor ─────────────────────────────────────────────────────────
import type { MepUnderfloorEntity } from '../../bim/types/mep-underfloor-types';
import {
  DEFAULT_UNDERFLOOR_SPACING_MM,
  DEFAULT_UNDERFLOOR_EDGE_CLEARANCE_MM,
  DEFAULT_UNDERFLOOR_PATTERN,
  DEFAULT_UNDERFLOOR_SCREED_OFFSET_MM,
  DEFAULT_UNDERFLOOR_CONNECTOR_DIAMETER_MM,
} from '../../bim/types/mep-underfloor-types';
import { computeMepUnderfloorGeometry } from '../../bim/mep-underfloor/mep-underfloor-geometry';

// ── 11. Furniture ──────────────────────────────────────────────────────────────
import type { FurnitureEntity } from '../../bim/types/furniture-types';
import {
  DEFAULT_FURNITURE_WIDTH_MM,
  DEFAULT_FURNITURE_DEPTH_MM,
  DEFAULT_FURNITURE_HEIGHT_MM,
  DEFAULT_FURNITURE_MOUNTING_ELEVATION_MM,
} from '../../bim/types/furniture-types';
import { computeFurnitureGeometry } from '../../bim/furniture/furniture-geometry';

// ─────────────────────────────────────────────────────────────────────────────
// Shared zero-violation validation stamp
// ─────────────────────────────────────────────────────────────────────────────
const CLEAN: BimValidation = {
  hasCodeViolations: false,
  violationKeys: [],
  lastValidatedAt: null,
};

// 1. Foundation — pad, anchor centre, at origin (0, 0)
const _foundationParams = buildDefaultFoundationParams('pad');

const foundationEntity: FoundationEntity = {
  id: 'fix-foundation-01',
  type: 'foundation',
  kind: 'pad',
  layerId: 'lyr_default',
  params: _foundationParams,
  geometry: computeFoundationGeometry(_foundationParams),
  validation: CLEAN,
  ifcType: 'IfcFooting',
  predefinedType: FOUNDATION_IFC_MAP['pad'],
};

// 2. Electrical Panel — distribution-board, centre at (2500, 0)
const _panelParams = {
  kind: 'distribution-board' as const,
  shape: 'rectangular' as const,
  position: { x: 2500, y: 0, z: 0 },
  rotation: 0,
  width: DEFAULT_PANEL_WIDTH_MM,
  length: DEFAULT_PANEL_LENGTH_MM,
  bodyHeightMm: DEFAULT_PANEL_BODY_HEIGHT_MM,
  mountingElevationMm: DEFAULT_PANEL_MOUNTING_ELEVATION_MM,
};

const panelEntity: ElectricalPanelEntity = {
  id: 'fix-panel-01',
  type: 'electrical-panel',
  kind: 'distribution-board',
  layerId: 'lyr_default',
  params: _panelParams,
  geometry: computeElectricalPanelGeometry(_panelParams),
  validation: CLEAN,
  ifcType: 'IfcElectricDistributionBoard',
};

// 3. MEP Manifold — floor-manifold, centre at (5000, 0)
const _manifoldParams = {
  kind: 'floor-manifold' as const,
  shape: 'rectangular' as const,
  position: { x: 5000, y: 0, z: 0 },
  rotation: 0,
  width: DEFAULT_MANIFOLD_WIDTH_MM,
  length: DEFAULT_MANIFOLD_LENGTH_MM,
  bodyHeightMm: DEFAULT_MANIFOLD_BODY_HEIGHT_MM,
  mountingElevationMm: DEFAULT_MANIFOLD_MOUNTING_ELEVATION_MM,
  outletCount: DEFAULT_MANIFOLD_OUTLET_COUNT,
  inletDiameterMm: DEFAULT_MANIFOLD_INLET_DIAMETER_MM,
  outletDiameterMm: DEFAULT_MANIFOLD_OUTLET_DIAMETER_MM,
};

const manifoldEntity: MepManifoldEntity = {
  id: 'fix-manifold-01',
  type: 'mep-manifold',
  kind: 'floor-manifold',
  layerId: 'lyr_default',
  params: _manifoldParams,
  geometry: computeMepManifoldGeometry(_manifoldParams),
  validation: CLEAN,
  ifcType: resolveManifoldIfcType('floor-manifold'),
};

// 4. MEP Radiator — panel-radiator, centre at (7500, 0)
const _radiatorParams = {
  kind: 'panel-radiator' as const,
  shape: 'rectangular' as const,
  position: { x: 7500, y: 0, z: 0 },
  rotation: 0,
  width: DEFAULT_RADIATOR_WIDTH_MM,
  length: DEFAULT_RADIATOR_LENGTH_MM,
  bodyHeightMm: DEFAULT_RADIATOR_BODY_HEIGHT_MM,
  mountingElevationMm: DEFAULT_RADIATOR_MOUNTING_ELEVATION_MM,
  connectorDiameterMm: DEFAULT_RADIATOR_CONNECTOR_DIAMETER_MM,
};

const radiatorEntity: MepRadiatorEntity = {
  id: 'fix-radiator-01',
  type: 'mep-radiator',
  kind: 'panel-radiator',
  layerId: 'lyr_default',
  params: _radiatorParams,
  geometry: computeMepRadiatorGeometry(_radiatorParams),
  validation: CLEAN,
  ifcType: 'IfcSpaceHeater',
};

// 5. MEP Boiler — wall-boiler, centre at (0, 2500)
const _boilerParams = {
  kind: 'wall-boiler' as const,
  shape: 'rectangular' as const,
  position: { x: 0, y: 2500, z: 0 },
  rotation: 0,
  width: DEFAULT_BOILER_WIDTH_MM,
  length: DEFAULT_BOILER_LENGTH_MM,
  bodyHeightMm: DEFAULT_BOILER_BODY_HEIGHT_MM,
  mountingElevationMm: DEFAULT_BOILER_MOUNTING_ELEVATION_MM,
  connectorDiameterMm: DEFAULT_BOILER_CONNECTOR_DIAMETER_MM,
};

const boilerEntity: MepBoilerEntity = {
  id: 'fix-boiler-01',
  type: 'mep-boiler',
  kind: 'wall-boiler',
  layerId: 'lyr_default',
  params: _boilerParams,
  geometry: computeMepBoilerGeometry(_boilerParams),
  validation: CLEAN,
  ifcType: 'IfcBoiler',
};

// 6. MEP Water Heater — electric-water-heater, centre at (2500, 2500)
const _waterHeaterParams = {
  kind: 'electric-water-heater' as const,
  shape: 'rectangular' as const,
  position: { x: 2500, y: 2500, z: 0 },
  rotation: 0,
  width: DEFAULT_WATER_HEATER_WIDTH_MM,
  length: DEFAULT_WATER_HEATER_LENGTH_MM,
  bodyHeightMm: DEFAULT_WATER_HEATER_BODY_HEIGHT_MM,
  mountingElevationMm: DEFAULT_WATER_HEATER_MOUNTING_ELEVATION_MM,
  connectorDiameterMm: DEFAULT_WATER_HEATER_CONNECTOR_DIAMETER_MM,
};

const waterHeaterEntity: MepWaterHeaterEntity = {
  id: 'fix-water-heater-01',
  type: 'mep-water-heater',
  kind: 'electric-water-heater',
  layerId: 'lyr_default',
  params: _waterHeaterParams,
  geometry: computeMepWaterHeaterGeometry(_waterHeaterParams),
  validation: CLEAN,
  ifcType: 'IfcUnitaryEquipment',
};

// 7. Railing — sketch path (5000,2500)→(7500,2500)
const _railingParams = {
  type: DEFAULT_RAILING_TYPE,
  pathSource: {
    kind: 'sketch' as const,
    path: [
      { x: 5000, y: 2500, z: 0 },
      { x: 7500, y: 2500, z: 0 },
    ],
  },
  totalHeightMm: DEFAULT_RAILING_TOTAL_HEIGHT_MM,
  baseElevationMm: 0,
};

const railingEntity: RailingEntity = {
  id: 'fix-railing-01',
  type: 'railing',
  kind: 'railing',
  layerId: 'lyr_default',
  params: _railingParams,
  geometry: computeRailingGeometry(_railingParams),
  validation: CLEAN,
  ifcType: 'IfcRailing',
};

// 8. Roof — hip 30°, 4000×3000 mm outline at (0, 6000)
const _roofOutline = {
  vertices: [
    { x: 0, y: 6000, z: 0 },
    { x: 4000, y: 6000, z: 0 },
    { x: 4000, y: 9000, z: 0 },
    { x: 0, y: 9000, z: 0 },
  ],
};
const _roofParams = {
  outline: _roofOutline,
  edges: applyRoofShapePreset(_roofOutline, 'hip', DEFAULT_ROOF_SLOPE_DEG, 'deg'),
  slopeUnit: 'deg' as const,
  basePivotZ: DEFAULT_ROOF_BASE_PIVOT_Z_MM,
  thickness: DEFAULT_ROOF_THICKNESS_MM,
};

const roofEntity: RoofEntity = {
  id: 'fix-roof-01',
  type: 'roof',
  kind: 'roof',
  layerId: 'lyr_default',
  params: _roofParams,
  geometry: computeRoofGeometry(_roofParams),
  validation: CLEAN,
  ifcType: 'IfcRoof',
};

// 9. Floor Finish — ceramic tile 3000×3000 mm at (5000, 6000)
const _floorFinishParams = {
  // ⚠ floorFinishToMesh defaults `sceneUnits ?? 'm'` (unlike the other converters
  // which default 'mm'). Without this, the mm footprint is read as METRES → a 3 km
  // plate that blows up the scene bbox. Pin it to 'mm' for consistency.
  sceneUnits: 'mm' as const,
  footprint: {
    vertices: [
      { x: 5000, y: 6000, z: 0 },
      { x: 8000, y: 6000, z: 0 },
      { x: 8000, y: 9000, z: 0 },
      { x: 5000, y: 9000, z: 0 },
    ],
  },
  materialId: DEFAULT_FLOOR_FINISH_MATERIAL_ID,
  thicknessMm: DEFAULT_FLOOR_FINISH_LAYER_THICKNESS_MM,
  finishLevel: DEFAULT_FLOOR_FINISH_LEVEL_MM,
};

const floorFinishEntity: FloorFinishEntity = {
  id: 'fix-floor-finish-01',
  type: 'floor-finish',
  kind: DEFAULT_FLOOR_FINISH_MATERIAL_ID,
  layerId: 'lyr_default',
  params: _floorFinishParams,
  geometry: computeFloorFinishGeometry(_floorFinishParams),
  validation: CLEAN,
  ifcType: 'IfcCovering',
};

// 10. MEP Underfloor — hydronic-loop 3000×3000 mm at (9000, 0)
const _underfloorParams = {
  kind: 'hydronic-loop' as const,
  footprint: {
    vertices: [
      { x: 9000, y: 0, z: 0 },
      { x: 12000, y: 0, z: 0 },
      { x: 12000, y: 3000, z: 0 },
      { x: 9000, y: 3000, z: 0 },
    ],
  },
  pipeSpacingMm: DEFAULT_UNDERFLOOR_SPACING_MM,
  edgeClearanceMm: DEFAULT_UNDERFLOOR_EDGE_CLEARANCE_MM,
  patternType: DEFAULT_UNDERFLOOR_PATTERN,
  screedOffsetMm: DEFAULT_UNDERFLOOR_SCREED_OFFSET_MM,
  connectorDiameterMm: DEFAULT_UNDERFLOOR_CONNECTOR_DIAMETER_MM,
};

const underfloorEntity: MepUnderfloorEntity = {
  id: 'fix-underfloor-01',
  type: 'mep-underfloor',
  kind: 'hydronic-loop',
  layerId: 'lyr_default',
  params: _underfloorParams,
  geometry: computeMepUnderfloorGeometry(_underfloorParams),
  validation: CLEAN,
  ifcType: 'IfcSpaceHeater',
};

// 11. Furniture — chair 500×500 mm at (9000, 4000)
const _furnitureParams = {
  kind: 'chair' as const,
  assetId: 'chair-01',
  position: { x: 9000, y: 4000, z: 0 },
  rotationDeg: 0,
  widthMm: DEFAULT_FURNITURE_WIDTH_MM,
  depthMm: DEFAULT_FURNITURE_DEPTH_MM,
  heightMm: DEFAULT_FURNITURE_HEIGHT_MM,
  mountingElevationMm: DEFAULT_FURNITURE_MOUNTING_ELEVATION_MM,
};

const furnitureEntity: FurnitureEntity = {
  id: 'fix-furniture-01',
  type: 'furniture',
  kind: 'chair',
  layerId: 'lyr_default',
  params: _furnitureParams,
  geometry: computeFurnitureGeometry(_furnitureParams),
  validation: CLEAN,
  ifcType: 'IfcFurniture',
};

/**
 * Final export — spread `EMPTY_BIM_ENTITIES` so every slice (walls, columns, …)
 * is present and typed, then override the 11 fixture slices.
 */
export const POINT_ENTITIES_FIXTURE: Bim3DEntities = {
  ...EMPTY_BIM_ENTITIES,
  foundations: [foundationEntity],
  panels: [panelEntity],
  manifolds: [manifoldEntity],
  radiators: [radiatorEntity],
  boilers: [boilerEntity],
  waterHeaters: [waterHeaterEntity],
  railings: [railingEntity],
  roofs: [roofEntity],
  floorFinishes: [floorFinishEntity],
  underfloors: [underfloorEntity],
  furnitures: [furnitureEntity],
};
