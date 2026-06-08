/**
 * Underfloor (radiant floor) heating geometry + validation + connector layout
 * (ADR-408 Εύρος Β #3). Pure SSoT — derives `MepUnderfloorGeometry` from
 * `MepUnderfloorParams`: the serpentine pipe field inside the footprint polygon, its
 * total developed length (BOQ), and the two hydronic connectors at the loop entry.
 * Idempotent + side-effect free.
 *
 * Two layout patterns (both implemented, Giorgio: «και τα δύο»):
 *   - `'boustrophedon'`     — back-and-forth parallel rows + a return leg to entry.
 *   - `'counterflow-spiral'`— bifilar interleave (supply/return alternate every row),
 *     both ends terminating at the entry edge (even floor temperature).
 *
 * Footprint vertices are world mm (the FloorFinish ADR-419 convention); all scalar
 * params are mm. The two connectors store their `localPosition` in WORLD coords and
 * resolve through an IDENTITY host transform (`connectorWorldPosition(c,0,0)`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { nowTimestamp } from '@/lib/firestore-now';
import type { BimValidation, Point3D } from '../types/bim-base';
import type {
  MepUnderfloorGeometry,
  MepUnderfloorParams,
} from '../types/mep-underfloor-types';
import { MIN_UNDERFLOOR_SPACING_MM, MIN_UNDERFLOOR_VERTICES } from '../types/mep-underfloor-types';
import { mmScaleFor } from '../../utils/scene-units';
import type { MepConnector } from '../types/mep-connector-types';
import {
  buildUnderfloorSupplyConnector,
  buildUnderfloorReturnConnector,
} from '../types/mep-connector-types';
import {
  buildAxisAlignedHatch,
  insetClosedPolygon,
  isPolygonCCW,
  pointInPolygon,
  polygonArea,
  polygonBbox,
  stripClosingDuplicate,
  type HatchDirection,
} from '../geometry/shared/polygon-utils';

const MM_TO_M = 1 / 1000;

/** One clipped serpentine row: the k-line index (for parity) + its two endpoints. */
interface ClippedRow {
  readonly line: number;
  readonly a: Point3D;
  readonly b: Point3D;
}

/**
 * Compute `MepUnderfloorGeometry` from `MepUnderfloorParams`. Pure SSoT — consumed
 * by the completion builder (creation), `seedDefaultConnectors` (load) and the
 * renderer. Degenerate footprint / over-clearance ⇒ empty loop (length 0, no throw).
 */
export function computeMepUnderfloorGeometry(
  params: MepUnderfloorParams,
): MepUnderfloorGeometry {
  const verts = params.footprint.vertices;
  if (verts.length < MIN_UNDERFLOOR_VERTICES) return emptyGeometry(verts);

  let ring = stripClosingDuplicate(verts) as Point3D[];
  if (ring.length < MIN_UNDERFLOOR_VERTICES) return emptyGeometry(verts);
  if (!isPolygonCCW(ring)) ring = [...ring].reverse();

  const bbox = polygonBbox(ring);
  // ADR-422 unit-fix — the footprint is in SCENE UNITS (`params.sceneUnits`), while the
  // scalar params (edgeClearanceMm / pipeSpacingMm) are mm. They MUST be converted to
  // scene units before any geometric comparison, and scene-unit outputs back to metres.
  // Without this, a non-mm scene (e.g. metres) collapses every room to the degenerate
  // guard (minSpan≈12 ≤ 2·clearance) → no serpentine field, just a flat colour. For an
  // 'mm' scene the factor is 1 (no behavioural change — same class as the Φ11 tol fix).
  const s = mmScaleFor(params);            // mm → scene units
  const sceneToM = MM_TO_M / s;            // scene units → metres
  const areaM2 = polygonArea(ring) * sceneToM * sceneToM;
  const entry = resolveEntryPoints(ring, params);
  const degenerate = { bbox, areaM2, totalLengthM: 0, loopPath: [entry.supply, entry.ret], ...entryConnectors(entry) };

  // Physical guard: a room narrower than 2× the wall clearance leaves no heating
  // field (over-inset would otherwise fold into an inverted polygon).
  const clearance = Math.max(0, params.edgeClearanceMm) * s;
  const minSpan = Math.min(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y);
  if (minSpan <= 2 * clearance) return degenerate;

  const inset = insetClosedPolygon(ring, clearance);
  if (!inset || inset.length < MIN_UNDERFLOOR_VERTICES) return degenerate;

  const spacingScene = Math.max(MIN_UNDERFLOOR_SPACING_MM, params.pipeSpacingMm) * s;
  const field = buildPatternField(inset, spacingScene, params.patternType, entry.supply);

  const loopPath = [entry.supply, ...field, entry.ret];
  // BOQ length is measured along the ACTUAL filleted centreline (the rounded bends
  // shorten the developed run vs. the sharp-corner polyline) — Revit material-takeoff
  // parity. The persisted `loopPath` stays the lean corner polyline (SSoT topology);
  // the bends are re-derived on demand by the 2D/3D renderers via the shared helper.
  const filleted = buildFilletedUnderfloorPath(loopPath, resolveUnderfloorBendRadiusScene(params));
  return {
    bbox,
    areaM2,
    totalLengthM: pathLengthMm(filleted) * sceneToM,
    loopPath,
    ...entryConnectors(entry),
  };
}

/**
 * Dispatch to the requested serpentine layout. `'spiral'` (Archimedean snail) falls
 * back to the simple snake when the inset is too small / concave to spiral (empty
 * field) — never throws, mirroring the degenerate-room contract.
 */
function buildPatternField(
  inset: readonly Point3D[],
  spacingScene: number,
  pattern: MepUnderfloorParams['patternType'],
  entry: Point3D,
): Point3D[] {
  if (pattern === 'spiral') {
    const spiral = buildSpiralField(inset, spacingScene, entry);
    if (spiral.length > 0) return spiral;
  }
  const rows = buildClippedRows(inset, spacingScene);
  return pattern === 'counterflow-spiral' ? stitchCounterflow(rows) : stitchSnake(rows);
}

// ─── Entry / connectors ───────────────────────────────────────────────────────

interface EntryPoints { readonly supply: Point3D; readonly ret: Point3D }

/** Two entry points at the `entrySide` edge midpoint, offset ±spacing/4 along it. */
function resolveEntryPoints(ring: readonly Point3D[], params: MepUnderfloorParams): EntryPoints {
  const n = ring.length;
  const e = ((params.entrySide ?? 0) % n + n) % n;
  const a = ring[e];
  const b = ring[(e + 1) % n];
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const off = (Math.max(MIN_UNDERFLOOR_SPACING_MM, params.pipeSpacingMm) / 4) * mmScaleFor(params);
  const ux = dx / len;
  const uy = dy / len;
  return {
    supply: { x: mx - ux * off, y: my - uy * off, z: 0 },
    ret: { x: mx + ux * off, y: my + uy * off, z: 0 },
  };
}

function entryConnectors(entry: EntryPoints): Pick<MepUnderfloorGeometry, 'supplyConnectorLocal' | 'returnConnectorLocal'> {
  return { supplyConnectorLocal: entry.supply, returnConnectorLocal: entry.ret };
}

// ─── Row generation ───────────────────────────────────────────────────────────

/** Axis the rows run along — the longer bbox dimension (fewer U-turns). */
function resolveAxis(bbox: { min: Point3D; max: Point3D }): HatchDirection {
  const w = bbox.max.x - bbox.min.x;
  const h = bbox.max.y - bbox.min.y;
  return w >= h ? { ux: 1, uy: 0 } : { ux: 0, uy: 1 };
}

/**
 * Build the serpentine rows: parallel hatch lines at `spacingMm`, each clipped to the
 * inset polygon (concave rooms yield multiple spans per line). Pre-ordered by the
 * perpendicular offset k (ascending) — `buildAxisAlignedHatch` emits in k order.
 */
function buildClippedRows(inset: readonly Point3D[], spacingMm: number): ClippedRow[] {
  const bbox = polygonBbox(inset);
  const u = resolveAxis(bbox);
  const lines = buildAxisAlignedHatch(bbox, spacingMm, u);
  const rows: ClippedRow[] = [];
  lines.forEach((seg, line) => {
    const a: Point3D = { x: seg.start.x, y: seg.start.y, z: 0 };
    const b: Point3D = { x: seg.end.x, y: seg.end.y, z: 0 };
    for (const span of clipSegmentToPolygon(a, b, inset)) {
      rows.push({ line, a: span[0], b: span[1] });
    }
  });
  return rows;
}

/**
 * Split segment a→b into the spans that lie INSIDE `ring` (handles concave). Collects
 * crossing params with every ring edge, then keeps spans whose midpoint is inside.
 */
function clipSegmentToPolygon(a: Point3D, b: Point3D, ring: readonly Point3D[]): Array<[Point3D, Point3D]> {
  const ts = [0, 1];
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const t = segmentCrossT(a, b, ring[i], ring[(i + 1) % n]);
    if (t !== null) ts.push(t);
  }
  const uniq = [...new Set(ts)].sort((p, q) => p - q);
  const out: Array<[Point3D, Point3D]> = [];
  for (let i = 0; i < uniq.length - 1; i++) {
    const t0 = uniq[i];
    const t1 = uniq[i + 1];
    const mid = lerp(a, b, (t0 + t1) / 2);
    if (pointInPolygon(mid, ring)) out.push([lerp(a, b, t0), lerp(a, b, t1)]);
  }
  return out;
}

// ─── Stitching ────────────────────────────────────────────────────────────────

/** Boustrophedon snake over all rows in order, alternating orientation per row. */
function stitchSnake(rows: readonly ClippedRow[]): Point3D[] {
  const path: Point3D[] = [];
  rows.forEach((row, i) => {
    const fwd = i % 2 === 0;
    path.push(fwd ? row.a : row.b, fwd ? row.b : row.a);
  });
  return path;
}

/**
 * Counterflow bifilar: traverse even rows outward, then odd rows back to entry, so
 * supply and return alternate every row and both ends sit at the entry edge.
 */
function stitchCounterflow(rows: readonly ClippedRow[]): Point3D[] {
  const evens = rows.filter((r) => r.line % 2 === 0);
  const odds = rows.filter((r) => r.line % 2 === 1).reverse();
  return [...stitchSnake(evens), ...stitchSnake(odds)];
}

// ─── Spiral / snail field ──────────────────────────────────────────────────────

/** Hard cap on concentric rings — runaway-loop backstop for tiny spacing. */
const MAX_SPIRAL_RINGS = 200;

/**
 * Archimedean snail field: concentric rings (the inset polygon repeatedly contracted
 * by `spacingScene`) traversed in COUNTERFLOW order — even rings inward (outer→inner),
 * odd rings back outward (inner→outer) — so adjacent physical pipes carry supply next
 * to return (even floor temperature). Each ring is opened at the vertex nearest the
 * running cursor, leaving a short radial gap that links it to the next ring (the
 * characteristic spiral transition). Returns `[]` when the inset cannot be ringed
 * (caller falls back to the snake).
 */
function buildSpiralField(inset: readonly Point3D[], spacingScene: number, entry: Point3D): Point3D[] {
  if (spacingScene <= 0) return [];
  const rings: Point3D[][] = [];
  let poly = stripClosingDuplicate(inset) as Point3D[];
  let guard = 0;
  while (poly.length >= MIN_UNDERFLOOR_VERTICES && guard < MAX_SPIRAL_RINGS) {
    rings.push(poly);
    const next = insetClosedPolygon(poly, spacingScene);
    if (!next || next.length < MIN_UNDERFLOOR_VERTICES) break;
    poly = stripClosingDuplicate(next) as Point3D[];
    guard += 1;
  }
  if (rings.length === 0) return [];

  // Counterflow interleave: inward on even rings, outward on the odd rings between them.
  const inward = rings.filter((_, i) => i % 2 === 0);
  const outward = rings.filter((_, i) => i % 2 === 1).reverse();
  const ordered = [...inward, ...outward];

  const path: Point3D[] = [];
  let cursor = entry;
  for (const ring of ordered) {
    const seq = reorderRingFromNearest(ring, cursor);
    path.push(...seq);
    cursor = seq[seq.length - 1] ?? cursor;
  }
  return path;
}

/** Rotate a ring's vertices so it starts at the vertex nearest `point` (one pass, no
 * wrap-back) — keeps the inter-ring jump short. */
function reorderRingFromNearest(ring: readonly Point3D[], point: Point3D): Point3D[] {
  const n = ring.length;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < n; i++) {
    const d = (ring[i].x - point.x) ** 2 + (ring[i].y - point.y) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  const out: Point3D[] = [];
  for (let j = 0; j < n; j++) out.push(ring[(best + j) % n]);
  return out;
}

// ─── Bend radius + arc filleting (Revit-grade rounded pipe bends) ───────────────

/**
 * Pipe-bend radius for the underfloor loop, in SCENE units. Real PEX/multilayer pipe
 * cannot kink — its minimum bend radius is ~5× the outer diameter — and at a 180° row
 * reversal the rounding cannot exceed half the row pitch or neighbouring rows overlap.
 * So `r = min(5·diameter, spacing/2)`, derived (no extra user param). SSoT shared by
 * the geometry length, the 2D renderer and the 3D tube so all three agree.
 */
export function resolveUnderfloorBendRadiusScene(params: MepUnderfloorParams): number {
  const s = mmScaleFor(params);
  const rMm = Math.min(5 * params.connectorDiameterMm, params.pipeSpacingMm / 2);
  return Math.max(0, rMm) * s;
}

/**
 * Round every interior corner of a polyline with a tangent circular arc of radius
 * `radius` (clamped per-corner to half the shorter adjacent segment so short U-turn
 * links stay valid). Endpoints are preserved. Pure + units-agnostic — the radius must
 * be in the SAME space as the path coordinates. Used on demand by the 2D renderer and
 * the 3D tube so the drawn pipe shows real bends instead of sharp mitres (Revit/4M).
 */
export function buildFilletedUnderfloorPath(path: readonly Point3D[], radius: number): Point3D[] {
  if (path.length < 3 || radius <= 0) return [...path];
  const out: Point3D[] = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const cur = path[i];
    const next = path[i + 1];
    const v1x = prev.x - cur.x, v1y = prev.y - cur.y;
    const v2x = next.x - cur.x, v2y = next.y - cur.y;
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    if (len1 < 1e-9 || len2 < 1e-9) { out.push(cur); continue; }
    const u1x = v1x / len1, u1y = v1y / len1;
    const u2x = v2x / len2, u2y = v2y / len2;
    // Half-angle between the two edges at the corner.
    const cosHalf = Math.min(1, Math.max(-1, (u1x * u2x + u1y * u2y)));
    const half = Math.acos(cosHalf) / 2;
    if (half < 1e-3 || half > Math.PI / 2 - 1e-3) { out.push(cur); continue; } // straight/needle
    const tan = Math.tan(half);
    let t = radius / tan;                       // tangent distance from corner
    t = Math.min(t, len1 * 0.5, len2 * 0.5);    // don't overrun either edge
    const r = t * tan;                          // effective radius after clamp
    if (t < 1e-6 || r < 1e-6) { out.push(cur); continue; }
    const p1 = { x: cur.x + u1x * t, y: cur.y + u1y * t, z: 0 };
    const p2 = { x: cur.x + u2x * t, y: cur.y + u2y * t, z: 0 };
    // Arc centre along the inner bisector at distance r / sin(half).
    let bx = u1x + u2x, by = u1y + u2y;
    const bl = Math.hypot(bx, by);
    if (bl < 1e-9) { out.push(cur); continue; }
    bx /= bl; by /= bl;
    const cx = cur.x + bx * (r / Math.sin(half));
    const cy = cur.y + by * (r / Math.sin(half));
    out.push(...sampleArc(cx, cy, p1, p2));
  }
  out.push(path[path.length - 1]);
  return out;
}

/** Sample the minor arc centre→p1..p2 (inclusive) into a short point list. */
function sampleArc(cx: number, cy: number, p1: Point3D, p2: Point3D): Point3D[] {
  const a1 = Math.atan2(p1.y - cy, p1.x - cx);
  const a2 = Math.atan2(p2.y - cy, p2.x - cx);
  let delta = a2 - a1;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  const r = Math.hypot(p1.x - cx, p1.y - cy);
  const steps = Math.min(12, Math.max(2, Math.ceil(Math.abs(delta) / (Math.PI / 8))));
  const pts: Point3D[] = [];
  for (let k = 0; k <= steps; k++) {
    const a = a1 + (delta * k) / steps;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), z: 0 });
  }
  return pts;
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

function lerp(a: Point3D, b: Point3D, t: number): Point3D {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: 0 };
}

/** Param t∈(0,1) where segment a→b crosses segment c→d, else null. */
function segmentCrossT(a: Point3D, b: Point3D, c: Point3D, d: Point3D): number | null {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const denom = r.x * s.y - r.y * s.x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / denom;
  const v = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / denom;
  if (t > 1e-9 && t < 1 - 1e-9 && v >= -1e-9 && v <= 1 + 1e-9) return t;
  return null;
}

function pathLengthMm(path: readonly Point3D[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  }
  return total;
}

function emptyGeometry(verts: readonly Point3D[]): MepUnderfloorGeometry {
  const bbox = polygonBbox(verts as Point3D[]);
  const origin = verts[0] ? { x: verts[0].x, y: verts[0].y, z: 0 } : { x: 0, y: 0, z: 0 };
  return {
    bbox,
    areaM2: 0,
    totalLengthM: 0,
    loopPath: [],
    supplyConnectorLocal: origin,
    returnConnectorLocal: origin,
  };
}

// ─── Connector layout (pure SSoT) ──────────────────────────────────────────────

/**
 * Build the underfloor loop's two embedded connectors (supply inlet + return
 * outlet), derived from `params`. SSoT consumed by both the completion builder
 * (creation) and `seedDefaultConnectors` (load-time re-materialisation).
 *
 * Both `localPosition`s are in WORLD coords (the computed loop-entry points) and
 * resolve through an identity host transform — the underfloor entity has no
 * `position`/`rotation`.
 */
export function buildUnderfloorConnectors(params: MepUnderfloorParams): MepConnector[] {
  const geom = computeMepUnderfloorGeometry(params);
  return [
    buildUnderfloorSupplyConnector(geom.supplyConnectorLocal, params.connectorDiameterMm),
    buildUnderfloorReturnConnector(geom.returnConnectorLocal, params.connectorDiameterMm),
  ];
}

// ─── Validation ─────────────────────────────────────────────────────────────────

/** Result of an underfloor validation pass — hard errors non-empty when invalid. */
export interface MepUnderfloorValidationResult {
  readonly hardErrors: readonly string[];
  readonly codeViolations: readonly string[];
  readonly bimValidation: BimValidation;
}

/**
 * Validate `MepUnderfloorParams`. Hard errors: footprint < 3 vertices, non-positive
 * spacing, or spacing below `MIN_UNDERFLOOR_SPACING_MM`.
 */
export function validateMepUnderfloorParams(
  params: MepUnderfloorParams,
): MepUnderfloorValidationResult {
  const hardErrors: string[] = [];
  const codeViolations: string[] = [];

  if (params.footprint.vertices.length < MIN_UNDERFLOOR_VERTICES) {
    hardErrors.push('mepUnderfloor.validation.hardErrors.tooFewVertices');
  }
  if (params.pipeSpacingMm <= 0) {
    hardErrors.push('mepUnderfloor.validation.hardErrors.nonPositiveSpacing');
  } else if (params.pipeSpacingMm < MIN_UNDERFLOOR_SPACING_MM) {
    hardErrors.push('mepUnderfloor.validation.hardErrors.spacingTooSmall');
  }

  const bimValidation: BimValidation = {
    hasCodeViolations: codeViolations.length > 0,
    violationKeys: [...codeViolations],
    lastValidatedAt: nowTimestamp(),
  };

  return { hardErrors, codeViolations, bimValidation };
}
