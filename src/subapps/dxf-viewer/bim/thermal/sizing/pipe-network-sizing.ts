/**
 * ADR-422 L3 — Pipe-network sizing walk (D5) — PURE SSoT.
 *
 * Παίρνει ένα **υπάρχον** δίκτυο θέρμανσης (σωλήνες + πηγές + παροχές τερματικών) και
 * διαστασιολογεί τη διάμετρο κάθε τμήματος. Αλγόριθμος (Revit «Pipe Sizing»):
 *
 *   1. Γράφος: κόμβοι = κοινά άκρα σωλήνων (quantized within join-tolerance),
 *      ακμές = τα `mep-segment`. (Reuse της λογικής `derivePipeNetworks` —
 *      ίδια union-find τοπολογία, αλλά κρατάμε τη δομή κόμβων/ακμών.)
 *   2. Ρίζα ανά component = ο κόμβος πιο κοντά σε connector πηγής (λέβητας/συλλέκτης).
 *      Επειδή τα τερματικά ΔΕΝ είναι segments, ο κλάδος προσαγωγής και ο κλάδος
 *      επιστροφής βγαίνουν ΞΕΧΩΡΙΣΤΑ ΔΕΝΤΡΑ → απλό post-order subtree sum (όχι loop).
 *   3. Κάθε τερματικό προσδίδει τη μαζική παροχή του (kg/s) στον κόμβο του· ο κορμός
 *      κουβαλά το άθροισμα των κατάντη → μεγάλο DN· ο κλάδος ένα σώμα → μικρό DN.
 *   4. flowM3s → standard.diameterForFlow → DN με v≤v_max ∧ R≤R_max.
 *
 * ΜΟΝΑΔΕΣ: endpoints/connector θέσεις σε **scene units** (το tol είναι scene-aware)·
 * παροχές kg/s, φορτία W, διάμετροι mm. Pure/idempotent, full unit-testable.
 *
 * @see ./pipe-sizing · ./velocity-friction-standard · ../../mep-systems/mep-pipe-network-derive
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L3)
 */

import type { Entity } from '../../../types/entities';
import { isMepSegmentEntity, isMepRadiatorEntity } from '../../../types/entities';
import { isPipeNetworkSourceEntity } from '../../mep-systems/pipe-network-source';
import {
  getEntityConnectors,
  getConnectorHostPlanTransform,
} from '../../mep-systems/connector-access';
import { connectorWorldPosition } from '../../types/mep-connector-types';
import { resolvePipeJoinTolerance } from '../../mep-systems/mep-pipe-network-derive';
import type { MepSegmentEntity } from '../../types/mep-segment-types';
import { compareStrings } from '@/lib/array-utils';
import { computePipeVolumeFlow } from './pipe-sizing';
import type { PipeSizingStandard } from './velocity-friction-standard';

/** Παροχή + φορτίο ενός τερματικού (από τον L2 read-model). */
export interface TerminalFlowContribution {
  /** kg/s — μαζική παροχή του σώματος (Φ_share / (c·ΔΤ)). */
  readonly massFlowKgS: number;
  /** W — μερίδιο θερμικού φορτίου του σώματος (για readout). */
  readonly loadW: number;
}

/** Πλήρες αποτέλεσμα διαστασιολόγησης ενός τμήματος σωλήνα (derived). */
export interface PipeSegmentSizing {
  readonly segmentId: string;
  readonly dnMm: number;
  /** mm — εξωτερική διάμετρος (→ `mep-segment.params.diameter` στο apply). */
  readonly outerMm: number;
  readonly innerMm: number;
  /** kg/s — αθροιστική μαζική παροχή κατάντη του τμήματος. */
  readonly massFlowKgS: number;
  /** m³/s — αθροιστική ογκομετρική παροχή. */
  readonly flowM3s: number;
  readonly velocityMS: number;
  readonly frictionPaM: number;
  /** W — αθροιστικό θερμικό φορτίο κατάντη (readout). */
  readonly cumulativeLoadW: number;
  /** Κανένας βαθμός DN δεν ικάνοποίησε τα όρια — επιστράφηκε ο μεγαλύτερος. */
  readonly saturated: boolean;
  /** Το τμήμα ανήκει σε βρόχο (back-edge) — v1 προσεγγιστική παροχή. */
  readonly inLoop: boolean;
}

/** segmentId → αποτέλεσμα διαστασιολόγησης. */
export type PipeSizingMap = ReadonlyMap<string, PipeSegmentSizing>;

/** Όρισμα του walk. */
export interface SizePipeNetworkInput {
  readonly entities: readonly Entity[];
  /** radiatorId → συνεισφορά παροχής/φορτίου (από `usePipeSizing`). */
  readonly terminals: ReadonlyMap<string, TerminalFlowContribution>;
  readonly standard: PipeSizingStandard;
  /** Override join tolerance (scene units)· default `resolvePipeJoinTolerance`. */
  readonly tolerance?: number;
}

interface Pt {
  x: number;
  y: number;
}
interface SegEdge {
  readonly segId: string;
  readonly a: number;
  readonly b: number;
}

// ─── Γράφος (κόμβοι + ακμές) ───────────────────────────────────────────────────

/** Βρες/δημιούργησε κόμβο για σημείο εντός tol (linear nearest). */
function findOrCreateNode(nodes: Pt[], p: Pt, tol2: number): number {
  for (let i = 0; i < nodes.length; i++) {
    const dx = nodes[i]!.x - p.x;
    const dy = nodes[i]!.y - p.y;
    if (dx * dx + dy * dy <= tol2) return i;
  }
  nodes.push({ x: p.x, y: p.y });
  return nodes.length - 1;
}

/** Κοντινότερος υπάρχων κόμβος εντός maxDist, αλλιώς -1. */
function findNearestNode(nodes: readonly Pt[], p: Pt, maxDist2: number): number {
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

/** Χτίσε κόμβους + ακμές από τα pipe segments (ταξινομημένα κατά id). */
function buildGraph(segments: readonly MepSegmentEntity[], tol: number): {
  nodes: Pt[];
  edges: SegEdge[];
} {
  const tol2 = tol * tol;
  const nodes: Pt[] = [];
  const edges: SegEdge[] = [];
  for (const seg of segments) {
    const a = findOrCreateNode(nodes, seg.params.startPoint, tol2);
    const b = findOrCreateNode(nodes, seg.params.endPoint, tol2);
    edges.push({ segId: seg.id, a, b });
  }
  return { nodes, edges };
}

/** Adjacency: node → [{segId, to}]. */
function buildAdjacency(
  nodeCount: number,
  edges: readonly SegEdge[],
): Array<Array<{ segId: string; to: number }>> {
  const adj: Array<Array<{ segId: string; to: number }>> = Array.from(
    { length: nodeCount },
    () => [],
  );
  for (const e of edges) {
    if (e.a === e.b) continue; // degenerate self-loop
    adj[e.a]!.push({ segId: e.segId, to: e.b });
    adj[e.b]!.push({ segId: e.segId, to: e.a });
  }
  return adj;
}

// ─── Τερματικά → κόμβοι (μαζική παροχή ανά κόμβο) ────────────────────────────────

/** World θέσεις των connectors ενός host (radiator/source). */
function connectorWorldPoints(entity: Entity): Pt[] {
  const t = getConnectorHostPlanTransform(entity);
  return getEntityConnectors(entity).map((c) =>
    connectorWorldPosition(c, t.position, t.rotation),
  );
}

/** Προσδίδει την παροχή/φορτίο κάθε τερματικού στον κόμβο του (dedupe ανά component). */
function attachTerminals(
  nodes: readonly Pt[],
  componentOf: readonly number[],
  radiators: readonly Entity[],
  terminals: ReadonlyMap<string, TerminalFlowContribution>,
  maxDist2: number,
): { kg: number[]; w: number[] } {
  const kg = new Array<number>(nodes.length).fill(0);
  const w = new Array<number>(nodes.length).fill(0);
  const seen = new Set<string>();
  for (const rad of radiators) {
    const t = terminals.get(rad.id);
    if (!t) continue;
    for (const p of connectorWorldPoints(rad)) {
      const node = findNearestNode(nodes, p, maxDist2);
      if (node < 0) continue;
      const key = `${componentOf[node]}|${rad.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      kg[node]! += t.massFlowKgS;
      w[node]! += t.loadW;
    }
  }
  return { kg, w };
}

// ─── Components + ρίζες ─────────────────────────────────────────────────────────

/** Union-find σε κόμβους μέσω ακμών → componentOf[node] (root index). */
function computeComponents(nodeCount: number, edges: readonly SegEdge[]): number[] {
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

/**
 * Ρίζα ανά component: ο κόμβος πιο κοντά σε connector πηγής (εντός του component).
 * Fallback (component χωρίς πηγή): ο κόμβος με το μικρότερο index (ντετερμινιστικό).
 */
function resolveComponentRoots(
  nodes: readonly Pt[],
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

// ─── Subtree walk ────────────────────────────────────────────────────────────

interface WalkAcc {
  readonly flowKg: Map<string, number>;
  readonly loadW: Map<string, number>;
  readonly loopSegs: Set<string>;
}

/** BFS από τη ρίζα: σειρά επίσκεψης + parent + tree-edge segId ανά κόμβο. */
function bfsTree(
  root: number,
  adj: ReadonlyArray<ReadonlyArray<{ segId: string; to: number }>>,
): { order: number[]; parent: number[]; edgeSeg: string[]; loopSegs: Set<string> } {
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
        loopSegs.add(segId); // back-edge (ring closure) — v1 flag
      }
    }
  }
  return { order, parent, edgeSeg, loopSegs };
}

/** Post-order accumulation: subtree παροχή ανά tree-edge segment. */
function accumulateSubtree(
  tree: { order: number[]; parent: number[]; edgeSeg: string[] },
  nodeKg: readonly number[],
  nodeW: readonly number[],
  acc: WalkAcc,
): void {
  const subKg = nodeKg.slice();
  const subW = nodeW.slice();
  for (let i = tree.order.length - 1; i >= 0; i--) {
    const node = tree.order[i]!;
    const p = tree.parent[node]!;
    if (p < 0) continue;
    acc.flowKg.set(tree.edgeSeg[node]!, subKg[node]!);
    acc.loadW.set(tree.edgeSeg[node]!, subW[node]!);
    subKg[p]! += subKg[node]!;
    subW[p]! += subW[node]!;
  }
}

/** Διαστασιολόγησε ένα component (δέντρο) ξεκινώντας από τη ρίζα. */
function walkComponent(
  root: number,
  adj: ReadonlyArray<ReadonlyArray<{ segId: string; to: number }>>,
  nodeKg: readonly number[],
  nodeW: readonly number[],
  acc: WalkAcc,
): void {
  const tree = bfsTree(root, adj);
  accumulateSubtree(tree, nodeKg, nodeW, acc);
  for (const s of tree.loopSegs) acc.loopSegs.add(s);
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

function buildSizing(
  segId: string,
  massFlowKgS: number,
  loadW: number,
  inLoop: boolean,
  standard: PipeSizingStandard,
): PipeSegmentSizing {
  const flowM3s = computePipeVolumeFlow(massFlowKgS);
  const sel = standard.diameterForFlow(flowM3s);
  return {
    segmentId: segId,
    dnMm: sel.dnMm,
    outerMm: sel.outerMm,
    innerMm: sel.innerMm,
    massFlowKgS,
    flowM3s,
    velocityMS: sel.velocityMS,
    frictionPaM: sel.frictionPaM,
    cumulativeLoadW: loadW,
    saturated: sel.saturated,
    inLoop,
  };
}

/**
 * Διαστασιολόγηση ΟΛΩΝ των τμημάτων ενός δικτύου θέρμανσης (pure). Επιστρέφει
 * `Map<segmentId, PipeSegmentSizing>` — μόνο για pipe segments. Άδειο όταν δεν
 * υπάρχουν σωλήνες ή τερματικά.
 */
export function sizePipeNetwork(input: SizePipeNetworkInput): PipeSizingMap {
  const out = new Map<string, PipeSegmentSizing>();
  const segments = input.entities
    .filter(isMepSegmentEntity)
    .filter((s) => s.params.domain === 'pipe')
    .sort((a, b) => compareStrings(a.id, b.id));
  if (segments.length === 0) return out;

  const tol = input.tolerance ?? resolvePipeJoinTolerance(input.entities);
  const attachDist2 = (tol * 2) * (tol * 2);
  const { nodes, edges } = buildGraph(segments, tol);
  const adj = buildAdjacency(nodes.length, edges);
  const componentOf = computeComponents(nodes.length, edges);

  const radiators = input.entities.filter(isMepRadiatorEntity);
  const sources = input.entities.filter(isPipeNetworkSourceEntity);
  const { kg, w } = attachTerminals(nodes, componentOf, radiators, input.terminals, attachDist2);
  const roots = resolveComponentRoots(nodes, componentOf, sources, attachDist2);

  const acc: WalkAcc = { flowKg: new Map(), loadW: new Map(), loopSegs: new Set() };
  const walked = new Set<number>();
  for (const rootNode of roots.values()) {
    const comp = componentOf[rootNode]!;
    if (walked.has(comp)) continue;
    walked.add(comp);
    walkComponent(rootNode, adj, kg, w, acc);
  }

  for (const seg of segments) {
    out.set(
      seg.id,
      buildSizing(
        seg.id,
        acc.flowKg.get(seg.id) ?? 0,
        acc.loadW.get(seg.id) ?? 0,
        acc.loopSegs.has(seg.id),
        input.standard,
      ),
    );
  }
  return out;
}
