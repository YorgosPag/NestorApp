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
 * @see ../columns/column-beam-corner-snap.ts — το αντίστροφο πρότυπο (L-κολόνα γεμίζει γωνιακό κενό)
 * @see ../geometry/shared/polygon-axis-projection.ts — projectPolygonOnAxis/projectPointOnAxis (SSoT)
 * @see ../geometry/shared/polygon-utils.ts — polygon2DCentroid (SSoT κέντρο 2D πολυγώνου)
 * @see ./placement-alignment-guide.ts — PlacementAlignmentGuide (canonical SSoT, paint pipeline)
 * @see ../../placement/bim-cursor-snap.ts — ο εγκέφαλος (beam branch, gated `beamSpanGhost`)
 * @see docs/centralized-systems/reference/adrs/ADR-528-beam-auto-span-between-structural-members.md
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

/** Πλαίσιο ζεύγους κατά τον άξονα `u` (κέντρο A → κέντρο B), με τις αντικριστές παρειές `sA`/`sB`. */
interface PairFrame {
  readonly u: Point2D;
  readonly sA: number; // αντικριστή παρειά A (προς B) — along από A.center
  readonly sB: number; // αντικριστή παρειά B (προς A) — along από A.center
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

/** Πλαίσιο ζεύγους (A,B): άξονας κέντρο→κέντρο + αντικριστές παρειές. `null` αν δεν υπάρχει καθαρό κενό. */
function pairFrame(A: SpanSupport, B: SpanSupport): PairFrame | null {
  const d = subtractPoints(B.center, A.center);
  const D = Math.hypot(d.x, d.y);
  if (D < EPS) return null; // ταυτισμένα κέντρα
  const u: Point2D = { x: d.x / D, y: d.y / D };
  // Αντικριστές παρειές = ακραίες προβολές κάθε outline στον `u`, προς το άλλο μέλος.
  const sA = projectPolygonOnAxis(A.outline, A.center.x, A.center.y, u.x, u.y).alongMax;
  const sB = D + projectPolygonOnAxis(B.outline, B.center.x, B.center.y, u.x, u.y).alongMin;
  if (sB <= sA + EPS) return null; // επικάλυψη / μηδέν κενό → όχι span
  return { u, sA, sB };
}

/** Span γεωμετρία (start/end flush + guide) ενός ζεύγους. `null` αν δεν υπάρχει κενό. */
function spanGeometry(A: SpanSupport, B: SpanSupport): Omit<BeamSpanSnap, 'dist'> | null {
  const fr = pairFrame(A, B);
  if (!fr) return null;
  return {
    start: addPoints(A.center, scalePoint(fr.u, fr.sA)),
    end: addPoints(A.center, scalePoint(fr.u, fr.sB)),
    guide: { a: A.center, b: B.center },
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
    const p = projectPointOnAxis(k.center.x, k.center.y, A.center.x, A.center.y, fr.u.x, fr.u.y);
    if (p.perp <= captureScene && p.along > fr.sA + EPS && p.along < fr.sB - EPS) return true;
  }
  return false;
}

/**
 * **Per-bay** auto-span: επιλέγει το **φάτνωμα διαδοχικών στηρίξεων** που περικλείει τον cursor (ο cursor
 * στο κενό + κάθετα κοντά στη νοητή ευθεία), απορρίπτοντας κάθε ζεύγος με **τρίτη στήριξη ανάμεσα**
 * (ποτέ span πάνω από ενδιάμεση κολόνα/τοίχο — EC2/EC8). Nearest-wins ως προς κάθετη απόσταση. Pure.
 * `null` όταν κανένα διαδοχικό ζεύγος δεν γεφυρώνεται. Ένα μέλος = το κλειστό outline του.
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
  for (let i = 0; i < supports.length; i++) {
    for (let j = i + 1; j < supports.length; j++) {
      const A = supports[i];
      const B = supports[j];
      const fr = pairFrame(A, B);
      if (!fr) continue;
      // Ο cursor πρέπει να είναι ΣΤΟ κενό (ανάμεσα στις παρειές) ΚΑΙ κάθετα κοντά στη νοητή ευθεία.
      const cp = projectPointOnAxis(cursor.x, cursor.y, A.center.x, A.center.y, fr.u.x, fr.u.y);
      if (cp.along < fr.sA || cp.along > fr.sB) continue;
      if (cp.perp > captureScene) continue;
      // ADR-528 §adjacency — απόρριψη μη-διαδοχικού ζεύγους (τρίτη στήριξη ανάμεσα).
      if (hasSupportBetween(A, B, fr, supports, captureScene)) continue;
      const geom = spanGeometry(A, B);
      if (geom && (!best || cp.perp < best.dist)) best = { ...geom, dist: cp.perp };
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
