/**
 * Beam **auto-span between two structural members** — Revit/ETABS-grade framing (ADR-528, pure SSoT).
 *
 * **Το ζητούμενο (Giorgio 2026-06-25):** όταν είναι ενεργό το εργαλείο **Δοκάρι** και ο cursor μπαίνει
 * στη **νοητή ευθεία** ανάμεσα σε **δύο δομικά μέλη** (κολόνα/τοίχο), γεφυρώνει το δοκάρι με τα άκρα του
 * **flush στις αντικριστές παρειές** (weld μέσω `useStructuralAutoAttach`, ADR-449). Αντίστροφο του ADR-525.
 *
 * **ADR-528 §adjacency (Giorgio 2026-06-25, EC2/EC8):** σε **σειρά συγγραμμικών** στηρίξεων (π.χ. 4 κολόνες
 * 1-2-3-4 σε ευθεία), το δοκάρι **ΔΕΝ** γεφυρώνει το ακραίο ζεύγος (1↔4) προσπερνώντας τις ενδιάμεσες —
 * αυτό είναι στατικά λάθος (χάνεται η στήριξη + ο αντισεισμικός κόμβος δοκού-υποστυλώματος). Σωστό =
 * **ένα δοκάρι ανά φάτνωμα** μεταξύ **διαδοχικών** στηρίξεων (συνεχής δοκός = N διακριτά ανοίγματα, EC8
 * ικανοτικός σχεδιασμός στον κάθε κόμβο). Δύο λειτουργίες:
 *   · `resolveBeamSpanSnap` — **per-bay**: το φάτνωμα (διαδοχικό ζεύγος) που περικλείει τον cursor. Απορρίπτει
 *     κάθε ζεύγος που έχει **τρίτη στήριξη ανάμεσα** (θα γεφυρωνόταν από πάνω της).
 *   · `resolveBeamSpanChain` — **whole-line** (Shift): όλα τα διαδοχικά φατνώματα της ευθείας (N δοκάρια).
 *
 * **Γεωμετρία (Revit «centerline trimmed-to-face»):** άξονας = νοητή ευθεία **κέντρο→κέντρο** (`u`)· τα
 * centerline άκρα = η ακραία προβολή κάθε outline στον `u`, **προς** το άλλο μέλος (`projectPolygonOnAxis`).
 * Orientation-agnostic. **FULL SSoT reuse:** κέντρο = `polygon2DCentroid`· προβολές = `projectPolygonOnAxis`/
 * `projectPointOnAxis`· vector-math = `geometry-vector-utils` (ΟΧΙ inline math)· guide = `PlacementAlignmentGuide`.
 * Pure (zero React/DOM/store). Ένα μέλος = το **κλειστό outline του** (κολόνα → footprint· τοίχος → ring).
 *
 * **ADR-529 Φ1 (bugfix κοίλα/Γ μέλη + cursor-ΣΤΗΝ-παρειά):** η αρχική υλοποίηση όριζε τον άξονα ζεύγους
 * ως **centroid→centroid** + facing παρειά = `projectPolygonOnAxis(ΟΛΟ το outline)`. Για **κοίλο/Γ** μέλος
 * (αμβλεία γωνία) το centroid πέφτει στην εσοχή → ο άξονας γέρνει → ο cursor στην ανατολική παρειά του
 * **οριζόντιου σκέλους** βγαίνει κάθετα μακριά (perp>capture) ή το start πέφτει σε λάθος NS. Επιπλέον, ο
 * cursor **ΠΑΝΩ/μέσα** σε μια παρειά (όχι στο γεωμετρικό κενό) απορριπτόταν (`along<sA`). Δύο διορθώσεις,
 * orientation-agnostic & μηδέν regression για κυρτά/ευθυγραμμισμένα μέλη (ισοδύναμο by construction):
 *   1. **Facing-point άξονας** — ο άξονας ορίζεται από τα **πλησιέστερα σημεία των δύο outlines** (το
 *      σκέλος/παρειά που «κοιτάζει» το άλλο μέλος), όχι από τα centroids. Για κυρτό ευθυγραμμισμένο ζεύγος
 *      το facing-point πέφτει στο μέσο της αντικριστής παρειάς ⇒ **ίδιο** u/start/end με πριν.
 *   2. **Along-margin** — ο cursor μετράει ως «σε αυτό το φάτνωμα» και όταν είναι **πάνω/λίγο μέσα** σε
 *      παρειά μέλους (`along ∈ [sA−capture, sB+capture]`), όχι μόνο αυστηρά στο κενό.
 *   3. **Face-perpendicular προτεραιότητα** — ζεύγη με άξονα **κάθετο σε παρειά** (face-to-face) προηγούνται
 *      των **λοξών γωνία-σε-γωνία** (το λοξό μένει fallback). Έτσι η ανατ. παρειά τοίχου → δυτ. παρειά
 *      αντικριστής κολόνας υπερισχύει της σπάνιας λοξής ανίχνευσης σε διαγώνια κολόνα.
 *
 * **ADR-529 Φ3 — justified third-alignment (cursor-driven, mirror 9-λαβών κολόνας):** το **κάθετο offset**
 * του δοκαριού ακολουθεί τη θέση του cursor κατά μήκος της facing-παρειάς που κοιτάζει: **lo → νότια-flush**
 * (όψη δοκαριού στη νότια παρειά μέλους), **mid → κεντραρισμένο** στον άξονα της παρειάς, **hi → βόρεια-flush**.
 * Reuse `pickThird` (SSoT). Χρειάζεται `beamWidthMm` (ημι-πλάτος = offset flush)· `0` → χωρίς justify (centered,
 * back-compat). Whole-line (Shift) → πάντα centered.
 *
 * @see ../columns/column-beam-corner-snap.ts — το αντίστροφο πρότυπο (L-κολόνα γεμίζει γωνιακό κενό)
 * @see ../columns/column-beam-promote-junction.ts — ADR-529 Φ2 (δοκάρι ΠΡΟΑΓΕΙ Ι-κολόνα σε Γ)
 * @see ../geometry/shared/polygon-axis-projection.ts — projectPolygonOnAxis/projectPointOnAxis (SSoT)
 * @see ../geometry/shared/polygon-utils.ts — polygon2DCentroid (SSoT κέντρο 2D πολυγώνου)
 * @see ./placement-alignment-guide.ts — PlacementAlignmentGuide (canonical SSoT, paint pipeline)
 * @see ../../placement/bim-cursor-snap.ts — ο εγκέφαλος (beam branch, gated `beamSpanGhost`)
 * @see docs/centralized-systems/reference/adrs/ADR-528-beam-auto-span-between-structural-members.md
 * @see docs/centralized-systems/reference/adrs/ADR-529-beam-promotes-corner-column-to-boundary-element.md
 */

import type { Point2D } from '../../rendering/types/Types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { polygon2DCentroid } from '../geometry/shared/polygon-utils';
import { projectPolygonOnAxis, projectPointOnAxis } from '../geometry/shared/polygon-axis-projection';
import { MEMBER_GHOST_CAPTURE_MM } from './member-column-face-snap';
import { pickThird } from './member-face-third';
import type { PlacementAlignmentGuide } from './placement-alignment-guide';
import type { GhostFaceFrame } from './linear-member-face-snap';
import type { SceneSnapTargets } from './scene-snap-targets';
import { subtractPoints, addPoints, scalePoint } from '../../rendering/entities/shared/geometry-vector-utils';

/** Πόσο κοντά (mm) στη **νοητή ευθεία** κέντρο→κέντρο πρέπει να φτάσει ο cursor / να βρίσκεται στήριξη. */
const SPAN_CAPTURE_MM = MEMBER_GHOST_CAPTURE_MM; // 600mm (tunable — ίδιο SSoT με τα υπόλοιπα member captures)
const EPS = 1e-6;
/** |u·edge| ≤ αυτό ⇒ ο άξονας span είναι **κάθετος σε παρειά** (~20°· sin20°≈0.342) → «κανονικό» framing. */
const FACE_PERP_SIN = 0.342;

/** Αποτέλεσμα auto-span: τα δύο centerline άκρα (flush στις παρειές) + οδηγός + nearest-wins dist. */
export interface BeamSpanSnap {
  /** Centerline START — flush στην αντικριστή παρειά του μέλους A (world/scene units). */
  readonly start: Point2D;
  /** Centerline END — flush στην αντικριστή παρειά του μέλους B. */
  readonly end: Point2D;
  /** Η νοητή ευθεία κέντρο→κέντρο (dashed οδηγός) — canonical SSoT `PlacementAlignmentGuide`. */
  readonly guide: PlacementAlignmentGuide;
  /** Κάθετη απόσταση cursor → νοητή ευθεία (nearest-wins με άλλα ζεύγη/tiers· 0 στο whole-line chain). */
  readonly dist: number;
  /**
   * ADR-529 Φ3 — `GhostFaceFrame` της facing-παρειάς που κοιτάζει ο cursor → οι **σιελ listening dimensions**
   * (leftGap/rightGap/centerToCenter) εμφανίζονται ΚΑΙ στο auto-span (ίδιο SSoT με τον T-framing), δείχνοντας
   * ζωντανά το justified alignment (νότια/κέντρο/βόρεια). `undefined` στο whole-line chain (centered).
   */
  readonly faceFrame?: GhostFaceFrame;
}

/** Υποψήφιο μέλος-στήριγμα: κέντρο (centroid) + κλειστό outline (scene units). */
interface SpanSupport {
  readonly center: Point2D;
  readonly outline: readonly Point2D[];
}

/**
 * Πλαίσιο ζεύγους κατά τον άξονα `u` (facing-point A → facing-point B, ADR-529 Φ1), με τις αντικριστές
 * παρειές `sA`/`sB` μετρημένες από το **facing-point του A** (`origin`).
 */
interface PairFrame {
  readonly origin: Point2D; // facing-point του A (το σημείο της παρειάς που «κοιτάζει» το B)
  readonly u: Point2D;
  readonly sA: number; // αντικριστή παρειά A (προς B) — along από `origin`
  readonly sB: number; // αντικριστή παρειά B (προς A) — along από `origin`
  /**
   * ADR-529 Φ2-refine — `true` όταν ο άξονας `u` είναι **κάθετος σε παρειά (ακμή) ≥ ενός μέλους** (το
   * facing-point πέφτει σε **εσωτερικό ακμής**, όχι κορυφή): «κανονικό» framing κάθετα σε παρειά. `false` =
   * **λοξό γωνία-σε-γωνία** (το facing-point είναι κορυφή). Προτιμώνται τα face-aligned ζεύγη (το λοξό μένει
   * fallback) → η ανατ. παρειά τοίχου → δυτ. παρειά κολόνας υπερισχύει της λοξής γωνία-με-γωνία.
   */
  readonly faceAligned: boolean;
  /** ADR-529 Φ3 — facing-point του B (για επιλογή «ποιο μέλος κοιτάζει ο cursor» στο justified alignment). */
  readonly fB: Point2D;
  /** Άκρα της facing-ακμής του A / B (για justified third-alignment: βόρεια-flush / κέντρο / νότια-flush). */
  readonly faceA: readonly [Point2D, Point2D];
  readonly faceB: readonly [Point2D, Point2D];
}

/**
 * SSoT collector των outlines δομικών μελών-στηρίξεων από το scene store: κολόνες (`footprints`) +
 * τοίχοι (`wallTargets.outline`). **ΕΝΑ σημείο** ώστε preview (εγκέφαλος) + commit (`useBeamTool`) να
 * δίνουν ΤΑΥΤΟΣΗΜΟ σύνολο στηρίξεων (preview ≡ commit). Pure. Επεκτάσιμο σε δοκάρια (additive).
 */
export function collectSpanSupportOutlines(targets: Readonly<SceneSnapTargets>): (readonly Point2D[])[] {
  return [...targets.footprints, ...targets.wallTargets.map((w) => w.outline)];
}

/** Χτίζει supports (centroid + outline) από outlines, αγνοώντας εκφυλισμένα (<3 κορυφές). */
function buildSupports(supportOutlines: readonly (readonly Point2D[])[]): SpanSupport[] {
  return supportOutlines
    .filter((o) => o.length >= 3)
    .map((outline) => ({ center: polygon2DCentroid(outline), outline }));
}

/**
 * Πλησιέστερο σημείο ευθυγράμμου τμήματος `[a,b]` στο `p` (clamped στα άκρα). Pure SSoT-local (ADR-529 Φ1):
 * δεν εισάγουμε το `systems/guides/projectPointOnSegment` (λάθος layer — θα έσπαγε το bim→systems decoupling,
 * όπως ο cross2D στο `column-beam-corner-snap`). Μικρό, καθαρό, single-consumer.
 */
function closestPointOnSegment(p: Point2D, a: Point2D, b: Point2D): Point2D {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 < EPS) return { x: a.x, y: a.y };
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/** Πλησιέστερο σημείο του περιγράμματος + η ακμή (unit dir + άκρα) πάνω στην οποία πέφτει. */
interface OutlineHit {
  readonly point: Point2D;
  readonly edge: Point2D;            // unit dir της ακμής (για το face-perpendicular gate)
  readonly seg: readonly [Point2D, Point2D]; // άκρα της ακμής (για το justified third-alignment)
}

/** Πλησιέστερο σημείο του **περιγράμματος** (κλειστού πολυγώνου) στο `target` — η παρειά που «κοιτάζει». */
function closestPointOnOutline(outline: readonly Point2D[], target: Point2D): OutlineHit {
  let best = outline[0];
  let bestEdge: Point2D = { x: 1, y: 0 };
  let bestSeg: readonly [Point2D, Point2D] = [outline[0], outline[0]];
  let bestD = Infinity;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const q = closestPointOnSegment(target, a, b);
    const d = (q.x - target.x) ** 2 + (q.y - target.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = q;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      bestEdge = len > EPS ? { x: (b.x - a.x) / len, y: (b.y - a.y) / len } : { x: 1, y: 0 };
      bestSeg = [a, b];
    }
  }
  return { point: best, edge: bestEdge, seg: bestSeg };
}

/**
 * Πλαίσιο ζεύγους (A,B): **facing-point άξονας** (ADR-529 Φ1) + αντικριστές παρειές. Ο άξονας ορίζεται από
 * τα πλησιέστερα σημεία των δύο outlines (η παρειά/σκέλος που κοιτάζει το άλλο μέλος) → ορθό και για **κοίλα/Γ**
 * μέλη (το centroid θα έγερνε τον άξονα). Fallback σε centroid→centroid αν τα facing-points ταυτίζονται.
 * `null` αν δεν υπάρχει καθαρό κενό. Οι παρειές `sA`/`sB` μετριούνται από το `origin` (= facing-point A).
 */
function pairFrame(A: SpanSupport, B: SpanSupport): PairFrame | null {
  // 2-step refinement: seed από centroids → fA από closest(A,B.center)· fB από closest(B,fA)· ξανά fA από
  // closest(A,fB). Για ισχυρά κοίλα μέλη (Γ) το centroid-target άφηνε υπόλοιπη κλίση· το refinement το λύνει.
  // Κυρτά/ευθυγραμμισμένα → σταθερό σημείο (ίδιο αποτέλεσμα με πριν, μηδέν regression).
  const fA0 = closestPointOnOutline(A.outline, B.center).point;
  const hB = closestPointOnOutline(B.outline, fA0);
  const hA = closestPointOnOutline(A.outline, hB.point);
  const fA = hA.point;
  const fB = hB.point;
  let d = subtractPoints(fB, fA);
  let D = Math.hypot(d.x, d.y);
  if (D < EPS) {
    d = subtractPoints(B.center, A.center); // fallback (επικάλυψη / ταυτισμένα facing-points)
    D = Math.hypot(d.x, d.y);
    if (D < EPS) return null;
  }
  const u: Point2D = { x: d.x / D, y: d.y / D };
  // Αντικριστές παρειές = ακραίες προβολές κάθε outline στον `u` (ΑΠΟ το ΚΟΙΝΟ origin `fA`), προς το άλλο μέλος.
  const sA = projectPolygonOnAxis(A.outline, fA.x, fA.y, u.x, u.y).alongMax;
  const sB = projectPolygonOnAxis(B.outline, fA.x, fA.y, u.x, u.y).alongMin;
  if (sB <= sA + EPS) return null; // επικάλυψη / μηδέν κενό → όχι span
  // ADR-529 Φ2-refine — face-perpendicular: ο `u` ∥ κάθετη ακμής (το facing-point σε εσωτερικό ακμής) ⇒
  // |u·edge|≈0. Λοξό γωνία-σε-γωνία (facing-point = κορυφή) ⇒ |u·edge| μεγάλο. Αρκεί ≥1 μέλος face-aligned.
  const faceAligned =
    Math.abs(u.x * hA.edge.x + u.y * hA.edge.y) <= FACE_PERP_SIN ||
    Math.abs(u.x * hB.edge.x + u.y * hB.edge.y) <= FACE_PERP_SIN;
  return { origin: fA, u, sA, sB, faceAligned, fB, faceA: hA.seg, faceB: hB.seg };
}

/**
 * ADR-529 Φ3 — **justified perp offset** (cross-axis) του δοκαριού βάσει της θέσης του cursor κατά μήκος της
 * facing-παρειάς που κοιτάζει (lo→νότια-flush / mid→κεντραρισμένο στον άξονα παρειάς / hi→βόρεια-flush),
 * mirror των 9 λαβών κολόνας (reuse `pickThird` SSoT). Επιλέγεται η παρειά του μέλους που είναι **πλησιέστερο
 * στον cursor** (A ή B). `beamHalfWidthScene` = ημι-πλάτος δοκαριού (flush = όψη δοκαριού πάνω στην παρειά·
 * αν η παρειά στενότερη του δοκαριού → κέντρο). Επιστρέφει το offset κατά την κάθετο `perpDir` (από το `origin`).
 */
function spanJustification(
  fr: PairFrame,
  cursor: Readonly<Point2D>,
  beamHalfWidthScene: number,
): { perpOffset: number; faceFrame: GhostFaceFrame } {
  const axisDir: Point2D = { x: -fr.u.y, y: fr.u.x }; // κατά μήκος της παρειάς (⊥ άξονα δοκαριού)
  // Παρειά του μέλους πλησιέστερου στον cursor (A=origin ή B=fB).
  const useA = (cursor.x - fr.origin.x) ** 2 + (cursor.y - fr.origin.y) ** 2
    <= (cursor.x - fr.fB.x) ** 2 + (cursor.y - fr.fB.y) ** 2;
  const base = useA ? fr.origin : fr.fB;
  const [e0, e1] = useA ? fr.faceA : fr.faceB;
  const alongFrom = (p: Point2D, ref: Point2D): number => (p.x - ref.x) * axisDir.x + (p.y - ref.y) * axisDir.y;
  const fp0 = alongFrom(e0, base);
  const fp1 = alongFrom(e1, base);
  const faceLo = Math.min(fp0, fp1);
  const faceHi = Math.max(fp0, fp1);
  // Justified κέντρο δοκαριού κατά μήκος της παρειάς (lo/mid/hi)· παρειά στενότερη του δοκαριού → κέντρο.
  const ghostCenterAlong = faceHi - faceLo < 2 * beamHalfWidthScene
    ? (faceLo + faceHi) / 2
    : (() => {
        const third = pickThird(alongFrom(cursor, base), faceLo, faceHi);
        return third === 'lo' ? faceLo + beamHalfWidthScene
          : third === 'hi' ? faceHi - beamHalfWidthScene
          : (faceLo + faceHi) / 2;
      })();
  // perpOffset (κατά axisDir) ΣΕ ΣΧΕΣΗ ΜΕ fr.origin (το spanGeometryFromFrame μετατοπίζει από εκεί).
  const perpOffset = ghostCenterAlong + alongFrom(base, fr.origin);
  const faceFrame: GhostFaceFrame = {
    origin: base,
    axisDir,
    perpDir: { x: fr.u.x, y: fr.u.y }, // = (axisDir.y, −axisDir.x) — «προς τα έξω» (φορά δοκαριού)
    facePerp: 0,
    outwardSign: 1,
    faceAlongMin: faceLo,
    faceAlongMax: faceHi,
    ghostCenterAlong,
    ghostHalfWidth: beamHalfWidthScene,
  };
  return { perpOffset, faceFrame };
}

/** Span γεωμετρία (start/end flush + guide) από έτοιμο frame, με προαιρετικό κάθετο offset (justified). */
function spanGeometryFromFrame(
  fr: PairFrame,
  cA: Point2D,
  cB: Point2D,
  perpOffset: number,
): Omit<BeamSpanSnap, 'dist'> {
  const off: Point2D = { x: -fr.u.y * perpOffset, y: fr.u.x * perpOffset }; // κατά την κάθετο (perpDir·offset)
  return {
    start: addPoints(addPoints(fr.origin, scalePoint(fr.u, fr.sA)), off),
    end: addPoints(addPoints(fr.origin, scalePoint(fr.u, fr.sB)), off),
    guide: { a: cA, b: cB }, // ο dashed οδηγός μένει κέντρο→κέντρο (σταθερό whole-line seed)
  };
}

/**
 * `true` αν υπάρχει **τρίτη στήριξη ανάμεσα** στο ζεύγος (A,B) πάνω στη νοητή ευθεία — δηλ. το ζεύγος
 * **δεν είναι διαδοχικό** και ένα ενιαίο δοκάρι θα γεφύρωνε από πάνω της (στατικά λάθος). Μια στήριξη `k`
 * είναι «ανάμεσα» όταν το κέντρο της προβάλλεται **εντός** του κενού `(sA,sB)` ΚΑΙ είναι **κάθετα κοντά**
 * στη νοητή ευθεία (ίδια ευθεία, όχι άσχετο μέλος στο πλάι).
 */
function hasSupportBetween(
  A: SpanSupport,
  B: SpanSupport,
  fr: PairFrame,
  supports: readonly SpanSupport[],
  captureScene: number,
): boolean {
  for (const k of supports) {
    if (k === A || k === B) continue;
    const p = projectPointOnAxis(k.center.x, k.center.y, fr.origin.x, fr.origin.y, fr.u.x, fr.u.y);
    if (p.perp <= captureScene && p.along > fr.sA + EPS && p.along < fr.sB - EPS) return true;
  }
  return false;
}

/**
 * **Per-bay** auto-span: επιλέγει το **φάτνωμα διαδοχικών στηρίξεων** που περικλείει τον cursor (ο cursor
 * στο κενό + κάθετα κοντά στη νοητή ευθεία), απορρίπτοντας κάθε ζεύγος με **τρίτη στήριξη ανάμεσα**
 * (ποτέ span πάνω από ενδιάμεση κολόνα/τοίχο — EC2/EC8). **Ranking (ADR-529 Φ2-refine):** face-aligned
 * ζεύγη (κάθετα σε παρειά) προηγούνται των λοξών γωνία-σε-γωνία· εντός ίδιας κλάσης, nearest-wins ως προς
 * κάθετη απόσταση. Pure. `null` όταν κανένα διαδοχικό ζεύγος δεν γεφυρώνεται. Ένα μέλος = το κλειστό outline του.
 */
export function resolveBeamSpanSnap(
  cursor: Readonly<Point2D>,
  supportOutlines: readonly (readonly Point2D[])[],
  sceneUnits: SceneUnits,
  beamWidthMm: number = 0,
): BeamSpanSnap | null {
  const supports = buildSupports(supportOutlines);
  if (supports.length < 2) return null;
  const f = mmToSceneUnits(sceneUnits);
  const captureScene = SPAN_CAPTURE_MM * f;
  const beamHalfWidthScene = (beamWidthMm / 2) * f;

  let best: BeamSpanSnap | null = null;
  let bestFace = false;
  for (let i = 0; i < supports.length; i++) {
    for (let j = i + 1; j < supports.length; j++) {
      const A = supports[i];
      const B = supports[j];
      const fr = pairFrame(A, B);
      if (!fr) continue;
      // ADR-529 Φ1 — ο cursor μετράει «σε αυτό το φάτνωμα» στο κενό ΑΛΛΑ ΚΑΙ ΠΑΝΩ/λίγο μέσα σε παρειά μέλους
      // (along-margin = capture), όχι μόνο αυστηρά ανάμεσα στις παρειές· ΚΑΙ κάθετα κοντά στη νοητή ευθεία.
      const cp = projectPointOnAxis(cursor.x, cursor.y, fr.origin.x, fr.origin.y, fr.u.x, fr.u.y);
      if (cp.along < fr.sA - captureScene || cp.along > fr.sB + captureScene) continue;
      if (cp.perp > captureScene) continue;
      // ADR-528 §adjacency — απόρριψη μη-διαδοχικού ζεύγους (τρίτη στήριξη ανάμεσα).
      if (hasSupportBetween(A, B, fr, supports, captureScene)) continue;
      // ADR-529 Φ3 — justified third-alignment: το κάθετο offset του δοκαριού ακολουθεί τη θέση του cursor
      // κατά μήκος της facing-παρειάς (νότια-flush / κέντρο / βόρεια-flush), mirror των 9 λαβών κολόνας.
      // Το `faceFrame` δίνει τις **σιελ listening dimensions** (ίδιο SSoT με τον T-framing).
      const { perpOffset, faceFrame } = spanJustification(fr, cursor, beamHalfWidthScene);
      const geom = spanGeometryFromFrame(fr, A.center, B.center, perpOffset);
      // ADR-529 Φ2-refine ranking: (1) face-aligned νικά λοξό γωνία-σε-γωνία ανεξαρτήτως perp· (2) ίδια κλάση
      // → μικρότερο perp. Το λοξό μένει fallback (επιλέγεται μόνο αν δεν υπάρχει face-aligned υποψήφιο).
      const better = !best
        || (fr.faceAligned && !bestFace)
        || (fr.faceAligned === bestFace && cp.perp < best.dist);
      if (better) {
        best = { ...geom, faceFrame, dist: cp.perp };
        bestFace = fr.faceAligned;
      }
    }
  }
  return best;
}

/**
 * **Whole-line** auto-span (Shift): όλα τα **διαδοχικά φατνώματα** της ευθείας συγγραμμικών στηρίξεων που
 * περιέχει τον cursor → **N δοκάρια** (1-2, 2-3, 3-4, …), καθένα flush στις παρειές του. Στατικά = συνεχής
 * δοκός N ανοιγμάτων. Pure. Άδειος πίνακας όταν ο cursor δεν είναι σε νοητή ευθεία ζεύγους.
 *
 * Η ευθεία ορίζεται από το per-bay φάτνωμα του cursor (διεύθυνση + origin)· μαζεύονται όλες οι στηρίξεις
 * **κάθετα κοντά** σε αυτήν, ταξινομούνται κατά μήκος, και κάθε διαδοχικό ζεύγος δίνει ένα δοκάρι.
 */
export function resolveBeamSpanChain(
  cursor: Readonly<Point2D>,
  supportOutlines: readonly (readonly Point2D[])[],
  sceneUnits: SceneUnits,
): BeamSpanSnap[] {
  const bay = resolveBeamSpanSnap(cursor, supportOutlines, sceneUnits);
  if (!bay) return [];
  const captureScene = SPAN_CAPTURE_MM * mmToSceneUnits(sceneUnits);
  // Ευθεία = (origin=guide.a, u=guide.a→guide.b) του φατνώματος του cursor.
  const origin = bay.guide.a;
  const d = subtractPoints(bay.guide.b, origin);
  const D = Math.hypot(d.x, d.y);
  if (D < EPS) return [{ ...bay }];
  const u: Point2D = { x: d.x / D, y: d.y / D };

  // Στηρίξεις κάθετα κοντά στην ευθεία → ταξινόμηση κατά μήκος (along).
  const onLine = buildSupports(supportOutlines)
    .map((s) => ({ s, p: projectPointOnAxis(s.center.x, s.center.y, origin.x, origin.y, u.x, u.y) }))
    .filter((e) => e.p.perp <= captureScene)
    .sort((a, b) => a.p.along - b.p.along);

  const out: BeamSpanSnap[] = [];
  for (let t = 0; t < onLine.length - 1; t++) {
    const A = onLine[t].s;
    const B = onLine[t + 1].s;
    const fr = pairFrame(A, B);
    // Whole-line: κεντραρισμένο (perpOffset 0) — η συνεχής δοκός ακολουθεί τη νοητή ευθεία, χωρίς per-bay justify.
    if (fr) out.push({ ...spanGeometryFromFrame(fr, A.center, B.center, 0), dist: 0 });
  }
  return out;
}
