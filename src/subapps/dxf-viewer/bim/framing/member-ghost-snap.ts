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
import { adaptiveDistanceStep } from '../../systems/tracking/adaptive-distance-snap';
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
 * @param worldPerPixel  (προαιρετικό) `1/scale` — ενεργοποιεί το **σταθερό, zoom-adaptive βήμα
 *   ολίσθησης** του φαντάσματος κατά μήκος της παρειάς μέλους (ΙΔΙΟ `adaptiveDistanceStep` SSoT
 *   με τα ίχνη ευθυγράμμισης). Το περνά μόνο ο **τοίχος**· το δοκάρι (alias) το παραλείπει → η
 *   ολίσθηση δοκαριού μένει συνεχής/αμετάβλητη.
 */
export function resolveMemberGhostSnapFromStore(
  cursor: Readonly<Point2D>,
  columnFootprints: readonly (readonly Point2D[])[],
  memberTargets: readonly LinearMemberSnapTarget[],
  memberWidthMm: number,
  sceneUnits: SceneUnits,
  worldPerPixel?: number,
): MemberGhostSnapResult | null {
  const f = mmToSceneUnits(sceneUnits);
  const ghostLenScene = MEMBER_GHOST_LEN_MM * f;
  const captureScene = MEMBER_GHOST_CAPTURE_MM * f;
  // ADR-508 — βήμα ολίσθησης σε scene units· υπολογίζεται ΜΙΑ φορά (το `adaptiveDistanceStep` δουλεύει
  // σε world=scene units). Το περνά ΚΑΙ το column branch ΚΑΙ το member branch → ταυτόσημη ρευστή
  // ολίσθηση + magnet. `undefined` (δοκάρι — χωρίς worldPerPixel) → συνεχής ολίσθηση χωρίς magnet/quantize.
  const slideStepScene = worldPerPixel && worldPerPixel > 0 ? adaptiveDistanceStep(worldPerPixel) : undefined;
  if (columnFootprints.length > 0) {
    const cs = resolveMemberColumnFaceSnap(cursor, columnFootprints, {
      memberWidthScene: memberWidthMm * f,
      ghostLenScene,
      captureScene,
      slideStepScene,
    });
    // ADR-508 — column-priority: status `neutral` (αμετάβλητο)· faceFrame → listening dims & στις κολόνες.
    if (cs) return { start: cs.start, end: cs.end, status: 'neutral', faceFrame: cs.faceFrame };
  }
  if (memberTargets.length > 0) {
    return resolveLinearMemberFaceSnap(cursor, memberTargets, {
      ghostLenScene,
      captureScene,
      memberWidthScene: memberWidthMm * f,
      slideStepScene,
    });
  }
  return null;
}
