/**
 * ADR-396 Phase P3 — Envelope perimeter (ETICS) geometry SSoT.
 *
 * Υπολογίζει το **ενιαίο συνεχές εξωτερικό περίγραμμα μόνωσης** ενός κτιρίου,
 * με την προσέγγιση που επέλεξε ο Giorgio (Option 1, Revit-style):
 *   1. Αλυσιδώνει τους τοίχους σε ordered loop μέσω κοινών άκρων (adjacency).
 *   2. Διαλέγει την εξωτερική παρειά κάθε τοίχου (D2: όψη μακριά από centroid).
 *   3. Offset προς τα έξω κατά το πάχος μόνωσης (D4: σταθερό πάχος, mitre γωνίες).
 * ΟΧΙ boolean polygon union — η συνέχεια βγαίνει από τους συνεχείς τοίχους,
 * όπως ακριβώς στη Revit (η μόνωση = στρώση ανά στοιχείο).
 *
 * ΣΗΜΕΙΩΣΗ scope: μόνο τοίχοι. Κολώνες/δοκάρια που προεξέχουν εκτός τοίχου ΔΕΝ
 * τυλίγονται εδώ — η Z1 συνεισφορά τους μετριέται per-element (P2
 * `computeFacadeContributionArea`). By design / Revit model.
 *
 * ΜΟΝΑΔΕΣ (meters-in/meters-out στο public boundary): `envelopeThickness_m` σε
 * ΜΕΤΡΑ· `perimeterM` σε ΜΕΤΡΑ· τα vertex coords παραμένουν σε canvas units
 * (όπως `WallGeometry.outerEdge/innerEdge`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3.1, §7 (P3)
 */

import type { Point3D, Polyline3D } from '../types/bim-base';
import type { WallGeometry, WallKind, WallParams } from '../types/wall-types';
import type { SceneUnits } from '../../utils/scene-units';
import { mmToSceneUnits } from '../../utils/scene-units';
import { computeWallGeometry } from './wall-geometry';
import { offsetPolyline, polygonCentroid } from './shared/polygon-utils';

const MM_TO_M = 1 / 1000;
/** Endpoint-match tolerance σε mm (κλιμακώνεται κατά scene-units στο entry). */
const SNAP_MM = 1.0;

// ============================================================================
// PUBLIC TYPES
// ============================================================================

/** Ελάχιστη μορφή τοίχου για το perimeter (καλύπτει `WallEntity`). */
export interface WallForEnvelope {
  readonly id: string;
  readonly kind: WallKind;
  readonly params: WallParams;
}

/** Ένα κλειστό ή ανοιχτό loop τοίχων μετά την αλυσίδωση. */
export interface EnvelopeChain {
  /** Ordered εξωτ. παρειά των τοίχων (πριν το offset μόνωσης). */
  readonly exteriorFaceLoop: Polyline3D;
  /** Εξωτ. όψη της στρώσης ETICS (offset προς τα έξω κατά το πάχος). */
  readonly insulationOuterLoop: Polyline3D;
  /** True όταν η αλυσίδα κλείνει (cycle). */
  readonly closed: boolean;
  /** Περίμετρος του `insulationOuterLoop` σε ΜΕΤΡΑ. */
  readonly perimeterM: number;
  /** Ordered wall ids όπως διασχίστηκαν (debug / P4 highlight). */
  readonly wallIds: readonly string[];
}

export interface EnvelopePerimeterResult {
  readonly chains: readonly EnvelopeChain[];
  /** Η κύρια κλειστή αλυσίδα (μεγαλύτερη περίμετρος), ή null αν καμία. */
  readonly primaryChain: EnvelopeChain | null;
}

// ============================================================================
// INTERNAL PREP
// ============================================================================

interface PreparedWall {
  readonly id: string;
  readonly startKey: string;
  readonly endKey: string;
  /** Εξωτερική παρειά (axis-ordered start→end). */
  readonly face: readonly Point3D[];
}

/** Raw άκρα τοίχου για adjacency — `params.start/end` (ΟΧΙ trimmed axis: το bevel μετακινεί τον άξονα όχι το σημείο σύνδεσης). */
function endpointsOf(params: WallParams, kind: WallKind): { start: Point3D; end: Point3D } {
  if (kind === 'polyline' && params.polylineVertices && params.polylineVertices.length >= 2) {
    const pv = params.polylineVertices;
    return { start: pv[0], end: pv[pv.length - 1] };
  }
  return { start: params.start, end: params.end };
}

function quantizeKey(p: Point3D, snap: number): string {
  const q = (v: number): number => Math.round(v / snap) * snap;
  return `${q(p.x)},${q(p.y)}`;
}

function meanPoint(points: readonly Point3D[]): { x: number; y: number } {
  return polygonCentroid(points);
}

function dist2(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * D2 — διαλέγει την εξωτερική παρειά: όποια (outer/inner) έχει midpoint
 * μακρύτερα από το `centroid`. Tie → 'outer'. Χειρίζεται `flip=true` σωστά.
 */
export function selectExteriorFace(
  geometry: WallGeometry,
  centroid: { readonly x: number; readonly y: number },
): 'outer' | 'inner' {
  const distOuter = dist2(meanPoint(geometry.outerEdge.points), centroid);
  const distInner = dist2(meanPoint(geometry.innerEdge.points), centroid);
  return distOuter >= distInner ? 'outer' : 'inner';
}

// ============================================================================
// ADJACENCY GRAPH (wall ↔ wall via shared valence-2 nodes)
// ============================================================================

interface WallEdge {
  readonly neighborId: string;
  readonly viaKey: string;
}

/**
 * Χτίζει wall→wall adjacency: δύο τοίχοι είναι γείτονες μόνο όταν μοιράζονται
 * κόμβο valence-2 (καθαρή γωνία). Valence-1 = ανοιχτό άκρο· valence-3+ =
 * T/cross junction (αποκλείεται από closed loop — εσωτερικός τοίχος).
 */
function buildWallAdjacency(prepared: readonly PreparedWall[]): Map<string, WallEdge[]> {
  const nodeMap = new Map<string, Array<{ wallId: string }>>();
  const push = (key: string, wallId: string): void => {
    const arr = nodeMap.get(key);
    if (arr) arr.push({ wallId });
    else nodeMap.set(key, [{ wallId }]);
  };
  for (const p of prepared) {
    push(p.startKey, p.id);
    push(p.endKey, p.id);
  }

  const adj = new Map<string, WallEdge[]>();
  for (const p of prepared) adj.set(p.id, []);
  for (const [key, entries] of nodeMap) {
    if (entries.length !== 2) continue; // valence-2 only
    const [a, b] = entries;
    if (a.wallId === b.wallId) continue; // self-loop guard
    adj.get(a.wallId)?.push({ neighborId: b.wallId, viaKey: key });
    adj.get(b.wallId)?.push({ neighborId: a.wallId, viaKey: key });
  }
  return adj;
}

function sharedKey(adj: Map<string, WallEdge[]>, aId: string, bId: string): string | null {
  return adj.get(aId)?.find(e => e.neighborId === bId)?.viaKey ?? null;
}

/** Συλλέγει + ordering ένα connected component ξεκινώντας από `seedId`. */
function orderComponent(
  seedId: string,
  adj: Map<string, WallEdge[]>,
  visited: Set<string>,
): { ids: string[]; closed: boolean } {
  const comp = new Set<string>([seedId]);
  const queue = [seedId];
  while (queue.length > 0) {
    const c = queue.pop() as string;
    for (const e of adj.get(c) ?? []) {
      if (!comp.has(e.neighborId)) {
        comp.add(e.neighborId);
        queue.push(e.neighborId);
      }
    }
  }
  comp.forEach(id => visited.add(id));

  const isCycle = [...comp].every(id => (adj.get(id)?.length ?? 0) === 2);
  let start = seedId;
  if (!isCycle) {
    for (const id of comp) {
      if ((adj.get(id)?.length ?? 0) < 2) { start = id; break; }
    }
  }

  const ordered: string[] = [];
  const oset = new Set<string>();
  let prev: string | null = null;
  let cur: string | null = start;
  while (cur !== null && !oset.has(cur)) {
    ordered.push(cur);
    oset.add(cur);
    const next = (adj.get(cur) ?? []).find(e => e.neighborId !== prev && !oset.has(e.neighborId));
    prev = cur;
    cur = next ? next.neighborId : null;
  }
  const closed = isCycle && ordered.length === comp.size && ordered.length >= 3;
  return { ids: ordered, closed };
}

// ============================================================================
// FACE LOOP ASSEMBLY
// ============================================================================

/** Append `pts` στο `loop` παρακάμπτοντας near-duplicate κορυφές (στις γωνίες). */
function appendDeduped(loop: Point3D[], pts: readonly Point3D[], snap: number): void {
  const snap2 = snap * snap;
  for (const p of pts) {
    const last = loop[loop.length - 1];
    if (last && dist2(last, p) < snap2) continue;
    loop.push(p);
  }
}

/**
 * Συναρμολογεί την ordered εξωτ. παρειά: για κάθε τοίχο προσανατολίζει την
 * παρειά του ώστε να συνεχίζει head-to-tail με τους γείτονες (exitKey/entryKey).
 */
function assembleFaceLoop(
  ids: readonly string[],
  closed: boolean,
  byId: Map<string, PreparedWall>,
  adj: Map<string, WallEdge[]>,
  snap: number,
): Point3D[] {
  const loop: Point3D[] = [];
  const n = ids.length;
  for (let i = 0; i < n; i++) {
    const p = byId.get(ids[i]);
    if (!p) continue;
    const nextId = i < n - 1 ? ids[i + 1] : (closed ? ids[0] : null);
    const prevId = i > 0 ? ids[i - 1] : (closed ? ids[n - 1] : null);
    const exitKey = nextId !== null ? sharedKey(adj, ids[i], nextId) : null;
    const entryKey = prevId !== null ? sharedKey(adj, ids[i], prevId) : null;

    let forward = true;
    if (exitKey !== null) forward = p.endKey === exitKey;
    else if (entryKey !== null) forward = p.startKey === entryKey;

    appendDeduped(loop, forward ? p.face : [...p.face].reverse(), snap);
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

/** Offset το loop ΕΞΩ (μακριά από centroid) κατά `thicknessCanvas` (winding-agnostic). */
function offsetLoopOutward(
  loop: readonly Point3D[],
  thicknessCanvas: number,
  centroid: { x: number; y: number },
): Point3D[] {
  if (thicknessCanvas <= 0 || loop.length < 2) return [...loop];
  const a = offsetPolyline(loop, thicknessCanvas, 1);
  const b = offsetPolyline(loop, thicknessCanvas, -1);
  return meanDistToCentroid(a, centroid) >= meanDistToCentroid(b, centroid) ? a : b;
}

/** Περίμετρος polyline σε ΜΕΤΡΑ. canvas→m = canvas / (s · 1000). */
function polylinePerimeterM(points: readonly Point3D[], closed: boolean, s: number): number {
  const n = points.length;
  if (n < 2) return 0;
  let canvas = 0;
  for (let i = 1; i < n; i++) canvas += Math.sqrt(dist2(points[i - 1], points[i]));
  if (closed) canvas += Math.sqrt(dist2(points[n - 1], points[0]));
  return canvas * (1 / s) * MM_TO_M;
}

// ============================================================================
// PUBLIC ENTRY
// ============================================================================

/**
 * ADR-396 P3 — υπολογίζει το εξωτερικό περίγραμμα μόνωσης ενός ορόφου.
 *
 * @param walls               εξωτ. τοίχοι ενός ορόφου (filtered από caller).
 * @param envelopeThickness_m πάχος στρώσης ETICS σε ΜΕΤΡΑ (ThermalEnvelopeSpec).
 * @param sceneUnits          canvas unit της σκηνής (default = walls[0] ?? 'mm').
 */
export function computeEnvelopePerimeter(
  walls: readonly WallForEnvelope[],
  envelopeThickness_m: number,
  sceneUnits?: SceneUnits,
): EnvelopePerimeterResult {
  if (walls.length === 0) return { chains: [], primaryChain: null };

  const units = sceneUnits ?? walls[0].params.sceneUnits ?? 'mm';
  const s = mmToSceneUnits(units);
  const thicknessCanvas = Math.max(0, envelopeThickness_m) * 1000 * s;
  const snapCanvas = SNAP_MM * s;

  // Geometry + building centroid (από όλους τους άξονες).
  const geos = walls.map(w => ({ w, geometry: computeWallGeometry(w.params, w.kind) }));
  const centroid = polygonCentroid(geos.flatMap(g => g.geometry.axisPolyline.points));

  // Prepared walls: keys (raw endpoints) + exterior face.
  const prepared: PreparedWall[] = geos.map(({ w, geometry }) => {
    const { start, end } = endpointsOf(w.params, w.kind);
    const faceKind = selectExteriorFace(geometry, centroid);
    const face = (faceKind === 'outer' ? geometry.outerEdge : geometry.innerEdge).points;
    return {
      id: w.id,
      startKey: quantizeKey(start, snapCanvas),
      endKey: quantizeKey(end, snapCanvas),
      face,
    };
  });
  const byId = new Map<string, PreparedWall>(prepared.map(p => [p.id, p] as const));
  const adj = buildWallAdjacency(prepared);

  // Components → chains.
  const visited = new Set<string>();
  const chains: EnvelopeChain[] = [];
  for (const p of prepared) {
    if (visited.has(p.id)) continue;
    const { ids, closed } = orderComponent(p.id, adj, visited);
    const exteriorFace = assembleFaceLoop(ids, closed, byId, adj, snapCanvas);
    const insulationOuter = offsetLoopOutward(exteriorFace, thicknessCanvas, centroid);
    chains.push({
      exteriorFaceLoop: { points: exteriorFace, closed },
      insulationOuterLoop: { points: insulationOuter, closed },
      closed,
      perimeterM: polylinePerimeterM(insulationOuter, closed, s),
      wallIds: ids,
    });
  }

  const closedChains = chains.filter(c => c.closed);
  const primaryChain = closedChains.length > 0
    ? closedChains.reduce((a, b) => (b.perimeterM > a.perimeterM ? b : a))
    : null;
  return { chains, primaryChain };
}
