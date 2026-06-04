/**
 * ADR-408 Φ11 — generic pipe-fitting BODY geometry SSoT (Revit-grade, all kinds).
 *
 * The ONE source of truth for the physical solid of EVERY auto pipe fitting. It
 * generalises the elbow `mep-fitting-bend.ts` to all six kinds so that the three
 * consumers — 2D plan footprint, 3D mesh, and the segment trim — always derive the
 * same shape from the same parametrisation (no drift between views):
 *   - `mep-fitting-geometry.ts`  → `tessellateFittingFootprint(body)` (2D outline),
 *   - `mep-fitting-to-mesh.ts`   → switches on `body.form` to build the THREE solid,
 *   - `mep-segment-trim.ts`      → `fittingTrimExtent(body)` (how far each pipe is cut).
 *
 * UNIT-AGNOSTIC & PURE (same contract as the bend SSoT): every length (node coords,
 * diameters) is in ONE caller unit and the result comes back in that unit. The 2D
 * caller passes canvas-unit diameters + the real node → a canvas-unit footprint; the
 * 3D caller passes metre diameters + node `{0,0}` → a metre body it meshes; the trim
 * caller passes mm. No store / Firestore / React.
 *
 * `FittingBody` is a discriminated union over `form`:
 *   - `'bend'`   (elbow)            → the swept circular bend (reuses `ElbowBend`).
 *   - `'inline'` (coupling/reducer) → an axial body, equal radii = sleeve cylinder,
 *                                     unequal radii = a reducing cone.
 *   - `'legs'`   (tee/cross)        → one radial arm per incident; the 2D footprint is
 *                                     their union outline (a real "T"/"+" body).
 *   - `'cap'`    (cap)              → a dome closing a dead-end pipe.
 *
 * @see ./mep-fitting-bend.ts — the elbow special case this generalises
 * @see ./mep-fitting-geometry.ts
 * @see ../../bim-3d/converters/mep-fitting-to-mesh.ts
 * @see ../mep-fittings/mep-segment-trim.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ11
 */

import type { Point3D } from '../types/bim-base';
import type { MepFittingKind } from '../types/mep-fitting-types';
import type { ElbowBend } from './mep-fitting-bend';
import { computeElbowBend, tessellateBendFootprint, DEFAULT_BEND_FACTOR } from './mep-fitting-bend';

// ─── Revit-ish body proportions (SSoT — the ONLY place fitting sizes live) ────────

/** Coupling half-length along the axis (total sleeve length = 2× this = 1.5·D). */
const COUPLING_HALF_FACTOR = 0.75;
/** Coupling bore radius as a multiple of the pipe radius (the sleeve laps the pipe). */
const COUPLING_RADIUS_FACTOR = 1.15;
/** Reducer half-length along the axis (total taper length = 2·D). */
const REDUCER_HALF_FACTOR = 1.0;
/** Tee/cross body half-extent along each leg as a multiple of Ø (`0.6·D`). */
const LEG_HALF_FACTOR = 0.6;
/** Cap dome depth as a multiple of the pipe radius (`1` ⇒ a hemisphere). */
const CAP_DOME_FACTOR = 1.0;

// ─── Inputs ───────────────────────────────────────────────────────────────────────

interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** One pipe end meeting at the node — direction (away from node) + diameter. */
export interface FittingBodyIncident {
  /** Unit vector pointing AWAY from the node along the pipe centreline. */
  readonly dir: Vec2;
  /** Pipe diameter, in the caller's unit. */
  readonly diameter: number;
}

/** Everything `computeFittingBody` needs, in ONE consistent unit. */
export interface FittingBodyInput {
  readonly kind: MepFittingKind;
  readonly node: Vec2;
  readonly incidents: readonly FittingBodyIncident[];
  /** Nominal Ø (largest incident), caller unit. */
  readonly primaryDiameter: number;
  /** Reducer only — the smaller Ø. */
  readonly secondaryDiameter?: number;
  /** Elbow bend radius multiple (defaults to the Revit long-radius 1.5·D). */
  readonly bendFactor?: number;
}

// ─── Body union ─────────────────────────────────────────────────────────────────

/** One radial arm of a tee/cross body. */
export interface FittingLegBody {
  /** Unit direction away from the node. */
  readonly dir: Vec2;
  /** Body extent along `dir` from the node. */
  readonly halfLength: number;
  /** Arm half-width (pipe radius of this leg). */
  readonly radius: number;
}

/**
 * The resolved fitting solid, unit matching the caller. Discriminated by `form`;
 * each consumer switches on it to emit a 2D outline, a 3D mesh, or a trim length.
 */
export type FittingBody =
  | { readonly form: 'bend'; readonly node: Vec2; readonly bend: ElbowBend }
  | {
      readonly form: 'inline';
      readonly node: Vec2;
      readonly axis: Vec2;
      readonly halfLength: number;
      /** Radius at the `+axis` face (the incident[0] pipe). */
      readonly radiusPos: number;
      /** Radius at the `−axis` face (the incident[1] pipe). */
      readonly radiusNeg: number;
    }
  | { readonly form: 'legs'; readonly node: Vec2; readonly legs: readonly FittingLegBody[] }
  | {
      readonly form: 'cap';
      readonly node: Vec2;
      /** Outward dome direction (away from the pipe). */
      readonly dir: Vec2;
      readonly radius: number;
      readonly domeDepth: number;
    };

// ─── Builders ───────────────────────────────────────────────────────────────────

function normalize(v: Vec2): Vec2 | null {
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-9) return null;
  return { x: v.x / len, y: v.y / len };
}

/**
 * Elbow → the swept bend SSoT (null when the legs are collinear/degenerate). Each
 * incident's OWN diameter is passed so a reducing elbow (differing Ø) tapers the
 * swept tube; equal diameters give the plain concentric elbow.
 */
function buildBendBody(input: FittingBodyInput): FittingBody | null {
  if (input.incidents.length < 2) return null;
  const inc0 = input.incidents[0]!;
  const inc1 = input.incidents[1]!;
  const bend = computeElbowBend(
    input.node,
    inc0.dir,
    inc1.dir,
    inc0.diameter,
    input.bendFactor ?? DEFAULT_BEND_FACTOR,
    inc1.diameter,
  );
  return bend ? { form: 'bend', node: input.node, bend } : null;
}

/**
 * Coupling / reducer → an axial body. `axis` follows incident[0]; the `+axis` face
 * matches incident[0]'s pipe and the `−axis` face incident[1]'s. Coupling ⇒ equal
 * (slightly enlarged) radii; reducer ⇒ each face at its own pipe radius.
 */
function buildInlineBody(input: FittingBodyInput, isReducer: boolean): FittingBody | null {
  const inc0 = input.incidents[0];
  if (!inc0) return null;
  const axis = normalize(inc0.dir);
  if (!axis) return null;
  const node = input.node;

  if (isReducer) {
    const inc1 = input.incidents[1];
    const radiusNeg = (inc1?.diameter ?? input.secondaryDiameter ?? input.primaryDiameter) / 2;
    return {
      form: 'inline',
      node,
      axis,
      halfLength: input.primaryDiameter * REDUCER_HALF_FACTOR,
      radiusPos: inc0.diameter / 2,
      radiusNeg,
    };
  }
  const r = (input.primaryDiameter * COUPLING_RADIUS_FACTOR) / 2;
  return {
    form: 'inline',
    node,
    axis,
    halfLength: input.primaryDiameter * COUPLING_HALF_FACTOR,
    radiusPos: r,
    radiusNeg: r,
  };
}

/** Tee / cross → one arm per incident, uniform half-length, each its own radius. */
function buildLegsBody(input: FittingBodyInput): FittingBody | null {
  const halfLength = input.primaryDiameter * LEG_HALF_FACTOR;
  const legs: FittingLegBody[] = [];
  for (const inc of input.incidents) {
    const dir = normalize(inc.dir);
    if (dir) legs.push({ dir, halfLength, radius: inc.diameter / 2 });
  }
  return legs.length >= 2 ? { form: 'legs', node: input.node, legs } : null;
}

/** Cap → a dome bulging OUTWARD (opposite the incident, away from the pipe). */
function buildCapBody(input: FittingBodyInput): FittingBody | null {
  const inc0 = input.incidents[0];
  if (!inc0) return null;
  const inward = normalize(inc0.dir);
  if (!inward) return null;
  const radius = input.primaryDiameter / 2;
  return {
    form: 'cap',
    node: input.node,
    dir: { x: -inward.x, y: -inward.y },
    radius,
    domeDepth: radius * CAP_DOME_FACTOR,
  };
}

/**
 * Resolve the fitting body for a junction. Pure SSoT, unit-agnostic. Returns `null`
 * for a degenerate input (so callers fall back to a centred square / inline stub).
 */
export function computeFittingBody(input: FittingBodyInput): FittingBody | null {
  switch (input.kind) {
    case 'elbow':
      return buildBendBody(input);
    case 'coupling':
      return buildInlineBody(input, false);
    case 'reducer':
      return buildInlineBody(input, true);
    case 'tee':
    case 'cross':
      return buildLegsBody(input);
    case 'cap':
      return buildCapBody(input);
  }
}

// ─── 2D footprint tessellation ──────────────────────────────────────────────────

function pt(x: number, y: number): Point3D {
  return { x, y, z: 0 };
}

/** Inline body → a closed CCW quad (rectangle for coupling, trapezoid for reducer). */
function tessellateInlineFootprint(
  body: Extract<FittingBody, { form: 'inline' }>,
): Point3D[] {
  const { node, axis, halfLength, radiusPos, radiusNeg } = body;
  const perp = { x: -axis.y, y: axis.x };
  const posX = node.x + axis.x * halfLength;
  const posY = node.y + axis.y * halfLength;
  const negX = node.x - axis.x * halfLength;
  const negY = node.y - axis.y * halfLength;
  return [
    pt(posX - perp.x * radiusPos, posY - perp.y * radiusPos),
    pt(posX + perp.x * radiusPos, posY + perp.y * radiusPos),
    pt(negX + perp.x * radiusNeg, negY + perp.y * radiusNeg),
    pt(negX - perp.x * radiusNeg, negY - perp.y * radiusNeg),
  ];
}

/** The four side corners + side directions of one arm (for the union outline). */
interface LegEdges {
  readonly dir: Vec2;
  readonly leftNear: Vec2;
  readonly leftFar: Vec2;
  readonly rightNear: Vec2;
  readonly rightFar: Vec2;
}

function legEdges(node: Vec2, leg: FittingLegBody): LegEdges {
  const d = leg.dir;
  const p = { x: -d.y, y: d.x }; // left normal (90° CCW)
  const w = leg.radius;
  const L = leg.halfLength;
  const left = { x: node.x + p.x * w, y: node.y + p.y * w };
  const right = { x: node.x - p.x * w, y: node.y - p.y * w };
  return {
    dir: d,
    leftNear: left,
    leftFar: { x: left.x + d.x * L, y: left.y + d.y * L },
    rightNear: right,
    rightFar: { x: right.x + d.x * L, y: right.y + d.y * L },
  };
}

/** Intersection of lines `p + t·dp` and `q + s·dq`; null when (near-)parallel. */
function lineIntersect2D(p: Vec2, dp: Vec2, q: Vec2, dq: Vec2): Vec2 | null {
  const denom = dp.x * dq.y - dp.y * dq.x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((q.x - p.x) * dq.y - (q.y - p.y) * dq.x) / denom;
  return { x: p.x + t * dp.x, y: p.y + t * dp.y };
}

/**
 * Tee/cross → the union outline of the arms (a real "T"/"+"). Arms are sorted CCW;
 * each contributes its far edge, then the inner concave corner where its LEFT side
 * meets the next arm's RIGHT side. Collinear neighbours (the straight run of a tee)
 * fall back to the arm's near wall point.
 */
function tessellateLegsFootprint(
  body: Extract<FittingBody, { form: 'legs' }>,
): Point3D[] {
  const sorted = [...body.legs].sort(
    (a, b) => Math.atan2(a.dir.y, a.dir.x) - Math.atan2(b.dir.y, b.dir.x),
  );
  const edges = sorted.map((leg) => legEdges(body.node, leg));
  const out: Point3D[] = [];
  for (let i = 0; i < edges.length; i++) {
    const cur = edges[i]!;
    const next = edges[(i + 1) % edges.length]!;
    out.push(pt(cur.rightFar.x, cur.rightFar.y));
    out.push(pt(cur.leftFar.x, cur.leftFar.y));
    const inner = lineIntersect2D(cur.leftNear, cur.dir, next.rightNear, next.dir) ?? cur.leftNear;
    out.push(pt(inner.x, inner.y));
  }
  return out;
}

/** Cap → a half-disk: a `segments`-step dome arc toward `dir`, closed by the chord. */
function tessellateCapFootprint(
  body: Extract<FittingBody, { form: 'cap' }>,
  segments: number,
): Point3D[] {
  const { node, dir, radius } = body;
  const theta = Math.atan2(dir.y, dir.x);
  const pts: Point3D[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = theta + Math.PI / 2 - (Math.PI * i) / segments;
    pts.push(pt(node.x + radius * Math.cos(a), node.y + radius * Math.sin(a)));
  }
  return pts;
}

/**
 * Tessellate the fitting body into a closed 2D plan polygon (caller's unit). The
 * footprint IS the real body shape — used for the fill, dashed outline, hit-test and
 * bbox, so no per-kind glyph is needed.
 */
export function tessellateFittingFootprint(body: FittingBody, segments = 16): Point3D[] {
  switch (body.form) {
    case 'bend':
      return tessellateBendFootprint(body.bend, segments);
    case 'inline':
      return tessellateInlineFootprint(body);
    case 'legs':
      return tessellateLegsFootprint(body);
    case 'cap':
      return tessellateCapFootprint(body, segments);
  }
}

// ─── Trim extent ────────────────────────────────────────────────────────────────

/**
 * How far (caller's unit) each incident pipe is shortened so it butts exactly
 * against the fitting body — never crossing it (Revit "pipe ends at the fitting"):
 *   - bend   → the tangent length (pipe stops where the curve begins),
 *   - inline → the body half-length,
 *   - legs   → the (uniform) arm half-length,
 *   - cap    → 0 (the cap sits on the pipe end; nothing is trimmed).
 */
export function fittingTrimExtent(body: FittingBody): number {
  switch (body.form) {
    case 'bend':
      return body.bend.tangentLen;
    case 'inline':
      return body.halfLength;
    case 'legs':
      return body.legs[0]?.halfLength ?? 0;
    case 'cap':
      return 0;
  }
}
