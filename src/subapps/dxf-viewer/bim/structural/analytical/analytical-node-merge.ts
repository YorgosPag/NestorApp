/**
 * Analytical node merge — pure SSoT (ADR-480, T2).
 *
 * Δύο εργαλεία που χρειάζεται ο `analytical-model-builder` για να μετατρέψει τα
 * ακατέργαστα άκρα μελών σε αναλυτικούς κόμβους:
 *
 *   1. `NodeUnionFind` — priority-aware union-find: συνενώνει συντρέχοντα άκρα σε
 *      έναν κόμβο. Ο αντιπρόσωπος (root) επιλέγεται κατά **προτεραιότητα** (π.χ.
 *      κορυφή κολόνας > άκρο δοκαριού) ώστε ένα δοκάρι που πλαισιώνει κολόνα να
 *      «κουμπώνει» στη θέση της κολόνας — ισοπαλία → ντετερμινιστικά το μικρότερο id.
 *   2. `mergeByProximity` — spatial-hash συνένωση κόμβων εντός ανοχής (3D), O(n).
 *   3. `clusterElevations` — ομαδοποίηση υψομέτρων σε στάθμες (για το διάφραγμα).
 *
 * Pure — zero React/DOM/Firestore. Μονάδες: μέτρα (m).
 *
 * @see ./analytical-model-builder.ts — ο καταναλωτής
 */

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

/**
 * Priority-aware union-find επί string ids. Ο root κάθε set είναι το στοιχείο με
 * τη μέγιστη προτεραιότητα (ισοπαλία → το λεξικογραφικά μικρότερο id) → η θέση
 * του γίνεται η θέση του τελικού κόμβου.
 */
export class NodeUnionFind {
  private readonly parent = new Map<string, string>();
  private readonly priority = new Map<string, number>();

  /** Καταχώρισε στοιχείο (idempotent — διατηρεί την υπάρχουσα προτεραιότητα). */
  add(id: string, priority: number): void {
    if (this.parent.has(id)) return;
    this.parent.set(id, id);
    this.priority.set(id, priority);
  }

  /** Βρες τον αντιπρόσωπο με path-compression. */
  find(id: string): string {
    let root = id;
    while (this.parent.get(root) !== root) root = this.parent.get(root) as string;
    let cur = id;
    while (cur !== root) {
      const next = this.parent.get(cur) as string;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  /** Συνένωσε δύο sets· νέος root = ο υψηλότερης προτεραιότητας (ισοπαλία → μικρότερο id). */
  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    const winner = this.preferred(ra, rb);
    const loser = winner === ra ? rb : ra;
    this.parent.set(loser, winner);
  }

  /** Ο προτιμώμενος root μεταξύ δύο (προτεραιότητα, μετά μικρότερο id). */
  private preferred(a: string, b: string): string {
    const pa = this.priority.get(a) ?? 0;
    const pb = this.priority.get(b) ?? 0;
    if (pa !== pb) return pa > pb ? a : b;
    return a < b ? a : b;
  }
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
 * Συνένωσε στο `uf` όσα raw nodes απέχουν ≤ `tolM` (3D). Spatial-hash grid: κάθε
 * κόμβος ελέγχεται μόνο έναντι των γειτονικών κελιών (3×3×3) → ~O(n) αντί O(n²).
 */
export function mergeByProximity(
  nodes: readonly RawNode[],
  uf: NodeUnionFind,
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
            if (dist2(node.position, other.position) <= tol2) uf.union(node.id, other.id);
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
