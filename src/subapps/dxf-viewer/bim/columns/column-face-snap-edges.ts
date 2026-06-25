/**
 * Column face-snap — **zero-width edge resolvers** (N.7.1 file-size split από `column-face-snap.ts`).
 *
 * Πυρήνας: ΑΚΜΕΣ ΠΛΑΚΑΣ + σκέτες ΓΡΑΜΜΕΣ + footprint ακμές (πέδιλα/μη-κυκλικές κολόνες/τοίχοι) μέσα
 * από τον ΙΔΙΟ axis-relative resolver (`resolveLinearMemberFaceSnap`) που καταναλώνουν τοίχος/δοκάρι.
 * Pure — zero React/DOM/store. Καλείται αποκλειστικά από τον core `resolveColumnFaceSnapFromTargets`
 * (ΕΝΑ SSoT για preview ≡ commit). Οι τύποι `ColumnFaceSnap`/`CircleGhostOpts` ζουν στον core
 * (type-only import → μηδέν runtime cycle).
 *
 * @see ./column-face-snap.ts — core consumer (nearest-wins ανάμεσα στα tiers)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md
 */

import type { Point2D } from '../../rendering/types/Types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { pickThird } from '../framing/member-face-third';
import { MEMBER_GHOST_CAPTURE_MM, MEMBER_GHOST_LEN_MM } from '../framing/member-column-face-snap';
import {
  resolveLinearMemberFaceSnap,
  type LinearMemberSnapTarget,
  type GhostFaceFrame,
} from '../framing/linear-member-face-snap';
import { pointOnCircle, calculateAngle } from '../../rendering/entities/shared/geometry-vector-utils';
import { resolveQuadrantEndAlignment, type PlacementAlignmentGuide } from './column-tangent-snap';
import {
  isAxisAligned,
  axisAlignmentRotationDeg,
  resolveAxisCenterFoot,
  buildCenteredAxisFaceFrame,
  SLAB_EDGE_CENTER_THRESHOLD_MM,
  edgeNearFace,
  edgeFlushAnchor,
  type ColumnFaceSide,
} from './column-face-snap-helpers';
import type { ColumnFaceSnap, CircleGhostOpts } from './column-face-snap';

/**
 * ADR-398 §3.11 — center-on-axis snap σε ακμή πλάκας: κέντρο κολώνας στον foot πάνω στον άξονα,
 * `anchor:'center'`, `rotation` = γωνία ακμής (0 axis-aligned / λοξή — §3.10b ευθυγράμμιση).
 * faceFrame κεντραρισμένο (`facePerp 0`, `ghostHalfWidth 0` → listening dims προς κέντρο, Revit
 * centerline· `ghostCenterAlong` = foot.along κατά μήκος του άξονα).
 */
function buildEdgeCenterSnap(
  ff: GhostFaceFrame,
  foot: { position: Point2D; along: number },
  rotation: number,
  face: ColumnFaceSide,
  align?: { along: number; guide: PlacementAlignmentGuide | null } | null,
): ColumnFaceSnap {
  // ADR-398 §3.20d — κυκλικό ghost: το διαμήκες `along` κουμπώνει στο άκρο/μέσον (quadrant-to-end) →
  // γραμμή-οδηγός ΚΑΙ στο center-on-axis γραμμής/ακμής πλάκας (mirror του τοίχου §3.20c). `core-not-band`:
  // η θέση πάνω στον ΑΞΟΝΑ της ακμής (perp 0), στο (πιθανώς κουμπωμένο) `along` — όχι στη μπάντα ±eps.
  const along = align ? align.along : foot.along;
  const axisPt: Point2D = { x: ff.origin.x + along * ff.axisDir.x, y: ff.origin.y + along * ff.axisDir.y };
  // ADR-398 §3.12 — σε κύκλο/τόξο η κολώνα κάθεται ΑΚΡΙΒΩΣ στην περιφέρεια (radial reprojection:
  // διορθώνει το chord-inset· η γωνία θέσης διατηρείται). Ευθείς στόχοι → axisPt αυτούσιο.
  const position = ff.arc
    ? pointOnCircle(ff.arc.center, ff.arc.radius, calculateAngle(ff.arc.center, axisPt))
    : axisPt;
  return {
    position,
    anchor: 'center',
    rotation,
    status: 'beam',
    targetId: null,
    face,
    third: 'mid',
    ...(align?.guide ? { alignmentGuide: align.guide } : {}),
    faceFrame: buildCenteredAxisFaceFrame(
      ff.origin, ff.axisDir, ff.perpDir, ff.faceAlongMin, ff.faceAlongMax, along, ff.arc,
    ),
  };
}

/**
 * ADR-508 §slab / ADR-398 §3.11 — **zero-width edges** (ΑΚΜΕΣ ΠΛΑΚΑΣ + σκέτες ΓΡΑΜΜΕΣ) μέσα από τον
 * **ΙΔΙΟ axis-relative resolver** που χρησιμοποιούν τοίχος/δοκάρι (`resolveLinearMemberFaceSnap`) —
 * δουλεύει σε ΚΑΘΕ προσανατολισμό (και διαγώνιες). `memberWidthScene=0` → η κολώνα μετριέται στο
 * **κέντρο** της (Revit centerline). Ακμή πλάκας ≡ γραμμή (ίδιο zero-width band, `edgeBandTarget`).
 *
 * **§3.11 nearest-reference-wins (mirror §3.9, αλλά axis-relative):**
 *   · cursor κάθετα κοντά στον άξονα (±`SLAB_EDGE_CENTER_THRESHOLD_MM`) → **center-on-axis**: κέντρο
 *     κολώνας στον άξονα + ολίσθηση **κατά μήκος** (`anchor:'center'`)·
 *   · αλλιώς → **flush** σε μία πλευρά (§3.10b· η σημερινή συμπεριφορά, anchor face × third).
 *
 * Επιστρέφει + απόσταση για σύγκριση προτεραιότητας με το bbox path. `null` όταν καμία ακμή εντός
 * capture. Function ≤40 γραμμές (N.7.1) μέσω helpers `edgeNearFace`/`edgeFlushAnchor`/
 * `buildEdgeCenterSnap` + κοινός `resolveAxisCenterFoot`.
 */
export function resolveColumnEdgeSnap(
  cursor: Readonly<Point2D>,
  edges: readonly LinearMemberSnapTarget[],
  sceneUnits: SceneUnits,
  circle?: CircleGhostOpts | null,
): { snap: ColumnFaceSnap; dist: number } | null {
  if (edges.length === 0) return null;
  const f = mmToSceneUnits(sceneUnits);
  const r = resolveLinearMemberFaceSnap(cursor, edges, {
    ghostLenScene: MEMBER_GHOST_LEN_MM * f,
    captureScene: MEMBER_GHOST_CAPTURE_MM * f,
    memberWidthScene: 0,
  });
  if (!r || !r.faceFrame) return null;
  const ff = r.faceFrame;
  const axisAligned = isAxisAligned(ff.axisDir);
  const rotation = axisAlignmentRotationDeg(ff.axisDir); // κοινός SSoT (μηδέν διπλό atan2)
  const face = edgeNearFace(ff);
  // §3.11 — center-on-axis (cursor κάθετα κοντά στον άξονα). Αλλιώς πέφτει στο flush παρακάτω.
  const foot = resolveAxisCenterFoot(
    cursor, ff.origin, ff.axisDir, ff.faceAlongMin, ff.faceAlongMax, SLAB_EDGE_CENTER_THRESHOLD_MM * f,
  );
  if (foot) {
    // ADR-398 §3.20d — κυκλικό ghost: quadrant-to-end alignment + γραμμή-οδηγός (zero-width edge → halfThickness 0).
    const align = circle
      ? resolveQuadrantEndAlignment(foot.along, ff.faceAlongMin, ff.faceAlongMax, circle.radius, ff.origin, ff.axisDir, 0, circle.wpp, circle.scaleF)
      : null;
    return { snap: buildEdgeCenterSnap(ff, foot, rotation, face, align), dist: foot.perp };
  }
  // §3.10b flush — η κολώνα κάθεται με μία παρειά flush στην ακμή, στην πλευρά του cursor.
  const third = pickThird(ff.ghostCenterAlong, ff.faceAlongMin, ff.faceAlongMax);
  const snap: ColumnFaceSnap = {
    position: r.start,
    anchor: edgeFlushAnchor(face, third, axisAligned, ff.outwardSign),
    rotation,
    status: r.status === 'overlap' ? 'overlap' : 'beam',
    targetId: null,
    face,
    third,
    faceFrame: ff,
  };
  return { snap, dist: Math.hypot(cursor.x - r.start.x, cursor.y - r.start.y) };
}

/**
 * ADR-514 Φ6d / ADR-398 §3.18 — face-snap σε υφιστάμενο **ΠΕΔΙΛΟ / ΜΗ-ΚΥΚΛΙΚΗ ΚΟΛΟΝΑ / ΤΟΙΧΟ** μέσω
 * των zero-width edges του πραγματικού (world-baked, στραμμένου, **πολυγωνικού/Γ/Τ/Π/λοξού**) footprint.
 * Σε αντίθεση με slab/line edges (center-on-axis straddle), το νέο μέλος κάθεται **flush ΔΙΠΛΑ** στην
 * παρειά (ΟΧΙ κεντραρισμένο πάνω της) και, κοντά σε **ΓΩΝΙΑ** (εξωτερικό τρίτο της παρειάς), κουμπώνει
 * **γωνία-με-γωνία**: το `centerAlong` κουμπώνει στην ΚΟΡΥΦΗ → **δύο παρειές flush** (η κοινή + η
 * συγγραμμική). **ΑΚΟΛΟΥΘΕΙ ΤΗ ΛΟΞΑΔΑ** (rotation από τον άξονα ακμής· axis-relative) → το φάντασμα
 * στρέφεται flush στην πραγματική (λοξή) παρειά αντί να ισιώνει σε ορθογώνιο bbox. Reuse
 * `resolveLinearMemberFaceSnap` + `pickThird` + `edgeFlushAnchor` + `edgeNearFace` — ΜΗΔΕΝ center-on-axis
 * (no straddle), μηδέν νέα geometry. `dist` = κάθετη απόσταση στην παρειά (η γωνία «κολλάει» στο εξωτ. τρίτο).
 */
export function resolveFootprintEdgeSnap(
  cursor: Readonly<Point2D>,
  edges: readonly LinearMemberSnapTarget[],
  sceneUnits: SceneUnits,
): { snap: ColumnFaceSnap; dist: number } | null {
  if (edges.length === 0) return null;
  const f = mmToSceneUnits(sceneUnits);
  const r = resolveLinearMemberFaceSnap(cursor, edges, {
    ghostLenScene: MEMBER_GHOST_LEN_MM * f,
    captureScene: MEMBER_GHOST_CAPTURE_MM * f,
    memberWidthScene: 0,
  });
  if (!r || !r.faceFrame) return null;
  const ff = r.faceFrame;
  const axisAligned = isAxisAligned(ff.axisDir);
  const rotation = axisAlignmentRotationDeg(ff.axisDir);
  const face = edgeNearFace(ff);
  // εξωτερικό τρίτο → ΚΟΡΥΦΗ (corner-to-corner)· μεσαίο → flush κατά μήκος (beside). ΧΩΡΙΣ center-on-axis.
  const third = pickThird(ff.ghostCenterAlong, ff.faceAlongMin, ff.faceAlongMax);
  const centerAlong = third === 'lo' ? ff.faceAlongMin : third === 'hi' ? ff.faceAlongMax : ff.ghostCenterAlong;
  // ΑΚΡΙΒΕΣ flush (facePerp 0): ο άξονας ακμής ΕΙΝΑΙ το όριο footprint του πεδίλου → η λαβή κάθεται πάνω
  // στην παρειά (0 κενό), όχι ±eps του zero-width band. Το outward extension το ορίζει το anchor.
  const position: Point2D = {
    x: ff.origin.x + centerAlong * ff.axisDir.x,
    y: ff.origin.y + centerAlong * ff.axisDir.y,
  };
  const faceFrame: GhostFaceFrame = { ...ff, ghostCenterAlong: centerAlong, facePerp: 0 };
  const perpDist = Math.abs((cursor.x - ff.origin.x) * ff.perpDir.x + (cursor.y - ff.origin.y) * ff.perpDir.y - ff.facePerp);
  return {
    snap: { position, anchor: edgeFlushAnchor(face, third, axisAligned, ff.outwardSign), rotation, status: 'beam', targetId: null, face, third, faceFrame },
    dist: perpDist,
  };
}
