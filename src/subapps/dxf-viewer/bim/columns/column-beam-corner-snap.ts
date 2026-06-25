/**
 * Column **L-shape corner-gap** auto-junction — Revit/ETABS boundary element (ADR-525, pure SSoT).
 *
 * **Το ζητούμενο (Giorgio 2026-06-25):** δύο **κάθετα μεταξύ τους** δοκάρια χωρίς στήριξη, που αν
 * προεκταθούν συναντιούνται σε γωνία «Γ». Όταν το φάντασμα μιας **L-κολόνας** πλησιάζει το κενό:
 *   · η **κορυφή (εξωτερική γωνία)** της L κουμπώνει στην **τομή των νοητών προεκτάσεων των ΕΞΩΤΕΡΙΚΩΝ
 *     παρειών** των δύο δοκαριών·
 *   · οι **εξωτερικές παρειές** της L ταυτίζονται με αυτές τις δύο γραμμές·
 *   · κάθε **σκέλος αυτο-διαστασιολογείται** ώστε το **άκρο** του να φτάνει flush στο **άκρο (στενή
 *     παρειά)** του αντίστοιχου δοκαριού → ένωση συμβολής (boundary element, EC8). Το weld το αναλαμβάνει
 *     αυτόματα ο `useStructuralAutoAttach` (γειτνίαση παρειά-με-παρειά) — εδώ μόνο γεωμετρία.
 *
 * **Γιατί η L «ταιριάζει» φυσικά:** η διατομή L έχει **ανεξάρτητα πάχη σκελών** (`armWidth` = πάχος
 * κατακόρυφου, `armLength` = πάχος οριζόντιου) μέσα σε bbox `width × depth` → κάθε σκέλος παίρνει
 * ΑΚΡΙΒΩΣ το πάχος του δοκαριού του (μηδέν συμβιβασμός όταν τα πάχη διαφέρουν). Η γωνία είναι ακριβής.
 *
 * **Orientation-agnostic:** ο προσανατολισμός (4 διατάξεις) προκύπτει ΑΥΤΟΜΑΤΑ από τη γεωμετρία —
 * `rotation` από την κατεύθυνση του οριζόντιου σκέλους, `flipY` από τη χειρότητα (cross-product) των δύο
 * κατευθύνσεων. Δεν χρειάζεται χειροκίνητο flip ούτε ο cursor για τον προσανατολισμό.
 *
 * **FULL SSoT reuse (μηδέν διπλότυπο):** member frames από `buildMemberAxisFrame` (axis ± ημι-πάχος)·
 * τομή ευθειών από `lineIntersectionPoint` (SSoT στο `polygon-axis-projection`, σχεδιασμένο γι' αυτό)·
 * listening-dim frame από `buildCenteredAxisFaceFrame`. Pure (zero React/DOM/store). Μονάδες εισόδου:
 * scene units· οι διαστάσεις επιστρέφονται σε **mm** (όπως τα `ColumnLshapeParams`). Η τελική γεωμετρία
 * παράγεται από `computeColumnGeometry` (lshape override) → το ίδιο footprint σε preview ΚΑΙ commit.
 *
 * @see ./column-face-snap.ts — ο resolver/tier (`lCornerHit`) που το καταναλώνει (nearest-wins)
 * @see ./column-reference-lines.ts — το αδελφό multi-reference snap σε ΤΟΙΧΟ (ADR-523, το πρότυπο)
 * @see ../geometry/shared/polygon-axis-projection.ts — lineIntersectionPoint (SSoT τομή ευθειών)
 * @see docs/centralized-systems/reference/adrs/ADR-525-column-beam-corner-gap-l-junction.md
 */

import type { Point2D } from '../../rendering/types/Types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { lineIntersectionPoint } from '../geometry/shared/polygon-axis-projection';
import { MEMBER_GHOST_CAPTURE_MM } from '../framing/member-column-face-snap';
import type { LinearMemberSnapTarget, GhostFaceFrame } from '../framing/linear-member-face-snap';
import {
  buildMemberAxisFrame,
  buildCenteredAxisFaceFrame,
  type MemberAxisFrame,
} from './column-face-snap-helpers';
import type { PlacementAlignmentGuide } from './column-tangent-snap';
// FULL SSoT vector-math reuse (ADR-074/090 — `geometry-vector-utils`): μηδέν inline αντίγραφο
// dot/sub/add/scale/rotate/perpendicular (Giorgio SSoT audit 2026-06-25).
import {
  dotProduct,
  subtractPoints,
  addPoints,
  scalePoint,
  rotatePoint,
  getPerpendicularDirection,
} from '../../rendering/entities/shared/geometry-vector-utils';

/** Καθετότητα: |û_h · û_v| ≤ sin(5°) → τα δύο δοκάρια είναι «κάθετα μεταξύ τους». */
const PERP_DOT_TOL = 0.0872;
/** Πόσο κοντά (mm) στον reflex-κόμβο του κενού πρέπει να φτάσει ο cursor για να ενεργοποιηθεί ο tier. */
const L_CORNER_CAPTURE_MM = 2 * MEMBER_GHOST_CAPTURE_MM; // 1200mm (tunable — intentional placement)
const EPS = 1e-6;

/** Auto-διαστασιολόγηση της L ώστε τα σκέλη να γεμίζουν το κενό (mm — όπως τα `ColumnLshapeParams`). */
export interface LCornerSizing {
  /** bbox κατά τον τοπικό x = μήκος οριζόντιου σκέλους (έως το άκρο του οριζόντιου δοκαριού). */
  readonly widthMm: number;
  /** bbox κατά τον τοπικό y = μήκος κατακόρυφου σκέλους (έως το άκρο του κατακόρυφου δοκαριού). */
  readonly depthMm: number;
  /** πάχος κατακόρυφου σκέλους = πάχος κατακόρυφου δοκαριού. */
  readonly armWidthMm: number;
  /** πάχος οριζόντιου σκέλους = πάχος οριζόντιου δοκαριού. */
  readonly armLengthMm: number;
  /** χειρότητα διάταξης (το σκέλος πάνω/κάτω) — orientation-agnostic. */
  readonly flipY: boolean;
}

/** Αποτέλεσμα L corner-gap snap (ο `column-face-snap` το τυλίγει σε `ColumnFaceSnap`). */
export interface LCornerSnap {
  /** Κέντρο bbox (anchor `center`) — world/scene units. */
  readonly position: Point2D;
  /** Γωνία (μοίρες CCW) ώστε το οριζόντιο σκέλος να ακολουθεί το οριζόντιο δοκάρι. */
  readonly rotation: number;
  readonly sizing: LCornerSizing;
  /** Centered frame κατά μήκος του οριζόντιου σκέλους — για τις listening dimensions. */
  readonly faceFrame: GhostFaceFrame;
  /** Οι 2 νοητές προεκτάσεις των εξωτερικών παρειών (dashed οδηγοί) → κορυφή. */
  readonly guides: readonly [PlacementAlignmentGuide, PlacementAlignmentGuide];
  /** Απόσταση cursor → reflex-κόμβος του κενού (nearest-wins με τα άλλα tiers). */
  readonly dist: number;
}

const ORIGIN: Point2D = { x: 0, y: 0 };
/** Αριστερό κάθετο μοναδιαίο διεύθυνσης — reuse `getPerpendicularDirection` SSoT (μηδέν inline). */
const leftNormal = (u: Point2D): Point2D => getPerpendicularDirection(ORIGIN, u, false);

/** Μέσο του άξονα ενός μέλους (αντιπρόσωπος του «σώματός» του). */
function frameMid(fr: MemberAxisFrame): Point2D {
  return addPoints(fr.a, scalePoint(fr.u, (fr.alongMin + fr.alongMax) / 2));
}

/** Πρόσημο εξωτερικής παρειάς: η πλευρά **αντίθετα** από το σώμα του άλλου μέλους. */
function outerSign(fr: MemberAxisFrame, otherMid: Point2D): 1 | -1 {
  const side = dotProduct(subtractPoints(otherMid, fr.a), leftNormal(fr.u));
  return side >= 0 ? -1 : 1;
}

/** Σημείο εξωτερικής παρειάς στο along-coord `s` (axis + σ·ημι-πάχος κατά την κάθετο). */
function outerFacePoint(fr: MemberAxisFrame, sgn: number, s: number): Point2D {
  return addPoints(
    addPoints(fr.a, scalePoint(fr.u, s)),
    scalePoint(leftNormal(fr.u), sgn * fr.halfThickness),
  );
}

/** Σκέλος κατά μήκος μέλους: near-end (κοντινό άκρο) + μήκος + προσημασμένη κατεύθυνση «προς το σώμα». */
function legSpan(fr: MemberAxisFrame, sP: number): { near: number; len: number; dir: Point2D } | null {
  // Η κορυφή πρέπει να είναι ΕΞΩ από το σώμα του δοκαριού (στο κενό), όχι μέσα/στο άκρο.
  if (sP > fr.alongMin - EPS && sP < fr.alongMax + EPS) return null;
  const near = Math.abs(sP - fr.alongMin) <= Math.abs(sP - fr.alongMax) ? fr.alongMin : fr.alongMax;
  const len = Math.abs(near - sP);
  if (len < EPS) return null;
  const sign = Math.sign(near - sP);
  return { near, len, dir: { x: sign * fr.u.x, y: sign * fr.u.y } };
}

/** Χτίζει υποψήφια L από ζεύγος (οριζόντιο σκέλος `frH`, κατακόρυφο `frV`). `null` αν δεν είναι καθαρή γωνία. */
function buildCandidate(
  frH: MemberAxisFrame,
  frV: MemberAxisFrame,
  cursor: Readonly<Point2D>,
  f: number,
): LCornerSnap | null {
  const sgH = outerSign(frH, frameMid(frV));
  const sgV = outerSign(frV, frameMid(frH));
  const P = lineIntersectionPoint(outerFacePoint(frH, sgH, 0), frH.u, outerFacePoint(frV, sgV, 0), frV.u);
  if (!P) return null;
  const sPH = dotProduct(subtractPoints(P, frH.a), frH.u);
  const sPV = dotProduct(subtractPoints(P, frV.a), frV.u);
  const spanH = legSpan(frH, sPH);
  const spanV = legSpan(frV, sPV);
  if (!spanH || !spanV) return null;

  const theta = Math.atan2(spanH.dir.y, spanH.dir.x);
  // χειρότητα διάταξης (2D cross sign) — predicate μιας έκφρασης, όχι μηχανισμός (cross2D ζει σε λάθος
  // layer `snapping/engines`· βλ. pending-ratchet). Δεν εισάγει εξάρτηση bim→snapping.
  const flipY = spanH.dir.x * spanV.dir.y - spanH.dir.y * spanV.dir.x < 0;
  const hw = spanH.len / 2;
  const hd = spanV.len / 2;
  const armWScene = 2 * frV.halfThickness; // κατακόρυφο σκέλος (κατά τον τοπικό x)
  const armLScene = 2 * frH.halfThickness; // οριζόντιο σκέλος (κατά τον τοπικό y)

  // Κορυφή (εξωτερική γωνία) → P. Κέντρο = P − R(τοπική θέση κορυφής). Reflex-κόμβος = εσωτερική γωνία.
  const localOuter: Point2D = flipY ? { x: -hw, y: hd } : { x: -hw, y: -hd };
  const position: Point2D = subtractPoints(P, rotatePoint(localOuter, ORIGIN, theta));
  const localInner: Point2D = flipY
    ? { x: -hw + armWScene, y: hd - armLScene }
    : { x: -hw + armWScene, y: -hd + armLScene };
  const reflex: Point2D = addPoints(position, rotatePoint(localInner, ORIGIN, theta));
  const dist = Math.hypot(cursor.x - reflex.x, cursor.y - reflex.y);
  if (dist > L_CORNER_CAPTURE_MM * f) return null;

  const along = dotProduct(subtractPoints(position, frH.a), frH.u);
  return {
    position,
    rotation: (theta * 180) / Math.PI,
    sizing: {
      widthMm: spanH.len / f,
      depthMm: spanV.len / f,
      armWidthMm: armWScene / f,
      armLengthMm: armLScene / f,
      flipY,
    },
    faceFrame: buildCenteredAxisFaceFrame(frH.a, frH.u, leftNormal(frH.u), frH.alongMin, frH.alongMax, along),
    guides: [
      { a: outerFacePoint(frH, sgH, spanH.near), b: P },
      { a: outerFacePoint(frV, sgV, spanV.near), b: P },
    ],
    dist,
  };
}

/**
 * Επιλέγει την πλησιέστερη L corner-gap τοποθέτηση από όλα τα ζεύγη **κάθετων** δοκαριών των οποίων οι
 * εξωτερικές παρειές, προεκτεινόμενες, τέμνονται στο κενό κοντά στον cursor. `null` όταν κανένα ζεύγος δεν
 * σχηματίζει καθαρή γωνία εντός capture. Pure. Το οριζόντιο σκέλος ανατίθεται στο πιο X-ευθυγραμμισμένο
 * δοκάρι (rotation ≈ 0 σε axis-aligned· η περιστροφή/flipY καλύπτουν κάθε προσανατολισμό).
 */
export function resolveColumnBeamCornerSnap(
  cursor: Readonly<Point2D>,
  beams: readonly LinearMemberSnapTarget[],
  sceneUnits: SceneUnits,
): LCornerSnap | null {
  if (beams.length < 2) return null;
  const f = mmToSceneUnits(sceneUnits);
  const frames = beams
    .map((b) => buildMemberAxisFrame(b.axis, b.outline))
    .filter((x): x is MemberAxisFrame => x !== null);
  let best: LCornerSnap | null = null;
  for (let i = 0; i < frames.length; i++) {
    for (let j = i + 1; j < frames.length; j++) {
      const a = frames[i];
      const b = frames[j];
      if (Math.abs(dotProduct(a.u, b.u)) > PERP_DOT_TOL) continue; // όχι κάθετα → προσπέρασε
      const [frH, frV] = Math.abs(a.u.x) >= Math.abs(b.u.x) ? [a, b] : [b, a];
      const cand = buildCandidate(frH, frV, cursor, f);
      if (cand && (!best || cand.dist < best.dist)) best = cand;
    }
  }
  return best;
}
