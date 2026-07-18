/**
 * SSOT — ο ΕΝΑΣ πυρήνας «κλειδωμένης μετατόπισης» (Displacement Model A).
 *
 * Η μαθηματική καρδιά που μοιράζονται ΟΛΑ τα typed-value locks λαβών των οποίων η σημασιολογία
 * είναι «μετακινήσου ΚΑΤΑ τόσο προς εκείνη την κατεύθυνση» (σε αντίθεση με το «όρισε το μήκος της
 * γραμμής σε τόσο», που ζει στο `grip-endpoint-lock.ts` και έχει άλλη σημασιολογία):
 *
 *   · κατεύθυνση = ORTHO/POLAR-κλειδωμένος κέρσορας ΣΧΕΤΙΚΑ με τη σημείο-άγκυρα (`resolveOrthoPolarStep`)
 *   · μέγεθος    = η πληκτρολογούμενη «Μήκος» τιμή (`applyLengthAngleLock`, rescale κρατώντας κατεύθυνση)
 *
 * Ίδιο pattern με τη ΣΧΕΔΙΑΣΗ (`drawing-hover-handler`: `resolveOrthoPolarStep` → `applyLengthAngleLock`)
 * → μηδέν απόκλιση μεταξύ «σχεδιάζω» και «επεξεργάζομαι».
 *
 * ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ MODULE (2026-07-18, N.18): οι καταναλωτές διαφέρουν **μόνο** στο ποια λαβή θεωρούν
 * επιλέξιμη — το σώμα ήταν token-ταυτόσημο. Γραμμένοι ως αδελφοί θα ήταν structural clones που το
 * `ssot:discover` (name-based) ΔΕΝ βλέπει και μόνο το jscpd πιάνει. Ένας πυρήνας, N eligibility gates.
 *
 * @see ./vertex-reshape-lock.ts — καταναλωτής: κορυφή/πλευρά τόξου/πολυγραμμής (reshape)
 * @see ./move-displacement-lock.ts — καταναλωτής: λαβή ΜΕΤΑΚΙΝΗΣΗΣ ολόκληρης οντότητας
 * @see ./length-angle-lock.ts — `applyLengthAngleLock` (typed-length rescale, κοινό με σχεδίαση)
 */

import type { Point2D } from '../../rendering/types/Types';
import { resolveOrthoPolarStep } from '../../hooks/drawing/drawing-handler-utils';
import { cadToggleState } from '../constraints/cad-toggle-state';
import { applyLengthAngleLock, isLengthAngleLockActive } from './length-angle-lock';

/**
 * Το κλειδωμένο delta (ΣΧΕΤΙΚΑ με το `anchorPos`), ή `null` όταν δεν υπάρχει ενεργό κλείδωμα —
 * οπότε ο καλών κρατά το δικό του ελεύθερο/ORTHO-constrained delta (μηδέν regression).
 *
 * Οι καταναλωτές ελέγχουν ΠΡΩΤΑ το δικό τους eligibility και μετά καλούν αυτό· έτσι το «ποια λαβή»
 * και το «τι μαθηματικά» μένουν χωριστές ευθύνες.
 */
export function resolveDisplacementLockedDelta(
  anchorPos: Readonly<Point2D>,
  cursorWorld: Readonly<Point2D>,
): Point2D | null {
  if (!isLengthAngleLockActive()) return null;
  const step = resolveOrthoPolarStep(cursorWorld, anchorPos, {
    ortho: cadToggleState.isOrthoOn(),
    polar: cadToggleState.isPolarOn(),
  });
  const locked = applyLengthAngleLock(step.constrained, anchorPos);
  return { x: locked.x - anchorPos.x, y: locked.y - anchorPos.y };
}
