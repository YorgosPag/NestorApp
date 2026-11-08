/**
 * @fileoverview **ΞΕΝΑ ΣΥΝΟΛΑ (UNION-FIND) ΣΕ ΑΚΕΡΑΙΟΥΣ ΔΕΙΚΤΕΣ** (SSoT, ADR-929 §6.9 #19).
 * @module lib/algorithms/disjoint-sets
 *
 * 🔑 **Όπως οι βιβλιοθήκες αναφοράς** (Boost `disjoint_sets`, LLVM `EquivalenceClasses`): **ένωση κατά μέγεθος** + **path
 * halving**. Μαζί δίνουν απόσβεση O(α(n)) ανά πράξη (Tarjan & van Leeuwen, JACM 31(2) 1984), χωρίς αναδρομή (καμία
 * υπερχείλιση στοίβας σε εκατομμύρια pixel) και σε δύο `Int32Array` (καμία δέσμευση ανά πράξη).
 *
 * ⚠️ **Η ταυτότητα της ρίζας δεν είναι συμβόλαιο.** Ο καλών ρωτά «ίδιο σύνολο;» (`same`) ή ομαδοποιεί με το `find` ως
 * κλειδί· **ποτέ** «ποιος είναι ο αντιπρόσωπος». Όποιος χρειάζεται συγκεκριμένο αντιπρόσωπο (π.χ. κόμβο με προτεραιότητα)
 * τον διαλέγει πάνω από τα `groups()`.
 *
 * 🧭 **Η ΜΙΑ μηχανή του repo** (ADR-929 §6.9 #20, φρουρός: module `disjoint-sets` στο `.ssot-registry.json`). Δύο όψεις:
 * δείκτες (`createDisjointSets`) και κλειδιά (`createKeyedDisjointSets`)· το `dxf-viewer/utils/connected-components`
 * («ακμές → συνιστώσες») είναι όψη πάνω σε αυτή, όχι δεύτερη υλοποίηση.
 */

export interface DisjointSets {
  /** Πλήθος στοιχείων `0 … n − 1`. */
  readonly count: number;
  /** Ο αντιπρόσωπος του συνόλου του `i` (σταθερός μόνο ανάμεσα σε δύο `union`). */
  find(i: number): number;
  /** Ένωσε τα σύνολα των `a`, `b`· `true` μόνο όταν ήταν **διαφορετικά**. */
  union(a: number, b: number): boolean;
  /** `a` και `b` στο ίδιο σύνολο; */
  same(a: number, b: number): boolean;
  /** Μέγεθος του συνόλου του `i`. */
  sizeOf(i: number): number;
  /** Η διαμέριση: κάθε σύνολο με τα στοιχεία του σε αύξουσα σειρά· τα σύνολα με τη σειρά του μικρότερου στοιχείου τους. */
  groups(): number[][];
}

function assertIndex(i: number, n: number): void {
  if (!Number.isInteger(i) || i < 0 || i >= n) throw new RangeError(`disjoint-sets index out of range: ${i} (n = ${n})`);
}

/** `n` μονοσύνολα `{0} … {n − 1}`. */
export function createDisjointSets(n: number): DisjointSets {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`disjoint-sets size must be an integer ≥ 0, got ${n}`);
  const parent = Int32Array.from({ length: n }, (_, i) => i);
  const size = new Int32Array(n).fill(1);

  const find = (i: number): number => {
    assertIndex(i, n);
    let x = i;
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };

  const union = (a: number, b: number): boolean => {
    let ra = find(a);
    let rb = find(b);
    if (ra === rb) return false;
    if (size[ra] < size[rb]) [ra, rb] = [rb, ra];
    parent[rb] = ra;
    size[ra] += size[rb];
    return true;
  };

  return {
    count: n,
    find,
    union,
    same: (a, b) => find(a) === find(b),
    sizeOf: (i) => size[find(i)],
    groups: () => partition(n, find),
  };
}

/**
 * **Όψη κλειδιών** πάνω στον ίδιο πυρήνα (πρότυπο LLVM `EquivalenceClasses<T>` · JGraphT `UnionFind<T>` · Boost property
 * maps): ο καλών ενώνει ids/κλειδιά, όχι δείκτες — καμία δεύτερη υλοποίηση, μόνο αντιστοίχιση κλειδί → δείκτης.
 *
 * 🔑 Συμβόλαια: η σειρά των `keys` ορίζει τους δείκτες (διπλό κλειδί ⇒ μετρά η **πρώτη** εμφάνιση) ⇒ τα `groups()` βγαίνουν
 * **ντετερμινιστικά** (σύνολα με τη σειρά πρώτης εμφάνισης, μέλη με τη σειρά των `keys`). Άγνωστο κλειδί ⇒ `RangeError`,
 * ποτέ σιωπηλή καταχώριση. **Κανένα `find`**: όποιος χρειάζεται αντιπρόσωπο τον διαλέγει πάνω από τα `groups()`.
 */
export interface KeyedDisjointSets<K> {
  /** Πλήθος (μοναδικών) κλειδιών. */
  readonly count: number;
  /** Ανήκει το `k` στο σύμπαν; */
  has(k: K): boolean;
  /** Ένωσε τα σύνολα των `a`, `b`· `true` μόνο όταν ήταν **διαφορετικά**. */
  union(a: K, b: K): boolean;
  /** `a` και `b` στο ίδιο σύνολο; */
  same(a: K, b: K): boolean;
  /** Μέγεθος του συνόλου του `k`. */
  sizeOf(k: K): number;
  /** Η διαμέριση σε κλειδιά (βλ. συμβόλαιο σειράς). */
  groups(): K[][];
}

/** Τα `keys` ως μονοσύνολα. */
export function createKeyedDisjointSets<K>(keys: Iterable<K>): KeyedDisjointSets<K> {
  const indexOf = new Map<K, number>();
  const keyAt: K[] = [];
  for (const k of keys) {
    if (indexOf.has(k)) continue;
    indexOf.set(k, keyAt.length);
    keyAt.push(k);
  }
  const sets = createDisjointSets(keyAt.length);
  const at = (k: K): number => {
    const i = indexOf.get(k);
    if (i === undefined) throw new RangeError(`disjoint-sets unknown key: ${String(k)}`);
    return i;
  };
  return {
    count: keyAt.length,
    has: (k) => indexOf.has(k),
    union: (a, b) => sets.union(at(a), at(b)),
    same: (a, b) => sets.same(at(a), at(b)),
    sizeOf: (k) => sets.sizeOf(at(k)),
    groups: () => sets.groups().map((g) => g.map((i) => keyAt[i])),
  };
}

/** Η διαμέριση: τα στοιχεία σε αύξουσα σειρά, τα σύνολα με τη σειρά του μικρότερου στοιχείου (σειρά εισαγωγής του `Map`). */
function partition(n: number, find: (i: number) => number): number[][] {
  const byRoot = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const g = byRoot.get(r);
    if (g) g.push(i); else byRoot.set(r, [i]);
  }
  return [...byRoot.values()];
}
