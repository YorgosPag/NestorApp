/**
 * Analytical model diagnostics — pure SSoT (ADR-480, T2).
 *
 * Προκαταρκτικοί έλεγχοι ευστάθειας πάνω στον DERIVED `AnalyticalModel` (πριν τον
 * solver T3 — πλήρης έλεγχος μηχανισμού/βαθμών ελευθερίας = T3):
 *
 *   · `analyticalModelUnstable` — υπάρχουν μέλη αλλά **καμία** στήριξη (ολικός
 *     μηχανισμός — δεν επιλύεται).
 *   · `analyticalMemberUnsupported` — μέλος που δεν συνδέεται (μέσω άλλων μελών) με
 *     καμία στήριξη (τοπικός μηχανισμός / αποσπασμένο τμήμα φορέα).
 *
 * Επιστρέφει `StructuralDiagnostic[]` (ίδιος τύπος με ADR-459) ώστε να ενώνονται
 * στο ΕΝΑ store write του `useStructuralOrganism`. i18n keys μόνο (N.11).
 *
 * Pure — zero React/DOM/Firestore.
 *
 * @see ./analytical-model-types.ts
 * @see ../organism/structural-organism-types.ts — StructuralDiagnostic
 * @see docs/centralized-systems/reference/adrs/ADR-480-analytical-model-ssot.md
 */

import type { StructuralDiagnostic } from '../organism/structural-organism-types';
import type { AnalyticalMember, AnalyticalModel } from './analytical-model-types';

/** i18n prefix (ns `dxf-viewer-shell`). */
const MSG = 'analyticalModel.diagnostics';

/** Adjacency κόμβων μέσω των μελών (μη-κατευθυνόμενο). */
function buildAdjacency(members: readonly AnalyticalMember[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  const link = (a: string, b: string): void => {
    const bucket = adj.get(a);
    if (bucket) bucket.push(b);
    else adj.set(a, [b]);
  };
  for (const m of members) {
    link(m.iNodeId, m.jNodeId);
    link(m.jNodeId, m.iNodeId);
  }
  return adj;
}

/** Σύνολο κόμβων προσβάσιμων από τις στηρίξεις (BFS μέσω των μελών). */
function reachableFromSupports(model: AnalyticalModel): Set<string> {
  const adj = buildAdjacency(model.members);
  const reached = new Set<string>();
  const queue: string[] = [];
  for (const s of model.supports) {
    if (reached.has(s.nodeId)) continue;
    reached.add(s.nodeId);
    queue.push(s.nodeId);
  }
  while (queue.length > 0) {
    const node = queue.shift() as string;
    for (const next of adj.get(node) ?? []) {
      if (reached.has(next)) continue;
      reached.add(next);
      queue.push(next);
    }
  }
  return reached;
}

/** Ολικός μηχανισμός: μέλη χωρίς καμία στήριξη. */
function checkModelUnstable(model: AnalyticalModel): StructuralDiagnostic[] {
  if (model.members.length === 0 || model.supports.length > 0) return [];
  const entityIds = [...new Set(model.members.map((m) => m.entityId))];
  return [{
    id: 'analyticalModelUnstable',
    code: 'analyticalModelUnstable',
    severity: 'error',
    messageKey: `${MSG}.modelUnstable`,
    primaryEntityId: entityIds[0],
    entityIds,
  }];
}

/** Μέλη με αμφότερα τα άκρα μη-προσβάσιμα από στήριξη → τοπικός μηχανισμός. */
function checkMembersUnsupported(model: AnalyticalModel): StructuralDiagnostic[] {
  if (model.supports.length === 0) return []; // καλύπτεται από modelUnstable
  const reached = reachableFromSupports(model);
  const out: StructuralDiagnostic[] = [];
  for (const m of model.members) {
    if (reached.has(m.iNodeId) || reached.has(m.jNodeId)) continue;
    out.push({
      id: `analyticalMemberUnsupported:${m.entityId}`,
      code: 'analyticalMemberUnsupported',
      severity: 'error',
      messageKey: `${MSG}.memberUnsupported`,
      primaryEntityId: m.entityId,
      entityIds: [m.entityId],
    });
  }
  return out;
}

/** Τρέξε όλους τους προκαταρκτικούς ελέγχους ευστάθειας. Pure. */
export function runAnalyticalDiagnostics(model: AnalyticalModel): StructuralDiagnostic[] {
  return [...checkModelUnstable(model), ...checkMembersUnsupported(model)];
}
