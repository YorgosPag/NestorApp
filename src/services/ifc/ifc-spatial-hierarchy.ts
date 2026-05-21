/**
 * IFC4 Spatial Hierarchy Builder (ADR-369 §Q8.3)
 *
 * Builds the canonical IFC4 spatial chain `IfcProject → IfcSite →
 * IfcBuilding[] → IfcBuildingStorey[]` and the `IfcRelAggregates`
 * relationships that bind them. All ids are appended into the supplied
 * `IfcGraph`; callers obtain the project id (for owner-history linking) and
 * a storey lookup so element serializers (Q8.4) can attach geometry to the
 * correct storey via `IfcRelContainedInSpatialStructure`.
 *
 * Conventions:
 *  - Lengths converted from internal mm → m (`MM_TO_M`).
 *  - Site `RefLatitude` / `RefLongitude` populated only when the project
 *    declares a geodetic survey point.
 *  - Storey `Name` = `floor.name` (short code, "L1"/"GF"/"B1"…),
 *    `LongName` = `floor.longName` (Greek full name, "1ος Όροφος"…).
 *  - Building `ElevationOfRefHeight` = `building.baseElevation` (m).
 */

import type { Project } from '@/types/project';
import type { Building } from '@/types/building/contracts';
import type { FloorDocument } from '@/app/api/floors/floors.types';

import {
  IfcGraph,
  enumValue,
  integer,
  lbl,
  real,
  ref,
} from './ifc-entity-graph';
import {
  appendAxis2Placement3D,
  appendCartesianPoint,
  appendDirection,
  appendIfcGeometricContext,
  appendIfcUnitAssignment,
} from './ifc-units';
import { generateIfcGuid } from '@/services/enterprise-id-convenience';

// ─── Public types ───────────────────────────────────────────────────────────

export interface SpatialHierarchyOutput {
  /** IfcProject expressID — link target for owner-history and units. */
  readonly projectID: number;
  /** IfcSite expressID. */
  readonly siteID: number;
  /** IfcBuilding ids keyed by Building.id. */
  readonly buildingIDs: ReadonlyMap<string, number>;
  /** IfcBuildingStorey ids keyed by Floor.id — used by element serializers. */
  readonly storeyIDs: ReadonlyMap<string, number>;
  /** Geometric context expressID (shared by every element representation). */
  readonly contextID: number;
}

export interface SpatialHierarchyInput {
  readonly project: Project;
  readonly buildings: readonly Building[];
  readonly floors: readonly FloorDocument[];
  /** Optional override of the IfcProject owner-history label. */
  readonly ownerName?: string;
}

// ─── Builder ────────────────────────────────────────────────────────────────

/**
 * Writes the full spatial chain into `graph`, returning ids for downstream
 * linking. Caller is responsible for appending an owner-history before
 * referencing the returned project id from products.
 */
export function buildIfcSpatialHierarchy(
  graph: IfcGraph,
  input: SpatialHierarchyInput,
): SpatialHierarchyOutput {
  const { project, buildings, floors } = input;

  // 1. Units + geometric context.
  const unitAssignment = appendIfcUnitAssignment(graph);
  const context = appendIfcGeometricContext(graph, project.northRotation ?? 0);

  // 2. Project root.
  const projectID = graph.add('IFCPROJECT', [
    lbl(generateIfcGuid()),
    null,                         // OwnerHistory — patched in by exporter
    lbl(project.name),
    project.description ? lbl(project.description) : null,
    null,                         // ObjectType
    null,                         // LongName
    null,                         // Phase
    [ref(context)],
    ref(unitAssignment),
  ]);

  // 3. Site.
  const siteID = buildSite(graph, project);
  graph.add('IFCRELAGGREGATES', [
    lbl(generateIfcGuid()),
    null,
    null,
    null,
    ref(projectID),
    [ref(siteID)],
  ]);

  // 4. Buildings (multi-building support, ADR-369 Q2).
  const buildingIDs = new Map<string, number>();
  for (const building of buildings) {
    const id = buildBuilding(graph, building);
    buildingIDs.set(building.id, id);
  }
  if (buildingIDs.size > 0) {
    graph.add('IFCRELAGGREGATES', [
      lbl(generateIfcGuid()),
      null,
      null,
      null,
      ref(siteID),
      Array.from(buildingIDs.values()).map((id) => ref(id)),
    ]);
  }

  // 5. Storeys per building (ADR-369 Q9 hybrid naming).
  const storeyIDs = new Map<string, number>();
  for (const [buildingKey, buildingID] of buildingIDs) {
    const buildingFloors = floors.filter((f) => f.buildingId === buildingKey);
    if (buildingFloors.length === 0) continue;
    const storeyRefs: number[] = [];
    for (const floor of buildingFloors) {
      const storeyID = buildStorey(graph, floor);
      storeyIDs.set(floor.id, storeyID);
      storeyRefs.push(storeyID);
    }
    graph.add('IFCRELAGGREGATES', [
      lbl(generateIfcGuid()),
      null,
      null,
      null,
      ref(buildingID),
      storeyRefs.map((id) => ref(id)),
    ]);
  }

  return { projectID, siteID, buildingIDs, storeyIDs, contextID: context };
}

// ─── Spatial primitives ─────────────────────────────────────────────────────

function buildSite(graph: IfcGraph, project: Project): number {
  const placement = appendIdentityLocalPlacement(graph, null);
  // ProjectSurveyPoint stores vertical reference in METRES (no lat/lon yet).
  // RefLatitude/RefLongitude remain $ until geodetic XY pairing lands
  // (deferred until a separate ADR exposes lat/lon on the survey point).
  const elevationM = project.surveyPoint?.z ?? null;

  return graph.add('IFCSITE', [
    lbl(generateIfcGuid()),
    null,
    lbl('Site'),
    null,
    null,
    ref(placement),
    null,
    null,
    enumValue('ELEMENT'),
    null,
    null,
    elevationM != null ? real(elevationM) : null,
    null,
    null,
  ]);
}

function buildBuilding(graph: IfcGraph, building: Building): number {
  const placement = appendIdentityLocalPlacement(graph, null);
  const baseElevationM = building.baseElevation ?? 0;
  return graph.add('IFCBUILDING', [
    lbl(generateIfcGuid()),
    null,
    lbl(building.code ?? building.name),
    building.description ? lbl(building.description) : null,
    null,
    ref(placement),
    null,
    lbl(building.name),
    enumValue('ELEMENT'),
    real(baseElevationM),
    null,
    null,
  ]);
}

function buildStorey(graph: IfcGraph, floor: FloorDocument): number {
  const placement = appendIdentityLocalPlacement(graph, null);
  const elevation = typeof floor.elevation === 'number' ? floor.elevation : 0;
  const shortName = floor.name ?? `L${floor.number}`;
  const longName = floor.longName;
  return graph.add('IFCBUILDINGSTOREY', [
    lbl(generateIfcGuid()),
    null,
    lbl(shortName),
    null,
    null,
    ref(placement),
    null,
    longName ? lbl(longName) : null,
    enumValue('ELEMENT'),
    real(elevation),
  ]);
}

function appendIdentityLocalPlacement(
  graph: IfcGraph,
  parentPlacementID: number | null,
): number {
  const origin = appendCartesianPoint(graph, [0, 0, 0]);
  const zAxis = appendDirection(graph, [0, 0, 1]);
  const xAxis = appendDirection(graph, [1, 0, 0]);
  const placement = appendAxis2Placement3D(graph, origin, zAxis, xAxis);
  return graph.add('IFCLOCALPLACEMENT', [
    parentPlacementID != null ? ref(parentPlacementID) : null,
    ref(placement),
  ]);
}

// (IfcCompoundPlaneAngleMeasure conversion deferred until geodetic XY pair
// is added to ProjectSurveyPointSchema — currently `z` only.)
void integer;
