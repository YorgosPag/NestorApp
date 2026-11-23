/**
 * @fileoverview **DXF drawing → its polylines in plan, without the DXF Viewer** (ADR-920 Β6.11 Ζ1).
 * @related ./dxf-section-scan (structure) · ./dxf-ocs (OCS → WCS) · ./dxf-insunits (units) ·
 *   ../terrain/survey-import/dxf-survey-points (the sibling scanner for spot heights — same leaves, same two phases)
 *
 * The plot outline of a surveyor's drawing is a closed polyline. This scanner walks the raw group codes over the same
 * zero-import leaves as the survey-point scanner, so the owner's form reads a DXF without the subapp (CHECK 3.62).
 *
 *   LWPOLYLINE → 70 flags (bit 1 = closed) · 38 elevation (OCS Z) · 210/220/230 extrusion · per vertex 10/20 + 42 bulge
 *   POLYLINE   → 70 flags (1 closed · 8 3D polyline · 16 3D mesh · 64 polyface) · 30 elevation · 210/220/230 ·
 *                then VERTEX records (10/20/30, 42 bulge, 70 vertex flags) up to SEQEND
 *
 * 🔑 **Plan (WCS) output, every frame decision named**:
 *   • default extrusion (0,0,1): OCS ≡ WCS, taken as written;
 *   • flipped (0,0,−1): x → −x **and every bulge changes sign** — the mirror reverses the turning sense of each arc;
 *   • any other (a tilted plane): **skipped as `tilted-plane`** — its plan projection is not the shape the surveyor
 *     drew, and an ellipse-shaped «arc» is not a bulge. Counted, so the screen can say so; never silently bent.
 *   • 3D polyline (70 bit 8): WCS already, no bulges by definition.
 *   • 3D mesh / polyface (bits 16 / 64): surfaces, not outlines ⇒ skipped as `mesh`.
 *
 * Only the ENTITIES section is scanned: geometry inside BLOCK definitions is a template at block-local coordinates,
 * not the drawing (ADR-635 Φ2) — the same rule as the survey points.
 *
 * 🔑 **TWO PHASES, ON PURPOSE**: coordinates stay in DRAWING units and the HEADER's `$INSUNITS` is returned; the
 * scale is the caller's policy (ADR-920 §13.2), exactly like `scanDxfSurvey`.
 */

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';

import { isEmbeddedObjectCode, ownFirstTags } from './dxf-embedded-object';
import { readDxfInsunits } from './dxf-insunits';
import { splitDxfLines } from './dxf-line-stream';
import {
  dxfOcsToWcs,
  dxfRealOr,
  isDefaultDxfExtrusion,
  isFlippedDxfExtrusion,
  readDxfExtrusion,
  type DxfVec3,
} from './dxf-ocs';
import { collectDxfRecordPairs, findDxfSectionRange, type DxfCodePair } from './dxf-section-scan';

/** One polyline, in plan (WCS), in DRAWING units. */
export interface DxfPolyline {
  readonly kind: 'LWPOLYLINE' | 'POLYLINE';
  /** Entity handle (group 5) — the identity the owner's choice refers back to; `null` when the writer omitted it. */
  readonly handle: string | null;
  /** Layer name (group 8); `'0'` when absent — the DXF default. */
  readonly layer: string;
  /** The CLOSED flag (70 bit 1). Coincident first/last vertices are NOT folded in here — that is the caller's call. */
  readonly closed: boolean;
  readonly vertices: readonly PlanarPoint[];
  /** Index-aligned with `vertices`, in PLAN sense (sign already corrected for a flipped extrusion). `0` = straight. */
  readonly bulges: readonly number[];
  /** WCS elevation of the polyline's plane; `null` for a 3D polyline whose vertices do not share one Z. */
  readonly elevation: number | null;
}

/** Why a polyline was not returned — each one a sentence the screen can say. */
export type DxfPolylineSkip = 'tilted-plane' | 'mesh' | 'unreadable';

export interface DxfPolylineScan {
  readonly polylines: readonly DxfPolyline[];
  readonly skipped: Readonly<Record<DxfPolylineSkip, number>>;
  /** The `$INSUNITS` the HEADER declares; `null` = the file does not say (see `readDxfInsunits`). */
  readonly declaredInsunits: number | null;
}

/** POLYLINE 70 bits (DXF Reference, «POLYLINE»). */
const POLYLINE_CLOSED = 1;
const POLYLINE_3D = 8;
const POLYLINE_MESH = 16;
const POLYLINE_POLYFACE = 64;
/** VERTEX 70 bit 16 — a spline frame control point: not on the curve, never part of the outline. */
const VERTEX_SPLINE_FRAME = 16;

interface RawVertex {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly bulge: number;
}

/** A REAL group code → number, or `NaN` when absent/garbled — the caller decides what NaN means. */
function real(value: string | undefined): number {
  return dxfRealOr(value, Number.NaN);
}

function int(value: string | undefined): number {
  const parsed = value === undefined ? Number.NaN : parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** LWPOLYLINE vertices: every `10` opens a vertex; `20` and `42` belong to the vertex opened last. */
function lwVertices(pairs: readonly DxfCodePair[]): RawVertex[] | null {
  const out: { x: number; y: number; z: number; bulge: number }[] = [];
  for (const [code, value] of pairs) {
    if (isEmbeddedObjectCode(code)) break;
    if (code === '10') out.push({ x: real(value), y: Number.NaN, z: 0, bulge: 0 });
    const last = out[out.length - 1];
    if (last === undefined) continue;
    if (code === '20') last.y = real(value);
    else if (code === '42') last.bulge = dxfRealOr(value, 0);
  }
  return out.every((v) => Number.isFinite(v.x) && Number.isFinite(v.y)) ? out : null;
}

interface PlanarRecord {
  readonly extrusion: DxfVec3;
  readonly ocsElevation: number;
}

/**
 * OCS vertices → plan. `null` for a tilted plane (see the file header). For a flipped extrusion each bulge changes
 * sign: the plan sees the arc from behind, so a counter-clockwise turn reads clockwise.
 */
function toPlan(vertices: readonly RawVertex[], record: PlanarRecord): { points: PlanarPoint[]; bulges: number[]; z: number } | null {
  const { extrusion, ocsElevation } = record;
  const flipped = isFlippedDxfExtrusion(extrusion);
  if (!isDefaultDxfExtrusion(extrusion) && !flipped) return null;
  const points = vertices.map((v) => {
    const w = dxfOcsToWcs({ x: v.x, y: v.y, z: ocsElevation }, extrusion);
    return { x: w.x, y: w.y };
  });
  const bulges = vertices.map((v) => (flipped ? -v.bulge : v.bulge));
  return { points, bulges, z: dxfOcsToWcs({ x: 0, y: 0, z: ocsElevation }, extrusion).z };
}

type PolylineOutcome = DxfPolyline | DxfPolylineSkip;

function identityOf(tags: Record<string, string>): Pick<DxfPolyline, 'handle' | 'layer'> {
  return { handle: tags['5'] ?? null, layer: tags['8'] || '0' };
}

function lwPolylineOf(pairs: readonly DxfCodePair[]): PolylineOutcome {
  const tags = ownFirstTags(pairs); // 70 · 38 · 5 · 8 before the vertices, 210–230 AFTER them: never stop at '10'
  const raw = lwVertices(pairs);
  if (raw === null) return 'unreadable';
  const flags = int(tags['70']);
  const plan = toPlan(raw, { extrusion: readDxfExtrusion(tags), ocsElevation: dxfRealOr(tags['38'], 0) });
  if (plan === null) return 'tilted-plane';
  return {
    kind: 'LWPOLYLINE', ...identityOf(tags), closed: (flags & POLYLINE_CLOSED) !== 0,
    vertices: plan.points, bulges: plan.bulges, elevation: plan.z,
  };
}

/** The common Z of 3D vertices, or `null` when they differ (a 3D polyline is not a level ring). */
function sharedZ(vertices: readonly RawVertex[]): number | null {
  const z0 = vertices[0]?.z;
  if (z0 === undefined || !Number.isFinite(z0)) return null;
  return vertices.every((v) => v.z === z0) ? z0 : null;
}

function heavyPolylineOf(header: readonly DxfCodePair[], vertices: readonly RawVertex[]): PolylineOutcome {
  const tags = ownFirstTags(header);
  const flags = int(tags['70']);
  if ((flags & (POLYLINE_MESH | POLYLINE_POLYFACE)) !== 0) return 'mesh';
  if (vertices.some((v) => !Number.isFinite(v.x) || !Number.isFinite(v.y))) return 'unreadable';
  const closed = (flags & POLYLINE_CLOSED) !== 0;
  if ((flags & POLYLINE_3D) !== 0) {
    return {
      kind: 'POLYLINE', ...identityOf(tags), closed,
      vertices: vertices.map((v) => ({ x: v.x, y: v.y })), bulges: vertices.map(() => 0), elevation: sharedZ(vertices),
    };
  }
  const plan = toPlan(vertices, { extrusion: readDxfExtrusion(tags), ocsElevation: dxfRealOr(tags['30'], 0) });
  if (plan === null) return 'tilted-plane';
  return { kind: 'POLYLINE', ...identityOf(tags), closed, vertices: plan.points, bulges: plan.bulges, elevation: plan.z };
}

/** One VERTEX record → raw vertex, or `null` for a spline frame control point (not on the curve). */
function vertexOf(pairs: readonly DxfCodePair[]): RawVertex | null {
  const tags = ownFirstTags(pairs);
  if ((int(tags['70']) & VERTEX_SPLINE_FRAME) !== 0) return null;
  return { x: real(tags['10']), y: real(tags['20']), z: dxfRealOr(tags['30'], 0), bulge: dxfRealOr(tags['42'], 0) };
}

const kindAt = (lines: readonly string[], i: number): string | undefined =>
  (lines[i]?.trim() === '0' ? lines[i + 1]?.trim() : undefined);

/** Walks the VERTEX records after a POLYLINE header, up to and including SEQEND. */
function collectVertices(lines: readonly string[], start: number, end: number): { vertices: RawVertex[]; next: number } {
  const vertices: RawVertex[] = [];
  let i = start;
  while (i < end && kindAt(lines, i) === 'VERTEX') {
    const { pairs, next } = collectDxfRecordPairs(lines, i + 2, end);
    const vertex = vertexOf(pairs);
    if (vertex) vertices.push(vertex);
    i = next;
  }
  if (kindAt(lines, i) === 'SEQEND') i = collectDxfRecordPairs(lines, i + 2, end).next;
  return { vertices, next: i };
}

/**
 * Scan raw DXF text for its polylines, open and closed, in plan and in DRAWING units. Never throws: a polyline it
 * cannot read is counted in `skipped`, the rest are returned.
 */
export function scanDxfPolylines(text: string): DxfPolylineScan {
  const lines = splitDxfLines(text);
  const range = findDxfSectionRange(lines, 'ENTITIES') ?? { start: 0, end: lines.length };
  const polylines: DxfPolyline[] = [];
  const skipped: Record<DxfPolylineSkip, number> = { 'tilted-plane': 0, mesh: 0, unreadable: 0 };
  const take = (outcome: PolylineOutcome): void => {
    if (typeof outcome === 'string') skipped[outcome]++;
    else polylines.push(outcome);
  };

  for (let i = range.start; i < range.end; ) {
    const kind = kindAt(lines, i);
    if (kind !== 'LWPOLYLINE' && kind !== 'POLYLINE') { i += 2; continue; }
    const record = collectDxfRecordPairs(lines, i + 2, range.end);
    if (kind === 'LWPOLYLINE') {
      take(lwPolylineOf(record.pairs));
      i = record.next;
      continue;
    }
    const { vertices, next } = collectVertices(lines, record.next, range.end);
    take(heavyPolylineOf(record.pairs, vertices));
    i = next;
  }

  return { polylines, skipped, declaredInsunits: readDxfInsunits(lines) };
}
