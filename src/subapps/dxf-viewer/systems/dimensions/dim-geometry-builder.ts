/**
 * ADR-362 Phase B1/B2/B3 — Dimension geometry builder (orchestrator).
 *
 * Pure entry-point: maps a `DimensionEntity` + resolved `DimStyle` to the
 * renderer-facing `DimGeometry` (discriminated union). No React, no Firestore,
 * no stores.
 *
 * Phase B1 scope: `linear` + `aligned` (→ `LinearDimGeometry`).
 * Phase B2 scope: `angular2L` + `angular3P` (→ `AngularDimGeometry`)
 *                 + `radius` + `diameter` + `arcLength` + `joggedRadius`
 *                 (→ `RadialDimGeometry`).
 * Phase B3 scope: `ordinate` (→ `LinearDimGeometry`, single-arrow leader)
 *                 + `baseline` + `continued` (→ `LinearDimGeometry` via
 *                 synthetic linear entity, parent resolved through optional
 *                 `DimensionLookup` callback). 10/10 variants implemented.
 *
 * Per-variant calc lives in `./builders/*` to keep each file focused (Google
 * SRP, ≤500 LOC).
 */

import type { DimensionEntity, DimStyle } from '../../types/dimension';
import type { Point2D } from '../../rendering/types/Types';
import {
  buildAlignedGeometry,
  buildLinearGeometry,
} from './builders/linear-aligned-builder';
import {
  buildAngular2LGeometry,
  buildAngular3PGeometry,
} from './builders/angular-builder';
import {
  buildArcLengthGeometry,
  buildDiameterGeometry,
  buildJoggedRadiusGeometry,
  buildRadiusGeometry,
} from './builders/radial-builder';
import { buildOrdinateGeometry } from './builders/ordinate-builder';
import {
  buildBaselineGeometry,
  buildContinuedGeometry,
} from './builders/chained-builder';

/**
 * Lazy parent resolver for baseline/continued chains (Phase B3). Returns
 * `undefined` when the id is not in the active scene — the chained builder
 * surfaces this as a "parent not found" error.
 */
export type DimensionLookup = (id: string) => DimensionEntity | undefined;

/** A line segment defined by two endpoints. */
export interface DimLineSegment {
  start: Point2D;
  end: Point2D;
}

/**
 * Fields shared by every `DimGeometry` variant. Renderer consumes these
 * directly — no further computation needed beyond style-driven styling
 * (color, line dash) and arrowhead block rotation.
 *
 * Conventions:
 *   - `arrowAnchor*` = tip of the arrowhead (lies at the foot of its
 *     corresponding extension line / leader / arc end).
 *   - `arrowDirection*` = UNIT vector pointing OUTWARD from the dim span.
 *     Renderer rotates the arrowhead block so its native `-X` apex (ADR-150)
 *     aligns with this vector. A zero vector signals "no arrow on this side"
 *     (radial single-arrow case).
 *   - `textAnchor` honours `entity.textMidpoint` when present, else a
 *     variant-specific default (midpoint of dim line / arc midpoint / leader
 *     midpoint).
 *   - `textRotation` = radians, 0 for horizontal text (DIMTIH=true), else
 *     reference angle normalised to readability range (-π/2, π/2].
 *   - `measurementValue` = raw measured quantity in world units (mm for
 *     linear/radial/arcLength; **radians** for angular). Caller applies
 *     DIMLFAC / DIMAUNIT formatting via `dim-text-formatter`.
 */
interface DimGeometryBase {
  arrowAnchor1: Point2D;
  arrowAnchor2: Point2D;
  arrowDirection1: Point2D;
  arrowDirection2: Point2D;
  textAnchor: Point2D;
  textRotation: number;
  measurementValue: number;
}

/**
 * Linear / aligned / rotated dim — straight dim line with optional
 * perpendicular (or obliqued) extension lines.
 */
export interface LinearDimGeometry extends DimGeometryBase {
  kind: 'linear';
  dimLine: DimLineSegment;
  extLine1: DimLineSegment | null;
  extLine2: DimLineSegment | null;
}

/**
 * Angular dim (2-line or 3-point) — main dim "line" is an ARC centred at the
 * angle vertex. `arcStartAngle`/`arcEndAngle` are unwrapped radians: going
 * from start to end along (`arcEndAngle - arcStartAngle`) traces the
 * dimensioned arc (positive sweep = CCW, negative = CW). `measurementValue`
 * = `|arcEndAngle - arcStartAngle|` (radians).
 */
export interface AngularDimGeometry extends DimGeometryBase {
  kind: 'angular';
  arcCenter: Point2D;
  arcRadius: number;
  arcStartAngle: number;
  arcEndAngle: number;
  extLine1: DimLineSegment | null;
  extLine2: DimLineSegment | null;
}

/**
 * Radial family (radius / diameter / arcLength / joggedRadius) — main dim
 * geometry is a polyline leader (`leaderPath`). `isDiameter` selects Ø vs R
 * prefix in the text formatter (consumer). `centerMarkExtent` carries DIMCEN
 * and `centerPoint` carries the circle/arc center for Phase L1 rendering.
 */
export interface RadialDimGeometry extends DimGeometryBase {
  kind: 'radial';
  leaderPath: readonly Point2D[];
  isDiameter: boolean;
  /** DIMCEN value (positive=mark, negative=mark+extensions, 0=none). Phase L1. */
  centerMarkExtent?: number;
  /** Center of the circle/arc for center mark rendering. Phase L1. */
  centerPoint?: Point2D;
}

export type DimGeometry =
  | LinearDimGeometry
  | AngularDimGeometry
  | RadialDimGeometry;

/**
 * Dispatch to the per-variant builder. `lookup` is required only for
 * `baseline` / `continued` (Phase B3 chained variants); other variants ignore
 * it. The exhaustive `never` default guards against future variants being
 * added to the union without a matching case here.
 */
export function buildDimensionGeometry(
  entity: DimensionEntity,
  style: DimStyle,
  lookup?: DimensionLookup,
): DimGeometry {
  switch (entity.dimensionType) {
    case 'linear':
      return buildLinearGeometry(entity, style);
    case 'aligned':
      return buildAlignedGeometry(entity, style);
    case 'angular2L':
      return buildAngular2LGeometry(entity, style);
    case 'angular3P':
      return buildAngular3PGeometry(entity, style);
    case 'radius':
      return buildRadiusGeometry(entity, style);
    case 'diameter':
      return buildDiameterGeometry(entity, style);
    case 'arcLength':
      return buildArcLengthGeometry(entity, style);
    case 'joggedRadius':
      return buildJoggedRadiusGeometry(entity, style);
    case 'ordinate':
      return buildOrdinateGeometry(entity, style);
    case 'baseline':
      return buildBaselineGeometry(entity, style, lookup);
    case 'continued':
      return buildContinuedGeometry(entity, style, lookup);
    default: {
      const _exhaustive: never = entity;
      throw new Error(
        `[dim-geometry-builder] Unknown dimensionType on entity '${(_exhaustive as DimensionEntity).id}'.`,
      );
    }
  }
}
