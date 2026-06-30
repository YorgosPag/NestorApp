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
  DOMINANT_DIVISION_MM,
} from './member-column-face-snap';
import {
  resolveLinearMemberFaceSnap,
  type MemberGhostSnapResult,
  type LinearMemberSnapTarget,
} from './linear-member-face-snap';
import { resolveMemberEndReferenceSnap, resolveMemberEndCornerCapSnap } from './member-end-reference-snap';

/**
 * Dispatcher: mm→scene conversion + επιλογή στόχου face-snap (column-priority, μετά member).
 *
 * ADR-508 (2026-06-24, Giorgio «συνεχή και ομαλή κίνηση») — το βήμα ολίσθησης είναι πλέον **proportional
 * fine** (γεωμετρικά παραγόμενο, ανεξάρτητο zoom): η παρειά ÷ 1cm = N· βήμα = πλάτος_μέλους / N (βλ.
 * `proportionalSlideStep`). Υπολογίζεται ΜΙΑ φορά η κυρίαρχη μονάδα (`dominantUnitScene = 1cm`) και
 * περνά ΚΑΙ στο column branch ΚΑΙ στο member branch → ταυτόσημη ομαλή ολίσθηση σε τοίχο/δοκάρι/κολώνα.
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
  // ADR-508 (2026-06-24) — κυρίαρχη μονάδα διαίρεσης = 1cm σε scene units (από τον resolver παράγεται
  // το proportional fine βήμα ανά παρειά). ΕΝΑ σημείο υπολογισμού· κοινό σε column + member branch.
  const dominantUnitScene = DOMINANT_DIVISION_MM * f;
  if (columnFootprints.length > 0) {
    const cs = resolveMemberColumnFaceSnap(cursor, columnFootprints, {
      memberWidthScene: memberWidthMm * f,
      ghostLenScene,
      captureScene,
      dominantUnitScene,
    });
    // ADR-508 — column-priority: status `neutral` (αμετάβλητο)· faceFrame → listening dims & στις κολόνες.
    if (cs) return { start: cs.start, end: cs.end, status: 'neutral', faceFrame: cs.faceFrame };
  }
  if (memberTargets.length > 0) {
    const memberOpts = {
      ghostLenScene,
      captureScene,
      memberWidthScene: memberWidthMm * f,
      dominantUnitScene,
    };
    // ADR-508 §end-reference (corner-cap) — ΒΟΡΕΙΑ της κορυφής & ΕΝΤΟΣ πλάτους (εκεί που πριν έβγαινε 🔴
    // ομοαξονικό): οριζόντια **γωνία Γ**, νότια παρειά flush στην κορυφή, σώμα έξω· η «πίσω-κάτω» γωνία
    // καθρεφτίζει τον κέρσορα (ολισθαίνει). ΥΨΗΛΟΤΕΡΗ προτεραιότητα → αντικαθιστά το 🔴.
    const cornerCap = resolveMemberEndCornerCapSnap(cursor, memberTargets, memberOpts);
    if (cornerCap) return cornerCap;
    // ADR-508 §end-reference (3-tier) — ΣΤΟ ΠΛΑΙ της κορυφής (κοντά σε μακριά παρειά): 1α/2β/3γ ≡ κορυφή,
    // nearest-wins. `null` μακριά → body Τ-framing (🟢) ή συγγραμμική επέκταση (🔴). ΕΝΑΣ dispatcher → preview ≡ commit.
    const endRef = resolveMemberEndReferenceSnap(cursor, memberTargets, memberOpts);
    if (endRef) return endRef;
    return resolveLinearMemberFaceSnap(cursor, memberTargets, memberOpts);
  }
  return null;
}
