/**
 * @fileoverview **ΣΥΜΒΟΛΙΚΗ ΑΝΑΛΥΣΗ ΑΡΑΙΟΥ ΣΥΜΜΕΤΡΙΚΟΥ ΣΥΣΤΗΜΑΤΟΣ** (SSoT) — διάταξη ελάχιστου βαθμού και η δομή του
 * παράγοντα `L`, υπολογισμένες **μία φορά** για μια σειρά επιλύσεων με την ίδια δομή.
 * @module lib/linear-algebra/sparse-ordering
 * @related `./sparse-ldlt.ts` (η αριθμητική παραγοντοποίηση, οι λύσεις, ο επιλεγμένος αντίστροφος)
 *
 * 🔑 **Ανάλυση μία φορά, παραγοντοποίηση πολλές** (η διάκριση `analyze` / `factorize` του CHOLMOD): στη συνόρθωση με data
 * snooping κάθε γύρος αλλάζει **βάρη** (μια παρατήρηση βγαίνει με βάρος 0), όχι **δομή**. Η δομή χτίζεται από **όλες** τις
 * παρατηρήσεις, ώστε να ισχύει σε κάθε γύρο — ένα μηδενικό που γίνεται «αριθμητικά» μηδέν δεν χαλά τίποτα.
 * 🔑 **Ελάχιστος βαθμός με προσομοίωση της απαλοιφής** (Tinney–Walker 1967 · Markowitz): απαλείφεται πάντα ο κόμβος με τους
 * λιγότερους γείτονες (ισοβαθμία ⇒ ο μικρότερος δείκτης, ντετερμινιστικά), και οι γείτονές του γίνονται κλίκα. Οι γείτονες
 * τη στιγμή της απαλοιφής **είναι** η δομή της στήλης του `L`. Ένας «πυκνός» άγνωστος (η ελεύθερη κλίμακα, που την αγγίζει
 * κάθε διάσταση) μένει φυσικά τελευταίος ⇒ σχήμα βέλους, καμία πλήρωση από αυτόν.
 * ⚠️ Κόστος O(n²) στην επιλογή του κόμβου (γραμμική σάρωση): για τα δίκτυα που λύνουμε (δεκάδες έως χιλιάδες άγνωστοι)
 * είναι αμελητέο μπροστά στην αριθμητική· ουρά προτεραιότητας θα ήταν η επόμενη βελτίωση **αν** μετρηθεί ανάγκη.
 * ⚠️ Το SuiteSparse (AMD/CHOLMOD) δεν χρησιμοποιείται: CHOLMOD = LGPL/GPL (N.5). Αλγόριθμοι από τη δημοσιευμένη βιβλιογραφία.
 *
 * 📐 Πηγές: Tinney & Walker (1967) «Direct solutions of sparse network equations by optimally ordered triangular
 *   factorization»· George & Liu (1989) «The evolution of the minimum degree ordering algorithm»· Davis (2006) «Direct
 *   Methods for Sparse Linear Systems».
 */

/** Η δομή ενός αραιού συμμετρικού `n × n` και του παράγοντά του, στη **διατεταγμένη** αρίθμηση. */
export interface SparseAnalysis {
  readonly n: number;
  /** `order[k]` = ο αρχικός δείκτης που απαλείφεται k-οστός. */
  readonly order: Int32Array;
  /** `position[i]` = η θέση του αρχικού δείκτη `i` στη διάταξη (αντίστροφο του `order`). */
  readonly position: Int32Array;
  /** Για κάθε στήλη k του `L` (διατεταγμένη): οι γραμμές `> k` με δομικά μη μηδενικό, **αύξουσες**. */
  readonly columnRows: readonly Int32Array[];
  /** Για κάθε γραμμή k: οι στήλες `< k` με δομικά μη μηδενικό `L[k][j]`, **αύξουσες**. */
  readonly rowColumns: readonly Int32Array[];
}

function adjacencyOf(n: number, couplings: Iterable<readonly number[]>): Set<number>[] {
  const adj = Array.from({ length: n }, () => new Set<number>());
  for (const clique of couplings) {
    for (const i of clique) {
      if (!(i >= 0 && i < n)) throw new RangeError(`sparse-ordering: δείκτης ${i} εκτός [0, ${n})`);
      for (const j of clique) if (i !== j) adj[i].add(j);
    }
  }
  return adj;
}

/** Ο ζωντανός κόμβος με τον μικρότερο βαθμό· ισοβαθμία ⇒ ο μικρότερος δείκτης. */
function minDegreeNode(adj: readonly Set<number>[], eliminated: Uint8Array): number {
  let best = -1;
  let bestDegree = Infinity;
  for (let i = 0; i < adj.length; i++) {
    if (eliminated[i] === 0 && adj[i].size < bestDegree) [best, bestDegree] = [i, adj[i].size];
  }
  return best;
}

/** Απαλοιφή του `v`: οι γείτονές του γίνονται κλίκα (πλήρωση) και ο `v` φεύγει από τον γράφο. Επιστρέφει τους γείτονες. */
function eliminate(adj: Set<number>[], v: number): number[] {
  const neighbours = [...adj[v]];
  for (const a of neighbours) {
    adj[a].delete(v);
    for (const b of neighbours) if (a !== b) adj[a].add(b);
  }
  adj[v].clear();
  return neighbours;
}

/**
 * Η ανάλυση: διάταξη ελάχιστου βαθμού και δομή του `L`. Κάθε στοιχείο του `couplings` είναι ένα σύνολο αρχικών δεικτών
 * που συνδέονται όλοι μεταξύ τους (π.χ. οι άγνωστοι μιας παρατήρησης ⇒ μπλοκ `aᵀ·a` στις κανονικές εξισώσεις).
 */
export function analyzeSparsePattern(n: number, couplings: Iterable<readonly number[]>): SparseAnalysis {
  const adj = adjacencyOf(n, couplings);
  const eliminated = new Uint8Array(n);
  const order = new Int32Array(n);
  const neighboursAt: number[][] = [];
  for (let k = 0; k < n; k++) {
    const v = minDegreeNode(adj, eliminated);
    order[k] = v;
    eliminated[v] = 1;
    neighboursAt.push(eliminate(adj, v));
  }
  const position = new Int32Array(n);
  order.forEach((v, k) => { position[v] = k; });
  const columnRows = neighboursAt.map((nb) => Int32Array.from(nb.map((v) => position[v])).sort());
  const rowLists: number[][] = Array.from({ length: n }, () => []);
  columnRows.forEach((rows, k) => rows.forEach((i) => rowLists[i].push(k)));
  return { n, order, position, columnRows, rowColumns: rowLists.map((r) => Int32Array.from(r)) };
}
