/**
 * Global load vector F — pure SSoT (ADR-481, T3 / S5).
 *
 * Μετατρέπει τα φορτία μελών (G/Q `MemberLoad`) σε ολικό διάνυσμα κόμβων F ανά
 * `LoadCombination`, μέσω **συνεπών (consistent) κομβικών φορτίων** ομοιόμορφου
 * κατανεμημένου φορτίου (fixed-end forces).
 *
 * **Πηγή φορτίου (v1) = ΜΟΝΟ τα δοκάρια.** Το tributary takedown (ADR-467) αποθηκεύει
 * το ΣΥΝΟΛΙΚΟ φορτίο της δοκού ως αξονικό kN (`combine().axialKn`)· εδώ το «ξε-
 * αθροίζουμε» σε γραμμικό φορτίο q = W/L (ίδια smear λογική με `section-context`,
 * N.0.2) που δρα στη βαρύτητα (−Z ολικό). Τα **αξονικά κολόνας ΔΕΝ** εφαρμόζονται
 * ως εξωτερικό φορτίο: η αξονική κολόνας **προκύπτει** από την ισορροπία του
 * πλαισίου (αλλιώς διπλομέτρηση του φορτίου που ήδη μεταφέρουν τα δοκάρια).
 *
 * Pure — zero React/DOM/Firestore.
 *
 * @see ../load-cases.ts — LoadCombination.combine
 * @see ../../loads/structural-loads-types.ts — MemberLoad
 * @see ./global-assembly.ts — AssembledElement (γεωμετρία/μετασχηματισμός reuse)
 */

import { matVec, transpose, zeroVector, scatterAddVector, type Vector, type MutableVector } from './dense-matrix';
import { restrainVector } from './dof-map';
import type { AssembledElement } from './global-assembly';
import type { LoadCombination } from '../load-cases';
import type { MemberLoad } from '../../loads/structural-loads-types';

/** Πάροχος χαρακτηριστικού φορτίου μέλους (injected → jest-clean). */
export type MemberLoadProvider = (member: AssembledElement['member']) => MemberLoad | null;

/** 3×3 μπλοκ στροφής (γραμμές = τοπικοί άξονες) από τον 12×12 μετασχηματισμό. */
function rotationBlock(transform: readonly number[][]): number[][] {
  return [transform[0].slice(0, 3), transform[1].slice(0, 3), transform[2].slice(0, 3)];
}

/**
 * Συνεπές διάνυσμα κομβικών φορτίων (12) στοιχείου υπό τοπικό ομοιόμορφο φορτίο
 * (wx, wy, wz ανά μήκος) επί μήκους L. Αξονικό → wL/2 ανά άκρο· εγκάρσια → wL/2 +
 * ροπές πάκτωσης ±wL²/12 (αντίθετα πρόσημα y/z κατά τη σύμβαση κάμψης).
 */
function consistentUdlVector(wLocal: Vector, l: number): MutableVector {
  const f = zeroVector(12);
  const [wx, wy, wz] = wLocal;
  const half = l / 2, m = l * l / 12;
  f[0] = wx * half; f[6] = wx * half;
  f[1] = wy * half; f[5] = wy * m; f[7] = wy * half; f[11] = -wy * m;
  f[2] = wz * half; f[4] = -wz * m; f[8] = wz * half; f[10] = wz * m;
  return f;
}

/**
 * **Τοπικό** ισοδύναμο διάνυσμα κομβικού φορτίου (12) ενός στοιχείου για έναν
 * συνδυασμό (Pₑ,local). Μηδενικό για μη-φορτισμένο μέλος (κολόνα / μηδέν φορτίο).
 * SSoT — το μοιράζονται ο assembler του F **και** το post-process των εντατικών
 * μεγεθών (member end forces = k_local·u_local − Pₑ,local).
 */
export function elementLocalLoad(
  element: AssembledElement, combination: LoadCombination, provider: MemberLoadProvider,
): MutableVector {
  if (element.member.memberType !== 'beam') return zeroVector(12);
  const load = provider(element.member);
  const l = element.stiffness.lengthM;
  if (!load || l <= 0) return zeroVector(12);
  const totalKn = combination.combine(load).axialKn;
  if (totalKn === 0) return zeroVector(12);
  // Συνολικό φορτίο → γραμμικό q (kN/m), βαρύτητα = −Z ολικό → τοπικά μέσω R.
  const wLocal = matVec(rotationBlock(element.stiffness.transform), [0, 0, -totalKn / l]);
  return consistentUdlVector(wLocal, l);
}

/**
 * Χτίσε το ολικό διάνυσμα φορτίου F για έναν συνδυασμό. Αθροίζει τα consistent
 * κομβικά φορτία (Tᵀ·Pₑ,local) όλων των δοκαριών και μηδενίζει τις δεσμευμένες
 * θέσεις (BC).
 */
export function buildLoadVector(
  elements: readonly AssembledElement[],
  combination: LoadCombination,
  provider: MemberLoadProvider,
  dofCount: number,
  restrained: ReadonlySet<number>,
): Vector {
  const f = zeroVector(dofCount);
  for (const element of elements) {
    const fLocal = elementLocalLoad(element, combination, provider);
    const fGlobal = matVec(transpose(element.stiffness.transform), fLocal);
    scatterAddVector(f, fGlobal, element.dofs);
  }
  restrainVector(f, restrained);
  return f;
}
