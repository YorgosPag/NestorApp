/**
 * IFC4 Units + Geometric Context (ADR-369 §Q8.3)
 *
 * Backend-agnostic builders that append unit and context entities into an
 * `IfcGraph`. The serializer (`ifc-step-writer.ts`) emits the graph as STEP21
 * text. Future web-ifc wiring can consume the same graph by walking records
 * and calling `IfcAPI.WriteLine()`.
 *
 * Schema references (buildingSMART IFC4 Add 2 TC1, ISO 16739-1:2018):
 *   - IfcSIUnit                — clause 8.20.2.8
 *   - IfcConversionBasedUnit   — clause 8.20.2.3
 *   - IfcDerivedUnit           — clause 8.20.2.5
 *   - IfcUnitAssignment        — clause 8.20.2.10
 *   - IfcGeometricRepresentationContext — clause 8.13.1
 */

import {
  IfcGraph,
  enumValue,
  integer,
  lbl,
  real,
  ref,
} from './ifc-entity-graph';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Geometric representation precision in METRES (IFC4 recommendation 1e-5). */
export const IFC_GEOMETRIC_PRECISION = 0.00001;

/** Geometric model dimensionality (3D). */
export const IFC_COORDINATE_SPACE_DIMENSION = 3;

/** Internal authoring unit (mm) → IFC length unit (m) scale factor. */
export const MM_TO_M = 0.001;

// ─── Unit assignment ────────────────────────────────────────────────────────

/**
 * Appends all standard Nestor units + an `IfcUnitAssignment` aggregating
 * them. Returns the assignment id so the project entity can link it via
 * `UnitsInContext`.
 *
 * Units written: METRE, SQUARE_METRE, CUBIC_METRE, RADIAN,
 * DEGREE_CELSIUS (conversion-based from KELVIN), PASCAL (derived).
 */
export function appendIfcUnitAssignment(graph: IfcGraph): number {
  const lengthUnit = appendSIUnit(graph, 'LENGTHUNIT', null, 'METRE');
  const areaUnit = appendSIUnit(graph, 'AREAUNIT', null, 'SQUARE_METRE');
  const volumeUnit = appendSIUnit(graph, 'VOLUMEUNIT', null, 'CUBIC_METRE');
  const angleUnit = appendSIUnit(graph, 'PLANEANGLEUNIT', null, 'RADIAN');
  const tempUnit = appendDegreeCelsiusUnit(graph);
  const pressureUnit = appendPascalUnit(graph);

  return graph.add('IFCUNITASSIGNMENT', [
    [
      ref(lengthUnit),
      ref(areaUnit),
      ref(volumeUnit),
      ref(angleUnit),
      ref(tempUnit),
      ref(pressureUnit),
    ],
  ]);
}

// ─── Geometric representation context ───────────────────────────────────────

/**
 * Builds the Model-level `IfcGeometricRepresentationContext` (3D, precision
 * 1e-5, world-origin placement, true-north derived from `northRotationDeg`).
 * Returns the context id so `IfcProject.RepresentationContexts` can link it.
 */
export function appendIfcGeometricContext(
  graph: IfcGraph,
  northRotationDeg: number = 0,
): number {
  const origin = appendCartesianPoint(graph, [0, 0, 0]);
  const zAxis = appendDirection(graph, [0, 0, 1]);
  const xAxis = appendDirection(graph, [1, 0, 0]);
  const worldPlacement = appendAxis2Placement3D(graph, origin, zAxis, xAxis);
  const trueNorth = appendTrueNorth(graph, northRotationDeg);

  return graph.add('IFCGEOMETRICREPRESENTATIONCONTEXT', [
    lbl('Body'),
    lbl('Model'),
    integer(IFC_COORDINATE_SPACE_DIMENSION),
    real(IFC_GEOMETRIC_PRECISION),
    ref(worldPlacement),
    ref(trueNorth),
  ]);
}

// ─── Cartesian / direction primitives (exported for downstream builders) ────

export function appendCartesianPoint(
  graph: IfcGraph,
  coordinates: readonly number[],
): number {
  return graph.add('IFCCARTESIANPOINT', [coordinates.map((c) => real(c))]);
}

export function appendDirection(
  graph: IfcGraph,
  ratios: readonly number[],
): number {
  return graph.add('IFCDIRECTION', [ratios.map((r) => real(r))]);
}

export function appendAxis2Placement3D(
  graph: IfcGraph,
  locationID: number,
  axisID: number,
  refDirectionID: number,
): number {
  return graph.add('IFCAXIS2PLACEMENT3D', [
    ref(locationID),
    ref(axisID),
    ref(refDirectionID),
  ]);
}

// ─── Internal helpers ───────────────────────────────────────────────────────

function appendSIUnit(
  graph: IfcGraph,
  unitType: string,
  prefix: string | null,
  name: string,
): number {
  return graph.add('IFCSIUNIT', [
    '*',
    enumValue(unitType),
    prefix ? enumValue(prefix) : null,
    enumValue(name),
  ]);
}

function appendDimensionalExponents(
  graph: IfcGraph,
  exponents: {
    readonly length?: number;
    readonly mass?: number;
    readonly time?: number;
    readonly current?: number;
    readonly temperature?: number;
    readonly substance?: number;
    readonly luminous?: number;
  },
): number {
  return graph.add('IFCDIMENSIONALEXPONENTS', [
    integer(exponents.length ?? 0),
    integer(exponents.mass ?? 0),
    integer(exponents.time ?? 0),
    integer(exponents.current ?? 0),
    integer(exponents.temperature ?? 0),
    integer(exponents.substance ?? 0),
    integer(exponents.luminous ?? 0),
  ]);
}

function appendDegreeCelsiusUnit(graph: IfcGraph): number {
  const kelvin = appendSIUnit(graph, 'THERMODYNAMICTEMPERATUREUNIT', null, 'KELVIN');
  // 1 °C corresponds to 1 K (with offset handled by consumers — IFC4 spec).
  const measure = graph.add('IFCMEASUREWITHUNIT', [real(1.0), ref(kelvin)]);
  const dims = appendDimensionalExponents(graph, { temperature: 1 });
  return graph.add('IFCCONVERSIONBASEDUNIT', [
    ref(dims),
    enumValue('THERMODYNAMICTEMPERATUREUNIT'),
    lbl('DEGREE_CELSIUS'),
    ref(measure),
  ]);
}

function appendPascalUnit(graph: IfcGraph): number {
  // PASCAL = kg·m^-1·s^-2 → 3 IfcDerivedUnitElement records.
  const gram = appendSIUnit(graph, 'MASSUNIT', 'KILO', 'GRAM');
  const metre = appendSIUnit(graph, 'LENGTHUNIT', null, 'METRE');
  const second = appendSIUnit(graph, 'TIMEUNIT', null, 'SECOND');

  const elMass = graph.add('IFCDERIVEDUNITELEMENT', [ref(gram), integer(1)]);
  const elLen = graph.add('IFCDERIVEDUNITELEMENT', [ref(metre), integer(-1)]);
  const elTime = graph.add('IFCDERIVEDUNITELEMENT', [ref(second), integer(-2)]);

  return graph.add('IFCDERIVEDUNIT', [
    [ref(elMass), ref(elLen), ref(elTime)],
    enumValue('PRESSUREUNIT'),
    null,
  ]);
}

function appendTrueNorth(graph: IfcGraph, northRotationDeg: number): number {
  // Project Y axis points to True North when northRotation=0. A positive
  // rotation (counter-clockwise as seen from above) tilts the project grid
  // East of True North, so the True-North direction relative to the project
  // grid rotates by -northRotation around Z.
  const rad = (northRotationDeg * Math.PI) / 180;
  const x = -Math.sin(rad);
  const y = Math.cos(rad);
  return appendDirection(graph, [x, y]);
}
