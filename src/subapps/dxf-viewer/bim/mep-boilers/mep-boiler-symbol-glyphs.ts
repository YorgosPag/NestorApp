/**
 * Pure glyph/stroke/outline builder helpers for the boiler 2D symbol (ADR-408).
 *
 * Extracted from `mep-boiler-symbol.ts` to keep both files ≤500 lines (Google SRP).
 * All functions here are pure geometry helpers with NO side effects. The main entry
 * point (`buildMepBoilerSymbol`) lives in the sibling file and imports from here.
 */

import type { BimPoint } from '../types/bim-base';
import {
  bodyFrame,
  frameArc,
  framePoint,
  lerpPlanPoint,
  shiftFrame,
  stubFrame,
  type PlanAxis,
} from '../geometry/shared/plan-frame';

/** A polyline of world-space points (canvas units). Re-exported by `mep-boiler-symbol.ts`. */
export type BoilerStroke = readonly BimPoint[];

// ---------------------------------------------------------------------------
// Private constants — fractional geometry parameters for glyph builders
// ---------------------------------------------------------------------------

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

/** Depth of the condensate P-trap U-bend along the flow axis, as a fraction of the stub. */
const TRAP_DEPTH_FRAC = 0.24;

/** Half-width of the condensate P-trap U-bend (perpendicular to flow), as a fraction of the stub. */
const TRAP_LEG_HALF_FRAC = 0.16;

/** Half-length of the condensate neutraliser cartridge along the flow axis, as a fraction of the stub. */
const NEUTRALISER_LEN_FRAC = 0.16;

/** Half-width of the condensate neutraliser cartridge (perpendicular to flow), as a fraction of the stub. */
const NEUTRALISER_HALF_FRAC = 0.13;

/** Safety-valve body centre offset toward the top edge (+width), as a fraction of the body width. */
const VALVE_CENTRE_WIDTH_FRAC = 0.28;

/** Safety-valve body centre lateral offset (+depth), as a fraction of the body depth. */
const VALVE_CENTRE_DEPTH_FRAC = 0.22;

/** Half-length of each bow-tie triangle along the discharge axis, as a fraction of the body width. */
const VALVE_BODY_HALF_FRAC = 0.07;

/** Bow-tie base half-width (perpendicular to discharge), as a fraction of the body depth. */
const VALVE_BODY_WIDE_FRAC = 0.06;

/** Discharge-stem length beyond the valve body, as a fraction of the body width. */
const VALVE_DISCHARGE_FRAC = 0.12;

/** Discharge chevron leg length, as a fraction of the body width. */
const VALVE_ARROW_LEN_FRAC = 0.05;

/** Discharge chevron half-width, as a fraction of the body depth. */
const VALVE_ARROW_HALF_FRAC = 0.05;

/** Expansion-vessel centre offset toward the top edge (+width), as a fraction of the body width. */
const VESSEL_CENTRE_WIDTH_FRAC = 0.28;

/** Expansion-vessel centre lateral offset (−depth, OPPOSITE the relief valve), as a fraction of the body depth. */
const VESSEL_CENTRE_DEPTH_FRAC = 0.22;

/** Expansion-vessel circle radius, as a fraction of the body depth. */
const VESSEL_RADIUS_FRAC = 0.1;

/** Expansion-vessel connection-stem length (inward, toward the body), as a fraction of the body width. */
const VESSEL_STEM_FRAC = 0.06;

/** Number of polyline segments approximating the expansion-vessel circle (no arc primitive). */
const VESSEL_SEGMENTS = 16;

/** Pressure-gauge centre offset toward the bottom edge (−width, lower chamber), as a fraction of the body width. */
const GAUGE_CENTRE_WIDTH_FRAC = 0.28;

/** Pressure-gauge centre lateral offset (+depth, SAME side as the relief valve but in the lower chamber), as a fraction of the body depth. */
const GAUGE_CENTRE_DEPTH_FRAC = 0.22;

/** Pressure-gauge dial radius, as a fraction of the body depth. */
const GAUGE_RADIUS_FRAC = 0.1;

/** Pressure-gauge needle length, as a fraction of the dial radius (stays inside the dial). */
const GAUGE_NEEDLE_FRAC = 0.82;

/** Pressure-gauge centre-pivot dot half-size, as a fraction of the dial radius. */
const GAUGE_PIVOT_FRAC = 0.16;

/** Pressure-gauge needle bearing — a fixed ~45° dial reading (cos/sin of π/4), in local dial axes. */
const GAUGE_NEEDLE_COS = Math.SQRT1_2;
const GAUGE_NEEDLE_SIN = Math.SQRT1_2;

/** Filling-loop centre offset toward the bottom edge (−width, lower chamber), as a fraction of the body width. */
const FILLING_CENTRE_WIDTH_FRAC = 0.28;

/** Filling-loop centre lateral offset (−depth, OPPOSITE the pressure gauge), as a fraction of the body depth. */
const FILLING_CENTRE_DEPTH_FRAC = 0.22;

/** Half-length of the filling-loop pipe run along the lateral (perp) flow axis, as a fraction of the body depth. */
const FILLING_RUN_HALF_FRAC = 0.1;

/** Double-check-valve chevron leg length (along the flow axis), as a fraction of the body depth. */
const FILLING_CHEVRON_LEN_FRAC = 0.05;

/** Double-check-valve chevron half-width (across the flow axis), as a fraction of the body width. */
const FILLING_CHEVRON_HALF_FRAC = 0.04;

/** Flexible-loop semicircle bulge radius (in the +width direction), as a fraction of the body width. */
const FILLING_LOOP_RADIUS_FRAC = 0.06;

/** Isolation-valve end-tick half-length (across the run), as a fraction of the body width. */
const FILLING_TICK_HALF_FRAC = 0.04;

// ---------------------------------------------------------------------------
// Glyph/stroke/outline builders (pure, rotation-aware)
// ---------------------------------------------------------------------------

/**
 * Build the service-clearance envelope (Revit «Clearances»): the footprint rectangle offset
 * outward by `clearanceCanvas` on every side, rotation-aware. Returns a closed 4-vertex polygon.
 */
export function buildClearanceOutline(
  v0: BimPoint,
  v1: BimPoint,
  v2: BimPoint,
  v3: BimPoint,
  clearanceCanvas: number,
): BimPoint[] {
  const { along: w, perp: d } = bodyFrame(v0, v1, v2, v3); // local +X (width) / +Y (depth) in world
  const c = clearanceCanvas;
  return [
    { x: v0.x - w.x * c - d.x * c, y: v0.y - w.y * c - d.y * c, z: 0 }, // −X/−Y corner
    { x: v1.x + w.x * c - d.x * c, y: v1.y + w.y * c - d.y * c, z: 0 }, // +X/−Y corner
    { x: v2.x + w.x * c + d.x * c, y: v2.y + w.y * c + d.y * c, z: 0 }, // +X/+Y corner
    { x: v3.x - w.x * c + d.x * c, y: v3.y - w.y * c + d.y * c, z: 0 }, // −X/+Y corner
  ];
}

/**
 * Build the horizontal divider stroke across the boiler body at `DIVIDER_FRAC` height.
 * Rotation-aware (verts are already in world space).
 */
export function buildDividerStroke(v0: BimPoint, v1: BimPoint, v2: BimPoint, v3: BimPoint): BoilerStroke {
  // Left wall of the body: v0→v3; right wall: v1→v2
  const leftPt  = lerpPlanPoint(v0, v3, DIVIDER_FRAC);  // point on −X edge at the divider height
  const rightPt = lerpPlanPoint(v1, v2, DIVIDER_FRAC);  // matching point on +X edge
  return [leftPt, rightPt];
}

/**
 * Build the upward-pointing triangle (flame/burner glyph) centred in the lower chamber.
 * Proportional to body dimensions, rotation-aware. Returns [base, leftLeg, rightLeg].
 */
export function buildFlameStrokes(v0: BimPoint, v1: BimPoint, v2: BimPoint, v3: BimPoint): BoilerStroke[] {
  const body = bodyFrame(v0, v1, v2, v3);

  // Flame frame: offset from the footprint centroid toward the bottom (−width direction)
  // so it sits in the lower chamber (between bottom edge and divider).
  const chamberCentreOffset = body.width * (0.5 - DIVIDER_FRAC / 2);
  const flame = shiftFrame(body, -chamberCentreOffset * 0.5, 0);

  // Triangle geometry
  const halfBase = body.depth * FLAME_HALF_WIDTH_FRAC;
  const flameH   = body.width * FLAME_HEIGHT_FRAC;

  // Base-left and base-right (along depth axis); apex upward (toward the divider, +width).
  const baseLeft  = framePoint(flame, 0, -halfBase);
  const baseRight = framePoint(flame, 0, halfBase);
  const apex      = framePoint(flame, flameH, 0);

  return [
    [baseLeft,  baseRight],  // base
    [baseLeft,  apex],       // left leg
    [baseRight, apex],       // right leg
  ];
}

/**
 * Build the SAFETY RELIEF VALVE body glyph (ασφαλιστική βαλβίδα) — bow-tie «▷◁» valve body
 * + discharge stem + chevron arrowhead, drawn ON the boiler body (not a perimeter connector).
 * Pure + rotation-aware. Returns [innerTriangle, outerTriangle, stem, chevronL, chevronR].
 */
export function buildSafetyValveGlyph(v0: BimPoint, v1: BimPoint, v2: BimPoint, v3: BimPoint): BoilerStroke[] {
  const body = bodyFrame(v0, v1, v2, v3);

  // Valve frame: from the footprint centroid, up toward the top edge + offset laterally so it
  // sits in the upper chamber clear of the central supply stub.
  const valve = shiftFrame(
    body,
    body.width * VALVE_CENTRE_WIDTH_FRAC,
    body.depth * VALVE_CENTRE_DEPTH_FRAC,
  );
  const centre = valve.origin;

  const bodyHalf = body.width * VALVE_BODY_HALF_FRAC;   // triangle half-length along discharge
  const baseHalf = body.depth * VALVE_BODY_WIDE_FRAC;   // bow-tie base half-width
  const discharge = body.width * VALVE_DISCHARGE_FRAC;  // stem length beyond the body
  const arrowLen = body.width * VALVE_ARROW_LEN_FRAC;
  const arrowHalf = body.depth * VALVE_ARROW_HALF_FRAC;

  // Bow-tie body: apexes meet at `centre`, bases splay ± along the discharge axis.
  const inBaseTop  = framePoint(valve, -bodyHalf, baseHalf);
  const inBaseBot  = framePoint(valve, -bodyHalf, -baseHalf);
  const outBaseTop = framePoint(valve, bodyHalf, baseHalf);
  const outBaseBot = framePoint(valve, bodyHalf, -baseHalf);

  // Discharge stem from the outer base centre outward, capped with a chevron arrowhead.
  const stemStart = framePoint(valve, bodyHalf, 0);
  const stemEnd   = framePoint(valve, bodyHalf + discharge, 0);
  const chevLeft  = framePoint(valve, bodyHalf + discharge - arrowLen, arrowHalf);
  const chevRight = framePoint(valve, bodyHalf + discharge - arrowLen, -arrowHalf);

  return [
    [centre, inBaseTop, inBaseBot, centre],   // inner triangle (closed)
    [centre, outBaseTop, outBaseBot, centre], // outer triangle (closed)
    [stemStart, stemEnd],                     // discharge stem
    [chevLeft, stemEnd],                      // chevron left leg
    [chevRight, stemEnd],                     // chevron right leg
  ];
}

/**
 * Build the EXPANSION VESSEL body glyph (δοχείο διαστολής, IFC `IfcTank` EXPANSION) — classic
 * diaphragm-vessel symbol: circle (N-gon) + membrane chord + connection stem. Placed in the upper
 * chamber (−depth) opposite the relief valve. Pure + rotation-aware. Returns [circle, diaphragm, stem].
 */
export function buildExpansionVesselGlyph(v0: BimPoint, v1: BimPoint, v2: BimPoint, v3: BimPoint): BoilerStroke[] {
  const body = bodyFrame(v0, v1, v2, v3);

  // Vessel frame: upper chamber (+width), lateral side OPPOSITE the relief valve (−depth).
  const vessel = shiftFrame(
    body,
    body.width * VESSEL_CENTRE_WIDTH_FRAC,
    -body.depth * VESSEL_CENTRE_DEPTH_FRAC,
  );

  const r = body.depth * VESSEL_RADIUS_FRAC; // equal world radius along both axes → a true circle
  const stemLen = body.width * VESSEL_STEM_FRAC;

  // Circle as a closed N-gon (the rim faces are built from the two local axes scaled equally).
  const circle = frameArc(vessel, r, 0, 2 * Math.PI, VESSEL_SEGMENTS);

  // Diaphragm: a diameter chord along the lateral (perp) axis = a «horizontal» membrane line.
  const diaphragm: BoilerStroke = [
    framePoint(vessel, 0, r),
    framePoint(vessel, 0, -r),
  ];

  // Connection stem: from the inner rim (−width) running inward toward the body centroid.
  const stem: BoilerStroke = [
    framePoint(vessel, -r, 0),
    framePoint(vessel, -(r + stemLen), 0),
  ];

  return [circle, diaphragm, stem];
}

/**
 * Build the PRESSURE GAUGE body glyph (μανόμετρο, IFC `IfcSensor` PRESSURE) — dial-gauge symbol:
 * circle (N-gon) + diagonal needle + central pivot dot. Placed in the lower chamber (+depth) distinct
 * from flame (centre), valve (+depth upper) and vessel (−depth upper). Pure + rotation-aware.
 * Returns [circle, needle, pivot].
 */
export function buildPressureGaugeGlyph(v0: BimPoint, v1: BimPoint, v2: BimPoint, v3: BimPoint): BoilerStroke[] {
  const body = bodyFrame(v0, v1, v2, v3);

  // Gauge frame: lower chamber (−width), relief-valve lateral side (+depth), clear of the flame.
  const gauge = shiftFrame(
    body,
    -body.width * GAUGE_CENTRE_WIDTH_FRAC,
    body.depth * GAUGE_CENTRE_DEPTH_FRAC,
  );

  const r = body.depth * GAUGE_RADIUS_FRAC; // equal world radius along both axes → a true circle
  const needle = r * GAUGE_NEEDLE_FRAC;
  const pivot = r * GAUGE_PIVOT_FRAC;

  // Dial face as a closed N-gon (rim faces built from the two local axes scaled equally).
  const circle = frameArc(gauge, r, 0, 2 * Math.PI, VESSEL_SEGMENTS);

  // Needle: from the centre out to a fixed ~45° bearing in the local dial axes (a dial reading).
  const needleLine: BoilerStroke = [
    gauge.origin,
    framePoint(gauge, needle * GAUGE_NEEDLE_COS, needle * GAUGE_NEEDLE_SIN),
  ];

  // Central pivot: a small closed diamond at the dial centre (the needle bearing).
  const pivotDot: BoilerStroke = [
    framePoint(gauge, pivot, 0),
    framePoint(gauge, 0, pivot),
    framePoint(gauge, -pivot, 0),
    framePoint(gauge, 0, -pivot),
    framePoint(gauge, pivot, 0),
  ];

  return [circle, needleLine, pivotDot];
}

/**
 * Build the FILLING LOOP body glyph (βρόχος πλήρωσης, Revit/IFC `IfcValve` CHECK) — the device that
 * charges a SEALED heating system to its cold-fill pressure (the gauge's `systemPressureBar`). Drawn
 * as a short pipe run carrying a DOUBLE-CHECK VALVE (two «»» chevrons in series, the WRAS backflow
 * preventer) with a flexible-connector loop (a small semicircle bulge) and an isolation-valve tick at
 * each end. Placed in the lower chamber (−width) on the lateral side OPPOSITE the pressure gauge
 * (−depth) — the fourth distinct sealed-system position (flame=centre, valve=+w/+d, vessel=+w/−d,
 * gauge=−w/+d). Pure + rotation-aware. Returns [run, chevron1, chevron2, loopArc, tick1, tick2].
 */
export function buildFillingLoopGlyph(v0: BimPoint, v1: BimPoint, v2: BimPoint, v3: BimPoint): BoilerStroke[] {
  const body = bodyFrame(v0, v1, v2, v3);

  // Loop frame: lower chamber (−width), lateral side OPPOSITE the gauge (−depth), clear of the flame.
  const loop = shiftFrame(
    body,
    -body.width * FILLING_CENTRE_WIDTH_FRAC,
    -body.depth * FILLING_CENTRE_DEPTH_FRAC,
  );

  const runHalf = body.depth * FILLING_RUN_HALF_FRAC;     // run extends ± along the lateral (perp) axis
  const chevLen = body.depth * FILLING_CHEVRON_LEN_FRAC;  // chevron leg length along the flow (perp)
  const chevHalf = body.width * FILLING_CHEVRON_HALF_FRAC; // chevron half-width across the flow (along)
  const r = body.width * FILLING_LOOP_RADIUS_FRAC;        // flexible-loop semicircle bulge radius
  const tickHalf = body.width * FILLING_TICK_HALF_FRAC;   // isolation-valve end-tick half-length

  // Pipe run: a straight segment along the lateral (perp) flow axis through the centre.
  const run: BoilerStroke = [
    framePoint(loop, 0, -runHalf),
    framePoint(loop, 0, runHalf),
  ];

  // Double-check valve: two chevrons «»» pointing in the +perp flow direction, in series along the run.
  // Each chevron is one open polyline: legLeft → apex → legRight.
  const chevron = (atPerp: number): BoilerStroke => [
    framePoint(loop, chevHalf, atPerp),
    framePoint(loop, 0, atPerp + chevLen),
    framePoint(loop, -chevHalf, atPerp),
  ];
  const chevron1 = chevron(-runHalf * 0.45);
  const chevron2 = chevron(runHalf * 0.1);

  // Flexible-connector loop: a small semicircle bulging in the +width (+along) direction at the centre,
  // sweeping from (−r along perp) up over (+r along the bulge axis) to (+r along perp). N-gon half-circle.
  // Starting at −90° puts the sweep's first point on −perp and its apex on +along.
  const loopArc = frameArc(loop, r, -Math.PI / 2, Math.PI, VESSEL_SEGMENTS);

  // Isolation valves: a short cross-tick across the run at each end (the two service stop-cocks).
  const tick1: BoilerStroke = [
    framePoint(loop, -tickHalf, -runHalf),
    framePoint(loop, tickHalf, -runHalf),
  ];
  const tick2: BoilerStroke = [
    framePoint(loop, -tickHalf, runHalf),
    framePoint(loop, tickHalf, runHalf),
  ];

  return [run, chevron1, chevron2, loopArc, tick1, tick2];
}

/**
 * Build the flue vent glyph (καπναγωγός) for `domain:'duct'` connectors: stub + chevron «^»
 * at the tip. Pure + rotation-aware. Returns [stub, leftLeg, rightLeg].
 */
export function buildFlueVentStroke(
  root: BimPoint,
  outward: PlanAxis,
  stubLen: number,
): BoilerStroke[] {
  const stub = stubFrame(root, outward);
  const tip = framePoint(stub, stubLen, 0);
  const arrowLen = stubLen * VENT_ARROW_LEN_FRAC;
  const arrowHalf = stubLen * VENT_ARROW_HALF_FRAC;
  // Back-of-arrow centre, then split ± perpendicular to form the chevron legs.
  const legLeft  = framePoint(stub, stubLen - arrowLen, arrowHalf);
  const legRight = framePoint(stub, stubLen - arrowLen, -arrowHalf);
  return [
    [root, tip],      // stub
    [legLeft, tip],   // chevron left leg
    [legRight, tip],  // chevron right leg
  ];
}

/**
 * Build the gas-cock glyph (τροφοδοσία καυσίμου) for `domain:'fuel'` connectors: stub + bow-tie
 * «▷◁» valve + lever. Pure + rotation-aware. Returns [stub, leftTriangle, rightTriangle, leverStem, leverBar].
 */
export function buildFuelCockStroke(
  root: BimPoint,
  outward: PlanAxis,
  stubLen: number,
): BoilerStroke[] {
  const stub = stubFrame(root, outward);
  // Bow-tie centred on the tip: apexes meet at `tip`, bases splay ± along the flow axis.
  const valve = shiftFrame(stub, stubLen, 0);
  const tip = valve.origin;
  const apex = tip;
  const valveHalfLen = stubLen * COCK_VALVE_LEN_FRAC;   // along flow
  const valveHalf = stubLen * COCK_VALVE_HALF_FRAC;     // perpendicular (base half-width)
  const handleLen = stubLen * COCK_HANDLE_LEN_FRAC;     // lever stem (perpendicular)
  const barHalf = stubLen * COCK_HANDLE_BAR_FRAC;       // lever crossbar half (along flow)

  // Inner base (toward the boiler), split ± perpendicular.
  const inBaseTop = framePoint(valve, -valveHalfLen, valveHalf);
  const inBaseBot = framePoint(valve, -valveHalfLen, -valveHalf);
  // Outer base (away from the boiler), split ± perpendicular.
  const outBaseTop = framePoint(valve, valveHalfLen, valveHalf);
  const outBaseBot = framePoint(valve, valveHalfLen, -valveHalf);

  // Operating lever: a stem from the valve centre out along +perp, ending in a small crossbar.
  const lever = shiftFrame(valve, 0, handleLen);
  const stemEnd = lever.origin;
  const barLeft = framePoint(lever, barHalf, 0);
  const barRight = framePoint(lever, -barHalf, 0);

  return [
    [root, tip],                              // stub
    [apex, inBaseTop, inBaseBot, apex],       // inner triangle (closed)
    [apex, outBaseTop, outBaseBot, apex],     // outer triangle (closed)
    [apex, stemEnd],                          // lever stem
    [barLeft, barRight],                      // lever crossbar (cock handle)
  ];
}

/**
 * Build the condensate-drain P-trap glyph (αποχέτευση συμπυκνωμάτων) for `sanitary-drainage`
 * connectors on a condensing boiler — stub + «∪» water-seal bend at the tip. Pure + rotation-aware.
 * Returns [stub, uBend]; caller tags both `'sanitary-drainage'` → renderer paints them brown.
 */
export function buildCondensateTrapStroke(
  root: BimPoint,
  outward: PlanAxis,
  stubLen: number,
): BoilerStroke[] {
  const trap = shiftFrame(stubFrame(root, outward), stubLen, 0);
  const tip = trap.origin;
  const depth = stubLen * TRAP_DEPTH_FRAC;   // U depth along flow (outward of the tip)
  const half = stubLen * TRAP_LEG_HALF_FRAC; // U half-width perpendicular to flow

  // «∪» water-seal: the mouth (open side) faces back toward the boiler (−outward), the
  // rounded bottom faces outward. Drawn as one open polyline: down the left leg, across
  // the rounded bottom, up the right leg — straddling the stub tip so it reads as a trap.
  const mouthLeft = framePoint(trap, -depth, half);
  const bottomLeft = framePoint(trap, depth, half);
  const bottomMid = framePoint(trap, depth + half, 0);
  const bottomRight = framePoint(trap, depth, -half);
  const mouthRight = framePoint(trap, -depth, -half);

  return [
    [root, tip],                                                       // inlet stub
    [mouthLeft, bottomLeft, bottomMid, bottomRight, mouthRight],       // «∪» water-seal trap
  ];
}

/**
 * Build the condensate NEUTRALISER cartridge glyph (εξουδετερωτής) — in-line rectangle at
 * ~mid-stub. Pure + rotation-aware. Returns [closedRect] tagged `'sanitary-drainage'` → brown.
 */
export function buildCondensateNeutraliserStroke(
  root: BimPoint,
  outward: PlanAxis,
  stubLen: number,
): BoilerStroke[] {
  const halfLen = stubLen * NEUTRALISER_LEN_FRAC; // along flow
  const half = stubLen * NEUTRALISER_HALF_FRAC;   // perpendicular
  // Centre the cartridge at ~mid-stub (between the boiler and the tip trap).
  const cartridge = shiftFrame(stubFrame(root, outward), stubLen * 0.5, 0);
  const c0 = framePoint(cartridge, -halfLen, half);
  const c1 = framePoint(cartridge, halfLen, half);
  const c2 = framePoint(cartridge, halfLen, -half);
  const c3 = framePoint(cartridge, -halfLen, -half);
  return [[c0, c1, c2, c3, c0]]; // closed rectangle
}
