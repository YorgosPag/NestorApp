/**
 * Linear-member → column face snap — pure SSoT (ADR-508 unified linear-member framing).
 *
 * Γενίκευση του `beam-column-face-snap` (ADR-398 §Smart beam ghost). Όταν εργαλείο γραμμικού
 * μέλους (δοκάρι/τοίχος) είναι ενεργό, **πριν το 1ο κλικ** εμφανίζεται μικρό έξυπνο φάντασμα.
 * Κοντά σε **ορθογώνια κολόνα** ο cursor «κουμπώνει» σε μία από 12 διακριτές θέσεις (4 παρειές
 * × 3 αγκυρώσεις) — το φάντασμα ΠΗΔΑΕΙ, δεν γλιστρά. Μακριά από κάθε κολόνα → `null`.
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
} from '../geometry/shared/footprint-face-frame';
import { pickThird, type MemberGhostThird } from './member-face-third';

/** Παρειά κολόνας στην οποία κουμπώνει το φάντασμα (world-aligned). SSoT alias `FootprintFace`. */
export type MemberGhostFace = 'E' | 'W' | 'N' | 'S';
/** Αγκύρωση κατά μήκος της παρειάς: γωνία / κέντρο / γωνία (SSoT leaf, re-export). */
export type { MemberGhostThird };

/** Πλήρες αποτέλεσμα face-snap: ποια παρειά + ποιο third + το centerline start/end. */
export interface MemberColumnFaceSnap {
  readonly face: MemberGhostFace;
  readonly third: MemberGhostThird;
  /** Centerline START (κλειδώνει το 1ο κλικ, πατά flush στην παρειά). */
  readonly start: Point2D;
  /** Centerline END (μικρό ghost, `ghostLenScene` προς τα έξω, κάθετα στην παρειά). */
  readonly end: Point2D;
}

/** Παράμετροι (όλες σε **scene units**) — ο dispatcher κάνει το mm→scene conversion. */
export interface MemberColumnFaceSnapOptions {
  /** Πλάτος μέλους (perpendicular) → half = offset των flush anchors. */
  readonly memberWidthScene: number;
  /** Μήκος του μικρού φαντάσματος προς τα έξω από την παρειά. */
  readonly ghostLenScene: number;
  /** Μέγιστη απόσταση cursor→παρειά για να ενεργοποιηθεί το snap. */
  readonly captureScene: number;
}

/** Default μήκος του ghost-before-click (mm) — μικρό, ίσα με ~μισό τυπικό άνοιγμα. */
export const MEMBER_GHOST_LEN_MM = 1200;
/** Default capture (mm) από την παρειά της κολόνας. */
export const MEMBER_GHOST_CAPTURE_MM = 600;

/**
 * Επίλεξε face-snap για το ghost-before-click. Pure. `null` όταν καμία κολόνα δεν είναι
 * εντός `captureScene` (ελεύθερη κίνηση). Reuse κοινό bbox/face SSoT (`footprint-face-frame`,
 * το ΙΔΙΟ που καταναλώνει και το `column-face-snap` — μηδέν διπλότυπο geometry).
 */
export function resolveMemberColumnFaceSnap(
  cursor: Readonly<Point2D>,
  columnFootprints: readonly (readonly Point2D[])[],
  opts: Readonly<MemberColumnFaceSnapOptions>,
): MemberColumnFaceSnap | null {
  // ── πλησιέστερη κολόνα εντός capture (reuse footprintBounds + distanceToFootprintBounds) ──
  let best: ReturnType<typeof footprintBounds> = null;
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

  const { minX, maxX, minY, maxY } = best;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const half = opts.memberWidthScene / 2;
  const len = opts.ghostLenScene;

  // ── ποια παρειά: reuse pickDominantFace SSoT (ex/ey κυρίαρχος άξονας) ──
  const face: MemberGhostFace = pickDominantFace(cursor, best);

  // ── E/W: οριζόντιο μέλος (άξονας X), thirds κατά Y ────────────────────────
  if (face === 'E' || face === 'W') {
    const third = pickThird(cursor.y, minY, maxY);
    const y = third === 'lo' ? minY + half : third === 'hi' ? maxY - half : cy;
    const faceX = face === 'E' ? maxX : minX;
    const tip = face === 'E' ? faceX + len : faceX - len;
    return { face, third, start: { x: faceX, y }, end: { x: tip, y } };
  }

  // ── N/S: κάθετο μέλος (άξονας Y), thirds κατά X ───────────────────────────
  const third = pickThird(cursor.x, minX, maxX);
  const x = third === 'lo' ? minX + half : third === 'hi' ? maxX - half : cx;
  const faceY = face === 'N' ? maxY : minY;
  const tip = face === 'N' ? faceY + len : faceY - len;
  return { face, third, start: { x, y: faceY }, end: { x, y: tip } };
}
