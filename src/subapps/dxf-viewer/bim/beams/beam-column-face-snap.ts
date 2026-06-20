/**
 * Beam→Column face snap — thin adapter (ADR-508). Η λογική ζει στο generic SSoT
 * `bim/framing/member-column-face-snap` + `member-ghost-snap` (κοινό δοκάρι+τοίχος, γενίκευση
 * του ADR-398 §Smart beam ghost).
 *
 * Εδώ μένει η ιστορική beam ταυτότητα + προσαρμογή πεδίου `beamWidthScene` → `memberWidthScene`.
 *
 * @see ../framing/member-column-face-snap.ts — canonical SSoT (12-θέσεων face snap)
 * @see ../framing/member-ghost-snap.ts — canonical dispatcher
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import {
  resolveMemberColumnFaceSnap,
  MEMBER_GHOST_LEN_MM,
  MEMBER_GHOST_CAPTURE_MM,
  type MemberColumnFaceSnap,
  type MemberGhostFace,
  type MemberGhostThird,
} from '../framing/member-column-face-snap';
import { resolveMemberGhostSnapFromStore } from '../framing/member-ghost-snap';
import type { BeamSnapTarget, BeamGhostSnapResult } from './beam-beam-face-snap';

/** Παρειά κολόνας στην οποία κουμπώνει το φάντασμα (world-aligned). */
export type BeamGhostFace = MemberGhostFace;
/** Αγκύρωση κατά μήκος της παρειάς: γωνία / κέντρο / γωνία. */
export type BeamGhostThird = MemberGhostThird;
/** Πλήρες αποτέλεσμα face-snap: ποια παρειά + ποιο third + το centerline start/end. */
export type BeamColumnFaceSnap = MemberColumnFaceSnap;

/** Παράμετροι (όλες σε **scene units**). */
export interface BeamFaceSnapOptions {
  /** Πλάτος δοκαριού (perpendicular) → half = offset των flush anchors. */
  readonly beamWidthScene: number;
  /** Μήκος του μικρού φαντάσματος προς τα έξω από την παρειά. */
  readonly ghostLenScene: number;
  /** Μέγιστη απόσταση cursor→παρειά για να ενεργοποιηθεί το snap. */
  readonly captureScene: number;
}

/** Default μήκος του ghost-before-click (mm). */
export const BEAM_GHOST_LEN_MM = MEMBER_GHOST_LEN_MM;
/** Default capture (mm) από την παρειά της κολόνας. */
export const BEAM_GHOST_CAPTURE_MM = MEMBER_GHOST_CAPTURE_MM;

/** @see resolveMemberColumnFaceSnap — beam-named adapter (`beamWidthScene` → `memberWidthScene`). */
export function resolveBeamColumnFaceSnap(
  cursor: Readonly<Point2D>,
  columnFootprints: readonly (readonly Point2D[])[],
  opts: Readonly<BeamFaceSnapOptions>,
): BeamColumnFaceSnap | null {
  return resolveMemberColumnFaceSnap(cursor, columnFootprints, {
    memberWidthScene: opts.beamWidthScene,
    ghostLenScene: opts.ghostLenScene,
    captureScene: opts.captureScene,
  });
}

/** @see resolveMemberGhostSnapFromStore — beam-named alias (ταυτόσημη υπογραφή). */
export function resolveBeamGhostSnapFromStore(
  cursor: Readonly<Point2D>,
  columnFootprints: readonly (readonly Point2D[])[],
  beamTargets: readonly BeamSnapTarget[],
  beamWidthMm: number,
  sceneUnits: SceneUnits,
): BeamGhostSnapResult | null {
  return resolveMemberGhostSnapFromStore(cursor, columnFootprints, beamTargets, beamWidthMm, sceneUnits);
}
