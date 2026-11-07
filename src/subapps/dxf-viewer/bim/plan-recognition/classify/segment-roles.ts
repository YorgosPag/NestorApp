/**
 * ADR-929 Φ5.4 — η **ΜΙΑ** πολιτική ρόλων: ποιοι ρόλοι τμήματος μπορούν να γίνουν είσοδος τοίχων. Τη ρωτούν η σύντηξη
 * (ευθείες παρειών) και η πηγή γραμμών του βοηθού (`isWallEvidence`). Κανένας δεύτερος τόπος.
 *
 * `unknown` είναι υποψήφιο: τα τεκμήρια δεν αποφάσισαν, και ένας πραγματικός τοίχος δεν χάνεται ποτέ σιωπηλά. Χωρίς
 * κρίση (`undefined`: τμήμα που δεν ταξινομήθηκε) ⇒ επίσης υποψήφιο.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/classify/segment-roles
 */

import type { PlanSegmentRole, PlanSegmentRoleVerdict } from '../plan-recognition-types';

const WALL_CANDIDATE_ROLES: ReadonlySet<PlanSegmentRole> = new Set<PlanSegmentRole>(['wall-face', 'unknown']);

export const isWallCandidateRole = (role: PlanSegmentRole | undefined): boolean =>
  role === undefined || WALL_CANDIDATE_ROLES.has(role);

/** Ο χάρτης «τμήμα → ρόλος» από τις κρίσεις του ταξινομητή. */
export function segmentRoleMap(verdicts: readonly PlanSegmentRoleVerdict[]): ReadonlyMap<string, PlanSegmentRole> {
  return new Map(verdicts.map((v) => [v.segmentId, v.role]));
}
