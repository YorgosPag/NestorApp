/**
 * Load-path graph traversal — pure SSoT (ADR-467).
 *
 * Διασχίζει τον στατικό οργανισμό (ADR-459 `StructuralGraph`) κατά τη **διαδρομή
 * φορτίων** (slab→beam→column→footing→soil), παράγοντας:
 *
 *   1. `topologicalLoadOrder` — reverse-topological σειρά (Kahn): κάθε στηριζόμενο
 *      μέλος προηγείται του στηρίζοντος → **beams → columns → footings**. Έτσι κάθε
 *      μέλος έχει υπολογιστεί ΠΡΙΝ «παραδώσει» (footing μετά την κολώνα του).
 *   2. Edge resolvers (`beamSupportColumnIds`, `footingColumnId`) για το ποιος
 *      παραδίδει σε ποιον.
 *
 * **`top-attachment` ακμές ΕΞΑΙΡΟΥΝΤΑΙ** — είναι γεωμετρικές (κορυφή μέλους σε host
 * από πάνω), ΟΧΙ load-delivery. Pure — zero entities/React/Firestore· δουλεύει αμιγώς
 * πάνω στον graph (testable με synthetic nodes/edges).
 *
 * @see ../organism/structural-organism-types.ts — StructuralGraph / edge kinds
 * @see ./load-path-takedown.ts — entity-aware orchestration (member assembly)
 * @see docs/centralized-systems/reference/adrs/ADR-467-load-path-engine.md
 */

import type {
  StructuralEdge,
  StructuralGraph,
  StructuralNode,
} from '../organism/structural-organism-types';

/** Ακμές που μεταφέρουν φορτίο (αποκλείει τις γεωμετρικές `top-attachment`). */
function loadEdges(graph: StructuralGraph): readonly StructuralEdge[] {
  return graph.edges.filter((e) => e.kind !== 'top-attachment');
}

/**
 * Reverse-topological σειρά κατά τη διαδρομή φορτίων (Kahn). `inDegree` ενός node =
 * πόσα στηριζόμενα μέλη πρέπει να παραδώσουν πρώτα (ακμές όπου node = `supportId`).
 * Επιστρέφει beams → columns → footings. Σε (απρόσμενο) κύκλο, τα εναπομείναντα nodes
 * προσαρτώνται στο τέλος ώστε κανένα μέλος να μη χαθεί (graceful, μη-throwing).
 */
export function topologicalLoadOrder(graph: StructuralGraph): StructuralNode[] {
  const edges = loadEdges(graph);
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>(graph.nodes.map((n) => [n.id, 0]));
  for (const e of edges) inDegree.set(e.supportId, (inDegree.get(e.supportId) ?? 0) + 1);

  const queue = graph.nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0);
  const ordered: StructuralNode[] = [];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const node = queue.shift() as StructuralNode;
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    ordered.push(node);
    for (const e of edges) {
      if (e.supportedId !== node.id) continue;
      const deg = (inDegree.get(e.supportId) ?? 0) - 1;
      inDegree.set(e.supportId, deg);
      if (deg <= 0) {
        const next = nodeById.get(e.supportId);
        if (next && !seen.has(next.id)) queue.push(next);
      }
    }
  }
  // Cycle fallback: ό,τι δεν διασχίστηκε προσαρτάται (μηδέν χαμένα μέλη).
  for (const n of graph.nodes) if (!seen.has(n.id)) ordered.push(n);
  return ordered;
}

/** Κολώνες που στηρίζουν ένα δοκάρι (`column-bearing` supportedId=beam → supportId). */
export function beamSupportColumnIds(graph: StructuralGraph, beamId: string): string[] {
  return graph.edges
    .filter((e) => e.kind === 'column-bearing' && e.supportedId === beamId)
    .map((e) => e.supportId);
}

/** Η κολώνα που εδράζεται σε ένα πέδιλο (`footing-bearing` supportId=footing → supportedId). */
export function footingColumnId(graph: StructuralGraph, footingId: string): string | null {
  const edge = graph.edges.find((e) => e.kind === 'footing-bearing' && e.supportId === footingId);
  return edge ? edge.supportedId : null;
}
