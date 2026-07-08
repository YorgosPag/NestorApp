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
 * ADR-508 §rotated-column — **ΠΕΡΙΣΤΡΑΜΜΕΝΗ ορθογώνια κολόνα**: το snap δουλεύει στο **τοπικό πλαίσιο**
 * της κολόνας (`RectFrame` u/v), άρα το μέλος βγαίνει κάθετα στην **πραγματική λοξή** παρειά (όχι στο
 * AABB). Ίσιες κολόνες / κύκλοι / πολύγωνα Γ-Τ-Π μένουν στο ιστορικό world-aligned bbox path (μηδέν
 * regression). Τα E/W/N/S παρακάτω είναι οι παρειές στο τοπικό πλαίσιο (world-aligned όταν rotation=0).
 *
 * Σημασιολογία (Revit/ETABS-grade): το μέλος βγαίνει **κάθετα προς τα έξω** από την παρειά,
 * με το κοντινό short-end να πατά flush στην παρειά (full bearing):
 *   · E (ανατ.) / W (δυτ.)  → μέλος ΟΡΙΖΟΝΤΙΟ (άξονας κατά X — τοπικό u)
 *   · N (βόρ.) / S (νότ.)   → μέλος ΚΑΘΕΤΟ   (άξονας κατά Y — τοπικό v)
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
import {
  rectFrameFromCorners,
  rectLocalToWorld,
  rectWorldToLocal,
  rectDirToWorld,
  type RectFrame,
} from './rect-frame';
import { clamp } from '../../rendering/entities/shared/geometry-utils';

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
 * ADR-508 §rotated-column — απόρριψη τυχόν κλείνουσας διπλής κορυφής (footprint μπορεί να είναι κλειστό).
 */
function stripClosingVertex(fp: readonly Point2D[]): readonly Point2D[] {
  const n = fp.length;
  if (n >= 2 && Math.abs(fp[0].x - fp[n - 1].x) < 1e-9 && Math.abs(fp[0].y - fp[n - 1].y) < 1e-9) {
    return fp.slice(0, n - 1);
  }
  return fp;
}

/**
 * ADR-508 §rotated-column — το ΠΕΡΙΣΤΡΑΜΜΕΝΟ ορθογώνιο πλαίσιο μιας κολόνας, ΜΟΝΟ όταν το footprint
 * είναι πραγματικό ορθογώνιο (4 κορυφές, u⊥v) ΚΑΙ όχι world-aligned. Axis-aligned ορθογώνια, κύκλοι
 * (πολλές κορυφές) και πολύγωνα Γ/Τ/Π → `null` → πέφτουν στο byte-identical AABB path (μηδέν regression).
 */
function orientedRectFrame(fp: readonly Point2D[]): RectFrame | null {
  const corners = stripClosingVertex(fp);
  if (corners.length !== 4) return null;
  const rect = rectFrameFromCorners(corners);
  if (!rect) return null;
  if (Math.abs(rect.u.x * rect.v.x + rect.u.y * rect.v.y) > 1e-6) return null; // όχι ορθή γωνία → όχι ορθογώνιο
  if (Math.abs(rect.u.x) < 1e-9 || Math.abs(rect.u.y) < 1e-9) return null; // world-aligned → AABB path (byte-identical)
  return rect;
}

/** Υποψήφια κολόνα-στόχος: λοξό ορθογώνιο (τοπικό πλαίσιο) ή world-aligned bbox. + απόσταση από cursor. */
type ColumnCandidate =
  | { readonly kind: 'rect'; readonly rect: RectFrame; readonly dist: number }
  | { readonly kind: 'aabb'; readonly bounds: FootprintBounds; readonly dist: number };

/** Πλησιέστερη κολόνα εντός capture. Λοξό ορθογώνιο → απόσταση στο τοπικό πλαίσιο (rigid → ίδια μετρική). */
function nearestColumnCandidate(
  cursor: Readonly<Point2D>,
  columnFootprints: readonly (readonly Point2D[])[],
  captureScene: number,
): ColumnCandidate | null {
  let best: ColumnCandidate | null = null;
  for (const fp of columnFootprints) {
    const rect = orientedRectFrame(fp);
    let cand: ColumnCandidate | null = null;
    if (rect) {
      const cl = rectWorldToLocal(rect, cursor);
      const dist = distanceToFootprintBounds(cl, { minX: -rect.halfW, maxX: rect.halfW, minY: -rect.halfV, maxY: rect.halfV });
      cand = { kind: 'rect', rect, dist };
    } else {
      const b = footprintBounds(fp);
      if (!b) continue;
      cand = { kind: 'aabb', bounds: b, dist: distanceToFootprintBounds(cursor, b) };
    }
    if (cand.dist <= captureScene && (!best || cand.dist < best.dist)) best = cand;
  }
  return best;
}

/**
 * ADR-508 §center-snap — face-flush + center-to-centroid resolve πάνω σε **world-aligned bounds** (cursor
 * σε ΙΔΙΕΣ συντεταγμένες). Είναι ΑΚΡΙΒΩΣ η ιστορική λογική· καλείται είτε με world bounds (AABB path)
 * είτε με τοπικές bounds λοξής κολόνας (rotated path) → ΕΝΑΣ κώδικας για ίσιες ΚΑΙ γυρισμένες κολόνες.
 */
function resolveFaceSnapInBounds(
  best: FootprintBounds,
  cursor: Readonly<Point2D>,
  half: number,
  opts: Readonly<MemberColumnFaceSnapOptions>,
): MemberColumnFaceSnap {
  const face: MemberGhostFace = pickDominantFace(cursor, best); // reuse pickDominantFace SSoT
  const { third, start, end } = resolveContinuousColumnFace(best, face, cursor, half, opts.ghostLenScene, opts.dominantUnitScene);
  // ADR-508 §center-snap — center-to-centroid override (nearest-wins)· `null` → κρατάμε το face-flush.
  const center = resolveColumnCenterSnap(best, cursor, face, start, opts.ghostLenScene);
  if (center) return center;
  return { face, third, start, end, faceFrame: buildColumnBboxFaceFrame(best, face, start) };
}

/**
 * ADR-508 §rotated-column — γύρνα ένα τοπικό (rotated-frame) αποτέλεσμα πίσω στον κόσμο. Τα σημεία μέσω
 * `rectLocalToWorld`, οι κατευθύνσεις του faceFrame μέσω `rectDirToWorld`· τα βαθμωτά (facePerp/along/
 * ghostHalfWidth/outwardSign) είναι μήκη/πρόσημα κατά τον άξονα → **rotation-invariant** (αμετάβλητα).
 */
function localSnapToWorld(s: MemberColumnFaceSnap, rect: Readonly<RectFrame>): MemberColumnFaceSnap {
  return {
    face: s.face,
    third: s.third,
    start: rectLocalToWorld(rect, s.start.x, s.start.y),
    end: rectLocalToWorld(rect, s.end.x, s.end.y),
    faceFrame: {
      ...s.faceFrame,
      origin: rectLocalToWorld(rect, s.faceFrame.origin.x, s.faceFrame.origin.y),
      axisDir: rectDirToWorld(rect, s.faceFrame.axisDir),
      perpDir: rectDirToWorld(rect, s.faceFrame.perpDir),
    },
  };
}

/**
 * Επίλεξε face-snap για το ghost-before-click. Pure. `null` όταν καμία κολόνα δεν είναι εντός
 * `captureScene` (ελεύθερη κίνηση). Reuse κοινό bbox/face SSoT (`footprint-face-frame`) + συνεχής
 * ολίσθηση/magnet + `buildColumnBboxFaceFrame` — μηδέν διπλότυπο.
 *
 * ADR-508 §rotated-column — **ΠΕΡΙΣΤΡΑΜΜΕΝΗ ορθογώνια κολόνα**: αντί να «ισιώσει» στο AABB (παλιό bug →
 * ο τοίχος έβγαινε πάντα οριζόντιος/κάθετος), φέρνουμε τον cursor στο ΤΟΠΙΚΟ πλαίσιο της κολόνας
 * (`rectWorldToLocal`), τρέχουμε την ΙΔΙΑ axis-aligned λογική (face-flush + 3-thirds + center-to-centroid)
 * και γυρνάμε το αποτέλεσμα στον κόσμο (`localSnapToWorld`) → ο τοίχος ακολουθεί την πραγματική γωνία
 * της λοξής παρειάς, με πλήρες parity μαγνητών. Ίσιες κολόνες / κύκλοι / Γ-Τ-Π → αμετάβλητο AABB path.
 *
 * ADR-508 §center-snap — δοκιμάζει το center-to-centroid candidate (nearest-wins με την παρειά):
 * cursor κοντά στο κέντρο → κέντρο άξονα τοίχου ↔ κέντρο κολόνας· κοντά σε παρειά → face-flush.
 */
export function resolveMemberColumnFaceSnap(
  cursor: Readonly<Point2D>,
  columnFootprints: readonly (readonly Point2D[])[],
  opts: Readonly<MemberColumnFaceSnapOptions>,
): MemberColumnFaceSnap | null {
  const cand = nearestColumnCandidate(cursor, columnFootprints, opts.captureScene);
  if (!cand) return null;
  const half = opts.memberWidthScene / 2;
  // ── Λοξή κολόνα → resolve στο τοπικό πλαίσιο, μετά πίσω στον κόσμο (ADR-508 §rotated-column) ──
  if (cand.kind === 'rect') {
    const bLocal: FootprintBounds = { minX: -cand.rect.halfW, maxX: cand.rect.halfW, minY: -cand.rect.halfV, maxY: cand.rect.halfV };
    const local = resolveFaceSnapInBounds(bLocal, rectWorldToLocal(cand.rect, cursor), half, opts);
    return localSnapToWorld(local, cand.rect);
  }
  // ── World-aligned κολόνα (ίσια/κύκλος/πολύγωνο) → ιστορικό AABB path (byte-identical) ──
  return resolveFaceSnapInBounds(cand.bounds, cursor, half, opts);
}
