/**
 * Auto-area geometry: finds closed polygon faces formed by connected line segments.
 * Algorithm: half-edge planar face traversal (O(n log n)).
 */

import type { Point2D } from '../../rendering/types/Types';
import { segmentIntersection } from '../../utils/geometry/GeometryUtils';
import { getNearestPointOnLine, getLineParameter, pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';

// ============================================================================
// TYPES
// ============================================================================

interface Node {
  pos: Point2D;
}

/** Param-space epsilon: αγνοούμε τομές ακριβώς στα άκρα ενός τμήματος (t≈0/1). */
const PARAM_EPS = 1e-6;

/**
 * Planarization / noding: σπάει τα τμήματα στα σημεία **τομής** τους (X-crossings
 * ΚΑΙ T-junctions) ώστε να προκύψει επίπεδος γράφος όπου τα τμήματα συναντιούνται
 * ΜΟΝΟ σε κορυφές. Απαραίτητο για κατόψεις «σκάρα» (γραμμές που τέμνονται στη μέση,
 * όχι άκρο-με-άκρο): χωρίς αυτό ο half-edge face traversal δεν βρίσκει τα δωμάτια,
 * γιατί τα crossings δεν είναι κόμβοι του γράφου.
 *
 * **Tolerance-aware (ADR-507 Φ3):** σε πραγματικές κατόψεις οι τοίχοι σπάνια
 * τέμνονται/ενώνονται τέλεια — ένα άκρο σταματά λίγα mm **πριν** (κενό) ή **μετά**
 * (overshoot) τον κάθετο τοίχο. Το exact `segmentIntersection` τα χάνει (t/u εκτός
 * [0,1]) → το κελί δεν κλείνει → ο traversal διαρρέει σε γιγάντιο face. Γι' αυτό,
 * πέρα από τις ακριβείς τομές, σπάμε ΚΑΙ σε **T-junctions με ανοχή**: αν το άκρο
 * ενός τμήματος προβάλλεται στο ΕΣΩΤΕΡΙΚΟ ενός άλλου σε απόσταση ≤ `snapTol`,
 * σπάμε τον «host» στο foot point. Το άκρο και το foot απέχουν ≤ `snapTol`, οπότε
 * το `findOrAdd` (ίδια ανοχή) τα ενώνει αυτόματα σε έναν κόμβο — χωρίς να
 * μετακινήσουμε άκρα. Έτσι κλείνουν gap **και** overshoot junctions.
 *
 * Το (κοινό) σημείο τομής μοιράζεται ως ΙΔΙΟ object και στα δύο τμήματα ώστε το
 * endpoint-merge του traversal να τα ενώσει σε έναν κόμβο. O(n²) pairwise — το
 * αποτέλεσμα γίνεται cache στο `getCachedClosedFaces`.
 *
 * @param snapTol Ανοχή σε world units (= `max(SNAP_DEFAULT/scale, gapTolerance)`).
 *   Τροφοδοτεί το T-junction noding· 0 = μόνο exact crossings (μη-regression).
 */
function planarizeSegments(
  linePairs: ReadonlyArray<readonly [Point2D, Point2D]>,
  snapTol: number,
  eps = 1e-9,
): [Point2D, Point2D][] {
  const n = linePairs.length;
  const cuts: { t: number; p: Point2D }[][] = Array.from({ length: n }, () => []);

  // Split ΜΟΝΟ στο ΕΣΩΤΕΡΙΚΟ κάθε τμήματος· οι ακραίες ενώσεις (t≈0/1) πιάνονται
  // ήδη από το endpoint-merge (`findOrAdd`) του face traversal.
  const addCut = (seg: number, t: number, p: Point2D): void => {
    if (t > PARAM_EPS && t < 1 - PARAM_EPS) cuts[seg].push({ t, p });
  };

  // T-junction με ανοχή: αν το άκρο `P` πέφτει στο ΕΣΩΤΕΡΙΚΟ του host `[h1,h2]` σε
  // απόσταση ≤ snapTol, σπάμε τον host στο foot. ΟΛΗ η γεωμετρία μέσω υπαρχόντων
  // SSoT (geometry-utils, ADR-065): param + clamped distance + foot point — μηδέν
  // inline math, μηδέν νέος intersection helper.
  const tryEndpointSplit = (P: Point2D, hostIdx: number, h1: Point2D, h2: Point2D): void => {
    if (snapTol <= 0) return;
    const t = getLineParameter(P, h1, h2);
    if (t <= PARAM_EPS || t >= 1 - PARAM_EPS) return; // μόνο εσωτερικό (T-junction)
    if (pointToLineDistance(P, h1, h2) > snapTol) return;
    addCut(hostIdx, t, getNearestPointOnLine(P, h1, h2, true));
  };

  for (let i = 0; i < n; i++) {
    const [a1, a2] = linePairs[i];
    for (let j = i + 1; j < n; j++) {
      const [b1, b2] = linePairs[j];
      const hit = segmentIntersection(a1, a2, b1, b2, eps);
      if (hit) {
        addCut(i, hit.t, hit.point);
        addCut(j, hit.u, hit.point);
        continue;
      }
      // Καμία ακριβής τομή → δοκίμασε tolerance-aware T-junctions και προς τις 2
      // κατευθύνσεις (άκρο του ενός στο εσωτερικό του άλλου).
      tryEndpointSplit(b1, i, a1, a2);
      tryEndpointSplit(b2, i, a1, a2);
      tryEndpointSplit(a1, j, b1, b2);
      tryEndpointSplit(a2, j, b1, b2);
    }
  }
  const out: [Point2D, Point2D][] = [];
  for (let i = 0; i < n; i++) {
    const [s, e] = linePairs[i];
    if (cuts[i].length === 0) { out.push([s, e]); continue; }
    cuts[i].sort((p, q) => p.t - q.t);
    let prev = s;
    for (const c of cuts[i]) { out.push([prev, c.p]); prev = c.p; }
    out.push([prev, e]);
  }
  return out;
}

/**
 * Gap-bridging «extend-to-gap» (AutoCAD HPGAPTOL): για κάθε άκρο τμήματος προεκτείνει
 * το τμήμα στην κατεύθυνσή του και, αν συναντήσει το ΠΛΗΣΙΕΣΤΕΡΟ άκρο άλλου τμήματος
 * εντός `gapTol` (κατά μήκος) και σχεδόν συγγραμμικά (perp ≤ `mergeTol`), προσθέτει
 * ευθεία γέφυρα. Έτσι κλείνουν ΑΝΟΙΧΤΑ κενά ορίου (πόρτες/σκάλες) χωρίς να καταρρέουν
 * κόμβοι. Το «πλησιέστερο πρώτα» αποτρέπει υπερπήδηση γειτονικών άκρων· τυχόν γέφυρα
 * προς ήδη-συνδεδεμένο άκρο γίνεται deduplicated στο edge-dedup.
 */
function bridgeCollinearGaps(
  linePairs: ReadonlyArray<readonly [Point2D, Point2D]>,
  mergeTol: number,
  gapTol: number,
): [Point2D, Point2D][] {
  // Κάθε άκρο με την ΕΞΩΣΤΡΕΦΗ μοναδιαία κατεύθυνση του τμήματός του.
  const ends: { p: Point2D; dx: number; dy: number }[] = [];
  for (const [s, e] of linePairs) {
    const len = Math.hypot(e.x - s.x, e.y - s.y);
    if (len < 1e-9) continue;
    ends.push({ p: s, dx: (s.x - e.x) / len, dy: (s.y - e.y) / len });
    ends.push({ p: e, dx: (e.x - s.x) / len, dy: (e.y - s.y) / len });
  }

  const bridges: [Point2D, Point2D][] = [];
  for (let i = 0; i < ends.length; i++) {
    const a = ends[i];
    let best: { q: Point2D; along: number } | null = null;
    for (let j = 0; j < ends.length; j++) {
      if (j === i) continue;
      const b = ends[j];
      const vx = b.p.x - a.p.x;
      const vy = b.p.y - a.p.y;
      const along = vx * a.dx + vy * a.dy;           // προβολή στην προέκταση (ahead > 0)
      if (along <= mergeTol || along > gapTol) continue; // πραγματικό κενό, εντός HPGAPTOL
      const perp = Math.abs(vx * -a.dy + vy * a.dx);  // πλευρική απόκλιση από την ευθεία
      if (perp > mergeTol) continue;                  // σχεδόν συγγραμμικό μόνο
      if (!best || along < best.along) best = { q: b.p, along };
    }
    if (best) bridges.push([{ x: a.p.x, y: a.p.y }, { x: best.q.x, y: best.q.y }]);
  }
  return bridges;
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Given an array of line segment endpoint pairs, finds all bounded (interior)
 * closed polygon faces formed by connected segments. Returns each face as an
 * ordered array of vertices.
 *
 * @param linePairs - Array of [start, end] world-coord pairs
 * @param mergeTol  - Απόσταση σύμπτωσης κόμβων (node snap) + perp-corridor + T-junction
 *                    proximity. Μικρή (≈ pixel snap σε world units). ΔΕΝ διογκώνεται
 *                    από το gap tolerance — έτσι μικροί τοίχοι ΔΕΝ καταρρέουν.
 * @param gapTol    - AutoCAD HPGAPTOL (world units). Μέγιστο μήκος «extend-to-gap»
 *                    γέφυρας πάνω από ΑΝΟΙΧΤΟ κενό ορίου (πόρτα/σκάλα). 0 = χωρίς
 *                    bridging (μη-regression).
 */
export function findClosedPolygonsFromLines(
  linePairs: ReadonlyArray<readonly [Point2D, Point2D]>,
  mergeTol: number,
  gapTol = 0,
): Point2D[][] {
  if (linePairs.length < 3) return [];

  // 0a. Gap-bridging (HPGAPTOL) — γεφυρώνει ΑΝΟΙΧΤΑ κενά ορίου (πόρτες/σκάλες) με
  // ευθεία «extend-to-gap» γέφυρα, όπως το AutoCAD BHATCH. Διαφορετικό από το
  // node-merge: ΠΡΟΣΘΕΤΕΙ ακμή αντί να καταρρέει κόμβους (δεν χαλά μικρούς τοίχους).
  const bridges = gapTol > 0 ? bridgeCollinearGaps(linePairs, mergeTol, gapTol) : [];
  const withBridges = bridges.length ? [...linePairs, ...bridges] : linePairs;

  // 0b. Planarization/noding — σπάμε τα τμήματα στα σημεία τομής (X + tolerance-aware
  // T-junctions) ώστε οι διασταυρούμενες γραμμές («σκάρα») ΚΑΙ οι τοίχοι με μικρά
  // κενά/overshoots να γίνουν κόμβοι του γράφου → βρίσκονται τα δωμάτια.
  const noded = planarizeSegments(withBridges, mergeTol);

  // 1. Normalize endpoints
  const nodes: Node[] = [];
  const edgeList: [number, number][] = [];

  const findOrAdd = (p: Point2D): number => {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i].pos;
      if (Math.hypot(n.x - p.x, n.y - p.y) <= mergeTol) return i;
    }
    return nodes.push({ pos: { x: p.x, y: p.y } }) - 1;
  };

  // Dedup ακμών ανά ζεύγος κόμβων: οι διπλές/επικαλυπτόμενες γραμμές (π.χ. τοίχος
  // σχεδιασμένος δύο φορές) θα δημιουργούσαν παράλληλες half-edges μεταξύ ίδιων
  // κόμβων → ασαφές «επόμενο» στην angular sort → χαλασμένες όψεις.
  const seenEdges = new Set<string>();
  for (const [s, e] of noded) {
    const u = findOrAdd(s);
    const v = findOrAdd(e);
    if (u === v) continue;
    const key = u < v ? `${u}-${v}` : `${v}-${u}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    edgeList.push([u, v]);
  }

  if (edgeList.length < 3) return [];

  // 2. Half-edge structure
  // he = 2*i → edge[i] forward (u→v); he = 2*i+1 → backward (v→u)
  const heCount = edgeList.length * 2;
  const heFrom = new Int32Array(heCount);
  const heTo   = new Int32Array(heCount);
  for (let i = 0; i < edgeList.length; i++) {
    const [u, v] = edgeList[i];
    heFrom[2 * i]     = u;  heTo[2 * i]     = v;
    heFrom[2 * i + 1] = v;  heTo[2 * i + 1] = u;
  }

  // Sort outgoing half-edges CCW by angle at each node
  const nodeOut: number[][] = nodes.map(() => []);
  for (let he = 0; he < heCount; he++) nodeOut[heFrom[he]].push(he);

  const angle = (he: number): number =>
    Math.atan2(nodes[heTo[he]].pos.y - nodes[heFrom[he]].pos.y,
               nodes[heTo[he]].pos.x - nodes[heFrom[he]].pos.x);

  for (const out of nodeOut) out.sort((a, b) => angle(a) - angle(b));

  // Build heNext: next half-edge in face cycle = prev CCW edge from destination
  const heNext = new Int32Array(heCount);
  for (let he = 0; he < heCount; he++) {
    const twin = he ^ 1;
    const v = heFrom[twin];
    const out = nodeOut[v];
    const idx = out.indexOf(twin);
    heNext[he] = out[(idx - 1 + out.length) % out.length];
  }

  // 3. Trace all face cycles
  const visited = new Uint8Array(heCount);
  const faces: Point2D[][] = [];

  for (let start = 0; start < heCount; start++) {
    if (visited[start]) continue;
    const poly: Point2D[] = [];
    let he = start;
    let guard = 0;
    do {
      visited[he] = 1;
      poly.push(nodes[heFrom[he]].pos);
      he = heNext[he];
    } while (he !== start && ++guard < heCount);

    if (poly.length < 3) continue;

    // Keep only interior (bounded) faces: positive signed area in DXF math coords
    let area2 = 0;
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      area2 += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
    }
    if (area2 > 0) faces.push(poly);
  }

  return faces;
}
