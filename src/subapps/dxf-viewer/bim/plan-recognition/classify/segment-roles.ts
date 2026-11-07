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

const WALL_CANDIDATE_ROLE_LIST = ['wall-face', 'unknown'] as const satisfies readonly PlanSegmentRole[];
const WALL_CANDIDATE_ROLES: ReadonlySet<PlanSegmentRole> = new Set<PlanSegmentRole>(WALL_CANDIDATE_ROLE_LIST);

/** ADR-929 Φ5.4β — οι ρόλοι που η πολιτική βγάζει **εκτός** τοίχων, παραγόμενοι από την ΙΔΙΑ λίστα (όχι δεύτερη δήλωση). */
export type NonWallRole = Exclude<PlanSegmentRole, (typeof WALL_CANDIDATE_ROLE_LIST)[number]>;

export const isWallCandidateRole = (role: PlanSegmentRole | undefined): boolean =>
  role === undefined || WALL_CANDIDATE_ROLES.has(role);

/** Το αντίθετο του `isWallCandidateRole`, ως type guard: το τμήμα έχει ρόλο, και ο ρόλος δεν είναι υποψήφια παρειά. */
export const isNonWallRole = (role: PlanSegmentRole | undefined): role is NonWallRole =>
  !isWallCandidateRole(role);

/** Ο χάρτης «τμήμα → ρόλος» από τις κρίσεις του ταξινομητή. */
export function segmentRoleMap(verdicts: readonly PlanSegmentRoleVerdict[]): ReadonlyMap<string, PlanSegmentRole> {
  return new Map(verdicts.map((v) => [v.segmentId, v.role]));
}
