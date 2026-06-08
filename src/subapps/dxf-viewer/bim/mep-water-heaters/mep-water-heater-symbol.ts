/**
 * Domestic hot water heater 2D symbol SSoT (ADR-408 DHW).
 *
 * Single source of truth for the *vector* symbol of a DHW water heater
 * (θερμοσίφωνας), shared by the 2D renderer and the placement ghost. Pure +
 * geometry-driven: it reads the already-computed (rotated) footprint and emits
 * the cabinet outline plus a distinctive DHW tank glyph and two connector stubs
 * (cold inlet −X end, hot outlet +X end).
 *
 * Glyph design (storage tank cross-section, clearly distinct from the boiler flame):
 *   (a) An inscribed circle approximated as a 10-segment polygon centred on the
 *       footprint centroid, radius ≈ 0.35 × min(bodyWidth, bodyDepth) — represents
 *       the circular cross-section of a cylindrical storage tank (θερμοσίφωνας).
 *   (b) A horizontal "water level" stroke across the upper third of the body —
 *       visually suggests a tank with a partly-filled water column.
 *   (c) A small 4-vertex zig-zag (heating element / αντίσταση) centred at the lower
 *       quarter of the body — universally recognised resistance-heater symbol.
 *
 * Connector semantics (REVERSED vs hydronic boiler):
 *   - Cold inlet (flow:'in', domestic-cold-water) at the −X end.
 *   - Hot outlet (flow:'out', domestic-hot-water) at the +X end.
 *
 * All coordinates are in world canvas units (same space as the footprint), so the
 * renderer just strokes them after applying its transform.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { Point3D } from '../types/bim-base';
import type {
  MepWaterHeaterGeometry,
  MepWaterHeaterParams,
} from '../types/mep-water-heater-types';
import { mmToSceneUnits } from '../../utils/scene-units';

/** A polyline of world-space points (canvas units). */
export type WaterHeaterStroke = readonly Point3D[];

export interface WaterHeaterSymbolGeometry {
  /** Closed outline polygon (= the footprint). */
  readonly outline: readonly Point3D[];
  /** Connector stub strokes — cold inlet (first, −X) + hot outlet (second, +X). */
  readonly strokes: readonly WaterHeaterStroke[];
  /**
   * DHW tank glyph strokes — drawn with a thin line:
   *   [0..N-1]  inscribed circle polygon (tank cross-section, 10 segments)
   *   [N]       horizontal water-level stroke (upper third of body)
   *   [N+1..N+3] zig-zag heating element (3 strokes, lower quarter)
   */
  readonly glyphStrokes: readonly WaterHeaterStroke[];
}

/** Number of segments for the inscribed circle polygon (tank cross-section). */
const TANK_CIRCLE_SEGMENTS = 10;

/** Inscribed circle radius as a fraction of min(bodyWidth, bodyDepth). */
const TANK_RADIUS_FRAC = 0.35;

/** Water-level stroke fractional position from the bottom edge (upper third). */
const WATER_LEVEL_FRAC = 0.67;

/** Half-width of the heating-element zig-zag as a fraction of bodyDepth. */
const ELEMENT_HALF_WIDTH_FRAC = 0.20;

/** Fractional position of the heating element from the bottom edge (lower quarter). */
const ELEMENT_CENTRE_FRAC = 0.20;

function lerp(a: Point3D, b: Point3D, t: number): Point3D {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: 0 };
}

function unit(dx: number, dy: number): { x: number; y: number } {
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/**
 * Build the inscribed circle polygon (tank cross-section glyph).
 *
 * Centred on the footprint centroid; radius = TANK_RADIUS_FRAC × min dimension.
 * TANK_CIRCLE_SEGMENTS segments returned as a closed polygon (first == last vertex).
 * Rotation-aware for free (centroid is in world space).
 */
function buildTankCircleStrokes(
  v0: Point3D, v1: Point3D, v2: Point3D, v3: Point3D,
): WaterHeaterStroke[] {
  const cx = (v0.x + v1.x + v2.x + v3.x) / 4;
  const cy = (v0.y + v1.y + v2.y + v3.y) / 4;

  const bodyWidth = Math.hypot(v1.x - v0.x, v1.y - v0.y);
  const bodyDepth = Math.hypot(v3.x - v0.x, v3.y - v0.y);
  const radius = TANK_RADIUS_FRAC * Math.min(bodyWidth, bodyDepth);

  const pts: Point3D[] = [];
  for (let i = 0; i <= TANK_CIRCLE_SEGMENTS; i++) {
    const angle = (2 * Math.PI * i) / TANK_CIRCLE_SEGMENTS;
    pts.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), z: 0 });
  }

  // Return as one closed polygon stroke (first vertex repeated at the end).
  return [pts];
}

/**
 * Build the horizontal water-level stroke (upper third of body).
 *
 * Runs parallel to the depth axis (−Y to +Y sides) at WATER_LEVEL_FRAC from the
 * bottom (−X edge) toward the top (+X edge). Rotation-aware: verts are in world space.
 */
function buildWaterLevelStroke(
  v0: Point3D, v1: Point3D, v2: Point3D, v3: Point3D,
): WaterHeaterStroke {
  // Depth-axis edge interpolation: left wall v0→v3, right wall v1→v2.
  const leftPt  = lerp(v0, v3, WATER_LEVEL_FRAC);
  const rightPt = lerp(v1, v2, WATER_LEVEL_FRAC);
  return [leftPt, rightPt];
}

/**
 * Build the zig-zag heating element strokes (αντίσταση / resistance element).
 *
 * A compact 4-vertex zig-zag centred at the lower quarter of the body along the
 * depth axis. Looks like the standard IEC resistor symbol — three short
 * alternating segments:  left → upper-peak → lower-peak → right.
 * Width and height are parametric / rotation-aware.
 */
function buildHeatingElementStrokes(
  v0: Point3D, v1: Point3D, v2: Point3D, v3: Point3D,
): WaterHeaterStroke[] {
  const depthDir = unit(v3.x - v0.x, v3.y - v0.y);  // local Y in world
  const widthDir = unit(v1.x - v0.x, v1.y - v0.y);  // local X in world

  const bodyDepth = Math.hypot(v3.x - v0.x, v3.y - v0.y);
  const bodyWidth = Math.hypot(v1.x - v0.x, v1.y - v0.y);

  // Centre of the heating element (lower quarter of the body, on the centroid depth axis)
  const footprintCx = (v0.x + v1.x + v2.x + v3.x) / 4;
  const footprintCy = (v0.y + v1.y + v2.y + v3.y) / 4;
  // Shift from centroid toward −X (bottom) by (0.5 − ELEMENT_CENTRE_FRAC) × bodyWidth
  const shiftAmount = bodyWidth * (0.5 - ELEMENT_CENTRE_FRAC);
  const eCx = footprintCx - widthDir.x * shiftAmount;
  const eCy = footprintCy - widthDir.y * shiftAmount;

  const hw = bodyDepth * ELEMENT_HALF_WIDTH_FRAC;     // half-width of zig-zag
  const peakOffset = hw * 0.7;                         // peak amplitude perpendicular to depth

  // 4 vertices: left-end → upper-peak → lower-peak → right-end (along depth axis)
  const left:  Point3D = { x: eCx - depthDir.x * hw,        y: eCy - depthDir.y * hw,        z: 0 };
  const upperP: Point3D = {
    x: eCx - depthDir.x * (hw / 3) + widthDir.x * peakOffset,
    y: eCy - depthDir.y * (hw / 3) + widthDir.y * peakOffset,
    z: 0,
  };
  const lowerP: Point3D = {
    x: eCx + depthDir.x * (hw / 3) - widthDir.x * peakOffset,
    y: eCy + depthDir.y * (hw / 3) - widthDir.y * peakOffset,
    z: 0,
  };
  const right: Point3D = { x: eCx + depthDir.x * hw,        y: eCy + depthDir.y * hw,        z: 0 };

  return [
    [left, upperP],   // first zag
    [upperP, lowerP], // second zag
    [lowerP, right],  // third zag
  ];
}

/**
 * Build the DHW water heater symbol geometry from params + computed geometry.
 * Rectangular cabinet → a DHW tank glyph (inscribed circle + water level + heating
 * element) plus a cold stub off the −X end and a hot stub off the +X end, all
 * rotation-aware because the footprint is rotated.
 *
 * NOTE: cold inlet is at −X end (flow:'in' → member of cold-water network) and hot
 * outlet is at +X end (flow:'out' → sources domestic-hot-water network). This is
 * the SAME direction layout as the boiler (supply/return at +X/−X), matching the
 * `buildWaterHeaterConnectors` SSoT in mep-water-heater-geometry.ts.
 */
export function buildMepWaterHeaterSymbol(
  params: MepWaterHeaterParams,
  geometry: MepWaterHeaterGeometry,
): WaterHeaterSymbolGeometry {
  const outline = geometry.footprint.vertices;
  if (outline.length !== 4) {
    return { outline, strokes: [], glyphStrokes: [] };
  }

  // v0=(-hw,-hl) v1=(hw,-hl) v2=(hw,hl) v3=(-hw,hl) — rotated to world.
  const [v0, v1, v2, v3] = outline;
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const stubLen = Math.max(params.length * s * 0.8, 60 * s);

  // Cold stub (flow:'in'): from the midpoint of the −X edge (v0→v3), pointing outward −X.
  const coldRoot = lerp(v0, v3, 0.5);
  const coldDir  = unit(v0.x - v1.x, v0.y - v1.y); // −X local (world-rotated)

  // Hot stub (flow:'out'): from the midpoint of the +X edge (v1→v2), pointing outward +X.
  const hotRoot = lerp(v1, v2, 0.5);
  const hotDir  = unit(v1.x - v0.x, v1.y - v0.y); // +X local (world-rotated)

  const strokes: WaterHeaterStroke[] = [
    [coldRoot, { x: coldRoot.x + coldDir.x * stubLen, y: coldRoot.y + coldDir.y * stubLen, z: 0 }],
    [hotRoot,  { x: hotRoot.x  + hotDir.x  * stubLen, y: hotRoot.y  + hotDir.y  * stubLen, z: 0 }],
  ];

  const glyphStrokes: WaterHeaterStroke[] = [
    ...buildTankCircleStrokes(v0, v1, v2, v3),
    buildWaterLevelStroke(v0, v1, v2, v3),
    ...buildHeatingElementStrokes(v0, v1, v2, v3),
  ];

  return { outline, strokes, glyphStrokes };
}
