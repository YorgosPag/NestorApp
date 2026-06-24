/**
 * Linear-member → column face snap — pure SSoT (ADR-508 unified linear-member framing).
 *
 * Γενίκευση του `beam-column-face-snap` (ADR-398 §Smart beam ghost). Όταν εργαλείο γραμμικού
 * μέλους (δοκάρι/τοίχος) είναι ενεργό, **πριν το 1ο κλικ** εμφανίζεται μικρό έξυπνο φάντασμα.
 * Κοντά σε **ορθογώνια κολόνα** το φάντασμα **ΟΛΙΣΘΑΙΝΕΙ ΣΥΝΕΧΩΣ** κατά μήκος της κυρίαρχης παρειάς
 * (mirror του `resolveLinearMemberFaceSnap` + του column-tool `resolveForTarget`): η διαμήκης θέση
 * ακολουθεί τον cursor (προαιρετικά κβαντισμένη σε `slideStepScene`) και **μαγνητίζεται** στα 3
 * χαρακτηριστικά σημεία (κέντρο + flush σε κάθε γωνία) μέσω του ΚΟΙΝΟΥ `magnetizeGhostCenterAlong`.
 * Εκθέτει `GhostFaceFrame` (→ listening dimensions και στις κολόνες). Μακριά από κάθε κολόνα → `null`.
 *
 * Σημασιολογία (Revit/ETABS-grade): το μέλος βγαίνει **κάθετα προς τα έξω** από την παρειά,
 * με το κοντινό short-end να πατά flush στην παρειά (full bearing):
 *   · E (ανατ.) / W (δυτ.)  → μέλος ΟΡΙΖΟΝΤΙΟ (άξονας κατά X)
 *   · N (βόρ.) / S (νότ.)   → μέλος ΚΑΘΕΤΟ   (άξονας κατά Y)
 * Τα 3 thirds κατά μήκος της παρειάς:
 *   · `lo`  → γωνία-flush στη μία άκρη (πλάγια παρειά μέλους ≡ γωνιακή παρειά κολόνας)
 *   · `mid` → centerline ≡ κέντρο κολόνας
 *   · `hi`  → γωνία-flush στην άλλη άκρη
 *
 * **Επιστρέφει το ΤΕΛΙΚΟ centerline** `start`/`end`. Ο caller κλειδώνει το `start` στο 1ο κλικ
 * ως centerline (`startAnchored`) → το 2ο κλικ τραβά ελεύθερα από αυτό το σταθερό σημείο.
 *
 * Pure — zero React/DOM/store. Reuse `projectPolygonOnAxis` (polygon-vs-axis SSoT, N.0.2).
 * Μονάδες: **scene units** (footprints world-baked· ο dispatcher μετατρέπει mm→scene).
 *
 * @see ./linear-member-face-snap.ts — η member-to-member αδελφή
 * @see ./member-ghost-snap.ts — ο dispatcher (`resolveMemberGhostSnapFromStore`)
 * @see ../beams/beam-column-face-snap.ts — thin re-export alias (πίσω συμβατότητα δοκαριού)
 * @see docs/centralized-systems/reference/adrs/ADR-508-unified-linear-member-framing.md
 */

import type { Point2D } from '../../rendering/types/Types';
import {
  footprintBounds,
  distanceToFootprintBounds,
  pickDominantFace,
  type FootprintBounds,
} from '../geometry/shared/footprint-face-frame';
import { pickThird, type MemberGhostThird } from './member-face-third';
import { quantizeMagnitude } from '../../systems/tracking/adaptive-distance-snap';
import {
  magnetizeGhostCenterAlong,
  buildColumnBboxFaceFrame,
  type GhostFaceFrame,
} from './linear-member-face-snap';

/** Clamp σε [lo,hi] — local leaf (μηδέν cross-layer import από `bim/columns`). */
const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/** Παρειά κολόνας στην οποία κουμπώνει το φάντασμα (world-aligned). SSoT alias `FootprintFace`. */
export type MemberGhostFace = 'E' | 'W' | 'N' | 'S';
/** Αγκύρωση κατά μήκος της παρειάς: γωνία / κέντρο / γωνία (SSoT leaf, re-export). */
export type { MemberGhostThird };

/** Πλήρες αποτέλεσμα face-snap: ποια παρειά + ποιο third + το centerline start/end + faceFrame. */
export interface MemberColumnFaceSnap {
  readonly face: MemberGhostFace;
  /** Third στο οποίο πέφτει η (συνεχής) διαμήκης θέση — metadata (lo/mid/hi). */
  readonly third: MemberGhostThird;
  /** Centerline START (κλειδώνει το 1ο κλικ, πατά flush στην παρειά). */
  readonly start: Point2D;
  /** Centerline END (μικρό ghost, `ghostLenScene` προς τα έξω, κάθετα στην παρειά). */
  readonly end: Point2D;
  /** ADR-508 §dim — πλαίσιο παρειάς για listening dimensions (ίδιο SSoT με τον member resolver). */
  readonly faceFrame: GhostFaceFrame;
}

/** Παράμετροι (όλες σε **scene units**) — ο dispatcher κάνει το mm→scene conversion. */
export interface MemberColumnFaceSnapOptions {
  /** Πλάτος μέλους (perpendicular) → half = offset των flush anchors. */
  readonly memberWidthScene: number;
  /** Μήκος του μικρού φαντάσματος προς τα έξω από την παρειά. */
  readonly ghostLenScene: number;
  /** Μέγιστη απόσταση cursor→παρειά για να ενεργοποιηθεί το snap. */
  readonly captureScene: number;
  /**
   * ADR-508 — προαιρετικό σταθερό βήμα ολίσθησης (scene units, zoom-adaptive· ΙΔΙΟ `quantizeMagnitude`
   * SSoT με τον member resolver). `undefined`/0 → συνεχής ολίσθηση (δοκάρι αμετάβλητο).
   */
  readonly slideStepScene?: number;
}

/** Default μήκος του ghost-before-click (mm) — μικρό, ίσα με ~μισό τυπικό άνοιγμα. */
export const MEMBER_GHOST_LEN_MM = 1200;
/** Default capture (mm) από την παρειά της κολόνας. */
export const MEMBER_GHOST_CAPTURE_MM = 600;

/**
 * ADR-508 — συνεχής διαμήκης θέση κατά μήκος παρειάς (mirror `resolveLinearMemberFaceSnap`): ακολουθεί
 * τον cursor, προαιρετικά κβαντισμένη σε `step`, και **μαγνητίζεται** στα 3 χαρακτηριστικά σημεία
 * (κέντρο + flush σε κάθε γωνία) μέσω του ΚΟΙΝΟΥ `magnetizeGhostCenterAlong`. ΕΝΑ SSoT, μηδέν διπλό.
 */
function slideAlongFace(c: number, lo: number, hi: number, half: number, step?: number): number {
  const slid = step ? clamp(quantizeMagnitude(c, step), lo, hi) : clamp(c, lo, hi);
  return magnetizeGhostCenterAlong(c, slid, lo, hi, half, step);
}

/** Χτίζει το συνεχές centerline (start/end/third) για την επιλεγμένη παρειά. Pure (scene units). */
function resolveContinuousColumnFace(
  best: FootprintBounds,
  face: MemberGhostFace,
  cursor: Readonly<Point2D>,
  half: number,
  len: number,
  step?: number,
): { third: MemberGhostThird; start: Point2D; end: Point2D } {
  const { minX, maxX, minY, maxY } = best;
  if (face === 'E' || face === 'W') {
    const y = slideAlongFace(cursor.y, minY, maxY, half, step);
    const faceX = face === 'E' ? maxX : minX;
    const tip = face === 'E' ? faceX + len : faceX - len;
    return { third: pickThird(y, minY, maxY), start: { x: faceX, y }, end: { x: tip, y } };
  }
  const x = slideAlongFace(cursor.x, minX, maxX, half, step);
  const faceY = face === 'N' ? maxY : minY;
  const tip = face === 'N' ? faceY + len : faceY - len;
  return { third: pickThird(x, minX, maxX), start: { x, y: faceY }, end: { x, y: tip } };
}

/**
 * Επίλεξε face-snap για το ghost-before-click. Pure. `null` όταν καμία κολόνα δεν είναι εντός
 * `captureScene` (ελεύθερη κίνηση). Reuse κοινό bbox/face SSoT (`footprint-face-frame`) + συνεχής
 * ολίσθηση/magnet (`magnetizeGhostCenterAlong`) + `buildColumnBboxFaceFrame` — μηδέν διπλότυπο.
 */
export function resolveMemberColumnFaceSnap(
  cursor: Readonly<Point2D>,
  columnFootprints: readonly (readonly Point2D[])[],
  opts: Readonly<MemberColumnFaceSnapOptions>,
): MemberColumnFaceSnap | null {
  // ── πλησιέστερη κολόνα εντός capture (reuse footprintBounds + distanceToFootprintBounds) ──
  let best: FootprintBounds | null = null;
  let bestDist = Infinity;
  for (const fp of columnFootprints) {
    const b = footprintBounds(fp);
    if (!b) continue;
    const d = distanceToFootprintBounds(cursor, b);
    if (d <= opts.captureScene && d < bestDist) {
      bestDist = d;
      best = b;
    }
  }
  if (!best) return null;

  const half = opts.memberWidthScene / 2;
  const face: MemberGhostFace = pickDominantFace(cursor, best); // reuse pickDominantFace SSoT
  const { third, start, end } = resolveContinuousColumnFace(best, face, cursor, half, opts.ghostLenScene, opts.slideStepScene);
  return { face, third, start, end, faceFrame: buildColumnBboxFaceFrame(best, face, start) };
}
