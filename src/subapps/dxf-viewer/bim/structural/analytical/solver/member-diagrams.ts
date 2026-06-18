/**
 * Member force diagrams — post-process SSoT (ADR-481, T3 / S6).
 *
 * Δειγματοληψία εντατικών μεγεθών (N, Vy, Vz, T, My, Mz) κατά μήκος ενός μέλους
 * από τις τοπικές δυνάμεις άκρων (i-end) + το ομοιόμορφο τοπικό φορτίο, με
 * ισορροπία ελεύθερου σώματος [0, x]:
 *   N(x)  = −(N_i + w_x·x)
 *   V(x)  = −(V_i + w·x)
 *   M(x)  = −(M_i + V_i·x + w·x²/2)
 * Το w_local ανακτάται από το consistent φορτίο Pₑ (w = (Pₑ_i+Pₑ_j)/L) — μηδέν
 * διπλό πέρασμα της γεωμετρίας φορτίου. Το πρόσημο ορίζει τη σύμβαση· τα extrema
 * αναφέρονται σε max-abs (σύμβαση-ανεξάρτητα) για διαστασιολόγηση/ελέγχους.
 *
 * Pure — zero React/DOM/Firestore.
 *
 * @see ./member-end-forces.ts
 * @see ./solver-types.ts — DiagramStation / MemberForceExtrema
 */

import type { Vector } from './dense-matrix';
import type { AssembledElement } from './global-assembly';
import type { DiagramStation, MemberForceExtrema } from './solver-types';

/** Πλήθος σταθμών δειγματοληψίας (8 διαστήματα → πιάνει ακριβώς το μέσον). */
export const DEFAULT_DIAGRAM_STATIONS = 9;

/** Τοπικό ομοιόμορφο φορτίο w (ανά μήκος) ανακτημένο από το consistent Pₑ. */
function recoverUdl(localLoad: Vector, l: number): { wx: number; wy: number; wz: number } {
  if (l <= 0) return { wx: 0, wy: 0, wz: 0 };
  return {
    wx: (localLoad[0] + localLoad[6]) / l,
    wy: (localLoad[1] + localLoad[7]) / l,
    wz: (localLoad[2] + localLoad[8]) / l,
  };
}

/** Μία σταθμός διαγράμματος σε απόσταση x από το άκρο i. */
function stationAt(end: Vector, w: { wx: number; wy: number; wz: number }, x: number): DiagramStation {
  return {
    xM: x,
    axialN: -(end[0] + w.wx * x),
    shearY: -(end[1] + w.wy * x),
    shearZ: -(end[2] + w.wz * x),
    torsion: -end[3],
    momentY: -(end[4] + end[2] * x + (w.wz * x * x) / 2),
    momentZ: -(end[5] + end[1] * x + (w.wy * x * x) / 2),
  };
}

/**
 * Διάγραμμα εντατικών μεγεθών του μέλους (stationCount σταθμές, ομοιόμορφα στο
 * μήκος). `endForcesLocal` = οι 12 τοπικές δυνάμεις άκρων (χρησιμοποιεί το i-end).
 */
export function sampleMemberDiagram(
  element: AssembledElement,
  endForcesLocal: Vector,
  localLoad: Vector,
  stationCount: number = DEFAULT_DIAGRAM_STATIONS,
): DiagramStation[] {
  const l = element.stiffness.lengthM;
  const w = recoverUdl(localLoad, l);
  const count = Math.max(2, stationCount);
  const stations: DiagramStation[] = [];
  for (let i = 0; i < count; i++) {
    stations.push(stationAt(endForcesLocal, w, (l * i) / (count - 1)));
  }
  return stations;
}

/** Ακραίες (max-abs) τιμές εντατικών μεγεθών από τις σταθμές διαγράμματος. */
export function diagramExtrema(stations: readonly DiagramStation[]): MemberForceExtrema {
  let axial = 0, shear = 0, moment = 0, torsion = 0;
  for (const s of stations) {
    axial = Math.max(axial, Math.abs(s.axialN));
    shear = Math.max(shear, Math.abs(s.shearY), Math.abs(s.shearZ));
    moment = Math.max(moment, Math.abs(s.momentY), Math.abs(s.momentZ));
    torsion = Math.max(torsion, Math.abs(s.torsion));
  }
  return { maxAbsAxialN: axial, maxAbsShear: shear, maxAbsMoment: moment, maxAbsTorsion: torsion };
}
