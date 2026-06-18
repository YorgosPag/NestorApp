/**
 * Static analysis diagnostics — pure SSoT (ADR-481, T3 / S7).
 *
 * Μετατρέπει το `AnalysisResult` σε `StructuralDiagnostic[]` (ίδιος τύπος με
 * ADR-459/480 ώστε να ενώνονται στο ΕΝΑ diagnostics store write):
 *   · `staticAnalysisUnstable` — κάποιος συνδυασμός βρήκε μηχανισμό (singular K):
 *     ο φορέας δεν επιλύεται (πλήρης έλεγχος ευστάθειας — πέρα από τα προκαταρκτικά
 *     diagnostics του T2).
 *   · `staticAnalysisMemberSkipped` — μέλος χωρίς έγκυρη διατομή/γεωμετρία που
 *     παραλείφθηκε από τον solver (memberId = entityId, 1:1 ADR-480).
 *
 * i18n keys μόνο (N.11). Pure — zero React/DOM/Firestore.
 *
 * @see ./solver-types.ts — AnalysisResult
 * @see ../analytical-diagnostics.ts — το αδελφό πρότυπο (T2)
 */

import type { StructuralDiagnostic } from '../../organism/structural-organism-types';
import type { AnalysisResult } from './solver-types';

/** i18n prefix (ns `dxf-viewer-shell`). */
const MSG = 'staticAnalysis.diagnostics';

/** Μηχανισμός: κάποιος συνδυασμός βρήκε singular K. `memberIds` = όλα τα μέλη του φορέα. */
function checkUnstable(result: AnalysisResult, memberIds: readonly string[]): StructuralDiagnostic[] {
  if (!result.unstable || memberIds.length === 0) return [];
  return [{
    id: 'staticAnalysisUnstable',
    code: 'staticAnalysisUnstable',
    severity: 'error',
    messageKey: `${MSG}.unstable`,
    primaryEntityId: memberIds[0],
    entityIds: [...memberIds],
  }];
}

/** Παραλειφθέντα μέλη (χωρίς διατομή/γεωμετρία). */
function checkSkipped(result: AnalysisResult): StructuralDiagnostic[] {
  return result.skippedMemberIds.map((memberId) => ({
    id: `staticAnalysisMemberSkipped:${memberId}`,
    code: 'staticAnalysisMemberSkipped',
    severity: 'warning',
    messageKey: `${MSG}.memberSkipped`,
    primaryEntityId: memberId,
    entityIds: [memberId],
  }));
}

/**
 * Τρέξε όλα τα diagnostics της στατικής ανάλυσης. `memberIds` = όλα τα μέλη του
 * μοντέλου (για το unstable diagnostic, που δεν αναφέρεται σε συγκεκριμένο μέλος). Pure.
 */
export function runAnalysisDiagnostics(
  result: AnalysisResult,
  memberIds: readonly string[],
): StructuralDiagnostic[] {
  return [...checkUnstable(result, memberIds), ...checkSkipped(result)];
}
