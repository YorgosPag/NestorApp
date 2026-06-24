/**
 * ADR-508 — Wall ENDPOINT face-snap (point snap) — pure SSoT.
 *
 * Πλήρης ενοποίηση με την κολώνα (Giorgio 2026-06-24): όπως το **START** του τοίχου κουμπώνει/γλιστρά
 * flush σε παρειές μελών/κολωνών μέσω του `resolveMemberGhostSnapFromStore`, έτσι και το **END** (2ο
 * κλικ) πρέπει να «κολλάει» flush στην πλησιέστερη παρειά. Σημασιολογικά είναι **POINT snap** (το άκρο
 * προσγειώνεται στο σημείο επαφής), ΟΧΙ κάθετο T-framing — γι' αυτό κρατάμε το `snap.start` (= το
 * flush σημείο πάνω στην παρειά, ΙΔΙΟ που κλειδώνει το 1ο κλικ) και αγνοούμε το `snap.end` (perpendicular
 * stub). Μηδέν νέο engine: reuse ο ΙΔΙΟΣ dispatcher → preview ≡ commit (το ίδιο helper τρέχει στο ghost
 * `wall-preview-helpers` ΚΑΙ στο commit `useWallTool`).
 *
 * **Precedence (Giorgio):** το face-snap κερδίζει εντός capture (CAD-standard osnap > ortho). Το
 * length/angle lock (Δαχτυλίδι Εντολών) νικά το face-snap — αλλά αυτό ελέγχεται στον caller
 * (`useWallTool` μέσω `isLengthAngleLockActive`), ώστε αυτό το leaf να μένει pure & καθολικό.
 *
 * Pure — zero React/DOM/store. Μονάδες: scene units (footprints/members world-baked).
 *
 * @see ../framing/member-ghost-snap.ts — ο κοινός dispatcher (column-priority → linear member)
 * @see ../../hooks/drawing/wall-preview-helpers.ts — preview consumer
 * @see ../../hooks/drawing/useWallTool.ts — commit consumer (precedence vs lock)
 * @see docs/centralized-systems/reference/adrs/ADR-508-unified-linear-member-framing.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import { resolveMemberGhostSnapFromStore } from '../framing/member-ghost-snap';
import type { GhostFaceFrame, LinearMemberSnapTarget } from '../framing/linear-member-face-snap';

/** Αποτέλεσμα endpoint snap: το (πιθανώς) snapped σημείο + προαιρετικό faceFrame για listening dims. */
export interface WallEndpointSnap {
  /** Το snapped άκρο (flush στην παρειά) ή το `rawEnd` αυτούσιο όταν καμία παρειά εντός capture. */
  readonly point: Point2D;
  /** Πλαίσιο παρειάς για listening dimensions στο endpoint — `undefined` όταν δεν κούμπωσε. */
  readonly faceFrame?: GhostFaceFrame;
}

/**
 * Κούμπωσε το ΑΚΡΟ του τοίχου flush στην πλησιέστερη παρειά μέλους/κολώνας (συνεχής ολίσθηση + magnet,
 * ΙΔΙΟΣ dispatcher με το start). `rawEnd` αυτούσιο όταν τίποτα εντός capture. Pure.
 */
export function resolveWallEndpointSnap(
  rawEnd: Readonly<Point2D>,
  columnFootprints: readonly (readonly Point2D[])[],
  memberTargets: readonly LinearMemberSnapTarget[],
  thicknessMm: number,
  sceneUnits: SceneUnits,
  worldPerPixel?: number,
): WallEndpointSnap {
  const snap = resolveMemberGhostSnapFromStore(rawEnd, columnFootprints, memberTargets, thicknessMm, sceneUnits, worldPerPixel);
  if (!snap) return { point: { x: rawEnd.x, y: rawEnd.y } };
  return { point: { x: snap.start.x, y: snap.start.y }, faceFrame: snap.faceFrame };
}
