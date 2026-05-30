/**
 * ADR-396 Phase P3 — Envelope perimeter (ETICS) geometry SSoT.
 *
 * Adjacency (2026-05-30 fix): FACE CORNER keys (outerEdge+innerEdge start/end)
 * αντί raw `params.start/end` — beveled walls μοιράζονται face corner, όχι axis
 * endpoint· 2 κλειδιά/άκρο βρίσκουν πάντα το shared corner. @see ADR-396 §3.1
 */

import type { Point3D, Polyline3D } from '../types/bim-base';
import type { WallGeometry, WallKind, WallParams } from '../types/wall-types';
import type { SceneUnits } from '../../utils/scene-units';
import { mmToSceneUnits } from '../../utils/scene-units';
import { COLUMN_BRIDGE_TOL_M } from '../types/thermal-envelope-types';
import { computeWallGeometry } from './wall-geometry';
import {
  offsetPolyline,
  polygonCentroid,
  polylinePerimeterMeters,
  stripClosingDuplicate,
} from './shared/polygon-utils';
import {
  prepareColumns,
  captureColumnId,
  columnExteriorArc,
  columnNodeKey,
  isColumnNodeKey,
  columnIdFromNodeKey,
  type ColumnForEnvelope,
  type PreparedColumn,
} from './envelope-column-bridge';
import {
  buildWallAdjacency,
  sharedKey,
  orderComponent,
  type WallEdge,
} from './envelope-wall-graph';

export type { ColumnForEnvelope } from './envelope-column-bridge';

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export interface WallForEnvelope {
  readonly id: string;
  readonly kind: WallKind;
  readonly params: WallParams;
}

export interface EnvelopeChain {
  readonly exteriorFaceLoop: Polyline3D;
  readonly insulationOuterLoop: Polyline3D;
  readonly closed: boolean;
  /**
   * ADR-396 v2 (Phase 1) — true όταν το component **περικλείει χώρο** (κύκλος στο
   * γράφημα: ακμές ≥ κόμβοι). Πιάνει και T-junctions (σε αντίθεση με `closed`)·
   * ανοιχτή αλυσίδα (Π/L/μεμονωμένος) = δέντρο → false. SSoT ETICS gate (§3.1).
   */
  readonly enclosesRegion: boolean;
  readonly perimeterM: number;
  readonly wallIds: readonly string[];
  readonly columnIds: readonly string[];
  /**
   * ADR-396 v2 (Phase 5) — δοκάρια που συνεισφέρουν στο κέλυφος (όταν η πηγή είναι
   * το footprint pipeline `computeEnvelopeShell`). Optional: το παλιό
   * `computeEnvelopePerimeter` (μόνο τοίχοι) το αφήνει `[]`· consumers διαβάζουν
   * `?? []`. Τροφοδοτεί BOQ per-element attribution (Φάση 5B).
   */
  readonly beamIds?: readonly string[];
  /**
   * ADR-401 v2 (Phase B3b) — source wall id **ανά ακμή** του `exteriorFaceLoop`,
   * ευθυγραμμισμένο 1:1 με `envelopeFaceEdges(exteriorFaceLoop)`. `null` = ακμή
   * γωνίας/column-arc/μη-τοίχου (→ επίπεδο fallback). Δίνεται ΜΟΝΟ από το
   * `computeEnvelopeShell` (κρατά `ShellEdge.sourceEntityId` per edge)· το legacy
   * `computeEnvelopePerimeter` το αφήνει `undefined` (consumers → flat heightM).
   * Τροφοδοτεί τη μεταβλητή (σκαλωτή/κεκλιμένη) κορυφή του Z1 κελύφους.
   */
  readonly edgeWallIds?: readonly (string | null)[];
}

export interface EnvelopePerimeterResult {
  readonly chains: readonly EnvelopeChain[];
  readonly primaryChain: EnvelopeChain | null;
}

// ============================================================================
// INTERNAL PREP
// ============================================================================

/**
 * 2 κλειδιά ανά άκρο τοίχου — από face corners (outerEdge + innerEdge).
 * Beveled walls μοιράζονται ΕΝΑ από τα 2 κλειδιά σε κάθε junction, οπότε
 * πάντα βρίσκουμε τη σύνδεση ανεξαρτήτως bevel orientation.
 */
interface KeyedWall {
  readonly id: string;
  readonly startKeys: readonly string[];
  readonly endKeys: readonly string[];
  readonly geometry: WallGeometry;
}

function quantizeKey(p: { x: number; y: number }, snap: number): string {
  const q = (v: number): number => Math.round(v / snap) * snap;
  return `${q(p.x)},${q(p.y)}`;
}

function dist2(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x; const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function meanPoint(points: readonly Point3D[]): { x: number; y: number } {
  return polygonCentroid(points);
}

export function selectExteriorFace(
  geometry: WallGeometry,
  centroid: { readonly x: number; readonly y: number },
): 'outer' | 'inner' {
  const distOuter = dist2(meanPoint(geometry.outerEdge.points), centroid);
  const distInner = dist2(meanPoint(geometry.innerEdge.points), centroid);
  return distOuter >= distInner ? 'outer' : 'inner';
}

/**
 * 3 κλειδιά ανά άκρο: (1) raw axis endpoint, (2) outer face corner, (3) inner
 * face corner. Deduplicated. Καλύπτει και τις δύο περιπτώσεις:
 *   - Axes που ακουμπούν ακριβώς (τυπικά test squares) → match μέσω axis key.
 *   - Beveled walls (real BIM data) → match μέσω face corner key.
 */
function wallEndKeys(
  axisPoint: Point3D,
  outerCorner: Point3D,
  innerCorner: Point3D,
  snap: number,
): string[] {
  const k1 = quantizeKey(axisPoint, snap);
  const k2 = quantizeKey(outerCorner, snap);
  const k3 = quantizeKey(innerCorner, snap);
  const seen = new Set<string>([k1]);
  const result = [k1];
  if (!seen.has(k2)) { seen.add(k2); result.push(k2); }
  if (!seen.has(k3)) { seen.add(k3); result.push(k3); }
  return result;
}

function allEndKeys(
  geometry: WallGeometry,
  axisStart: Point3D,
  axisEnd: Point3D,
  snap: number,
): { startKeys: string[]; endKeys: string[] } {
  const ol = geometry.outerEdge.points;
  const il = geometry.innerEdge.points;
  return {
    startKeys: wallEndKeys(axisStart, ol[0], il[0], snap),
    endKeys: wallEndKeys(axisEnd, ol[ol.length - 1], il[il.length - 1], snap),
  };
}

// ============================================================================
// NODE KEYS (face corners + column bridge για ελεύθερα άκρα)
// ============================================================================

function assignNodeKeys(
  geos: readonly { w: WallForEnvelope; geometry: WallGeometry }[],
  columns: readonly PreparedColumn[],
  snapCanvas: number,
  bridgeTolCanvas: number,
): KeyedWall[] {
  const base = geos.map(({ w, geometry }) => {
    const { start, end } = endpointsOf(w.params, w.kind);
    const { startKeys, endKeys } = allEndKeys(geometry, start, end, snapCanvas);
    return { id: w.id, startKeys, endKeys, geometry };
  });

  if (columns.length === 0) return base;

  // Valence per key — keys shared by 2 walls are "connected", valence-1 = free.
  const valence = new Map<string, number>();
  const bump = (keys: readonly string[]): void => {
    for (const k of keys) valence.set(k, (valence.get(k) ?? 0) + 1);
  };
  for (const b of base) { bump(b.startKeys); bump(b.endKeys); }

  // For free ends (ALL keys valence-1) near a column → reassign ALL keys to col: key.
  const rawGeos = geos.map(({ w, geometry }) => {
    const { start, end } = endpointsOf(w.params, w.kind);
    return { id: w.id, start, end, geometry };
  });
  const rawMap = new Map(rawGeos.map(r => [r.id, r] as const));

  return base.map((b) => {
    const raw = rawMap.get(b.id);
    if (!raw) return b;
    let { startKeys, endKeys } = b;

    const startFree = startKeys.every(k => (valence.get(k) ?? 0) <= 1);
    const endFree = endKeys.every(k => (valence.get(k) ?? 0) <= 1);

    if (startFree) {
      const colId = captureColumnId(raw.start, columns, bridgeTolCanvas);
      if (colId) startKeys = [columnNodeKey(colId), columnNodeKey(colId)];
    }
    if (endFree) {
      const colId = captureColumnId(raw.end, columns, bridgeTolCanvas);
      if (colId) endKeys = [columnNodeKey(colId), columnNodeKey(colId)];
    }
    return { ...b, startKeys, endKeys };
  });
}

/** Raw endpoints (ΟΧΙ trimmed) για column bridge distance check. */
function endpointsOf(params: WallParams, kind: WallKind): { start: Point3D; end: Point3D } {
  if (kind === 'polyline' && params.polylineVertices && params.polylineVertices.length >= 2) {
    const pv = params.polylineVertices;
    return { start: pv[0], end: pv[pv.length - 1] };
  }
  return { start: params.start, end: params.end };
}

// ============================================================================
// PER-COMPONENT CENTROID + COLUMN IDS
// ============================================================================

function componentCentroid(
  ids: readonly string[],
  byId: Map<string, KeyedWall>,
  colById: Map<string, PreparedColumn>,
): { x: number; y: number } {
  const pts: Point3D[] = [];
  const seenCols = new Set<string>();
  for (const id of ids) {
    const k = byId.get(id);
    if (!k) continue;
    pts.push(...k.geometry.axisPolyline.points);
    for (const keys of [k.startKeys, k.endKeys]) {
      for (const key of keys) {
        if (!isColumnNodeKey(key)) continue;
        const cid = columnIdFromNodeKey(key);
        if (seenCols.has(cid)) continue;
        seenCols.add(cid);
        const col = colById.get(cid);
        if (col) pts.push(...col.footprint);
      }
    }
  }
  return polygonCentroid(pts);
}

function collectColumnIds(ids: readonly string[], byId: Map<string, KeyedWall>): string[] {
  const set = new Set<string>();
  for (const id of ids) {
    const k = byId.get(id);
    if (!k) continue;
    for (const keys of [k.startKeys, k.endKeys]) {
      for (const key of keys) {
        if (isColumnNodeKey(key)) set.add(columnIdFromNodeKey(key));
      }
    }
  }
  return [...set];
}

// ============================================================================
// FACE LOOP ASSEMBLY
// ============================================================================

function appendDeduped(loop: Point3D[], pts: readonly Point3D[], snap: number): void {
  const snap2 = snap * snap;
  for (const p of pts) {
    const last = loop[loop.length - 1];
    if (last && dist2(last, p) < snap2) continue;
    loop.push(p);
  }
}

function orientedFace(
  k: KeyedWall,
  centroid: { x: number; y: number },
  forward: boolean,
): Point3D[] {
  const faceKind = selectExteriorFace(k.geometry, centroid);
  const face = (faceKind === 'outer' ? k.geometry.outerEdge : k.geometry.innerEdge).points;
  return forward ? [...face] : [...face].reverse();
}

function assembleFaceLoop(
  ids: readonly string[],
  closed: boolean,
  byId: Map<string, KeyedWall>,
  adj: Map<string, WallEdge[]>,
  colById: Map<string, PreparedColumn>,
  centroid: { x: number; y: number },
  snap: number,
): Point3D[] {
  const n = ids.length;

  // Pass A — orientation: forward = endKeys contains the exitKey.
  const oriented: Point3D[][] = [];
  for (let i = 0; i < n; i++) {
    const k = byId.get(ids[i]);
    if (!k) { oriented.push([]); continue; }
    const nextId = i < n - 1 ? ids[i + 1] : (closed ? ids[0] : null);
    const prevId = i > 0 ? ids[i - 1] : (closed ? ids[n - 1] : null);
    const exitKey = nextId !== null ? sharedKey(adj, ids[i], nextId) : null;
    const entryKey = prevId !== null ? sharedKey(adj, ids[i], prevId) : null;

    let forward = true;
    if (exitKey !== null) forward = k.endKeys.includes(exitKey);
    else if (entryKey !== null) forward = k.startKeys.includes(entryKey);

    oriented.push(orientedFace(k, centroid, forward));
  }

  // Pass B — concat with column arcs at bridged junctions.
  const loop: Point3D[] = [];
  for (let i = 0; i < n; i++) {
    appendDeduped(loop, oriented[i], snap);
    const nextIdx = i < n - 1 ? i + 1 : (closed ? 0 : -1);
    if (nextIdx < 0) continue;
    const exitKey = sharedKey(adj, ids[i], ids[nextIdx]);
    if (!exitKey || !isColumnNodeKey(exitKey)) continue;
    const col = colById.get(columnIdFromNodeKey(exitKey));
    const next = oriented[nextIdx];
    if (!col || next.length === 0 || loop.length === 0) continue;
    const arc = columnExteriorArc(col.footprint, loop[loop.length - 1], next[0], centroid);
    appendDeduped(loop, arc, snap);
  }
  return loop;
}

// ============================================================================
// OFFSET + PERIMETER
// ============================================================================

function meanDistToCentroid(pts: readonly Point3D[], c: { x: number; y: number }): number {
  if (pts.length === 0) return 0;
  let sum = 0;
  for (const p of pts) sum += Math.sqrt(dist2(p, c));
  return sum / pts.length;
}

function offsetLoopOutward(
  loop: readonly Point3D[],
  thicknessCanvas: number,
  centroid: { x: number; y: number },
  closed: boolean,
): Point3D[] {
  if (thicknessCanvas <= 0 || loop.length < 2) return [...loop];
  // A closed face loop carries its first point repeated at the end. Offsetting it
  // as an open polyline mis-mitres that seam vertex → a `thickness`-long diagonal
  // jog at one corner. Strip the duplicate, offset with closed-mitre, then restore
  // the closing duplicate so the loop representation matches `exteriorFaceLoop`.
  const ring = closed ? stripClosingDuplicate(loop) : loop;
  const a = offsetPolyline(ring, thicknessCanvas, 1, closed);
  const b = offsetPolyline(ring, thicknessCanvas, -1, closed);
  const chosen = meanDistToCentroid(a, centroid) >= meanDistToCentroid(b, centroid) ? a : b;
  if (closed && chosen.length > 0 && ring.length < loop.length) {
    chosen.push({ ...chosen[0] });
  }
  return chosen;
}

// ============================================================================
// PUBLIC ENTRY
// ============================================================================

export function computeEnvelopePerimeter(
  walls: readonly WallForEnvelope[],
  envelopeThickness_m: number,
  sceneUnits?: SceneUnits,
  columns: readonly ColumnForEnvelope[] = [],
): EnvelopePerimeterResult {
  if (walls.length === 0) return { chains: [], primaryChain: null };

  const units = sceneUnits ?? walls[0].params.sceneUnits ?? 'mm';
  const s = mmToSceneUnits(units);
  const thicknessCanvas = Math.max(0, envelopeThickness_m) * 1000 * s;
  // 5mm snap: αρκετά μεγάλο για bevel rounding (~2mm error), αρκετά μικρό για να μην
  // συγχέουμε άσχετα σημεία. Covers both axis-exact test walls + real beveled BIM walls.
  const snapCanvas = 5.0 * s;
  const bridgeTolCanvas = COLUMN_BRIDGE_TOL_M * 1000 * s;

  const geos = walls.map(w => ({ w, geometry: computeWallGeometry(w.params, w.kind) }));
  const preparedColumns = prepareColumns(columns);
  const colById = new Map<string, PreparedColumn>(preparedColumns.map(c => [c.id, c] as const));

  const keyed = assignNodeKeys(geos, preparedColumns, snapCanvas, bridgeTolCanvas);
  const byId = new Map<string, KeyedWall>(keyed.map(k => [k.id, k] as const));
  const adj = buildWallAdjacency(keyed);

  const visited = new Set<string>();
  const chains: EnvelopeChain[] = [];
  for (const k of keyed) {
    if (visited.has(k.id)) continue;
    const { ids, closed, enclosesRegion } = orderComponent(k.id, adj, visited);
    const centroid = componentCentroid(ids, byId, colById);
    const exteriorFace = assembleFaceLoop(ids, closed, byId, adj, colById, centroid, snapCanvas);
    const insulationOuter = offsetLoopOutward(exteriorFace, thicknessCanvas, centroid, closed);
    chains.push({
      exteriorFaceLoop: { points: exteriorFace, closed },
      insulationOuterLoop: { points: insulationOuter, closed },
      closed,
      enclosesRegion,
      perimeterM: polylinePerimeterMeters(insulationOuter, closed, s),
      wallIds: ids,
      columnIds: collectColumnIds(ids, byId),
      beamIds: [],
    });
  }

  const closedChains = chains.filter(c => c.closed);
  const primaryChain = closedChains.length > 0
    ? closedChains.reduce((a, b) => (b.perimeterM > a.perimeterM ? b : a))
    : null;
  return { chains, primaryChain };
}
