/**
 * @fileoverview Συνεκτικές συνιστώσες μη-κατευθυνόμενου γράφου — **όψη «ακμές → συνιστώσες»**
 * πάνω στη ΜΙΑ μηχανή union-find του repo, `@/lib/algorithms/disjoint-sets` (ADR-929 §6.9 #20).
 *
 * Πρότυπο Boost: `connected_components` πάνω σε `disjoint_sets`. Εδώ ΔΕΝ ζει δεύτερος union-find
 * (η παλιά κρυφή `IndexUnionFind` καταργήθηκε· ίδιες ρίζες: ένωση κατά μέγεθος, ισοπαλία ⇒ ρίζα του `a`).
 *
 * Το `pipe-network-graph.computeComponents` παραμένει ως λεπτό περιτύλιγμα πάνω σε αυτό —
 * ίδια συμπεριφορά, ένας κώδικας (N.12 / N.18: μηδέν sibling clone).
 *
 * Πολυπλοκότητα: σχεδόν γραμμική στις ακμές (union by size + path halving, α(n)).
 * Ο **υπολογισμός των ακμών** είναι ευθύνη του καλούντος — εκεί κρύβεται το κόστος όταν το
 * κριτήριο γειτνίασης είναι «κάθε ζεύγος».
 *
 * @see ADR-745 §5.3 — Λ1 Reader (ομαδοποίηση κελιών πινακίδας)
 * @see ADR-650 §M10e — «ο GridSpatialIndex ήταν ο έκτος χειρόγραφος κάνναβος»
 */

import { createDisjointSets, type DisjointSets } from '@/lib/algorithms/disjoint-sets';

/** Ακμή ανάμεσα σε δύο κόμβους, δηλωμένους ως δείκτες στο `[0, nodeCount)`. */
export interface ComponentEdge {
  readonly a: number;
  readonly b: number;
}

/** Τα ξένα σύνολα μετά από όλες τις έγκυρες ακμές· βρόχοι και ακμές εκτός ορίων αγνοούνται. */
function unionEdges(nodeCount: number, edges: readonly ComponentEdge[]): DisjointSets {
  const sets = createDisjointSets(nodeCount);
  for (const edge of edges) {
    if (edge.a === edge.b) continue;
    if (edge.a < 0 || edge.b < 0 || edge.a >= nodeCount || edge.b >= nodeCount) continue;
    sets.union(edge.a, edge.b);
  }
  return sets;
}

/**
 * Ρίζα ανά κόμβο: `result[i] === result[j]` ⟺ οι κόμβοι `i`, `j` ανήκουν στην ίδια συνιστώσα.
 *
 * Ακμές εκτός ορίων ή βρόχοι (`a === b`) αγνοούνται — ο καλών δεν υποχρεούται να τις φιλτράρει.
 * Η τιμή είναι **ετικέτα**, όχι συμβόλαιο ταυτότητας (βλ. `disjoint-sets`).
 */
export function computeConnectedComponents(
  nodeCount: number,
  edges: readonly ComponentEdge[],
): number[] {
  const sets = unionEdges(nodeCount, edges);
  return Array.from({ length: nodeCount }, (_, i) => sets.find(i));
}

/**
 * Οι δείκτες ομαδοποιημένοι ανά συνιστώσα.
 *
 * **Ντετερμινιστική σειρά**: οι ομάδες βγαίνουν με τη σειρά που πρωτοεμφανίζεται μέλος τους
 * και μέσα σε κάθε ομάδα οι δείκτες είναι αύξοντες (το συμβόλαιο του `groups()` του SSoT).
 */
export function groupIndicesByComponent(
  nodeCount: number,
  edges: readonly ComponentEdge[],
): number[][] {
  return unionEdges(nodeCount, edges).groups();
}
