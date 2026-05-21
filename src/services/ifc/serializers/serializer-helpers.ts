/**
 * IFC4 Entity Serializer — Shared Geometry Helpers (ADR-369 §Q8.4)
 *
 * Builders κοινής χρήσης από όλους τους 5 element serializers:
 *   - LocalPlacement (world-anchored Axis2Placement3D wrapped σε IfcLocalPlacement)
 *   - Rectangle-profile swept solid + ShapeRepresentation + ProductDefinitionShape
 *   - Polygon-profile swept solid (slabs)
 *   - Circle-profile swept solid (circular columns)
 *   - I-shape profile swept solid (steel beams)
 *
 * Όλες οι μετρήσεις σε ΜΕΤΡΑ — κάθε serializer μετατρέπει mm→m πριν περάσει τιμές.
 * Profile dimensions ορίζονται ΣΕ ΜΕΤΡΑ. Heights σε ΜΕΤΡΑ.
 */

import type { FloorDocument } from '@/app/api/floors/floors.types';

import {
  IfcGraph,
  enumValue,
  lbl,
  real,
  ref,
} from '../ifc-entity-graph';
import {
  appendAxis2Placement3D,
  appendCartesianPoint,
  appendDirection,
} from '../ifc-units';

// ─── Vector type ────────────────────────────────────────────────────────────

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Point2 {
  readonly x: number;
  readonly y: number;
}

// ─── Local placement ────────────────────────────────────────────────────────

/**
 * Builds an absolute (world-anchored) `IfcLocalPlacement` whose
 * Axis2Placement3D has the supplied origin, +Z axis and ref-direction.
 * `parent` is left `$` — caller chains storey-relative placements if needed.
 */
export function appendLocalPlacement(
  graph: IfcGraph,
  origin: Vec3,
  zAxis: Vec3,
  refDirection: Vec3,
): number {
  const originID = appendCartesianPoint(graph, [origin.x, origin.y, origin.z]);
  const zID = appendDirection(graph, [zAxis.x, zAxis.y, zAxis.z]);
  const xID = appendDirection(graph, [refDirection.x, refDirection.y, refDirection.z]);
  const axis = appendAxis2Placement3D(graph, originID, zID, xID);
  return graph.add('IFCLOCALPLACEMENT', [null, ref(axis)]);
}

/** Identity 3D placement at origin — handy για profile-local frames. */
export function appendIdentityPlacement3D(graph: IfcGraph): number {
  const origin = appendCartesianPoint(graph, [0, 0, 0]);
  const zAxis = appendDirection(graph, [0, 0, 1]);
  const xAxis = appendDirection(graph, [1, 0, 0]);
  return appendAxis2Placement3D(graph, origin, zAxis, xAxis);
}

// ─── 2D primitives (profile placements) ─────────────────────────────────────

function appendCartesianPoint2D(graph: IfcGraph, x: number, y: number): number {
  return graph.add('IFCCARTESIANPOINT', [[real(x), real(y)]]);
}

function appendDirection2D(graph: IfcGraph, x: number, y: number): number {
  return graph.add('IFCDIRECTION', [[real(x), real(y)]]);
}

function appendAxis2Placement2D(
  graph: IfcGraph,
  locationID: number,
  refDirectionID: number,
): number {
  return graph.add('IFCAXIS2PLACEMENT2D', [ref(locationID), ref(refDirectionID)]);
}

// ─── Rectangle profile ──────────────────────────────────────────────────────

export interface RectangleProfileSpec {
  /** Profile length along its local X axis (METRES). */
  readonly xDim: number;
  /** Profile length along its local Y axis (METRES). */
  readonly yDim: number;
  /** Profile center along local X (METRES, default 0). */
  readonly centerX?: number;
  /** Profile center along local Y (METRES, default 0). */
  readonly centerY?: number;
  /** Profile in-plane rotation in radians (default 0 = X-aligned). */
  readonly rotation?: number;
}

function appendRectangleProfileDef(graph: IfcGraph, p: RectangleProfileSpec): number {
  const cx = p.centerX ?? 0;
  const cy = p.centerY ?? 0;
  const rot = p.rotation ?? 0;
  const location = appendCartesianPoint2D(graph, cx, cy);
  const dir = appendDirection2D(graph, Math.cos(rot), Math.sin(rot));
  const axis = appendAxis2Placement2D(graph, location, dir);
  return graph.add('IFCRECTANGLEPROFILEDEF', [
    enumValue('AREA'),
    null,
    ref(axis),
    real(p.xDim),
    real(p.yDim),
  ]);
}

// ─── Circle profile (circular columns) ──────────────────────────────────────

function appendCircleProfileDef(graph: IfcGraph, radiusM: number): number {
  const location = appendCartesianPoint2D(graph, 0, 0);
  const dir = appendDirection2D(graph, 1, 0);
  const axis = appendAxis2Placement2D(graph, location, dir);
  return graph.add('IFCCIRCLEPROFILEDEF', [
    enumValue('AREA'),
    null,
    ref(axis),
    real(radiusM),
  ]);
}

// ─── I-shape profile (steel beams) ──────────────────────────────────────────

export interface IShapeProfileSpec {
  /** Overall depth (web height + 2× flange thickness), METRES. */
  readonly overallDepth: number;
  /** Overall flange width, METRES. */
  readonly overallWidth: number;
  /** Web thickness, METRES. */
  readonly webThickness: number;
  /** Flange thickness, METRES. */
  readonly flangeThickness: number;
}

function appendIShapeProfileDef(graph: IfcGraph, p: IShapeProfileSpec): number {
  const location = appendCartesianPoint2D(graph, 0, 0);
  const dir = appendDirection2D(graph, 1, 0);
  const axis = appendAxis2Placement2D(graph, location, dir);
  return graph.add('IFCISHAPEPROFILEDEF', [
    enumValue('AREA'),
    null,
    ref(axis),
    real(p.overallWidth),
    real(p.overallDepth),
    real(p.webThickness),
    real(p.flangeThickness),
    null,
  ]);
}

// ─── Arbitrary polygon profile (slabs) ──────────────────────────────────────

function appendPolylineProfileDef(graph: IfcGraph, polyXY: readonly Point2[]): number {
  const pointIDs = polyXY.map((p) => appendCartesianPoint2D(graph, p.x, p.y));
  // Close the polyline by repeating the first vertex.
  const closedIDs = [...pointIDs, pointIDs[0]];
  const polyline = graph.add('IFCPOLYLINE', [closedIDs.map((id) => ref(id))]);
  return graph.add('IFCARBITRARYCLOSEDPROFILEDEF', [
    enumValue('AREA'),
    null,
    ref(polyline),
  ]);
}

// ─── Extruded swept-solid + product shape ───────────────────────────────────

interface ExtrudedShapeSpec {
  readonly contextID: number;
  readonly profileID: number;
  readonly direction: Vec3;
  readonly depth: number;
}

function appendExtrudedAreaShape(graph: IfcGraph, s: ExtrudedShapeSpec): number {
  const dirID = appendDirection(graph, [s.direction.x, s.direction.y, s.direction.z]);
  const localFrame = appendIdentityPlacement3D(graph);
  const solid = graph.add('IFCEXTRUDEDAREASOLID', [
    ref(s.profileID),
    ref(localFrame),
    ref(dirID),
    real(s.depth),
  ]);
  const shapeRep = graph.add('IFCSHAPEREPRESENTATION', [
    ref(s.contextID),
    lbl('Body'),
    lbl('SweptSolid'),
    [ref(solid)],
  ]);
  return graph.add('IFCPRODUCTDEFINITIONSHAPE', [
    null,
    null,
    [ref(shapeRep)],
  ]);
}

// ─── Public swept-shape facades (one per profile kind) ──────────────────────

export interface RectangleSweepSpec {
  readonly contextID: number;
  readonly profile: RectangleProfileSpec;
  readonly direction: Vec3;
  readonly depth: number;
}

export function appendRectangleSweep(graph: IfcGraph, p: RectangleSweepSpec): number {
  const profile = appendRectangleProfileDef(graph, p.profile);
  return appendExtrudedAreaShape(graph, {
    contextID: p.contextID,
    profileID: profile,
    direction: p.direction,
    depth: p.depth,
  });
}

export interface CircleSweepSpec {
  readonly contextID: number;
  readonly radius: number;
  readonly direction: Vec3;
  readonly depth: number;
}

export function appendCircleSweep(graph: IfcGraph, p: CircleSweepSpec): number {
  const profile = appendCircleProfileDef(graph, p.radius);
  return appendExtrudedAreaShape(graph, {
    contextID: p.contextID,
    profileID: profile,
    direction: p.direction,
    depth: p.depth,
  });
}

export interface IShapeSweepSpec {
  readonly contextID: number;
  readonly profile: IShapeProfileSpec;
  readonly direction: Vec3;
  readonly depth: number;
}

export function appendIShapeSweep(graph: IfcGraph, p: IShapeSweepSpec): number {
  const profile = appendIShapeProfileDef(graph, p.profile);
  return appendExtrudedAreaShape(graph, {
    contextID: p.contextID,
    profileID: profile,
    direction: p.direction,
    depth: p.depth,
  });
}

/**
 * Rectangle sweep με offset extrusion frame — επιτρέπει συμμετρικό extrude
 * (π.χ. openings που τέμνουν τοίχο και στις δύο όψεις). `localZOffset` σε
 * METRES — π.χ. `-depth / 2` κεντράρει το solid στο placement origin.
 */
export interface RectangleSweepOffsetSpec {
  readonly contextID: number;
  readonly profile: RectangleProfileSpec;
  readonly direction: Vec3;
  readonly depth: number;
  readonly localZOffset: number;
}

export function appendRectangleSweepOffset(
  graph: IfcGraph,
  p: RectangleSweepOffsetSpec,
): number {
  const profile = appendRectangleProfileDef(graph, p.profile);
  const originID = appendCartesianPoint(graph, [0, 0, p.localZOffset]);
  const zID = appendDirection(graph, [0, 0, 1]);
  const xID = appendDirection(graph, [1, 0, 0]);
  const localFrame = graph.add('IFCAXIS2PLACEMENT3D', [
    ref(originID),
    ref(zID),
    ref(xID),
  ]);
  const dirID = appendDirection(graph, [p.direction.x, p.direction.y, p.direction.z]);
  const solid = graph.add('IFCEXTRUDEDAREASOLID', [
    ref(profile),
    ref(localFrame),
    ref(dirID),
    real(p.depth),
  ]);
  const shapeRep = graph.add('IFCSHAPEREPRESENTATION', [
    ref(p.contextID),
    lbl('Body'),
    lbl('SweptSolid'),
    [ref(solid)],
  ]);
  return graph.add('IFCPRODUCTDEFINITIONSHAPE', [
    null,
    null,
    [ref(shapeRep)],
  ]);
}

export interface PolygonSweepSpec {
  readonly contextID: number;
  readonly polygon: readonly Point2[];
  readonly direction: Vec3;
  readonly depth: number;
}

export function appendPolygonSweep(graph: IfcGraph, p: PolygonSweepSpec): number {
  const profile = appendPolylineProfileDef(graph, p.polygon);
  return appendExtrudedAreaShape(graph, {
    contextID: p.contextID,
    profileID: profile,
    direction: p.direction,
    depth: p.depth,
  });
}

// ─── Floor lookup ───────────────────────────────────────────────────────────

export interface FloorLookup {
  readonly byId: ReadonlyMap<string, FloorDocument>;
}

export function buildFloorLookup(floors: readonly FloorDocument[]): FloorLookup {
  const byId = new Map<string, FloorDocument>();
  for (const f of floors) byId.set(f.id, f);
  return { byId };
}

/**
 * Returns the storey elevation in METRES. Floor.elevation per ADR-369 §1 is
 * stored in metres on FloorDocument (untyped per index signature, so we
 * runtime-narrow it).
 */
export function readFloorElevationM(floor: FloorDocument | undefined): number {
  if (!floor) return 0;
  const raw = (floor as { elevation?: unknown }).elevation;
  return typeof raw === 'number' ? raw : 0;
}
