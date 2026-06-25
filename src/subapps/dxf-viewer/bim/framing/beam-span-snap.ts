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
import type { PlacementAlignmentGuide } from './placement-alignment-guide';
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

/** Πλησιέστερο σημείο του περιγράμματος + η **μοναδιαία διεύθυνση της ακμής** πάνω στην οποία πέφτει. */
interface OutlineHit {
  readonly point: Point2D;
  readonly edge: Point2D; // unit dir της ακμής στο `point` (για το face-perpendicular gate)
}

/** Πλησιέστερο σημείο του **περιγράμματος** (κλειστού πολυγώνου) στο `target` — η παρειά που «κοιτάζει». */
function closestPointOnOutline(outline: readonly Point2D[], target: Point2D): OutlineHit {
  let best = outline[0];
  let bestEdge: Point2D = { x: 1, y: 0 };
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
    }
  }
  return { point: best, edge: bestEdge };
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
  return { origin: fA, u, sA, sB, faceAligned };
}

/** Span γεωμετρία (start/end flush + guide) ενός ζεύγους. `null` αν δεν υπάρχει κενό. */
function spanGeometry(A: SpanSupport, B: SpanSupport): Omit<BeamSpanSnap, 'dist'> | null {
  const fr = pairFrame(A, B);
  if (!fr) return null;
  return {
    start: addPoints(fr.origin, scalePoint(fr.u, fr.sA)),
    end: addPoints(fr.origin, scalePoint(fr.u, fr.sB)),
    guide: { a: A.center, b: B.center }, // ο dashed οδηγός μένει κέντρο→κέντρο (σταθερό whole-line seed)
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
): BeamSpanSnap | null {
  const supports = buildSupports(supportOutlines);
  if (supports.length < 2) return null;
  const captureScene = SPAN_CAPTURE_MM * mmToSceneUnits(sceneUnits);

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
      const geom = spanGeometry(A, B);
      if (!geom) continue;
      // ADR-529 Φ2-refine ranking: (1) face-aligned νικά λοξό γωνία-σε-γωνία ανεξαρτήτως perp· (2) ίδια κλάση
      // → μικρότερο perp. Το λοξό μένει fallback (επιλέγεται μόνο αν δεν υπάρχει face-aligned υποψήφιο).
      const better = !best
        || (fr.faceAligned && !bestFace)
        || (fr.faceAligned === bestFace && cp.perp < best.dist);
      if (better) {
        best = { ...geom, dist: cp.perp };
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
    const geom = spanGeometry(onLine[t].s, onLine[t + 1].s);
    if (geom) out.push({ ...geom, dist: 0 });
  }
  return out;
}
