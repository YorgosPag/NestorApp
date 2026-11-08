/**
 * Analytical node merge — pure SSoT (ADR-480, T2).
 *
 * Δύο εργαλεία που χρειάζεται ο `analytical-model-builder` για να μετατρέψει τα
 * ακατέργαστα άκρα μελών σε αναλυτικούς κόμβους:
 *
 *   1. `createNodeSets` + `priorityRepresentatives` — συνενώνει συντρέχοντα άκρα σε
 *      έναν κόμβο με τον SSoT union-find (`@/lib/algorithms/disjoint-sets`, ADR-929 §6.9 #20).
 *      Ο αντιπρόσωπος επιλέγεται κατά **προτεραιότητα** (π.χ. κορυφή κολόνας > άκρο
 *      δοκαριού) ώστε ένα δοκάρι που πλαισιώνει κολόνα να «κουμπώνει» στη θέση της
 *      κολόνας — ισοπαλία → ντετερμινιστικά το μικρότερο id.
 *   2. `mergeByProximity` — spatial-hash συνένωση κόμβων εντός ανοχής (3D), O(n).
 *   3. `clusterElevations` — ομαδοποίηση υψομέτρων σε στάθμες (για το διάφραγμα).
 *
 * Pure — zero React/DOM/Firestore. Μονάδες: μέτρα (m).
 *
 * @see ./analytical-model-builder.ts — ο καταναλωτής
 */

import { createKeyedDisjointSets, type KeyedDisjointSets } from '@/lib/algorithms/disjoint-sets';
import type { AnalyticalPoint3D } from './analytical-model-types';

/** Ανοχή σύμπτωσης κόμβων (m) — 50mm: άκρα εντός αυτής → ένας κόμβος. */
export const NODE_MERGE_TOLERANCE_M = 0.05;

/** Ένα ακατέργαστο άκρο μέλους πριν το merge. */
export interface RawNode {
  readonly id: string;
  readonly position: AnalyticalPoint3D;
  /** Μεγαλύτερη προτεραιότητα → ο root του union (η θέση του «νικά»). */
  readonly priority: number;
}

/** Τα ξένα σύνολα των raw κόμβων (SSoT union-find, ADR-929 §6.9 #20)· κλειδί = `RawNode.id`. */
export type NodeSets = KeyedDisjointSets<string>;

/** Κάθε raw κόμβος μονοσύνολο — με τη σειρά των `nodes` (διπλό id ⇒ μετρά η πρώτη εμφάνιση). */
export function createNodeSets(nodes: readonly RawNode[]): NodeSets {
  return createKeyedDisjointSets(nodes.map((n) => n.id));
}

/** Ο προτιμώμενος από δύο: μεγαλύτερη προτεραιότητα, ισοπαλία → λεξικογραφικά μικρότερο id. */
function preferred(a: string, b: string, priorityOf: (id: string) => number): string {
  const pa = priorityOf(a);
  const pb = priorityOf(b);
  if (pa !== pb) return pa > pb ? a : b;
  return a < b ? a : b;
}

/**
 * Αντιπρόσωπος ανά κόμβο: σε κάθε σύνολο, το στοιχείο **μέγιστης προτεραιότητας** (ισοπαλία → το
 * λεξικογραφικά μικρότερο id) — η θέση του γίνεται η θέση του τελικού κόμβου (κορυφή κολόνας > άκρο δοκαριού).
 *
 * Ολική διάταξη ⇒ ο αντιπρόσωπος είναι συνάρτηση **μόνο** του συνόλου, όχι της σειράς των ενώσεων: ακριβώς η
 * ρίζα της παλιάς `NodeUnionFind` με προτεραιότητα, διαλεγμένη πάνω από τα `groups()` όπως ορίζει το SSoT.
 */
export function priorityRepresentatives(
  sets: NodeSets,
  priorityOf: (id: string) => number,
): Map<string, string> {
  const representativeOf = new Map<string, string>();
  for (const group of sets.groups()) {
    const winner = group.reduce((best, id) => preferred(best, id, priorityOf));
    for (const id of group) representativeOf.set(id, winner);
  }
  return representativeOf;
}

/** Κλειδί κελιού spatial hash για μια συντεταγμένη σε ανοχή `tol`. */
function cell(value: number, tol: number): number {
  return Math.round(value / tol);
}

/** Απόσταση 3D στο τετράγωνο (αποφυγή sqrt στον έλεγχο ανοχής). */
function dist2(a: AnalyticalPoint3D, b: AnalyticalPoint3D): number {
  const dx = a.xM - b.xM;
  const dy = a.yM - b.yM;
  const dz = a.zM - b.zM;
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Συνένωσε στα `sets` όσα raw nodes απέχουν ≤ `tolM` (3D). Spatial-hash grid: κάθε
 * κόμβος ελέγχεται μόνο έναντι των γειτονικών κελιών (3×3×3) → ~O(n) αντί O(n²).
 */
export function mergeByProximity(
  nodes: readonly RawNode[],
  sets: NodeSets,
  tolM: number = NODE_MERGE_TOLERANCE_M,
): void {
  const tol2 = tolM * tolM;
  const grid = new Map<string, RawNode[]>();
  for (const node of nodes) {
    const cx = cell(node.position.xM, tolM);
    const cy = cell(node.position.yM, tolM);
    const cz = cell(node.position.zM, tolM);
    for (let ix = -1; ix <= 1; ix++) {
      for (let iy = -1; iy <= 1; iy++) {
        for (let iz = -1; iz <= 1; iz++) {
          const bucket = grid.get(`${cx + ix},${cy + iy},${cz + iz}`);
          if (!bucket) continue;
          for (const other of bucket) {
            if (dist2(node.position, other.position) <= tol2) sets.union(node.id, other.id);
          }
        }
      }
    }
    const key = `${cx},${cy},${cz}`;
    const own = grid.get(key);
    if (own) own.push(node);
    else grid.set(key, [node]);
  }
}

/** Μια στάθμη: αντιπροσωπευτικό υψόμετρο (μ.ό. του cluster). */
export interface ElevationCluster {
  readonly elevationM: number;
}

/** Αποτέλεσμα clustering: οι στάθμες (αύξον z) + map υψομέτρου → δείκτη στάθμης. */
export interface ElevationClustering {
  readonly clusters: readonly ElevationCluster[];
  /** Δείκτης στάθμης για ένα υψόμετρο (πάντα έγκυρος για z που δόθηκε). */
  indexOf(elevationM: number): number;
}

/**
 * Ομαδοποίησε υψόμετρα σε στάθμες: αύξουσα ταξινόμηση, greedy grouping όσων
 * απέχουν ≤ `tolM` από το πρώτο του cluster. Επιστρέφει αντιπρόσωπο = μ.ό. και
 * έναν resolver z → δείκτη στάθμης (nearest cluster).
 */
export function clusterElevations(
  elevationsM: readonly number[],
  tolM: number = NODE_MERGE_TOLERANCE_M,
): ElevationClustering {
  const sorted = [...new Set(elevationsM)].sort((a, b) => a - b);
  const groups: number[][] = [];
  for (const z of sorted) {
    const last = groups[groups.length - 1];
    if (last && z - last[0] <= tolM) last.push(z);
    else groups.push([z]);
  }
  const clusters = groups.map((g) => ({ elevationM: g.reduce((s, v) => s + v, 0) / g.length }));
  const indexOf = (z: number): number => {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < clusters.length; i++) {
      const d = Math.abs(clusters[i].elevationM - z);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  };
  return { clusters, indexOf };
}
