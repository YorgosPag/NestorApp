/**
 * Beam→Beam face snap — thin adapter (ADR-508). Η λογική ζει στο generic SSoT
 * `bim/framing/linear-member-face-snap` (κοινό δοκάρι+τοίχος, γενίκευση του ADR-398 §3.6).
 *
 * Εδώ μένει η ιστορική beam ταυτότητα (`BeamSnapTarget`, `resolveBeamBeamFaceSnap`, …) +
 * προσαρμογή ονόματος πεδίου `beamWidthScene` → `memberWidthScene` ώστε οι beam consumers/tests
 * να μένουν αμετάβλητοι (byte-for-byte).
 *
 * @see ../framing/linear-member-face-snap.ts — canonical SSoT
 */

import type { Point2D } from '../../rendering/types/Types';
import {
  resolveLinearMemberFaceSnap,
  isMemberCollinearOverlap,
  type LinearMemberSnapTarget,
  type MemberGhostSnapResult,
} from '../framing/linear-member-face-snap';

/** Στόχος face-snap = υφιστάμενο δοκάρι (axis + outline, scene units). */
export type BeamSnapTarget = LinearMemberSnapTarget;
/** Αποτέλεσμα ghost snap: centerline start/end + σημασιολογικό status (🟢/🔴/ουδέτερο). */
export type BeamGhostSnapResult = MemberGhostSnapResult;

export interface BeamBeamFaceSnapOptions {
  /** Μήκος μικρού φαντάσματος προς τα έξω από την παρειά/άκρη. */
  readonly ghostLenScene: number;
  /** Μέγιστη απόσταση cursor→σώμα δοκαριού για ενεργοποίηση. */
  readonly captureScene: number;
  /** Πλάτος νέου δοκαριού (scene units) — για την 3-ζωνική δικαιολόγηση κατά τον άξονα. */
  readonly beamWidthScene: number;
}

/** @see resolveLinearMemberFaceSnap — beam-named adapter (`beamWidthScene` → `memberWidthScene`). */
export function resolveBeamBeamFaceSnap(
  cursor: Readonly<Point2D>,
  targets: readonly BeamSnapTarget[],
  opts: Readonly<BeamBeamFaceSnapOptions>,
): BeamGhostSnapResult | null {
  return resolveLinearMemberFaceSnap(cursor, targets, {
    ghostLenScene: opts.ghostLenScene,
    captureScene: opts.captureScene,
    memberWidthScene: opts.beamWidthScene,
  });
}

export { isMemberCollinearOverlap as isBeamCollinearOverlap };
