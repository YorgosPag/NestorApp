/**
 * Member end forces — post-process SSoT (ADR-481, T3 / S6).
 *
 * Τοπικά εντατικά μεγέθη στα άκρα ενός μέλους από τη λύση μετακινήσεων:
 *   Q_local = k_local · (T · u_element) − Pₑ,local
 * όπου Pₑ,local = το consistent τοπικό φορτίο (SSoT `elementLocalLoad`). Ο όρος
 * −Pₑ,local προσθέτει τις δυνάμεις πάκτωσης (fixed-end forces), ώστε τα εντατικά
 * μεγέθη να είναι σωστά και στο εσωτερικό του φορτισμένου μέλους (όχι μόνο από
 * τις κομβικές μετακινήσεις).
 *
 * Pure — zero React/DOM/Firestore.
 *
 * @see ./load-vector.ts — elementLocalLoad (το Pₑ,local)
 * @see ./member-diagrams.ts — δειγματοληψία κατά μήκος από αυτά τα άκρα
 */

import { gatherVector, matVec, type Vector, type MutableVector } from './dense-matrix';
import type { AssembledElement } from './global-assembly';

/**
 * 12 τοπικές δυνάμεις/ροπές άκρων του μέλους [i: N,Vy,Vz,T,My,Mz | j: …] από το
 * ολικό διάνυσμα μετακινήσεων u και το τοπικό ισοδύναμο φορτίο Pₑ,local.
 */
export function computeMemberEndForces(
  element: AssembledElement,
  globalDisplacements: Vector,
  localLoad: Vector,
): MutableVector {
  const uElem = gatherVector(globalDisplacements, element.dofs);
  const uLocal = matVec(element.stiffness.transform, uElem);
  const kU = matVec(element.stiffness.kLocal, uLocal);
  return kU.map((value, i) => value - localLoad[i]);
}
