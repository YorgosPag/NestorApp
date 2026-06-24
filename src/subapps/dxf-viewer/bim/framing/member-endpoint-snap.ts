/**
 * ADR-508 — Linear-member ENDPOINT face-snap (point snap) — pure SSoT.
 *
 * Πλήρης ενοποίηση τοίχου ↔ δοκαριού ↔ κολώνας (Giorgio 2026-06-24): όπως το **START** ενός γραμμικού
 * μέλους κουμπώνει/γλιστρά flush σε παρειές μελών/κολωνών μέσω του `resolveMemberGhostSnapFromStore`,
 * έτσι και το **END** (2ο κλικ) πρέπει να «κολλάει» flush στην πλησιέστερη παρειά. Σημασιολογικά είναι
 * **POINT snap** (το άκρο προσγειώνεται στο σημείο επαφής), ΟΧΙ κάθετο T-framing — γι' αυτό κρατάμε το
 * `snap.start` (= το flush σημείο πάνω στην παρειά, ΙΔΙΟ που κλειδώνει το 1ο κλικ) και αγνοούμε το
 * `snap.end` (perpendicular stub). Μηδέν νέο engine: reuse ο ΙΔΙΟΣ dispatcher → preview ≡ commit (το ίδιο
 * helper τρέχει στο ghost (`*-preview-helpers`) ΚΑΙ στο commit (`use*Tool`) και για τοίχο ΚΑΙ για δοκάρι).
 *
 * **Γιατί στο `bim/framing/` (όχι `bim/walls/`):** το END snap είναι μέλος-αγνωστικό — ο ΙΔΙΟΣ κώδικας
 * εξυπηρετεί τοίχο και δοκάρι. Ζει δίπλα στον dispatcher (`member-ghost-snap.ts`) που χρησιμοποιεί. Το
 * `bim/walls/wall-endpoint-snap.ts` παραμένει ως **thin re-export** (byte-for-byte για wall consumers +
 * tests· mirror του beam-adapter pattern `beam-column-face-snap` → `member-column-face-snap`).
 *
 * **Precedence (Giorgio):** το face-snap κερδίζει εντός capture (CAD-standard osnap > ortho). Τυχόν
 * length/angle lock (Δαχτυλίδι Εντολών — μόνο ο τοίχος) νικά το face-snap, αλλά αυτό ελέγχεται στον caller
 * (`useWallTool` μέσω `isLengthAngleLockActive`), ώστε αυτό το leaf να μένει pure & καθολικό.
 *
 * Pure — zero React/DOM/store. Μονάδες: scene units (footprints/members world-baked).
 *
 * @see ./member-ghost-snap.ts — ο κοινός dispatcher (column-priority → linear member)
 * @see ../walls/wall-endpoint-snap.ts — thin re-export (wall-named aliases)
 * @see ../../hooks/drawing/wall-preview-helpers.ts + beam-preview-helpers.ts — preview consumers
 * @see ../../hooks/drawing/useWallTool.ts + useBeamTool.ts — commit consumers
 * @see docs/centralized-systems/reference/adrs/ADR-508-unified-linear-member-framing.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import { resolveMemberGhostSnapFromStore } from './member-ghost-snap';
import type { GhostFaceFrame, LinearMemberSnapTarget } from './linear-member-face-snap';
import { applyMoveFineStepAboutAnchor } from '../grips/grip-move-constraints';

/** Αποτέλεσμα endpoint snap: το (πιθανώς) snapped σημείο + προαιρετικό faceFrame για listening dims. */
export interface MemberEndpointSnap {
  /** Το snapped άκρο (flush στην παρειά) ή το `rawEnd` αυτούσιο όταν καμία παρειά εντός capture. */
  readonly point: Point2D;
  /** Πλαίσιο παρειάς για listening dimensions στο endpoint — `undefined` όταν δεν κούμπωσε. */
  readonly faceFrame?: GhostFaceFrame;
}

/**
 * Κούμπωσε το ΑΚΡΟ του μέλους flush στην πλησιέστερη παρειά μέλους/κολώνας (συνεχής ολίσθηση + magnet,
 * ΙΔΙΟΣ dispatcher με το start). `rawEnd` αυτούσιο όταν τίποτα εντός capture. Pure.
 *
 * @param memberWidthMm Πάχος τοίχου / πλάτος δοκαριού του υπό σχεδίαση μέλους σε mm.
 */
export function resolveMemberEndpointSnap(
  rawEnd: Readonly<Point2D>,
  columnFootprints: readonly (readonly Point2D[])[],
  memberTargets: readonly LinearMemberSnapTarget[],
  memberWidthMm: number,
  sceneUnits: SceneUnits,
): MemberEndpointSnap {
  const snap = resolveMemberGhostSnapFromStore(rawEnd, columnFootprints, memberTargets, memberWidthMm, sceneUnits);
  if (!snap) return { point: { x: rawEnd.x, y: rawEnd.y } };
  return { point: { x: snap.start.x, y: snap.start.y }, faceFrame: snap.faceFrame };
}

/**
 * ADR-049 (Giorgio 2026-06-24) — εφάρμοσε το **Shift fine 1 cm βήμα** στο ΑΚΡΟ που σχεδιάζεται,
 * ΜΟΝΟ όταν ΔΕΝ κούμπωσε σε παρειά (ελεύθερος χώρος). **Precedence (Giorgio): face-snap νικά** — αν
 * υπάρχει `faceFrame`, επιστρέφει το flush σημείο αυτούσιο· αλλιώς το άκρο κβαντίζεται σε πολλαπλάσια
 * του 1 cm σχετικά με το `start` (reuse του move SSoT `applyMoveFineStepAboutAnchor` — no-op όταν το
 * Shift δεν κρατιέται). Ο ΙΔΙΟΣ helper τρέχει στο preview ΚΑΙ στο commit → preview ≡ commit.
 */
export function resolveMemberEndpointWithFineStep(snap: MemberEndpointSnap, start: Readonly<Point2D>): Point2D {
  if (snap.faceFrame) return { x: snap.point.x, y: snap.point.y };
  return applyMoveFineStepAboutAnchor(snap.point, start);
}
