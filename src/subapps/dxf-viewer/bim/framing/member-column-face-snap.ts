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
  footprintCenter,
  distanceToFootprintBounds,
  pickDominantFace,
  type FootprintBounds,
} from '../geometry/shared/footprint-face-frame';
import { pickThird, type MemberGhostThird } from './member-face-third';
import { quantizeMagnitude } from '../../systems/tracking/adaptive-distance-snap';
import {
  buildColumnBboxFaceFrame,
  buildCenteredAxisFaceFrame,
  proportionalSlideStep,
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
   * ADR-508 (2026-06-24) — κυρίαρχη μονάδα διαίρεσης (scene units, π.χ. 1cm): η παρειά ÷ unit = N·
   * βήμα ολίσθησης = πλάτος_μέλους / N (proportional fine step → ομαλή κίνηση, βλ. `proportionalSlideStep`).
   * `undefined`/0 → καθαρή συνεχής ολίσθηση (δοκάρι/edge αμετάβλητο).
   */
  readonly dominantUnitScene?: number;
}

/** Default μήκος του ghost-before-click (mm) — μικρό, ίσα με ~μισό τυπικό άνοιγμα. */
export const MEMBER_GHOST_LEN_MM = 1200;
/** Default capture (mm) από την παρειά της κολόνας. */
export const MEMBER_GHOST_CAPTURE_MM = 600;
/** ADR-508 (2026-06-24, Giorgio) — κυρίαρχη μονάδα διαίρεσης (mm): η μεγάλη παρειά διαιρείται ανά 1cm. */
export const DOMINANT_DIVISION_MM = 10;

/**
 * ADR-508 (2026-06-24, Giorgio «συνεχώς ομαλά») — ΣΥΝΕΧΗΣ διαμήκης θέση κατά μήκος παρειάς (mirror
 * `resolveLinearMemberFaceSnap`): ακολουθεί τον cursor κβαντισμένο στο **proportional fine βήμα**
 * (παρειά ÷ 1cm → N· βήμα = πλάτος/N → ομαλή κίνηση), **clamped εντός της παρειάς** `[lo+half, hi-half]`
 * (auto edge-flush στα άκρα, ΧΩΡΙΣ άλματα magnet/3-ζωνών). Μέλος ευρύτερο από την παρειά → κεντράρισμα.
 * `half*2` = πλάτος μέλους. ΕΝΑ SSoT, μηδέν διπλό.
 */
function slideAlongFace(c: number, lo: number, hi: number, half: number, dominantUnit?: number): number {
  const step = proportionalSlideStep(hi - lo, half * 2, dominantUnit);
  const slid = step ? clamp(quantizeMagnitude(c, step), lo, hi) : clamp(c, lo, hi);
  const insLo = lo + half;
  const insHi = hi - half;
  return insLo <= insHi ? clamp(slid, insLo, insHi) : (lo + hi) / 2;
}

/** Χτίζει το συνεχές centerline (start/end/third) για την επιλεγμένη παρειά. Pure (scene units). */
function resolveContinuousColumnFace(
  best: FootprintBounds,
  face: MemberGhostFace,
  cursor: Readonly<Point2D>,
  half: number,
  len: number,
  dominantUnit?: number,
): { third: MemberGhostThird; start: Point2D; end: Point2D } {
  const { minX, maxX, minY, maxY } = best;
  if (face === 'E' || face === 'W') {
    const y = slideAlongFace(cursor.y, minY, maxY, half, dominantUnit);
    const faceX = face === 'E' ? maxX : minX;
    const tip = face === 'E' ? faceX + len : faceX - len;
    // `third` = ζώνη του ΚΕΡΣΟΡΑ (metadata)· η θέση `y` είναι ήδη συνεχής/clamped (μηδέν διακριτό άλμα).
    return { third: pickThird(cursor.y, minY, maxY), start: { x: faceX, y }, end: { x: tip, y } };
  }
  const x = slideAlongFace(cursor.x, minX, maxX, half, dominantUnit);
  const faceY = face === 'N' ? maxY : minY;
  const tip = face === 'N' ? faceY + len : faceY - len;
  return { third: pickThird(cursor.x, minX, maxX), start: { x, y: faceY }, end: { x, y: tip } };
}

/**
 * ADR-508 §center-snap — magnet ζώνη κέντρου = `min(halfX,halfY) · CENTER_ZONE_FRACTION` (= ¼ της
 * μικρότερης ΠΛΗΡΟΥΣ διάστασης· mirror της «εσωτερικής μισής ζώνης» ADR-398 §3.9).
 */
const CENTER_ZONE_FRACTION = 0.5;

/** Μοναδιαίο κάθετο «προς τα έξω» της κυρίαρχης παρειάς. */
const outwardNormal = (face: MemberGhostFace): Point2D =>
  face === 'E' ? { x: 1, y: 0 } : face === 'W' ? { x: -1, y: 0 } : face === 'N' ? { x: 0, y: 1 } : { x: 0, y: -1 };

/**
 * ADR-508 §center-snap — **center-to-centroid** candidate (mirror ADR-398 §3.9, αντίστροφη φορά: ο
 * ΤΟΙΧΟΣ κουμπώνει το κέντρο άξονά του στο ΚΕΝΤΡΟ της κολόνας). `null` (→ face-flush wins) όταν η
 * face-flush επαφή είναι πλησιέστερη ΚΑΙ ο cursor εκτός magnet ζώνης κέντρου. Επειδή η face επαφή
 * ολισθαίνει με τον cursor (πάντα μικρό `dFace`), το «κούμπωμα στο κέντρο» απαιτεί firm magnet ζώνη
 * γύρω από το centroid (αλλιώς το κέντρο δεν κερδίζει σχεδόν ποτέ). Reuse `footprintCenter` +
 * `buildCenteredAxisFaceFrame` (SSoT). Orientation-agnostic (AABB-based, scene units).
 */
function resolveColumnCenterSnap(
  best: FootprintBounds,
  cursor: Readonly<Point2D>,
  face: MemberGhostFace,
  faceContact: Readonly<Point2D>,
  len: number,
): MemberColumnFaceSnap | null {
  const c = footprintCenter(best);
  const centerCapture = Math.min((best.maxX - best.minX) / 2, (best.maxY - best.minY) / 2) * CENTER_ZONE_FRACTION;
  const dCenter = Math.hypot(cursor.x - c.x, cursor.y - c.y);
  const dFace = Math.hypot(cursor.x - faceContact.x, cursor.y - faceContact.y);
  if (dCenter > dFace && dCenter > centerCapture) return null; // nearest-wins: face-flush κερδίζει
  const n = outwardNormal(face);
  const horizontal = face === 'E' || face === 'W';
  const axisDir: Point2D = horizontal ? { x: 0, y: 1 } : { x: 1, y: 0 }; // κατά μήκος της κυρίαρχης παρειάς
  const end: Point2D = { x: c.x + len * n.x, y: c.y + len * n.y };
  return {
    face, third: 'mid', start: c, end,
    faceFrame: buildCenteredAxisFaceFrame(
      c, axisDir, n,
      horizontal ? best.minY - c.y : best.minX - c.x,
      horizontal ? best.maxY - c.y : best.maxX - c.x,
      0,
    ),
  };
}

/**
 * Επίλεξε face-snap για το ghost-before-click. Pure. `null` όταν καμία κολόνα δεν είναι εντός
 * `captureScene` (ελεύθερη κίνηση). Reuse κοινό bbox/face SSoT (`footprint-face-frame`) + συνεχής
 * ολίσθηση/magnet (`magnetizeGhostCenterAlong`) + `buildColumnBboxFaceFrame` — μηδέν διπλότυπο.
 *
 * ADR-508 §center-snap — δοκιμάζει ΠΡΩΤΑ το center-to-centroid candidate (nearest-wins με την παρειά):
 * cursor κοντά στο κέντρο → κέντρο άξονα τοίχου ↔ κέντρο κολόνας· κοντά σε παρειά → face-flush.
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
  const { third, start, end } = resolveContinuousColumnFace(best, face, cursor, half, opts.ghostLenScene, opts.dominantUnitScene);
  // ADR-508 §center-snap — center-to-centroid override (nearest-wins)· `null` → κρατάμε το face-flush.
  const center = resolveColumnCenterSnap(best, cursor, face, start, opts.ghostLenScene);
  if (center) return center;
  return { face, third, start, end, faceFrame: buildColumnBboxFaceFrame(best, face, start) };
}
