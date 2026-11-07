/**
 * ADR-929 Φ5.4β — από ρόλο τμήματος σε **σημάδι ρόλου**. Ο ΕΝΑΣ αναγνώστης του `PLAN_SEGMENT_ROLE_MARKS`: η επικάλυψη
 * του καμβά και το υπόμνημα του πάνελ ρωτούν εδώ, ώστε ό,τι μετρά η λίστα να είναι ό,τι φαίνεται πάνω στην εικόνα.
 *
 * Σημάδι παίρνει **μόνο** τμήμα που η πολιτική ρόλων (`isNonWallRole`) βγάζει εκτός τοίχων· οι υποψήφιες παρειές
 * (`wall-face`, `unknown`, χωρίς κρίση) μένουν στα επίπεδα βεβαιότητας.
 *
 * @see ../../config/color-config.ts (`PLAN_SEGMENT_ROLE_MARKS`, κρίνεται από το CHECK 3.41)
 * @see ../../bim/plan-recognition/classify/segment-roles.ts (η μία πολιτική ρόλων)
 */

import { PLAN_CONFIDENCE_MARKS, PLAN_SEGMENT_ROLE_MARKS } from '../../config/color-config';
import type { PlanSegmentRole } from '../../bim/plan-recognition/plan-recognition-types';
import { isNonWallRole, type NonWallRole } from '../../bim/plan-recognition/classify/segment-roles';
import type { PlanConfidenceMark } from './plan-confidence';

export type PlanRoleMarkKind = keyof typeof PLAN_SEGMENT_ROLE_MARKS.roles;

/** Η σειρά του υπομνήματος και της ζωγραφικής. */
export const PLAN_ROLE_MARK_ORDER: readonly PlanRoleMarkKind[] = ['dimension', 'annotation'];

/** Κάθε ρόλος εκτός τοίχων ⇒ ένα σημάδι. Εξαντλητικό στον τύπο: νέος ρόλος εκτός τοίχων χωρίς σημάδι δεν μεταγλωττίζεται. */
const ROLE_MARK_KIND: Readonly<Record<NonWallRole, PlanRoleMarkKind>> = {
  'dimension-line': 'dimension',
  'extension-line': 'dimension',
  annotation: 'annotation',
};

/** Το σημάδι ρόλου ενός τμήματος, ή `null` αν μένει υποψήφια παρειά (τότε το ζωγραφίζει το επίπεδο βεβαιότητας). */
export function planRoleMarkKind(role: PlanSegmentRole | undefined): PlanRoleMarkKind | null {
  return isNonWallRole(role) ? ROLE_MARK_KIND[role] : null;
}

export function planRoleMark(kind: PlanRoleMarkKind): PlanConfidenceMark {
  const spec = PLAN_SEGMENT_ROLE_MARKS.roles[kind];
  return {
    stroke: spec.hex,
    dash: PLAN_SEGMENT_ROLE_MARKS.dashPx[spec.dash],
    strokeWidth: PLAN_CONFIDENCE_MARKS.strokeWidthPx,
  };
}

/** Μηδενικά πλήθη ανά σημάδι — η αρχή κάθε μέτρησης. */
export function emptyRoleMarkCounts(): Record<PlanRoleMarkKind, number> {
  return { dimension: 0, annotation: 0 };
}
