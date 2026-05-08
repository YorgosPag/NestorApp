/**
 * SSoT — Multi-kind floorplan overlay types (ADR-340 Phase 8).
 *
 * Single Firestore collection `floorplan_overlays` stores all geometric
 * entities drawn over any background (DXF / PDF / Image), polymorphic via
 * the `geometry` discriminated union. Semantic meaning lives in `role`,
 * separate from the geometric shape.
 *
 * Imported by: API handlers, mutation gateway, renderer, read hook,
 * Firestore rules tests, DXF Viewer subapp persistence layer.
 */

// ─── Geometry primitives ──────────────────────────────────────────────────────

export interface Point2D {
  x: number;
  y: number;
}

// ─── Geometry discriminated union ─────────────────────────────────────────────
//
// `polygon` carries an optional `closed` flag (default true). `closed: false`
// represents an open polyline — avoids a separate `polyline` geometry type.

export type OverlayGeometry =
  | { type: 'polygon';     vertices: Point2D[]; closed?: boolean }
  | { type: 'line';        start: Point2D; end: Point2D }
  | { type: 'circle';      center: Point2D; radius: number }
  | {
      type: 'arc';
      center: Point2D;
      radius: number;
      startAngle: number;
      endAngle: number;
      counterclockwise?: boolean;
    }
  | {
      type: 'dimension';
      from: Point2D;
      to: Point2D;
      offset?: number;
      value?: string;
      unit?: 'm' | 'cm' | 'mm';
    }
  | {
      type: 'measurement';
      points: Point2D[];
      mode: 'distance' | 'area' | 'angle';
      value: number;
      unit: string;
    }
  | {
      type: 'text';
      position: Point2D;
      text: string;
      fontSize?: number;
      rotation?: number;
    };

export type OverlayGeometryType = OverlayGeometry['type'];

export const OVERLAY_GEOMETRY_TYPES: ReadonlyArray<OverlayGeometryType> = [
  'polygon',
  'line',
  'circle',
  'arc',
  'dimension',
  'measurement',
  'text',
] as const;

// ─── Semantic role ────────────────────────────────────────────────────────────

export type OverlayRole =
  | 'property'
  | 'parking'
  | 'storage'
  | 'footprint'
  | 'annotation'
  | 'auxiliary';

export const OVERLAY_ROLES: ReadonlyArray<OverlayRole> = [
  'property',
  'parking',
  'storage',
  'footprint',
  'annotation',
  'auxiliary',
] as const;

/**
 * Per-role allowed geometry types — enforced at API handler, Firestore rules,
 * and TypeScript layers. Mismatched combinations are rejected.
 */
export const ROLE_ALLOWED_GEOMETRY: Record<OverlayRole, ReadonlyArray<OverlayGeometryType>> = {
  property:   ['polygon'],
  parking:    ['polygon'],
  storage:    ['polygon'],
  footprint:  ['polygon'],
  annotation: ['line', 'circle', 'arc', 'dimension', 'measurement', 'text'],
  auxiliary:  ['polygon', 'line', 'circle', 'arc', 'dimension', 'measurement', 'text'],
};

/**
 * Roles that require a corresponding `linked.<entity>Id` to be set.
 */
export const ROLE_REQUIRES_LINK: Partial<Record<OverlayRole, keyof OverlayLinked>> = {
  property: 'propertyId',
  parking:  'parkingId',
  storage:  'storageId',
};

// ─── Linked entity reference ──────────────────────────────────────────────────

export interface OverlayLinked {
  propertyId?: string;
  parkingId?: string;
  storageId?: string;
}

// ─── Style override ───────────────────────────────────────────────────────────

export interface OverlayStyle {
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  opacity?: number;
  dashed?: boolean;
}

// ─── Domain entity ────────────────────────────────────────────────────────────

/**
 * Shape of a `floorplan_overlays` document AS STORED in Firestore.
 *
 * Immutable fields (Firestore rules D6): `id`, `companyId`, `backgroundId`,
 * `floorId`. Audit timestamps may be `number` (legacy ms) or `Timestamp`
 * (admin SDK) — readers normalize to ms. Kept loose here to stay framework-
 * agnostic; concrete typing happens in the read hook and gateway.
 */
export interface FloorplanOverlay {
  id: string;
  companyId: string;
  backgroundId: string;
  floorId: string;
  geometry: OverlayGeometry;
  role: OverlayRole;
  linked?: OverlayLinked;
  label?: string;
  style?: OverlayStyle;
  layer?: string;
  createdAt: number | { toMillis: () => number };
  updatedAt: number | { toMillis: () => number };
  createdBy: string;
}

export type CreateFloorplanOverlayData = Omit<
  FloorplanOverlay,
  'id' | 'createdAt' | 'updatedAt' | 'createdBy'
>;

export type UpdateFloorplanOverlayData = Partial<
  Pick<FloorplanOverlay, 'geometry' | 'role' | 'linked' | 'label' | 'style' | 'layer'>
>;

// ─── Background scale (calibration metadata) ──────────────────────────────────

export type BackgroundScaleSourceUnit = 'mm' | 'cm' | 'm' | 'pixel';

/**
 * Conversion metadata: how many native units of this background equal one
 * real-world meter. Set automatically for DXF (parsed from $INSUNITS) or
 * manually for PDF/Image (via 2-point click-to-calibrate).
 *
 * Lives on `floorplan_backgrounds.scale` and is consumed by dimension /
 * measurement renderers + the FloorplanGallery transient measure tool.
 */
export interface BackgroundScale {
  unitsPerMeter: number;
  sourceUnit: BackgroundScaleSourceUnit;
  calibratedAt?: number | { toMillis: () => number };
  calibratedBy?: string;
}

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isPolygonGeometry(
  g: OverlayGeometry,
): g is Extract<OverlayGeometry, { type: 'polygon' }> {
  return g.type === 'polygon';
}

export function isLineGeometry(
  g: OverlayGeometry,
): g is Extract<OverlayGeometry, { type: 'line' }> {
  return g.type === 'line';
}

export function isCircleGeometry(
  g: OverlayGeometry,
): g is Extract<OverlayGeometry, { type: 'circle' }> {
  return g.type === 'circle';
}

export function isArcGeometry(
  g: OverlayGeometry,
): g is Extract<OverlayGeometry, { type: 'arc' }> {
  return g.type === 'arc';
}

export function isDimensionGeometry(
  g: OverlayGeometry,
): g is Extract<OverlayGeometry, { type: 'dimension' }> {
  return g.type === 'dimension';
}

export function isMeasurementGeometry(
  g: OverlayGeometry,
): g is Extract<OverlayGeometry, { type: 'measurement' }> {
  return g.type === 'measurement';
}

export function isTextGeometry(
  g: OverlayGeometry,
): g is Extract<OverlayGeometry, { type: 'text' }> {
  return g.type === 'text';
}

// ─── Validation helpers ───────────────────────────────────────────────────────

/**
 * Returns true if the given role permits the given geometry type.
 */
export function isRoleGeometryConsistent(
  role: OverlayRole,
  geometryType: OverlayGeometryType,
): boolean {
  return ROLE_ALLOWED_GEOMETRY[role].includes(geometryType);
}

/**
 * Returns the missing `linked.<x>Id` field key for a role, or null if
 * validation passes.
 *
 * Semantics: `linked` is OPTIONAL at creation — draw first, link later.
 * Validation only fires when `linked` IS explicitly provided but incomplete:
 *   role='property' + linked={} → error (must include propertyId)
 *   role='property' + linked=undefined → OK (unlinked polygon is valid)
 */
export function findMissingLink(
  role: OverlayRole,
  linked: OverlayLinked | undefined,
): keyof OverlayLinked | null {
  const required = ROLE_REQUIRES_LINK[role];
  if (!required) return null;
  // No linked object provided → unlinked overlay is allowed; link can be set later
  if (!linked) return null;
  // linked IS provided — it must satisfy the role requirement
  if (typeof linked[required] !== 'string' || !linked[required]) {
    return required;
  }
  return null;
}
