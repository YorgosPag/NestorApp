/**
 * Heating boiler 2D symbol SSoT (ADR-408 Εύρος Β #2).
 *
 * Single source of truth for the *vector* symbol of a boiler (λέβητας), consumed by
 * the 2D renderer. Pure + geometry-driven: it reads the already-computed (rotated)
 * footprint and emits the cabinet outline, a distinctive boiler glyph (horizontal
 * divider + upward-triangle flame/burner mark), and one stub PER embedded connector.
 *
 * Connector stubs are CONNECTOR-DRIVEN (FULL SSOT): instead of hardcoding supply/return,
 * the symbol loops over `buildBoilerConnectors(params)` — the SAME source of truth that
 * seeds the boiler's real connectors — and resolves each one's world position via
 * `connectorWorldPosition` (rotation-aware, the shared SSoT). So EVERY connector (the
 * hydronic supply/return pair, the combi DHW hot/cold/recirc ports, the gas/oil flue,
 * and any future port) is automatically drawn in plan at its true position — zero drift.
 * Each connector DOMAIN gets its own unmistakable read: pipes draw plain stubs, the
 * combustion flue (`domain:'duct'`) a vent glyph (stub + chevron + terminal cap), and the
 * fuel inlet (`domain:'fuel'`) a gas-cock isolation-valve glyph (stub + bow-tie + lever).
 *
 * Glyph design:
 *   - A horizontal divider line across the body ~40% from the bottom — visually
 *     separates the combustion chamber from the expansion vessel / flue section.
 *   - An upward-pointing triangle centred just below the divider (~25% body size)
 *     representing the burner flame. This distinguishes the boiler from the
 *     radiator (which uses parallel fin bars) at a glance.
 *
 * All coordinates are in world canvas units (same space as the footprint), so the
 * renderer just strokes them after applying its transform.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { Point3D } from '../types/bim-base';
import type {
  MepBoilerGeometry,
  MepBoilerParams,
} from '../types/mep-boiler-types';
import { connectorWorldPosition } from '../types/mep-connector-types';
import type {
  PlumbingSystemClassification,
  DuctSystemClassification,
} from '../types/mep-connector-types';
import { buildBoilerConnectors } from './mep-boiler-geometry';
import { buildFlueTerminalGlyph, DEFAULT_FLUE_TERMINATION } from './boiler-flue-terminal';
import { mmToSceneUnits } from '../../utils/scene-units';

/** A polyline of world-space points (canvas units). */
export type BoilerStroke = readonly Point3D[];

/**
 * A connector stub polyline tagged with its System Classification (Revit color-coded MEP
 * plan). The symbol stays pure geometry + classification data — it carries NO colours; the
 * renderer resolves the colour from the classification via the `resolveSegmentClassificationColor`
 * SSoT (`mep-system-color.ts`). `classification` is `undefined` when the SSoT does not cover
 * the connector's domain (e.g. the `fuel` domain) — the renderer then falls back to its
 * default boiler stroke. Covers the plumbing classifications (supply/return, DHW hot/cold,
 * drainage) and the duct `exhaust` classification (the flue).
 */
export interface ClassifiedBoilerStroke {
  readonly line: BoilerStroke;
  readonly classification?: PlumbingSystemClassification | DuctSystemClassification;
}

export interface BoilerSymbolGeometry {
  /** Closed outline polygon (= the footprint). */
  readonly outline: readonly Point3D[];
  /**
   * Connector stub strokes — one straight stub per PIPE connector: the water/pipe ports
   * (`domain:'pipe'`) only (the hydronic supply/return pair + any combi DHW hot/cold/recirc
   * ports). The combustion flue (`domain:'duct'`) and the fuel inlet (`domain:'fuel'`) get
   * their own distinct glyphs in `ventStrokes` / `fuelStrokes`. Connector-driven from
   * `buildBoilerConnectors`; order follows it: supply outlet, return inlet, any combi DHW ports.
   * Each stub carries its plumbing System Classification so the renderer colours it per Revit
   * convention (supply red, return blue, DHW hot red / cold blue, drainage brown).
   */
  readonly strokes: readonly ClassifiedBoilerStroke[];
  /**
   * Vent/duct connector glyph strokes — per `domain:'duct'` connector (the gas/oil
   * combustion flue / καπναγωγός): a stub + chevron arrowhead, PLUS the vent-terminal
   * cap glyph at the chevron tip (καμινάδα, per `flueTermination`). Kept separate from
   * `strokes` so the renderer can give the exhaust duct a distinct read. Each glyph stroke
   * carries the duct classification (`exhaust`) so the renderer colours the flue grey.
   */
  readonly ventStrokes: readonly ClassifiedBoilerStroke[];
  /**
   * Fuel-supply connector glyph strokes — per `domain:'fuel'` connector (the gas/oil
   * combustion fuel inlet / τροφοδοσία καυσίμου): a stub capped with a gas-cock isolation
   * valve glyph (bow-tie «▷◁» plug valve + a short operating lever). Kept separate from
   * `strokes` so the piped fuel line reads distinctly from the water pipes and the exhaust
   * duct — every connector domain has its own unmistakable symbol in plan (Revit-grade).
   */
  readonly fuelStrokes: readonly BoilerStroke[];
  /**
   * Boiler glyph strokes — drawn with a thin line.
   *   [0] horizontal divider across the body
   *   [1..3] upward triangle (burner/flame mark, 3 sides as separate strokes)
   */
  readonly glyphStrokes: readonly BoilerStroke[];
}

/** Fractional height from the bottom edge at which the divider sits. */
const DIVIDER_FRAC = 0.40;

/** Half-size of the flame triangle as a fraction of the body width. */
const FLAME_HALF_WIDTH_FRAC = 0.14;

/** Fractional height of the flame triangle apex above the divider. */
const FLAME_HEIGHT_FRAC = 0.22;

/** Chevron arrowhead leg length as a fraction of the stub length (flue vent glyph). */
const VENT_ARROW_LEN_FRAC = 0.32;

/** Chevron arrowhead half-width as a fraction of the stub length (flue vent glyph). */
const VENT_ARROW_HALF_FRAC = 0.2;

/** Half-length of the gas-cock bow-tie along the flow axis, as a fraction of the stub. */
const COCK_VALVE_LEN_FRAC = 0.22;

/** Half-width of the gas-cock bow-tie base (perpendicular to flow), as a fraction of the stub. */
const COCK_VALVE_HALF_FRAC = 0.16;

/** Length of the gas-cock operating lever (perpendicular to flow), as a fraction of the stub. */
const COCK_HANDLE_LEN_FRAC = 0.22;

/** Half-width of the gas-cock lever crossbar (along flow), as a fraction of the stub. */
const COCK_HANDLE_BAR_FRAC = 0.12;

/** Below this magnitude the outward direction is treated as degenerate (skip the stub). */
const MIN_OUTWARD_LEN = 1e-6;

function lerp(a: Point3D, b: Point3D, t: number): Point3D {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: 0 };
}

function unit(dx: number, dy: number): { x: number; y: number } {
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/**
 * Build the horizontal divider stroke across the boiler body.
 *
 * The divider runs from the −Y side to the +Y side (same orientation as fin bars
 * on the radiator) at `DIVIDER_FRAC` of the way from the bottom (−X edge) to the
 * top (+X edge). Rotation-aware for free (verts are already in world space).
 */
function buildDividerStroke(v0: Point3D, v1: Point3D, v2: Point3D, v3: Point3D): BoilerStroke {
  // Left wall of the body: v0→v3; right wall: v1→v2
  const leftPt  = lerp(v0, v3, DIVIDER_FRAC);  // point on −X edge at the divider height
  const rightPt = lerp(v1, v2, DIVIDER_FRAC);  // matching point on +X edge
  return [leftPt, rightPt];
}

/**
 * Build the upward-pointing triangle (flame/burner glyph) centred below the divider.
 *
 * The triangle sits in the lower chamber (below the divider). Its base is centred
 * on the body centroid, and its apex points toward the divider. Width and height are
 * proportional to the body dimensions (parametric, rotation-aware).
 */
function buildFlameStrokes(v0: Point3D, v1: Point3D, v2: Point3D, v3: Point3D): BoilerStroke[] {
  // Body width direction (−X edge to +X edge centroid, a.k.a. local X axis in world)
  const widthDir  = unit(v1.x - v0.x, v1.y - v0.y);
  // Body depth direction (−Y edge to +Y edge centroid, a.k.a. local Y axis in world)
  const depthDir  = unit(v3.x - v0.x, v3.y - v0.y);

  // Body dimensions in canvas units
  const bodyWidthVec  = { x: v1.x - v0.x, y: v1.y - v0.y };
  const bodyWidth  = Math.hypot(bodyWidthVec.x, bodyWidthVec.y);
  const bodyDepthVec  = { x: v3.x - v0.x, y: v3.y - v0.y };
  const bodyDepth = Math.hypot(bodyDepthVec.x, bodyDepthVec.y);

  // Centroid of the whole footprint
  const cx = (v0.x + v1.x + v2.x + v3.x) / 4;
  const cy = (v0.y + v1.y + v2.y + v3.y) / 4;

  // Flame centre: offset from footprint centroid toward the bottom (−width direction)
  // so it sits in the lower chamber (between bottom edge and divider).
  const chamberCentreOffset = bodyWidth * (0.5 - DIVIDER_FRAC / 2);
  const flameCx = cx - widthDir.x * chamberCentreOffset * 0.5;
  const flameCy = cy - widthDir.y * chamberCentreOffset * 0.5;

  // Triangle geometry
  const halfBase = bodyDepth * FLAME_HALF_WIDTH_FRAC;
  const flameH   = bodyWidth * FLAME_HEIGHT_FRAC;

  // Base-left and base-right (along depth axis)
  const baseLeft:  Point3D = {
    x: flameCx - depthDir.x * halfBase,
    y: flameCy - depthDir.y * halfBase,
    z: 0,
  };
  const baseRight: Point3D = {
    x: flameCx + depthDir.x * halfBase,
    y: flameCy + depthDir.y * halfBase,
    z: 0,
  };
  // Apex: upward (toward the divider, i.e. +width direction)
  const apex: Point3D = {
    x: flameCx + widthDir.x * flameH,
    y: flameCy + widthDir.y * flameH,
    z: 0,
  };

  return [
    [baseLeft,  baseRight],  // base
    [baseLeft,  apex],       // left leg
    [baseRight, apex],       // right leg
  ];
}

/**
 * Build the distinct vent glyph for a `domain:'duct'` connector (the combustion flue /
 * καπναγωγός): a straight stub from `root` along `outward`, capped with a chevron «^»
 * arrowhead at the tip pointing outward (exhaust flow). This reads differently from the
 * plain pipe stubs so the gas duct is unmistakable in plan. Pure + rotation-aware (the
 * `outward` direction is already world-rotated). Returns [stub, leftLeg, rightLeg].
 */
function buildFlueVentStroke(
  root: Point3D,
  outward: { x: number; y: number },
  stubLen: number,
): BoilerStroke[] {
  const tip: Point3D = { x: root.x + outward.x * stubLen, y: root.y + outward.y * stubLen, z: 0 };
  // Perpendicular to the outward direction (for the chevron half-width).
  const perp = { x: -outward.y, y: outward.x };
  const arrowLen = stubLen * VENT_ARROW_LEN_FRAC;
  const arrowHalf = stubLen * VENT_ARROW_HALF_FRAC;
  // Back-of-arrow centre, then split ± perpendicular to form the chevron legs.
  const backX = tip.x - outward.x * arrowLen;
  const backY = tip.y - outward.y * arrowLen;
  const legLeft:  Point3D = { x: backX + perp.x * arrowHalf, y: backY + perp.y * arrowHalf, z: 0 };
  const legRight: Point3D = { x: backX - perp.x * arrowHalf, y: backY - perp.y * arrowHalf, z: 0 };
  return [
    [root, tip],      // stub
    [legLeft, tip],   // chevron left leg
    [legRight, tip],  // chevron right leg
  ];
}

/**
 * Build the distinct gas-cock glyph for a `domain:'fuel'` connector (the gas/oil combustion
 * fuel inlet / τροφοδοσία καυσίμου): a straight stub from `root` along `outward`, capped at
 * the tip with a manual isolation-valve symbol — the classic bow-tie «▷◁» (two triangles
 * meeting apex-to-apex = a plug/cock valve) plus a short operating lever projecting sideways
 * (the cock handle). This reads unmistakably as a hand-operated fuel shutoff, distinct from
 * the plain water stubs and the flue chevron. Pure + rotation-aware (the `outward` direction
 * is already world-rotated). Returns [stub, leftTriangle, rightTriangle, leverStem, leverBar].
 */
function buildFuelCockStroke(
  root: Point3D,
  outward: { x: number; y: number },
  stubLen: number,
): BoilerStroke[] {
  const tip: Point3D = { x: root.x + outward.x * stubLen, y: root.y + outward.y * stubLen, z: 0 };
  // Perpendicular to the outward direction (the bow-tie's lateral / lever axis).
  const perp = { x: -outward.y, y: outward.x };
  const valveHalfLen = stubLen * COCK_VALVE_LEN_FRAC;   // along flow
  const valveHalf = stubLen * COCK_VALVE_HALF_FRAC;     // perpendicular (base half-width)
  const handleLen = stubLen * COCK_HANDLE_LEN_FRAC;     // lever stem (perpendicular)
  const barHalf = stubLen * COCK_HANDLE_BAR_FRAC;       // lever crossbar half (along flow)

  // Bow-tie centred on the tip: apexes meet at `tip`, bases splay ± along the flow axis.
  const apex = tip;
  // Inner base (toward the boiler), split ± perpendicular.
  const inBaseTop: Point3D = pointAt(apex, outward, perp, -valveHalfLen, valveHalf);
  const inBaseBot: Point3D = pointAt(apex, outward, perp, -valveHalfLen, -valveHalf);
  // Outer base (away from the boiler), split ± perpendicular.
  const outBaseTop: Point3D = pointAt(apex, outward, perp, valveHalfLen, valveHalf);
  const outBaseBot: Point3D = pointAt(apex, outward, perp, valveHalfLen, -valveHalf);

  // Operating lever: a stem from the valve centre out along +perp, ending in a small crossbar.
  const stemEnd: Point3D = pointAt(apex, outward, perp, 0, handleLen);
  const barLeft: Point3D = pointAt(stemEnd, outward, perp, barHalf, 0);
  const barRight: Point3D = pointAt(stemEnd, outward, perp, -barHalf, 0);

  return [
    [root, tip],                              // stub
    [apex, inBaseTop, inBaseBot, apex],       // inner triangle (closed)
    [apex, outBaseTop, outBaseBot, apex],     // outer triangle (closed)
    [apex, stemEnd],                          // lever stem
    [barLeft, barRight],                      // lever crossbar (cock handle)
  ];
}

/** Point at `alongOut` (flow axis) + `alongPerp` (perpendicular) from `origin`. */
function pointAt(
  origin: Point3D,
  outward: { x: number; y: number },
  perp: { x: number; y: number },
  alongOut: number,
  alongPerp: number,
): Point3D {
  return {
    x: origin.x + outward.x * alongOut + perp.x * alongPerp,
    y: origin.y + outward.y * alongOut + perp.y * alongPerp,
    z: 0,
  };
}

/**
 * Build the boiler symbol geometry from params + computed geometry. Rectangular
 * cabinet → a divider + flame glyph plus ONE stub per embedded connector, all
 * rotation-aware because both the footprint and the connectors are resolved into world.
 *
 * Connector stubs are derived from `buildBoilerConnectors(params)` — the SSoT that seeds
 * the boiler's real connectors — so the plan symbol always matches the actual ports:
 *   - `domain:'pipe'` (supply outlet +X, return inlet −X, and any combi DHW hot/cold/recirc
 *     corners) → a straight stub from the connector's world position pointing outward (the
 *     normalised connector offset). Supply/return reproduce EXACTLY their prior geometry
 *     (supply at +X edge midpoint, return at −X edge midpoint) — regression-free.
 *   - `domain:'duct'` (the gas/oil combustion flue) → a distinct vent glyph (stub + chevron).
 *
 * NOTE: supply is at the +X end (flow:'out' → sources hydronic supply) and return at the
 * −X end (flow:'in') — REVERSED vs the radiator (which has supply at −X end).
 */
export function buildMepBoilerSymbol(
  params: MepBoilerParams,
  geometry: MepBoilerGeometry,
): BoilerSymbolGeometry {
  const outline = geometry.footprint.vertices;
  if (outline.length !== 4) {
    return { outline, strokes: [], ventStrokes: [], fuelStrokes: [], glyphStrokes: [] };
  }

  // v0=(-hw,-hl) v1=(hw,-hl) v2=(hw,hl) v3=(-hw,hl) — rotated to world.
  const [v0, v1, v2, v3] = outline;
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const stubLen = Math.max(params.length * s * 0.8, 60 * s);

  // Connector-driven stubs (FULL SSOT): one stub per real connector, at its true world
  // position. `connectorWorldPosition` = hostPosition + R·localPosition, so the outward
  // direction is `normalize(worldPos − hostPosition)` = R·(normalised local offset).
  const strokes: ClassifiedBoilerStroke[] = [];
  const ventStrokes: ClassifiedBoilerStroke[] = [];
  const fuelStrokes: BoilerStroke[] = [];
  for (const connector of buildBoilerConnectors(params)) {
    const root = connectorWorldPosition(connector, params.position, params.rotation);
    const len = Math.hypot(root.x - params.position.x, root.y - params.position.y);
    if (len < MIN_OUTWARD_LEN) continue; // connector at the origin — no meaningful stub direction
    const outward = { x: (root.x - params.position.x) / len, y: (root.y - params.position.y) / len };
    if (connector.domain === 'duct') {
      // Flue (καπναγωγός) — tag every chevron/terminal stroke with the duct classification
      // (`exhaust`) so the renderer colours the whole vent glyph grey via the colour SSoT.
      const ductClass = connector.duct?.systemClassification;
      ventStrokes.push(
        ...buildFlueVentStroke(root, outward, stubLen).map((line) => ({ line, classification: ductClass })),
      );
      // VENT TERMINAL (καμινάδα) — cap the chevron tip with the termination-type glyph.
      const tip: Point3D = { x: root.x + outward.x * stubLen, y: root.y + outward.y * stubLen, z: 0 };
      ventStrokes.push(
        ...buildFlueTerminalGlyph(tip, outward, stubLen, params.flueTermination ?? DEFAULT_FLUE_TERMINATION).map(
          (line) => ({ line, classification: ductClass }),
        ),
      );
    } else if (connector.domain === 'fuel') {
      // FUEL INLET (τροφοδοσία καυσίμου) — a distinct gas-cock isolation-valve glyph so the
      // piped fuel line reads differently from the water stubs and the exhaust duct. The fuel
      // domain is NOT covered by the colour SSoT, so the gas-cock keeps the default boiler
      // stroke (it is already shape-distinct) — left untagged in `fuelStrokes`.
      fuelStrokes.push(...buildFuelCockStroke(root, outward, stubLen));
    } else {
      // Pipe stub — tag with the connector's plumbing classification (supply/return, DHW
      // hot/cold, drainage) so the renderer colours it per Revit convention.
      strokes.push({
        line: [root, { x: root.x + outward.x * stubLen, y: root.y + outward.y * stubLen, z: 0 }],
        classification: connector.pipe?.systemClassification,
      });
    }
  }

  const glyphStrokes: BoilerStroke[] = [
    buildDividerStroke(v0, v1, v2, v3),
    ...buildFlameStrokes(v0, v1, v2, v3),
  ];

  return { outline, strokes, ventStrokes, fuelStrokes, glyphStrokes };
}
