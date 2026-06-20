/**
 * Linear-member ghost snap dispatcher — pure SSoT (ADR-508 unified linear-member framing).
 *
 * **ΕΝΑ SSoT** για preview ΚΑΙ click ώστε το φάντασμα να είναι ταυτόσημο με το σημείο που
 * κλειδώνει το 1ο κλικ (preview === commit). Καταναλώνεται και από το **δοκάρι** (μέσω του
 * alias `resolveBeamGhostSnapFromStore`) και από τον **τοίχο**.
 *
 * **Column-priority** (ADR-398 §beam-to-beam framing): όταν υπάρχει κολόνα εντός capture, η
 * **παρειά κολόνας νικά** (διατηρεί ΑΚΡΙΒΩΣ το committed §3.3 behavior — status `neutral`)· το
 * member-to-member framing (🟢/🔴 status) ισχύει **μακριά** από κολόνες.
 *
 * @see ./member-column-face-snap.ts — η 12-θέσεων column face snap
 * @see ./linear-member-face-snap.ts — η member-to-member Τ-framing
 * @see docs/centralized-systems/reference/adrs/ADR-508-unified-linear-member-framing.md
 */

import type { Point2D } from '../../rendering/types/Types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import {
  resolveMemberColumnFaceSnap,
  MEMBER_GHOST_LEN_MM,
  MEMBER_GHOST_CAPTURE_MM,
} from './member-column-face-snap';
import {
  resolveLinearMemberFaceSnap,
  type MemberGhostSnapResult,
  type LinearMemberSnapTarget,
} from './linear-member-face-snap';

/**
 * Dispatcher: mm→scene conversion + επιλογή στόχου face-snap (column-priority, μετά member).
 *
 * @param memberWidthMm  Πλάτος (δοκάρι) ή πάχος (τοίχος) του νέου μέλους σε mm.
 */
export function resolveMemberGhostSnapFromStore(
  cursor: Readonly<Point2D>,
  columnFootprints: readonly (readonly Point2D[])[],
  memberTargets: readonly LinearMemberSnapTarget[],
  memberWidthMm: number,
  sceneUnits: SceneUnits,
): MemberGhostSnapResult | null {
  const f = mmToSceneUnits(sceneUnits);
  const ghostLenScene = MEMBER_GHOST_LEN_MM * f;
  const captureScene = MEMBER_GHOST_CAPTURE_MM * f;
  if (columnFootprints.length > 0) {
    const cs = resolveMemberColumnFaceSnap(cursor, columnFootprints, {
      memberWidthScene: memberWidthMm * f,
      ghostLenScene,
      captureScene,
    });
    if (cs) return { start: cs.start, end: cs.end, status: 'neutral' };
  }
  if (memberTargets.length > 0) {
    return resolveLinearMemberFaceSnap(cursor, memberTargets, {
      ghostLenScene,
      captureScene,
      memberWidthScene: memberWidthMm * f,
    });
  }
  return null;
}
