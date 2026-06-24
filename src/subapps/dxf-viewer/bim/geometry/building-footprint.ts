/**
 * ADR-396 v2 Phase 2 — Building footprint via boolean union (ETICS).
 *
 * Παράγει το ΠΡΑΓΜΑΤΙΚΟ περίγραμμα κτιρίου από την **boolean union** των
 * αποτυπωμάτων (footprints) των δομικών στοιχείων του ορόφου: ΤΟΙΧΟΙ + ΚΟΛΩΝΕΣ +
 * ΔΟΚΑΡΙΑ. Σε αντίθεση με το `envelope-perimeter.ts` (Option 1 — σειριακή ένωση
 * εξωτ. παρειών), η γεωμετρική ένωση χειρίζεται σωστά τα στοιχεία που
 * **επικαλύπτονται** (π.χ. κολώνα μέσα σε τοίχο, δοκάρι πάνω σε τοίχο).
 *
 * Έξοδος: τα εξώτατα όρια (outer rings) + οι τρύπες (holes = αίθρια / δωμάτια),
 * με per-edge mapping ποια οντότητα έδωσε κάθε ακμή του περιγράμματος (τροφοδοτεί
 * τη Φάση 5: per-element Z1 render κολώνας/δοκαριού «ίδια με τοίχους»).
 *
 * Pure SSoT — canvas-unit χώρος (ίδιος με `WallGeometry.outerEdge`,
 * `ColumnGeometry.footprint`, `BeamGeometry.outline`). Μηδέν globals / React /
 * Firestore. Library: `polygon-clipping` (MIT).
 *
 * ⚠️ Phase 2 = αυτόνομο module + tests· ΚΑΝΕΝΑ wiring στους consumers (Φάση 5).
 * Σχεδιασμένο με «συμβατό» σχήμα εξόδου ώστε η Φάση 5 να αντικαταστήσει σταδιακά
 * το `envelope-perimeter.ts` → ΕΝΑ σύστημα (SSoT).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3.1
 */

import type { MultiPolygon, Ring, Pair } from 'polygon-clipping';

import { safeUnion } from './shared/safe-polygon-boolean';
import { closedRingFromEdges } from './shared/polygon-utils';
import type { Point3D, Polyline3D } from '../types/bim-base';
import type { BeamParams } from '../types/beam-types';
import type { SceneUnits } from '../../utils/scene-units';
import { mmToSceneUnits } from '../../utils/scene-units';
import { polygonArea } from './shared/polygon-utils';
import { pointToSegmentDistance } from '../../systems/guides';
import { computeWallGeometry } from './wall-geometry';
import { computeBeamGeometry } from './beam-geometry';
import { prepareColumns, type ColumnForEnvelope } from './envelope-column-bridge';
import type { WallForEnvelope } from './envelope-perimeter';

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export type FootprintSourceType = 'wall' | 'column' | 'beam';

/** Ελάχιστη μορφή δοκαριού για το footprint (καλύπτει `BeamEntity` / `DxfBeam`). */
export interface BeamForFootprint {
  readonly id: string;
  readonly params: BeamParams;
}

/** Μία ακμή του περιγράμματος + ποια οντότητα την έδωσε (null = νέα κορυφή τομής). */
export interface FootprintEdge {
  readonly a: Point3D;
  readonly b: Point3D;
  readonly sourceEntityId: string | null;
  readonly sourceEntityType: FootprintSourceType | null;
}

/** Ένα κλειστό δαχτυλίδι του περιγράμματος (εξώτατο όριο ή τρύπα). */
export interface FootprintRing {
  /** Κλειστό ring (canvas units· χωρίς διπλή κλείνουσα κορυφή). */
  readonly points: Polyline3D;
  /** 1:1 με τις ακμές του ring (edge i = points[i] → points[i+1], wrap-around). */
  readonly edges: readonly FootprintEdge[];
  /** true = τρύπα (αίθριο/δωμάτιο)· false = εξώτατο όριο. */
  readonly isHole: boolean;
  /** Unsigned εμβαδόν σε canvas units². */
  readonly areaCanvas: number;
}

/** Ένα συνεκτικό κομμάτι του περιγράμματος: ένα εξώτατο όριο + οι τρύπες του. */
export interface BuildingFootprintComponent {
  readonly outer: FootprintRing;
  readonly holes: readonly FootprintRing[];
}

export interface BuildingFootprintResult {
  readonly components: readonly BuildingFootprintComponent[];
  /** Convenience flat λίστα όλων των εξώτατων ορίων. */
  readonly outerRings: readonly FootprintRing[];
  /** Convenience flat λίστα όλων των τρυπών (αίθρια/δωμάτια). */
  readonly holes: readonly FootprintRing[];
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

interface InputEdge {
  readonly a: Point3D;
  readonly b: Point3D;
  readonly entityId: string;
  readonly entityType: FootprintSourceType;
}

interface CollectedFootprints {
  /** Κάθε στοιχείο = ένα closed polygon (translated σε local origin). */
  readonly polygons: Point3D[][];
  /** Όλες οι ακμές εισόδου (translated) για το per-edge attribution. */
  readonly inputEdges: InputEdge[];
  /** Local-origin offset που αφαιρέθηκε (για επαναφορά στην έξοδο). */
  readonly offset: { x: number; y: number };
}

const EMPTY_RESULT: BuildingFootprintResult = { components: [], outerRings: [], holes: [] };

// ============================================================================
// FOOTPRINT EXTRACTION (per entity type → closed polygon)
// ============================================================================

/** Τοίχος → κλειστό footprint = outerEdge (forward) + innerEdge (reversed). */
function wallFootprint(w: WallForEnvelope): Point3D[] {
  const g = computeWallGeometry(w.params, w.kind);
  const outer = g.outerEdge.points;
  const inner = g.innerEdge.points;
  if (outer.length < 2 || inner.length < 2) return [];
  return closedRingFromEdges(outer, inner);
}

/** Δοκάρι → κλειστό footprint = το plan-view outline (width × length). */
function beamFootprint(b: BeamForFootprint): Point3D[] {
  try {
    return [...computeBeamGeometry(b.params).outline.vertices];
  } catch {
    return [];
  }
}

/** Σπρώχνει τις ακμές ενός κλειστού polygon στη λίστα input edges. */
function pushEdges(
  poly: readonly Point3D[],
  entityId: string,
  entityType: FootprintSourceType,
  sink: InputEdge[],
): void {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    sink.push({ a: poly[i], b: poly[(i + 1) % n], entityId, entityType });
  }
}

/** Είναι έγκυρο polygon (≥3 κορυφές, μη μηδενικό εμβαδόν). */
function isValidPolygon(poly: readonly Point3D[]): boolean {
  return poly.length >= 3 && polygonArea(poly) > 0;
}

/**
 * Μαζεύει τα footprints όλων των στοιχείων, μεταφράζει σε local origin (precision
 * guard για το polygon-clipping σε mm-scale ~χιλιάδες) και χτίζει τις input edges.
 */
function collectFootprints(
  walls: readonly WallForEnvelope[],
  columns: readonly ColumnForEnvelope[],
  beams: readonly BeamForFootprint[],
): CollectedFootprints {
  const raw: Array<{ poly: Point3D[]; id: string; type: FootprintSourceType }> = [];

  for (const w of walls) {
    const poly = wallFootprint(w);
    if (isValidPolygon(poly)) raw.push({ poly, id: w.id, type: 'wall' });
  }
  for (const c of prepareColumns(columns)) {
    const poly = [...c.footprint];
    if (isValidPolygon(poly)) raw.push({ poly, id: c.id, type: 'column' });
  }
  for (const b of beams) {
    const poly = beamFootprint(b);
    if (isValidPolygon(poly)) raw.push({ poly, id: b.id, type: 'beam' });
  }

  if (raw.length === 0) return { polygons: [], inputEdges: [], offset: { x: 0, y: 0 } };

  let minX = Infinity;
  let minY = Infinity;
  for (const r of raw) {
    for (const p of r.poly) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
    }
  }
  const offset = { x: minX, y: minY };

  const polygons: Point3D[][] = [];
  const inputEdges: InputEdge[] = [];
  for (const r of raw) {
    const shifted = r.poly.map((p) => ({ x: p.x - offset.x, y: p.y - offset.y, z: 0 }));
    polygons.push(shifted);
    pushEdges(shifted, r.id, r.type, inputEdges);
  }
  return { polygons, inputEdges, offset };
}

// ============================================================================
// EDGE → ENTITY ATTRIBUTION
// ============================================================================

/** sin της μέγιστης γωνιακής απόκλισης για να θεωρηθούν δύο ακμές παράλληλες (~3°). */
const PARALLEL_SIN_TOL = 0.05;
const LEN_EPS = 1e-9;

/**
 * Βρίσκει την οντότητα που έδωσε την ακμή `a→b`: το input edge που είναι
 * **παράλληλο** ΚΑΙ περιέχει το **midpoint** της εξόδου εντός ανοχής. Το
 * polygon-clipping δεν κρατά provenance → reconstruction με γεωμετρική ταύτιση.
 *
 * Midpoint (αντί και-τα-δύο-άκρα): η lib **ενώνει collinear ακμές** → μια ακμή
 * εξόδου μπορεί να καλύπτει πολλά input edges· το midpoint την αποδίδει σε ΕΝΑ
 * (best-effort — Phase 5 μπορεί να split-άρει στις κορυφές εισόδου). Παράλληλο
 * φίλτρο: αποκλείει κάθετο input edge που τυχαία περνά κοντά από το midpoint σε
 * γωνία. Κανένα match → null (νέα κορυφή από τομή). O(inputEdges) ανά output edge.
 */
function attributeEdge(
  a: Point3D,
  b: Point3D,
  inputEdges: readonly InputEdge[],
  tol: number,
): { id: string | null; type: FootprintSourceType | null } {
  const mid: Point3D = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: 0 };
  const odx = b.x - a.x;
  const ody = b.y - a.y;
  const oLen = Math.hypot(odx, ody);
  if (oLen < LEN_EPS) return { id: null, type: null };

  let best: InputEdge | null = null;
  let bestScore = Infinity;
  for (const e of inputEdges) {
    const dMid = pointToSegmentDistance(mid, e.a, e.b);
    if (dMid > tol) continue;
    const idx = e.b.x - e.a.x;
    const idy = e.b.y - e.a.y;
    const iLen = Math.hypot(idx, idy);
    if (iLen < LEN_EPS) continue;
    const cross = Math.abs(odx * idy - ody * idx) / (oLen * iLen);
    if (cross > PARALLEL_SIN_TOL) continue;
    const score = dMid + cross;
    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best ? { id: best.entityId, type: best.entityType } : { id: null, type: null };
}

// ============================================================================
// RING ASSEMBLY
// ============================================================================

/** polygon-clipping ring → κλειστό ring χωρίς διπλή κλείνουσα κορυφή. */
function ringPairsToPoints(ring: Ring, offset: { x: number; y: number }): Point3D[] {
  const pts: Point3D[] = ring.map((pr: Pair) => ({ x: pr[0] + offset.x, y: pr[1] + offset.y, z: 0 }));
  // polygon-clipping επαναλαμβάνει την πρώτη κορυφή στο τέλος — αφαίρεσέ την.
  if (pts.length >= 2) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first.x === last.x && first.y === last.y) pts.pop();
  }
  return pts;
}

/** Χτίζει ένα `FootprintRing` (points + per-edge attribution + isHole + area). */
function buildRing(
  ring: Ring,
  isHole: boolean,
  inputEdges: readonly InputEdge[],
  offset: { x: number; y: number },
  tol: number,
): FootprintRing {
  const points = ringPairsToPoints(ring, offset);
  // Attribution σε translated space (input edges είναι translated) → αφαίρεσε offset.
  const edges: FootprintEdge[] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const aT = { x: a.x - offset.x, y: a.y - offset.y, z: 0 };
    const bT = { x: b.x - offset.x, y: b.y - offset.y, z: 0 };
    const src = attributeEdge(aT, bT, inputEdges, tol);
    edges.push({ a, b, sourceEntityId: src.id, sourceEntityType: src.type });
  }
  return { points: { points, closed: true }, edges, isHole, areaCanvas: polygonArea(points) };
}

// ============================================================================
// PUBLIC ENTRY
// ============================================================================

/**
 * Boolean union των footprints (τοίχοι + κολώνες + δοκάρια) → εξώτατα όρια + τρύπες.
 *
 * @param walls    - τοίχοι ορόφου (footprint = outer + inner edge).
 * @param columns  - κολώνες (footprint = `ColumnGeometry.footprint`). Optional.
 * @param beams    - δοκάρια (footprint = `BeamGeometry.outline`). Optional.
 * @param sceneUnits - μόνο για κλίμακα ανοχής attribution. Default από walls[0]/'mm'.
 */
export function computeBuildingFootprint(
  walls: readonly WallForEnvelope[],
  columns: readonly ColumnForEnvelope[] = [],
  beams: readonly BeamForFootprint[] = [],
  sceneUnits?: SceneUnits,
): BuildingFootprintResult {
  const { polygons, inputEdges, offset } = collectFootprints(walls, columns, beams);
  if (polygons.length === 0) return EMPTY_RESULT;

  const units = sceneUnits ?? walls[0]?.params.sceneUnits ?? 'mm';
  const s = mmToSceneUnits(units);
  const tol = 5.0 * s; // 5mm physical — mirror του snap στο envelope-perimeter.

  // polygon-clipping geom: κάθε στοιχείο = Polygon (ένα ring). union(first, ...rest).
  const geoms = polygons.map((poly): Ring[] => [poly.map((p): Pair => [p.x, p.y])]);
  const merged: MultiPolygon = safeUnion(geoms[0], ...geoms.slice(1));

  const components: BuildingFootprintComponent[] = [];
  const outerRings: FootprintRing[] = [];
  const holes: FootprintRing[] = [];
  for (const polygon of merged) {
    if (polygon.length === 0) continue;
    const outer = buildRing(polygon[0], false, inputEdges, offset, tol);
    const compHoles = polygon.slice(1).map((ring) => buildRing(ring, true, inputEdges, offset, tol));
    components.push({ outer, holes: compHoles });
    outerRings.push(outer);
    holes.push(...compHoles);
  }
  return { components, outerRings, holes };
}
