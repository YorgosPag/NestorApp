/**
 * Polygon-vertex face-snap — pure SSoT (ADR-514 Φ6, Revit-grade «Draw on Face» για περίγραμμα).
 *
 * **Τι λύνει:** όταν σχεδιάζεις περίγραμμα πλάκας/στέγης (ή τοποθετείς θεμέλιο), μια **κορυφή ή ακμή**
 * να κουμπώνει **flush σε παρειά** τοίχου/κολόνας/δοκαριού/πλάκας — όπως η Revit. Δύο επίπεδα, ΕΝΑ
 * pure resolver (preview ≡ commit by construction — καλείται και από το commit click ΚΑΙ από το preview):
 *
 *   · **Φ6a — per-vertex flush:** κάθε κορυφή κουμπώνει στην πλησιέστερη παρειά μέλους. Περνά **ΜΕΣΑ
 *     από τον εγκέφαλο** (`resolveBimCursorSnap` toolKind `'polygon-vertex'`, memberWidth 0) → reuse του
 *     ΙΔΙΟΥ `resolveMemberGhostSnapFromStore` που χρησιμοποιούν τοίχος/δοκάρι/κολώνα (μηδέν διπλότυπο).
 *   · **Φ6b — edge-slide constraint:** όταν η ΠΡΟΗΓΟΥΜΕΝΗ κορυφή κούμπωσε σε παρειά P (`lock`), ο
 *     τρέχων cursor **γλιστράει ΚΑΤΑ ΜΗΚΟΣ της P** → η ακμή μένει flush/parallel στην παρειά. Παραχωρεί
 *     σε φρέσκο snap σε **ΔΙΑΦΟΡΕΤΙΚΗ** παρειά (στροφή γωνίας) και **απελευθερώνεται** όταν ο cursor
 *     απομακρυνθεί κάθετα πέρα από το capture (ο χρήστης τραβά μακριά → ελεύθερη σχεδίαση).
 *
 * **Anti double-snap (ADR-514 §2):** ο `cursor` έρχεται ήδη OSNAP-snapped κεντρικά (commit: `bimPoint`·
 * preview: `resolveEffectivePreviewCursor`) → ο εγκέφαλος καλείται **ΧΩΡΙΣ** `findSnapPoint`.
 *
 * **Pure** — zero React/DOM/store (ο `lock` + οι `targets` δίνονται από τον caller). Scene units.
 *
 * @see ./bim-cursor-snap.ts — ο εγκέφαλος (toolKind `'polygon-vertex'` branch)
 * @see ./polygon-vertex-lock-store.ts — το zero-React lock store (Φ6b state, single-writer ο ενεργός tool)
 * @see ../framing/linear-member-face-snap.ts — `GhostFaceFrame` (το πλαίσιο παρειάς που γλιστράμε)
 * @see docs/centralized-systems/reference/adrs/ADR-514-unified-bim-cursor-snap.md §Φ6
 */

import type { Point2D } from '../../rendering/types/Types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import type { SceneSnapTargets } from '../framing/scene-snap-targets';
import type { GhostFaceFrame } from '../framing/linear-member-face-snap';
import { MEMBER_GHOST_CAPTURE_MM } from '../framing/member-column-face-snap';
import { resolveBimCursorSnap } from './bim-cursor-snap';

/** Η κλειδωμένη παρειά της προηγούμενης κορυφής (Φ6b edge-slide). `targetId` = id host μέλους (ή undefined). */
export interface PolygonVertexLock {
  readonly faceFrame: GhostFaceFrame;
  readonly targetId?: string;
}

/** Αποτέλεσμα: το τελικό σημείο + (αν κούμπωσε σε παρειά) το frame/targetId για να γίνει ο επόμενος lock. */
export interface PolygonVertexSnap {
  readonly point: Point2D;
  /** Πλαίσιο παρειάς όπου κούμπωσε (→ νέο `lock` για την επόμενη κορυφή)· `undefined` σε ελεύθερο σημείο. */
  readonly faceFrame?: GhostFaceFrame;
  readonly targetId?: string;
}

/**
 * Προβολή του cursor πάνω στην **άπειρη ευθεία** μιας κλειδωμένης παρειάς: κρατά την κάθετη θέση
 * `facePerp` (μένει ΠΑΝΩ στην παρειά) και γλιστράει κατά μήκος του `axisDir`. Pure.
 */
function projectCursorOntoFaceLine(cursor: Readonly<Point2D>, ff: GhostFaceFrame): Point2D {
  const ox = ff.origin.x + ff.facePerp * ff.perpDir.x;
  const oy = ff.origin.y + ff.facePerp * ff.perpDir.y;
  const along = (cursor.x - ox) * ff.axisDir.x + (cursor.y - oy) * ff.axisDir.y;
  return { x: ox + along * ff.axisDir.x, y: oy + along * ff.axisDir.y };
}

/** Κάθετη απόσταση cursor → ευθεία παρειάς (= |(cursor − faceOrigin)·perpDir|). Pure. */
function perpDistToFaceLine(cursor: Readonly<Point2D>, ff: GhostFaceFrame): number {
  const ox = ff.origin.x + ff.facePerp * ff.perpDir.x;
  const oy = ff.origin.y + ff.facePerp * ff.perpDir.y;
  return Math.abs((cursor.x - ox) * ff.perpDir.x + (cursor.y - oy) * ff.perpDir.y);
}

/**
 * ADR-514 Φ6 — επιλύει το σημείο μιας κορυφής περιγράμματος (flush + edge-slide). Pure.
 *
 * @param cursor   Ήδη-OSNAP-snapped σημείο (commit `bimPoint` / preview `resolveEffectivePreviewCursor`).
 * @param targets  Pre-collected face-snap στόχοι σκηνής (κοινό `sceneSnapTargetsStore`).
 * @param lock     (Φ6b) η παρειά της προηγούμενης κορυφής· `undefined` στην 1η κορυφή ή μετά από release.
 */
export function resolvePolygonVertexSnap(
  cursor: Readonly<Point2D>,
  targets: Readonly<SceneSnapTargets>,
  sceneUnits: SceneUnits,
  lock?: PolygonVertexLock,
): PolygonVertexSnap {
  // Φ6a — flush στην πλησιέστερη παρειά (ΜΕΣΑ από τον εγκέφαλο· cursor ήδη snapped → χωρίς findSnapPoint).
  const brain = resolveBimCursorSnap({ toolKind: 'polygon-vertex', cursor, targets, sceneUnits });
  const fresh = brain.kind === 'member-placement' ? brain.placement : null;

  // Φ6b — edge-slide: κράτα την ακμή flush στην κλειδωμένη παρειά της προηγούμενης κορυφής.
  if (lock) {
    // Στροφή γωνίας: φρέσκο snap σε ΔΙΑΦΟΡΕΤΙΚΗ παρειά νικά → νέος lock.
    if (fresh?.faceFrame && fresh.targetId !== lock.targetId) {
      return { point: fresh.start, faceFrame: fresh.faceFrame, targetId: fresh.targetId };
    }
    // Όσο ο cursor μένει εντός capture της κλειδωμένης παρειάς → ολίσθηση κατά μήκος της (ακμή flush).
    const captureScene = MEMBER_GHOST_CAPTURE_MM * mmToSceneUnits(sceneUnits);
    if (perpDistToFaceLine(cursor, lock.faceFrame) <= captureScene) {
      return { point: projectCursorOntoFaceLine(cursor, lock.faceFrame), faceFrame: lock.faceFrame, targetId: lock.targetId };
    }
    // Release: ο cursor τραβήχτηκε μακριά κάθετα → πέφτουμε σε φρέσκο/ελεύθερο παρακάτω.
  }

  // Φ6a fresh flush (κούμπωσε σε παρειά με frame → γίνεται ο επόμενος lock).
  if (fresh?.faceFrame) {
    return { point: fresh.start, faceFrame: fresh.faceFrame, targetId: fresh.targetId };
  }
  // Ελεύθερο σημείο (καμία παρειά / collinear-overlap χωρίς frame) → ο (snapped) cursor αυτούσιος, χωρίς lock.
  return { point: brain.point };
}
