/**
 * Rigid diaphragm constraints (penalty method) — pure SSoT (ADR-481, T3 / S4).
 *
 * Επιβάλλει την **εντός-επιπέδου** ακαμψία κάθε διαφράγματος (στάθμη) συνδέοντας
 * κινηματικά τους κόμβους-δοκαριών με έναν master κόμβο. Για κάθε slave κόμβο s
 * (master m), τρεις εξισώσεις περιορισμού (επίπεδο X-Y):
 *   g₁: u_x,s − u_x,m + rz,m·(y_s − y_m) = 0
 *   g₂: u_y,s − u_y,m − rz,m·(x_s − x_m) = 0
 *   g₃: rz,s − rz,m = 0
 *
 * **Μέθοδος penalty** (v1): προσθήκη penalty·aᵀa στο K (a = συντελεστές περιορισμού),
 * RHS αμετάβλητο (μηδενικός περιορισμός). Απλή/robust, διατηρεί συμμετρία, χωρίς DOF
 * condensation· master-slave condensation = μελλοντική βελτίωση για το T4 (σεισμός).
 * Στη στατική βαρύτητα (G/Q) η επίδραση είναι δευτερεύουσα, αλλά υλοποιείται για
 * πληρότητα & ετοιμότητα δυναμικής. Pure — zero React/DOM/Firestore.
 *
 * @see ./dof-map.ts — globalDof
 * @see ../analytical-model-types.ts — RigidDiaphragm
 */

import { maxAbsDiagonal, type MutableMatrix } from './dense-matrix';
import { globalDof, type DofMap } from './dof-map';
import type { AnalyticalNode, RigidDiaphragm } from '../analytical-model-types';

/** Συντελεστής penalty ως προς το max διαγώνιο του K (rigid αλλά ασφαλώς conditioned). */
const PENALTY_FACTOR = 1e6;
/** Τοπικοί DOF: u_x=0, u_y=1, rz=5. */
const DOF_UX = 0, DOF_UY = 1, DOF_RZ = 5;

/** Όρος περιορισμού: (ολικός DOF, συντελεστής). */
interface ConstraintTerm {
  readonly dof: number;
  readonly coeff: number;
}

/** Πρόσθεσε penalty·aᵀa ενός περιορισμού στο K (αγνοεί όρους με DOF < 0). */
function addPenalty(k: MutableMatrix, terms: readonly ConstraintTerm[], penalty: number): void {
  for (const a of terms) {
    if (a.dof < 0) continue;
    for (const b of terms) {
      if (b.dof < 0) continue;
      k[a.dof][b.dof] += penalty * a.coeff * b.coeff;
    }
  }
}

/** Οι τρεις περιορισμοί ενός slave κόμβου ως προς τον master. */
function slaveConstraints(
  map: DofMap, master: AnalyticalNode, slave: AnalyticalNode,
): ConstraintTerm[][] {
  const dyx = slave.position.yM - master.position.yM;
  const dxx = slave.position.xM - master.position.xM;
  return [
    [{ dof: globalDof(map, slave.id, DOF_UX), coeff: 1 }, { dof: globalDof(map, master.id, DOF_UX), coeff: -1 }, { dof: globalDof(map, master.id, DOF_RZ), coeff: dyx }],
    [{ dof: globalDof(map, slave.id, DOF_UY), coeff: 1 }, { dof: globalDof(map, master.id, DOF_UY), coeff: -1 }, { dof: globalDof(map, master.id, DOF_RZ), coeff: -dxx }],
    [{ dof: globalDof(map, slave.id, DOF_RZ), coeff: 1 }, { dof: globalDof(map, master.id, DOF_RZ), coeff: -1 }],
  ];
}

/**
 * Πρόσθεσε τους penalty περιορισμούς όλων των διαφραγμάτων στο K (in-place). Το
 * penalty κλιμακώνεται ως προς το ήδη συναρμολογημένο K (καλείται ΠΡΙΝ τα BC).
 */
export function applyDiaphragmPenalty(
  k: MutableMatrix,
  diaphragms: readonly RigidDiaphragm[],
  nodes: readonly AnalyticalNode[],
  map: DofMap,
): void {
  if (diaphragms.length === 0) return;
  const penalty = Math.max(maxAbsDiagonal(k), 1) * PENALTY_FACTOR;
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  for (const dia of diaphragms) {
    const master = nodeById.get(dia.masterNodeId);
    if (!master) continue;
    for (const slaveId of dia.nodeIds) {
      if (slaveId === dia.masterNodeId) continue;
      const slave = nodeById.get(slaveId);
      if (!slave) continue;
      for (const terms of slaveConstraints(map, master, slave)) addPenalty(k, terms, penalty);
    }
  }
}
