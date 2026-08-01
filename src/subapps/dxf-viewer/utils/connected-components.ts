/**
 * @fileoverview Συνεκτικές συνιστώσες μη-κατευθυνόμενου γράφου — **ένας** union-find (SSoT).
 *
 * Το subapp είχε ήδη τέσσερις χωριστές υλοποιήσεις union-find (θερμικό δίκτυο, διακλαδώσεις
 * σωλήνων, θεμελιώσεις, γωνίες τοίχων). Καμία δεν διέφερε στον **αλγόριθμο** — μόνο στο τι
 * περιγράφει ο κόμβος. Εδώ ζει το αλγοριθμικό μέρος, καθαρό από κάθε τομέα: δείκτες και ακμές.
 *
 * Το `pipe-network-graph.computeComponents` παραμένει ως λεπτό περιτύλιγμα πάνω σε αυτό —
 * ίδια συμπεριφορά, ένας κώδικας (N.12 / N.18: μηδέν sibling clone).
 *
 * Πολυπλοκότητα: σχεδόν γραμμική στις ακμές (union by size + path compression, α(n)).
 * Ο **υπολογισμός των ακμών** είναι ευθύνη του καλούντος — εκεί κρύβεται το κόστος όταν το
 * κριτήριο γειτνίασης είναι «κάθε ζεύγος».
 *
 * @see ADR-745 §5.3 — Λ1 Reader (ομαδοποίηση κελιών πινακίδας)
 * @see ADR-650 §M10e — «ο GridSpatialIndex ήταν ο έκτος χειρόγραφος κάνναβος»
 */

/** Ακμή ανάμεσα σε δύο κόμβους, δηλωμένους ως δείκτες στο `[0, nodeCount)`. */
export interface ComponentEdge {
  readonly a: number;
  readonly b: number;
}

/**
 * Union-find με συμπίεση διαδρομής και ένωση κατά μέγεθος.
 *
 * Δεν εκτίθεται: ο έξω κόσμος θέλει τις συνιστώσες, όχι τη δομή. Όποιος χρειαστεί
 * σταδιακή ένωση (π.χ. με προτεραιότητα ρίζας) θα την προσθέσει **εδώ**, όχι δίπλα.
 */
class IndexUnionFind {
  private readonly parent: number[];
  private readonly size: number[];

  constructor(nodeCount: number) {
    this.parent = Array.from({ length: nodeCount }, (_, i) => i);
    this.size = new Array<number>(nodeCount).fill(1);
  }

  find(node: number): number {
    let root = node;
    while (this.parent[root] !== root) root = this.parent[root];
    // Δεύτερο πέρασμα: όλοι οι ενδιάμεσοι δείχνουν κατευθείαν στη ρίζα.
    let walk = node;
    while (this.parent[walk] !== root) {
      const next = this.parent[walk];
      this.parent[walk] = root;
      walk = next;
    }
    return root;
  }

  union(a: number, b: number): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return;
    const [big, small] = this.size[rootA] >= this.size[rootB] ? [rootA, rootB] : [rootB, rootA];
    this.parent[small] = big;
    this.size[big] += this.size[small];
  }
}

/**
 * Ρίζα ανά κόμβο: `result[i] === result[j]` ⟺ οι κόμβοι `i`, `j` ανήκουν στην ίδια συνιστώσα.
 *
 * Ακμές εκτός ορίων ή βρόχοι (`a === b`) αγνοούνται — ο καλών δεν υποχρεούται να τις φιλτράρει.
 */
export function computeConnectedComponents(
  nodeCount: number,
  edges: readonly ComponentEdge[],
): number[] {
  const uf = new IndexUnionFind(nodeCount);
  for (const edge of edges) {
    if (edge.a === edge.b) continue;
    if (edge.a < 0 || edge.b < 0 || edge.a >= nodeCount || edge.b >= nodeCount) continue;
    uf.union(edge.a, edge.b);
  }
  return Array.from({ length: nodeCount }, (_, i) => uf.find(i));
}

/**
 * Οι δείκτες ομαδοποιημένοι ανά συνιστώσα.
 *
 * **Ντετερμινιστική σειρά**: οι ομάδες βγαίνουν με τη σειρά που πρωτοεμφανίζεται μέλος τους
 * και μέσα σε κάθε ομάδα οι δείκτες είναι αύξοντες. Χωρίς αυτή την εγγύηση, το αποτέλεσμα
 * θα εξαρτιόταν από τη σειρά ένωσης και κάθε ισχυρισμός πάνω του θα ήταν εύθραυστος.
 */
export function groupIndicesByComponent(
  nodeCount: number,
  edges: readonly ComponentEdge[],
): number[][] {
  const roots = computeConnectedComponents(nodeCount, edges);
  const byRoot = new Map<number, number[]>();
  for (let i = 0; i < nodeCount; i++) {
    const bucket = byRoot.get(roots[i]);
    if (bucket) bucket.push(i);
    else byRoot.set(roots[i], [i]);
  }
  return [...byRoot.values()];
}
