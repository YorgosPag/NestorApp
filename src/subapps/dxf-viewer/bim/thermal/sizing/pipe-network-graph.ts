/**
 * ADR-422 L3/L4 — Pipe-network topology graph — PURE SSoT (shared).
 *
 * Κοινός γράφος δικτύου σωληνώσεων που καταναλώνουν **και** το L3 sizing walk
 * (`pipe-network-sizing.ts`) **και** το L4 hydraulic balancing
 * (`balancing/circuit-balancing.ts`). Μία και μόνη υλοποίηση τοπολογίας — κανένα
 * fork (κανόνας N.0.2 / SSoT).
 *
 *   - Κόμβοι = κοινά άκρα σωλήνων (quantized εντός join-tolerance).
 *   - Ακμές = τα `mep-segment` (domain 'pipe').
 *   - Components = union-find στους κόμβους μέσω των ακμών.
 *   - Ρίζα ανά component = ο κόμβος πιο κοντά σε connector πηγής (λέβητας/συλλέκτης).
 *   - `bfsTree` = δέντρο επικάλυψης ανά ρίζα (parent/edgeSeg/order + back-edges).
 *
 * Επειδή τα τερματικά (σώματα) ΔΕΝ είναι segments, ο κλάδος προσαγωγής και ο κλάδος
 * επιστροφής βγαίνουν ΞΕΧΩΡΙΣΤΑ ΔΕΝΤΡΑ (ξεχωριστά components) — το «κύκλωμα» τα ενώνει
 * per-terminal στον consumer. ΜΟΝΑΔΕΣ: θέσεις σε **scene units** (το tol είναι
 * scene-aware). Pure/idempotent, full unit-testable.
 *
 * @see ./pipe-network-sizing (L3 consumer) · ../balancing/circuit-balancing (L4 consumer)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L3/L4)
 */

import type { Entity } from '../../../types/entities';
import {
  getEntityConnectors,
  getConnectorHostPlanTransform,
} from '../../mep-systems/connector-access';
import { connectorWorldPosition } from '../../types/mep-connector-types';
import type { MepSegmentEntity } from '../../types/mep-segment-types';

/** Σημείο στο plan (scene units). */
export interface GraphPoint {
  x: number;
  y: number;
}

/** Ακμή του γράφου = ένα pipe segment μεταξύ δύο κόμβων (indices). */
export interface GraphSegEdge {
  readonly segId: string;
  readonly a: number;
  readonly b: number;
}

/** Γράφος δικτύου: κόμβοι (θέσεις) + ακμές (segments). */
export interface PipeNetworkGraph {
  readonly nodes: readonly GraphPoint[];
  readonly edges: readonly GraphSegEdge[];
}

/** Adjacency entry: γειτονικός κόμβος + το segment που τους ενώνει. */
export interface AdjEntry {
  readonly segId: string;
  readonly to: number;
}

/** Spanning tree από μια ρίζα (BFS). */
export interface BfsTree {
  /** Σειρά επίσκεψης (root-first → leaves). */
  readonly order: readonly number[];
  /** parent[node] = γονικός κόμβος (-1 για τη ρίζα / μη-επισκεφθέντες). */
  readonly parent: readonly number[];
  /** edgeSeg[node] = segId της tree-ακμής node↔parent ('' για τη ρίζα). */
  readonly edgeSeg: readonly string[];
  /** segIds back-edges (κλείσιμο βρόχου) — δεν ανήκουν στο δέντρο. */
  readonly loopSegs: ReadonlySet<string>;
}

// ─── Κόμβοι ─────────────────────────────────────────────────────────────────────

/** Βρες/δημιούργησε κόμβο για σημείο εντός tol (linear nearest). */
function findOrCreateNode(nodes: GraphPoint[], p: GraphPoint, tol2: number): number {
  for (let i = 0; i < nodes.length; i++) {
    const dx = nodes[i]!.x - p.x;
    const dy = nodes[i]!.y - p.y;
    if (dx * dx + dy * dy <= tol2) return i;
  }
  nodes.push({ x: p.x, y: p.y });
  return nodes.length - 1;
}

/** Κοντινότερος υπάρχων κόμβος εντός maxDist², αλλιώς -1. */
export function findNearestNode(
  nodes: readonly GraphPoint[],
  p: GraphPoint,
  maxDist2: number,
): number {
  let best = -1;
  let bestD = maxDist2;
  for (let i = 0; i < nodes.length; i++) {
    const dx = nodes[i]!.x - p.x;
    const dy = nodes[i]!.y - p.y;
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

// ─── Γράφος ──────────────────────────────────────────────────────────────────────

/** Χτίσε κόμβους + ακμές από τα pipe segments (καλούνται ταξινομημένα κατά id). */
export function buildGraph(segments: readonly MepSegmentEntity[], tol: number): PipeNetworkGraph {
  const tol2 = tol * tol;
  const nodes: GraphPoint[] = [];
  const edges: GraphSegEdge[] = [];
  for (const seg of segments) {
    const a = findOrCreateNode(nodes, seg.params.startPoint, tol2);
    const b = findOrCreateNode(nodes, seg.params.endPoint, tol2);
    edges.push({ segId: seg.id, a, b });
  }
  return { nodes, edges };
}

/** Adjacency list: node → [{segId, to}] (αγνοεί degenerate self-loops). */
export function buildAdjacency(
  nodeCount: number,
  edges: readonly GraphSegEdge[],
): AdjEntry[][] {
  const adj: AdjEntry[][] = Array.from({ length: nodeCount }, () => []);
  for (const e of edges) {
    if (e.a === e.b) continue;
    adj[e.a]!.push({ segId: e.segId, to: e.b });
    adj[e.b]!.push({ segId: e.segId, to: e.a });
  }
  return adj;
}

/** Union-find σε κόμβους μέσω ακμών → componentOf[node] (root index). */
export function computeComponents(nodeCount: number, edges: readonly GraphSegEdge[]): number[] {
  const parent = Array.from({ length: nodeCount }, (_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r]!;
    while (parent[i] !== r) {
      const n = parent[i]!;
      parent[i] = r;
      i = n;
    }
    return r;
  };
  for (const e of edges) parent[find(e.a)] = find(e.b);
  return parent.map((_, i) => find(i));
}

// ─── Πηγές / ρίζες ───────────────────────────────────────────────────────────────

/** World θέσεις των connectors ενός host (radiator/source/πηγή). */
export function connectorWorldPoints(entity: Entity): GraphPoint[] {
  const t = getConnectorHostPlanTransform(entity);
  return getEntityConnectors(entity).map((c) =>
    connectorWorldPosition(c, t.position, t.rotation),
  );
}

/**
 * Ρίζα ανά component: ο κόμβος πιο κοντά σε connector πηγής (εντός του component).
 * Fallback (component χωρίς πηγή): ο κόμβος με το μικρότερο index (ντετερμινιστικό).
 */
export function resolveComponentRoots(
  nodes: readonly GraphPoint[],
  componentOf: readonly number[],
  sources: readonly Entity[],
  maxDist2: number,
): Map<number, number> {
  const roots = new Map<number, number>();
  for (const src of sources) {
    for (const p of connectorWorldPoints(src)) {
      const node = findNearestNode(nodes, p, maxDist2);
      if (node < 0) continue;
      const comp = componentOf[node]!;
      if (!roots.has(comp)) roots.set(comp, node);
    }
  }
  for (let i = 0; i < nodes.length; i++) {
    const comp = componentOf[i]!;
    if (!roots.has(comp)) roots.set(comp, i);
  }
  return roots;
}

// ─── Spanning tree ───────────────────────────────────────────────────────────────

/** BFS από τη ρίζα: σειρά επίσκεψης + parent + tree-edge segId ανά κόμβο. */
export function bfsTree(
  root: number,
  adj: ReadonlyArray<ReadonlyArray<AdjEntry>>,
): BfsTree {
  const parent = new Array<number>(adj.length).fill(-1);
  const edgeSeg = new Array<string>(adj.length).fill('');
  const visited = new Array<boolean>(adj.length).fill(false);
  const loopSegs = new Set<string>();
  const order: number[] = [];
  const queue = [root];
  visited[root] = true;
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const { segId, to } of adj[node]!) {
      if (!visited[to]) {
        visited[to] = true;
        parent[to] = node;
        edgeSeg[to] = segId;
        queue.push(to);
      } else if (segId !== edgeSeg[node]) {
        loopSegs.add(segId); // back-edge (ring closure)
      }
    }
  }
  return { order, parent, edgeSeg, loopSegs };
}
