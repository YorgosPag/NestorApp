/**
 * Pure glyph/stroke/outline builder helpers for the boiler 2D symbol (ADR-408).
 *
 * Extracted from `mep-boiler-symbol.ts` to keep both files ≤500 lines (Google SRP).
 * All functions here are pure geometry helpers with NO side effects. The main entry
 * point (`buildMepBoilerSymbol`) lives in the sibling file and imports from here.
 */

import type { Point3D } from '../types/bim-base';

/** A polyline of world-space points (canvas units). Re-exported by `mep-boiler-symbol.ts`. */
export type BoilerStroke = readonly Point3D[];

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

// ---------------------------------------------------------------------------
// Shared micro-helpers (pure)
// ---------------------------------------------------------------------------

export function lerp(a: Point3D, b: Point3D, t: number): Point3D {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: 0 };
}

export function unit(dx: number, dy: number): { x: number; y: number } {
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/** Point at `alongOut` (flow axis) + `alongPerp` (perpendicular) from `origin`. */
export function pointAt(
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

// ---------------------------------------------------------------------------
// Glyph/stroke/outline builders (pure, rotation-aware)
// ---------------------------------------------------------------------------

/**
 * Build the service-clearance envelope (Revit «Clearances»): the footprint rectangle offset
 * outward by `clearanceCanvas` on every side, rotation-aware. Returns a closed 4-vertex polygon.
 */
export function buildClearanceOutline(
  v0: Point3D,
  v1: Point3D,
  v2: Point3D,
  v3: Point3D,
  clearanceCanvas: number,
): Point3D[] {
  const w = unit(v1.x - v0.x, v1.y - v0.y); // local +X (width) direction in world
  const d = unit(v3.x - v0.x, v3.y - v0.y); // local +Y (depth) direction in world
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
export function buildDividerStroke(v0: Point3D, v1: Point3D, v2: Point3D, v3: Point3D): BoilerStroke {
  // Left wall of the body: v0→v3; right wall: v1→v2
  const leftPt  = lerp(v0, v3, DIVIDER_FRAC);  // point on −X edge at the divider height
  const rightPt = lerp(v1, v2, DIVIDER_FRAC);  // matching point on +X edge
  return [leftPt, rightPt];
}

/**
 * Build the upward-pointing triangle (flame/burner glyph) centred in the lower chamber.
 * Proportional to body dimensions, rotation-aware. Returns [base, leftLeg, rightLeg].
 */
export function buildFlameStrokes(v0: Point3D, v1: Point3D, v2: Point3D, v3: Point3D): BoilerStroke[] {
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
 * Build the SAFETY RELIEF VALVE body glyph (ασφαλιστική βαλβίδα) — bow-tie «▷◁» valve body
 * + discharge stem + chevron arrowhead, drawn ON the boiler body (not a perimeter connector).
 * Pure + rotation-aware. Returns [innerTriangle, outerTriangle, stem, chevronL, chevronR].
 */
export function buildSafetyValveGlyph(v0: Point3D, v1: Point3D, v2: Point3D, v3: Point3D): BoilerStroke[] {
  // Local body axes in world: +X (width, toward the top edge = discharge axis) and +Y (depth, lateral).
  const along = unit(v1.x - v0.x, v1.y - v0.y);
  const perp  = unit(v3.x - v0.x, v3.y - v0.y);
  const bodyWidth = Math.hypot(v1.x - v0.x, v1.y - v0.y);
  const bodyDepth = Math.hypot(v3.x - v0.x, v3.y - v0.y);

  // Valve centre: from the footprint centroid, up toward the top edge + offset laterally so it
  // sits in the upper chamber clear of the central supply stub.
  const cx = (v0.x + v1.x + v2.x + v3.x) / 4;
  const cy = (v0.y + v1.y + v2.y + v3.y) / 4;
  const centre: Point3D = {
    x: cx + along.x * bodyWidth * VALVE_CENTRE_WIDTH_FRAC + perp.x * bodyDepth * VALVE_CENTRE_DEPTH_FRAC,
    y: cy + along.y * bodyWidth * VALVE_CENTRE_WIDTH_FRAC + perp.y * bodyDepth * VALVE_CENTRE_DEPTH_FRAC,
    z: 0,
  };

  const bodyHalf = bodyWidth * VALVE_BODY_HALF_FRAC;   // triangle half-length along discharge
  const baseHalf = bodyDepth * VALVE_BODY_WIDE_FRAC;   // bow-tie base half-width
  const discharge = bodyWidth * VALVE_DISCHARGE_FRAC;  // stem length beyond the body
  const arrowLen = bodyWidth * VALVE_ARROW_LEN_FRAC;
  const arrowHalf = bodyDepth * VALVE_ARROW_HALF_FRAC;

  // Bow-tie body: apexes meet at `centre`, bases splay ± along the discharge axis.
  const inBaseTop  = pointAt(centre, along, perp, -bodyHalf, baseHalf);
  const inBaseBot  = pointAt(centre, along, perp, -bodyHalf, -baseHalf);
  const outBaseTop = pointAt(centre, along, perp, bodyHalf, baseHalf);
  const outBaseBot = pointAt(centre, along, perp, bodyHalf, -baseHalf);

  // Discharge stem from the outer base centre outward, capped with a chevron arrowhead.
  const stemStart = pointAt(centre, along, perp, bodyHalf, 0);
  const stemEnd   = pointAt(centre, along, perp, bodyHalf + discharge, 0);
  const chevLeft  = pointAt(centre, along, perp, bodyHalf + discharge - arrowLen, arrowHalf);
  const chevRight = pointAt(centre, along, perp, bodyHalf + discharge - arrowLen, -arrowHalf);

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
export function buildExpansionVesselGlyph(v0: Point3D, v1: Point3D, v2: Point3D, v3: Point3D): BoilerStroke[] {
  // Local body axes in world: +X (width, toward the top edge) and +Y (depth, lateral).
  const along = unit(v1.x - v0.x, v1.y - v0.y);
  const perp  = unit(v3.x - v0.x, v3.y - v0.y);
  const bodyWidth = Math.hypot(v1.x - v0.x, v1.y - v0.y);
  const bodyDepth = Math.hypot(v3.x - v0.x, v3.y - v0.y);

  // Vessel centre: upper chamber (+width), lateral side OPPOSITE the relief valve (−depth).
  const cx = (v0.x + v1.x + v2.x + v3.x) / 4;
  const cy = (v0.y + v1.y + v2.y + v3.y) / 4;
  const centre: Point3D = {
    x: cx + along.x * bodyWidth * VESSEL_CENTRE_WIDTH_FRAC - perp.x * bodyDepth * VESSEL_CENTRE_DEPTH_FRAC,
    y: cy + along.y * bodyWidth * VESSEL_CENTRE_WIDTH_FRAC - perp.y * bodyDepth * VESSEL_CENTRE_DEPTH_FRAC,
    z: 0,
  };

  const r = bodyDepth * VESSEL_RADIUS_FRAC; // equal world radius along both axes → a true circle
  const stemLen = bodyWidth * VESSEL_STEM_FRAC;

  // Circle as a closed N-gon (the rim faces are built from the two local axes scaled equally).
  const circle: Point3D[] = [];
  for (let i = 0; i <= VESSEL_SEGMENTS; i += 1) {
    const a = (2 * Math.PI * i) / VESSEL_SEGMENTS;
    circle.push(pointAt(centre, along, perp, r * Math.cos(a), r * Math.sin(a)));
  }

  // Diaphragm: a diameter chord along the lateral (perp) axis = a «horizontal» membrane line.
  const diaphragm: BoilerStroke = [
    pointAt(centre, along, perp, 0, r),
    pointAt(centre, along, perp, 0, -r),
  ];

  // Connection stem: from the inner rim (−width) running inward toward the body centroid.
  const stem: BoilerStroke = [
    pointAt(centre, along, perp, -r, 0),
    pointAt(centre, along, perp, -(r + stemLen), 0),
  ];

  return [circle, diaphragm, stem];
}

/**
 * Build the PRESSURE GAUGE body glyph (μανόμετρο, IFC `IfcSensor` PRESSURE) — dial-gauge symbol:
 * circle (N-gon) + diagonal needle + central pivot dot. Placed in the lower chamber (+depth) distinct
 * from flame (centre), valve (+depth upper) and vessel (−depth upper). Pure + rotation-aware.
 * Returns [circle, needle, pivot].
 */
export function buildPressureGaugeGlyph(v0: Point3D, v1: Point3D, v2: Point3D, v3: Point3D): BoilerStroke[] {
  // Local body axes in world: +X (width, toward the top edge) and +Y (depth, lateral).
  const along = unit(v1.x - v0.x, v1.y - v0.y);
  const perp  = unit(v3.x - v0.x, v3.y - v0.y);
  const bodyWidth = Math.hypot(v1.x - v0.x, v1.y - v0.y);
  const bodyDepth = Math.hypot(v3.x - v0.x, v3.y - v0.y);

  // Gauge centre: lower chamber (−width), relief-valve lateral side (+depth), clear of the flame.
  const cx = (v0.x + v1.x + v2.x + v3.x) / 4;
  const cy = (v0.y + v1.y + v2.y + v3.y) / 4;
  const centre: Point3D = {
    x: cx - along.x * bodyWidth * GAUGE_CENTRE_WIDTH_FRAC + perp.x * bodyDepth * GAUGE_CENTRE_DEPTH_FRAC,
    y: cy - along.y * bodyWidth * GAUGE_CENTRE_WIDTH_FRAC + perp.y * bodyDepth * GAUGE_CENTRE_DEPTH_FRAC,
    z: 0,
  };

  const r = bodyDepth * GAUGE_RADIUS_FRAC; // equal world radius along both axes → a true circle
  const needle = r * GAUGE_NEEDLE_FRAC;
  const pivot = r * GAUGE_PIVOT_FRAC;

  // Dial face as a closed N-gon (rim faces built from the two local axes scaled equally).
  const circle: Point3D[] = [];
  for (let i = 0; i <= VESSEL_SEGMENTS; i += 1) {
    const a = (2 * Math.PI * i) / VESSEL_SEGMENTS;
    circle.push(pointAt(centre, along, perp, r * Math.cos(a), r * Math.sin(a)));
  }

  // Needle: from the centre out to a fixed ~45° bearing in the local dial axes (a dial reading).
  const needleLine: BoilerStroke = [
    centre,
    pointAt(centre, along, perp, needle * GAUGE_NEEDLE_COS, needle * GAUGE_NEEDLE_SIN),
  ];

  // Central pivot: a small closed diamond at the dial centre (the needle bearing).
  const pivotDot: BoilerStroke = [
    pointAt(centre, along, perp, pivot, 0),
    pointAt(centre, along, perp, 0, pivot),
    pointAt(centre, along, perp, -pivot, 0),
    pointAt(centre, along, perp, 0, -pivot),
    pointAt(centre, along, perp, pivot, 0),
  ];

  return [circle, needleLine, pivotDot];
}

/**
 * Build the flue vent glyph (καπναγωγός) for `domain:'duct'` connectors: stub + chevron «^»
 * at the tip. Pure + rotation-aware. Returns [stub, leftLeg, rightLeg].
 */
export function buildFlueVentStroke(
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
 * Build the gas-cock glyph (τροφοδοσία καυσίμου) for `domain:'fuel'` connectors: stub + bow-tie
 * «▷◁» valve + lever. Pure + rotation-aware. Returns [stub, leftTriangle, rightTriangle, leverStem, leverBar].
 */
export function buildFuelCockStroke(
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

/**
 * Build the condensate-drain P-trap glyph (αποχέτευση συμπυκνωμάτων) for `sanitary-drainage`
 * connectors on a condensing boiler — stub + «∪» water-seal bend at the tip. Pure + rotation-aware.
 * Returns [stub, uBend]; caller tags both `'sanitary-drainage'` → renderer paints them brown.
 */
export function buildCondensateTrapStroke(
  root: Point3D,
  outward: { x: number; y: number },
  stubLen: number,
): BoilerStroke[] {
  const tip: Point3D = { x: root.x + outward.x * stubLen, y: root.y + outward.y * stubLen, z: 0 };
  // Perpendicular to the outward direction (the U-bend's lateral axis).
  const perp = { x: -outward.y, y: outward.x };
  const depth = stubLen * TRAP_DEPTH_FRAC;   // U depth along flow (outward of the tip)
  const half = stubLen * TRAP_LEG_HALF_FRAC; // U half-width perpendicular to flow

  // «∪» water-seal: the mouth (open side) faces back toward the boiler (−outward), the
  // rounded bottom faces outward. Drawn as one open polyline: down the left leg, across
  // the rounded bottom, up the right leg — straddling the stub tip so it reads as a trap.
  const mouthLeft: Point3D = pointAt(tip, outward, perp, -depth, half);
  const bottomLeft: Point3D = pointAt(tip, outward, perp, depth, half);
  const bottomMid: Point3D = pointAt(tip, outward, perp, depth + half, 0);
  const bottomRight: Point3D = pointAt(tip, outward, perp, depth, -half);
  const mouthRight: Point3D = pointAt(tip, outward, perp, -depth, -half);

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
  root: Point3D,
  outward: { x: number; y: number },
  stubLen: number,
): BoilerStroke[] {
  const perp = { x: -outward.y, y: outward.x };
  const halfLen = stubLen * NEUTRALISER_LEN_FRAC; // along flow
  const half = stubLen * NEUTRALISER_HALF_FRAC;   // perpendicular
  // Centre the cartridge at ~mid-stub (between the boiler and the tip trap).
  const mid: Point3D = { x: root.x + outward.x * stubLen * 0.5, y: root.y + outward.y * stubLen * 0.5, z: 0 };
  const c0 = pointAt(mid, outward, perp, -halfLen, half);
  const c1 = pointAt(mid, outward, perp, halfLen, half);
  const c2 = pointAt(mid, outward, perp, halfLen, -half);
  const c3 = pointAt(mid, outward, perp, -halfLen, -half);
  return [[c0, c1, c2, c3, c0]]; // closed rectangle
}
