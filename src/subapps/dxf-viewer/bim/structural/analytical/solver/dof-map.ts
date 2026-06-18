/**
 * DOF mapping & boundary conditions — pure SSoT (ADR-481, T3 / S4).
 *
 * Αντιστοιχίζει κάθε αναλυτικό κόμβο σε 6 διαδοχικούς ολικούς βαθμούς ελευθερίας
 * (node-index·6 + local-dof) και παρέχει:
 *   · τους 12 DOF ενός μέλους (i:0-5, j:6-11) για το scatter του assembly,
 *   · το σύνολο δεσμευμένων DOF από τα `RestraintDof` των κόμβων (στηρίξεις),
 *   · εφαρμογή στηρίξεων στο K/F με μηδενισμό γραμμής/στήλης + μοναδιαία διαγώνιο
 *     (μηδενική προδιαγεγραμμένη μετακίνηση — διατηρεί συμμετρία/θετική οριστικότητα).
 *
 * Pure — zero React/DOM/Firestore.
 *
 * @see ./frame-element-stiffness.ts — DOF_PER_NODE
 * @see ./global-assembly.ts — ο καταναλωτής
 */

import type { MutableMatrix, MutableVector } from './dense-matrix';
import { DOF_PER_NODE } from './frame-element-stiffness';
import type { AnalyticalMember, AnalyticalNode, RestraintDof } from '../analytical-model-types';

/** Χάρτης κόμβου → δείκτη + συνολικό πλήθος DOF. */
export interface DofMap {
  readonly indexByNode: ReadonlyMap<string, number>;
  readonly dofCount: number;
}

/** Διάταξη κλειδιών του `RestraintDof` ώστε να αντιστοιχούν στους τοπικούς DOF 0-5. */
const RESTRAINT_KEYS: readonly (keyof RestraintDof)[] = ['dx', 'dy', 'dz', 'rx', 'ry', 'rz'];

/** Χτίσε τον χάρτη DOF: κάθε κόμβος → 6 διαδοχικοί ολικοί DOF. */
export function buildDofMap(nodes: readonly AnalyticalNode[]): DofMap {
  const indexByNode = new Map<string, number>();
  nodes.forEach((n, i) => indexByNode.set(n.id, i));
  return { indexByNode, dofCount: nodes.length * DOF_PER_NODE };
}

/** Ο ολικός DOF index ενός (nodeId, τοπικός DOF 0-5). -1 αν ο κόμβος λείπει. */
export function globalDof(map: DofMap, nodeId: string, localDof: number): number {
  const idx = map.indexByNode.get(nodeId);
  return idx === undefined ? -1 : idx * DOF_PER_NODE + localDof;
}

/** Οι 12 ολικοί DOF ενός μέλους [i:0-5, j:6-11]. */
export function elementDofs(member: AnalyticalMember, map: DofMap): number[] {
  const dofs: number[] = [];
  for (const nodeId of [member.iNodeId, member.jNodeId]) {
    const base = (map.indexByNode.get(nodeId) ?? 0) * DOF_PER_NODE;
    for (let d = 0; d < DOF_PER_NODE; d++) dofs.push(base + d);
  }
  return dofs;
}

/** Σύνολο δεσμευμένων ολικών DOF από τα `RestraintDof` των κόμβων. */
export function restrainedDofs(nodes: readonly AnalyticalNode[], map: DofMap): Set<number> {
  const restrained = new Set<number>();
  for (const node of nodes) {
    const base = (map.indexByNode.get(node.id) ?? 0) * DOF_PER_NODE;
    RESTRAINT_KEYS.forEach((key, d) => {
      if (node.restraint[key]) restrained.add(base + d);
    });
  }
  return restrained;
}

/**
 * Στηρίξεις στο K (in-place): για κάθε δεσμευμένο DOF d → μηδένισε γραμμή/στήλη d,
 * K[d][d]=1. Διατηρεί συμμετρία (απενεργοποιεί τη σύζευξη) — το ελεύθερο υποσύστημα
 * μένει SPD. Καλείται **μία φορά** (το K είναι κοινό σε όλους τους συνδυασμούς).
 */
export function restrainMatrix(k: MutableMatrix, restrained: ReadonlySet<number>): void {
  const n = k.length;
  for (const d of restrained) {
    for (let j = 0; j < n; j++) { k[d][j] = 0; k[j][d] = 0; }
    k[d][d] = 1;
  }
}

/** Μηδένισε τις δεσμευμένες θέσεις ενός διανύσματος φορτίου (ανά συνδυασμό). */
export function restrainVector(f: MutableVector, restrained: ReadonlySet<number>): void {
  for (const d of restrained) f[d] = 0;
}

/**
 * Εφάρμοσε μηδενικές προδιαγεγραμμένες μετακινήσεις (στηρίξεις) στο K & F μαζί.
 * Convenience για unit tests/μονο-συνδυασμό· ο solver χρησιμοποιεί τα διαχωρισμένα
 * `restrainMatrix`/`restrainVector` (κοινό K, ανά-συνδυασμό F).
 */
export function applyRestraints(k: MutableMatrix, f: MutableVector, restrained: ReadonlySet<number>): void {
  restrainMatrix(k, restrained);
  restrainVector(f, restrained);
}
