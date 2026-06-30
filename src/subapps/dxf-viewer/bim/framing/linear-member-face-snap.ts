/**
 * Linear-member → linear-member face snap — pure SSoT (ADR-508 unified linear-member framing).
 *
 * Γενίκευση του `beam-beam-face-snap` (ADR-398 §3.6) ώστε να εξυπηρετεί **κάθε γραμμικό μέλος**
 * (δοκάρι ΚΑΙ τοίχο) με ΤΑΥΤΟΣΗΜΗ συμπεριφορά φαντάσματος. **Axis-relative** (ΟΧΙ world-bbox):
 * τα μέλη είναι μακρόστενα & πιθανώς υπό γωνία, οπότε το ⊥/∥ κρίνεται από τον **άξονα** του
 * υφιστάμενου μέλους. Όταν το ghost-before-click είναι κοντά σε **υφιστάμενο μέλος**:
 *
 *   · cursor πάνω στο **σώμα** (κατά μήκος) → 🟢 κάθετο Τ-framing στην **πλησιέστερη
 *     μακριά παρειά**· κέντρο άξονα → πλησιέστερη παρειά. Ολίσθηση σε όλο το μήκος
 *     (το `cAlong` ακολουθεί τον — ήδη snapped — cursor).
 *   · cursor **πέρα από κοντή άκρη** → 🔴 συγγραμμική συνέχεια («extend instead»).
 *
 * Reuse `projectPolygonOnAxis` (signed perp έκταση = δύο μακριές παρειές + κοντές άκρες) +
 * `projectPointOnAxis` (cursor along) — ΜΗΔΕΝ νέο projection primitive. Pure — zero React/DOM/
 * store. Μονάδες: **scene units** (axis/outline world-baked· ο caller δίνει `ghostLenScene`/
 * `captureScene`/`memberWidthScene`).
 *
 * @see ./member-column-face-snap.ts — η column αδελφή + ο dispatcher (`resolveMemberGhostSnapFromStore`)
 * @see ../beams/beam-beam-face-snap.ts — thin re-export alias (πίσω συμβατότητα δοκαριού)
 * @see ../geometry/shared/polygon-axis-projection.ts — projectPolygonOnAxis/projectPointOnAxis (SSoT)
 * @see ../ghosts/ghost-status-color.ts — GhostStatus (🟢/🔴)
 * @see docs/centralized-systems/reference/adrs/ADR-508-unified-linear-member-framing.md
 */

import type { Point2D } from '../../rendering/types/Types';
import { projectPolygonOnAxis, projectPointOnAxis } from '../geometry/shared/polygon-axis-projection';
import { coveredIntervals } from '../geometry/shared/segment-polygon-coverage';
import { quantizeMagnitude } from '../../systems/tracking/adaptive-distance-snap';
import type { FootprintBounds, FootprintFace } from '../geometry/shared/footprint-face-frame';
import type { GhostStatus } from '../ghosts/ghost-status-color';
import type { PlacementAlignmentGuide } from './placement-alignment-guide';
import type { StripJustification } from '../types/foundation-types';

/**
 * ADR-398 §3.12 — **καμπύλος στόχος** (κύκλος/τόξο): η αληθινή γεωμετρία περιφέρειας, ώστε οι
 * listening dimensions να μετρούν **μήκος τόξου** (`s=r·θ`) αντί ευθείας χορδής και η dim line να
 * **ακολουθεί την καμπύλη**. Γωνίες σε **μοίρες** (DXF convention, CCW)· κύκλος = `0→360`. Φέρεται
 * αυτούσιο από `circleTargets`/`arcTargets` σε **κάθε** χορδή του ίδιου κύκλου/τόξου (μηδέν νέο math).
 */
export interface ArcMeta {
  readonly center: Point2D;
  readonly radius: number;
  readonly startAngle: number;
  readonly endAngle: number;
}

/** Στόχος face-snap = υφιστάμενο γραμμικό μέλος (axis + outline, scene units). */
export interface LinearMemberSnapTarget {
  readonly id: string;
  /** axisPolyline points (≥2). Ευθύ = 2· καμπύλο = tessellated (χρησιμοποιείται η χορδή). */
  readonly axis: readonly Point2D[];
  /** outline vertices (≥3) — δίνει τις μακριές παρειές + κοντές άκρες μέσω projection. */
  readonly outline: readonly Point2D[];
  /** ADR-398 §3.12 — γεωμετρία περιφέρειας όταν ο στόχος είναι χορδή κύκλου/τόξου (αλλιώς `undefined`). */
  readonly arc?: ArcMeta;
}

/**
 * Πλαίσιο παρειάς για τις **listening dimensions** (ADR-508 §dim) — όλα τα δεδομένα που
 * χρειάζεται ο `resolveGhostFaceDimensions` ώστε να μετρήσει αποστάσεις φαντάσματος → άκρα/κέντρο
 * της παρειάς ΚΑΤΑ ΜΗΚΟΣ του άξονα. Scene units. Εκτίθεται **μόνο** στον 🟢 Τ-framing κλάδο (όπου
 * το φάντασμα γλιστράει πάνω σε παρειά μέλους)· `undefined` σε column/overlap. Είναι ακριβώς οι
 * ποσότητες που **ήδη υπολογίζονται** εσωτερικά — μηδέν νέο projection.
 */
export interface GhostFaceFrame {
  /** axis origin a (axis[0]). */
  readonly origin: Point2D;
  /** unit axis direction u (chord). */
  readonly axisDir: Point2D;
  /** unit perpendicular p = (u.y, −u.x). */
  readonly perpDir: Point2D;
  /** signed κάθετη θέση της παρειάς πάνω στην οποία κάθεται το φάντασμα. */
  readonly facePerp: number;
  /** φορά «προς τα έξω» (παρειά → φάντασμα) = `outwardSign · perpDir`. */
  readonly outwardSign: number;
  /** διαμήκης θέση του ΑΡΙΣΤΕΡΟΥ άκρου της παρειάς (alongMin). */
  readonly faceAlongMin: number;
  /** διαμήκης θέση του ΔΕΞΙΟΥ άκρου της παρειάς (alongMax). */
  readonly faceAlongMax: number;
  /** διαμήκης θέση του ΑΞΟΝΑ του φαντάσματος (centerAlong). */
  readonly ghostCenterAlong: number;
  /** μισό πλάτος φαντάσματος → οι base γωνίες = centerAlong ± αυτό. */
  readonly ghostHalfWidth: number;
  /**
   * ADR-398 §3.20b — **προσημασμένη κάθετη απόσταση** (κατά `perpDir`) του ΚΕΝΤΡΟΥ του φαντάσματος από
   * τη γραμμή αναφοράς (`facePerp`-line). Όταν οριστεί (≠0), ο `resolveGhostFaceDimensions` εκπέμπει μια
   * επιπλέον **κάθετη (dy)** listening dimension (πλήρες καρτεσιανό dx+dy). Χρησιμοποιείται από το
   * circumference-tangent (§3.19): η κυκλική ολισθαίνει με σταθερό perp = R → δείχνει το κάθετο offset.
   * `undefined`/0 → καμία κάθετη dim (όλοι οι υπόλοιποι callers αμετάβλητοι). */
  readonly ghostPerpOffset?: number;
  /**
   * ADR-398 §3.12 — γεωμετρία περιφέρειας όταν η παρειά προέρχεται από **χορδή κύκλου/τόξου**. Όταν
   * οριστεί, ο `resolveGhostFaceDimensions` περνά στον arc-length κλάδο (μήκος τόξου + καμπύλη dim line)·
   * `undefined` σε ευθείς στόχους → αμετάβλητη ευθεία συμπεριφορά (gated).
   */
  readonly arc?: ArcMeta;
}

/** Αποτέλεσμα ghost snap: το centerline start/end + το σημασιολογικό status (🟢/🔴/ουδέτερο). */
export interface MemberGhostSnapResult {
  /** Centerline START (κλειδώνει το 1ο κλικ· πατά flush στην παρειά / κοντή άκρη). */
  readonly start: Point2D;
  /** Centerline END (μικρό ghost προς τα έξω — κάθετα στην παρειά ή συγγραμμικά στο άκρο). */
  readonly end: Point2D;
  /** 🟢 `beam` (κάθετο Τ-framing) / 🔴 `overlap` (συγγραμμικό κοντής άκρης) / `neutral`. */
  readonly status: GhostStatus;
  /** Πλαίσιο παρειάς για listening dimensions — μόνο στον 🟢 Τ-framing κλάδο. */
  readonly faceFrame?: GhostFaceFrame;
  /**
   * ADR-508 §opening-conflict — id του **host μέλους** στο οποίο κούμπωσε το ghost (= `target.id`).
   * Revit-grade «reference carries its host»: η ταυτότητα του host καθορίζεται ΕΔΩ ΜΙΑ φορά και
   * διαδίδεται (preview + commit) αντί να ξανα-υπολογίζεται γεωμετρικά. `undefined` σε column-priority
   * snap (κολόνες δεν φιλοξενούν ανοίγματα).
   */
  readonly targetId?: string;
  /**
   * ADR-528 — `true` όταν το placement είναι **πλήρης auto-span** ανάμεσα σε δύο δομικά μέλη (το δοκάρι
   * γεφυρώνει το κενό, `start`/`end` ήδη flush στις αντικριστές παρειές). Σηματοδοτεί στο beam FSM να
   * κάνει **single-click commit** ολόκληρου του span (ΟΧΙ μόνο lock του start). `undefined`/`false` σε
   * κάθε άλλο placement (face-snap/T-framing/overlap) → ο caller κρατά το κανονικό 2-click flow.
   */
  readonly span?: boolean;
  /**
   * ADR-528 — η **νοητή ευθεία** (κέντρο→κέντρο των δύο μελών) ενός auto-span, ως canonical
   * `PlacementAlignmentGuide`. Ζωγραφίζεται από το paint pipeline (ίδιο SSoT με τους column οδηγούς).
   * Παρόν μόνο στο span placement· `undefined` αλλού.
   */
  readonly guide?: PlacementAlignmentGuide;
  /**
   * ADR-529 — **Revit Location-Line justification** ενός auto-span placement ('center'|'left'|'right').
   * Το `start`/`end` είναι ο body axis (για το ghost)· ο commit κάνει `unjustifyAxisPoints` με αυτό
   * ώστε να αποθηκεύσει location line + justification → associative με το πλάτος (north-flush δεν σπάει
   * όταν ο οργανισμός ξανα-διαστασιολογεί). `undefined` σε μη-span placements (centerline ως τώρα).
   */
  readonly justification?: StripJustification;
}

export interface LinearMemberFaceSnapOptions {
  /** Μήκος μικρού φαντάσματος προς τα έξω από την παρειά/άκρη. */
  readonly ghostLenScene: number;
  /** Μέγιστη απόσταση cursor→σώμα μέλους για ενεργοποίηση. */
  readonly captureScene: number;
  /** Πλάτος νέου μέλους (scene units) — για την 3-ζωνική δικαιολόγηση κατά τον άξονα. */
  readonly memberWidthScene: number;
  /**
   * ADR-508 (2026-06-24, Giorgio) — προαιρετική **κυρίαρχη μονάδα διαίρεσης** (scene units· π.χ. 1cm).
   * Η παρειά-στόχος (μήκος `L`) διαιρείται σε `N = round(L / dominantUnitScene)` ίσα τμήματα· το **βήμα
   * ολίσθησης** = `πλάτος_μέλους / N` → πολύ λεπτό → ΟΜΑΛΗ/ΣΥΝΕΧΗΣ κίνηση με ίσο πλήθος υποδιαιρέσεων
   * (βλ. `proportionalSlideStep`). `undefined`/0 ή μηδενικό πλάτος ⇒ καθαρή συνεχής ολίσθηση.
   */
  readonly dominantUnitScene?: number;
}

/**
 * ADR-508 (2026-06-24, Giorgio «συνεχή και ομαλή κίνηση») — **proportional fine slide step**:
 * η κυρίαρχη (μεγάλη) παρειά μήκους `faceLen` διαιρείται ανά `dominantUnit` (π.χ. 1cm) → `N` ίσα
 * τμήματα· το βήμα ολίσθησης = `memberWidth / N`. Παράδειγμα: παρειά 2.5m ÷ 1cm = 250 τμήματα·
 * νέος τοίχος 0.25m ÷ 250 = **1mm βήμα** → οπτικά συνεχές αλλά deterministic/αναλογικό πλέγμα.
 * `undefined` σε degenerate (μηδενικό πλάτος/μήκος/unit) → ο caller πέφτει σε συνεχή ολίσθηση. Pure.
 */
export function proportionalSlideStep(faceLen: number, memberWidth: number, dominantUnit?: number): number | undefined {
  if (!dominantUnit || dominantUnit <= 0 || memberWidth <= 0 || faceLen <= 0) return undefined;
  const n = Math.max(1, Math.round(faceLen / dominantUnit));
  return memberWidth / n;
}

/** Πλαίσιο άξονα ενός υποψήφιου μέλους-στόχου (όλα σε scene units). */
interface TargetFrame {
  readonly a: Point2D; // axis origin (axis[0])
  readonly u: Point2D; // unit axis direction (chord)
  readonly p: Point2D; // unit perpendicular = (u.y, -u.x) — η φορά του signedPerp
  readonly alongMin: number;
  readonly alongMax: number;
  readonly perpMin: number;
  readonly perpMax: number;
  readonly cAlong: number; // cursor διαμήκης θέση
  readonly cPerp: number; // cursor signed κάθετη θέση
  readonly distance: number; // cursor → oriented band απόσταση (0 εντός σώματος)
}

/** Χτίζει το axis frame + προβολές cursor για έναν στόχο· `null` σε εκφυλισμένο άξονα. */
function buildTargetFrame(cursor: Readonly<Point2D>, target: LinearMemberSnapTarget): TargetFrame | null {
  const pts = target.axis;
  const a = pts[0];
  const last = pts[pts.length - 1];
  const dx = last.x - a.x;
  const dy = last.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  const u: Point2D = { x: dx / len, y: dy / len };
  const p: Point2D = { x: u.y, y: -u.x };
  const poly = projectPolygonOnAxis(target.outline, a.x, a.y, u.x, u.y);
  const cAlong = projectPointOnAxis(cursor.x, cursor.y, a.x, a.y, u.x, u.y).along;
  const cPerp = (cursor.x - a.x) * u.y - (cursor.y - a.y) * u.x;
  const alongClamped = Math.min(Math.max(cAlong, poly.alongMin), poly.alongMax);
  const perpClamped = Math.min(Math.max(cPerp, poly.perpMin), poly.perpMax);
  const distance = Math.hypot(cAlong - alongClamped, cPerp - perpClamped);
  return {
    a: { x: a.x, y: a.y },
    u,
    p,
    alongMin: poly.alongMin,
    alongMax: poly.alongMax,
    perpMin: poly.perpMin,
    perpMax: poly.perpMax,
    cAlong,
    cPerp,
    distance,
  };
}

/**
 * Επιλέγει το ghost snap πάνω σε υφιστάμενο γραμμικό μέλος. Pure. `null` όταν κανένα μέλος
 * δεν είναι εντός `captureScene` (ελεύθερη κίνηση → ο caller δείχνει default ghost).
 */
export function resolveLinearMemberFaceSnap(
  cursor: Readonly<Point2D>,
  targets: readonly LinearMemberSnapTarget[],
  opts: Readonly<LinearMemberFaceSnapOptions>,
): MemberGhostSnapResult | null {
  let best: TargetFrame | null = null;
  let bestArc: ArcMeta | undefined; // ADR-398 §3.12 — γεωμετρία περιφέρειας του επιλεγμένου στόχου
  let bestId: string | undefined;   // ADR-508 §opening-conflict — id του επιλεγμένου host μέλους
  for (const t of targets) {
    if (t.axis.length < 2 || t.outline.length < 3) continue;
    const fr = buildTargetFrame(cursor, t);
    if (fr && fr.distance <= opts.captureScene && (!best || fr.distance < best.distance)) {
      best = fr;
      bestArc = t.arc;
      bestId = t.id;
    }
  }
  if (!best) return null;

  const { a, u, p, alongMin, alongMax, perpMin, perpMax, cAlong, cPerp } = best;
  const len = opts.ghostLenScene;
  const mid = (perpMin + perpMax) / 2;

  // ── cursor πάνω στο σώμα → 🟢 κάθετο Τ-framing στην πλησιέστερη μακριά παρειά ──────
  if (cAlong >= alongMin && cAlong <= alongMax) {
    const isSouth = cPerp >= mid; // perpMax = νότια παρειά (signedPerp αντίστροφο του y)
    const nearPerp = isSouth ? perpMax : perpMin; // πλησιέστερη παρειά (κέντρο→«Α»)
    const outwardSign = isSouth ? 1 : -1; // ghost προς τα έξω, μακριά από το κέντρο σώματος
    // ADR-508 (2026-06-24) — **proportional fine βήμα** (Giorgio): η παρειά (μήκος) ÷ 1cm = N· βήμα =
    // πλάτος_μέλους / N → λεπτό → ΟΜΑΛΗ συνεχής κίνηση. Κούμπωσε τη διαμήκη θέση σε πολλαπλάσια αυτού,
    // μένοντας μέσα στο σώμα [alongMin,alongMax]. `undefined` (μηδ. πλάτος/μήκος) → καθαρή συνεχής.
    const step = proportionalSlideStep(alongMax - alongMin, opts.memberWidthScene, opts.dominantUnitScene);
    const slideAlong = step
      ? Math.min(Math.max(quantizeMagnitude(cAlong, step), alongMin), alongMax)
      : cAlong;
    // ADR-508 (2026-06-24, Giorgio «συνεχώς ομαλά») — ΣΥΝΕΧΗΣ centerline: ακολουθεί τον (quantized)
    // cursor, clamped ώστε το μέλος να μένει ΕΝΤΟΣ της παρειάς → `[alongMin+half, alongMax−half]`. Auto
    // edge-flush στα άκρα (centerline=insLo ⇒ πλάγια ακμή flush στην άκρη), ΧΩΡΙΣ τα διακριτά άλματα
    // 3-ζωνικής μετατόπισης/magnet (που «πηδούσαν» άκρες↔κέντρο). Μέλος ευρύτερο από την παρειά
    // (inset ανεστραμμένο) → κεντράρισμα. Το `third` παραμένει ως metadata (faceFrame δεν το χρειάζεται).
    const half = opts.memberWidthScene / 2;
    const insLo = alongMin + half;
    const insHi = alongMax - half;
    const centerAlong = insLo <= insHi
      ? Math.min(Math.max(slideAlong, insLo), insHi)
      : (alongMin + alongMax) / 2;
    const start: Point2D = {
      x: a.x + centerAlong * u.x + nearPerp * p.x,
      y: a.y + centerAlong * u.y + nearPerp * p.y,
    };
    const end: Point2D = {
      x: start.x + outwardSign * len * p.x,
      y: start.y + outwardSign * len * p.y,
    };
    // ADR-508 §dim — εκθέτω το πλαίσιο παρειάς για τις listening dimensions (ίδιες ποσότητες
    // που μόλις υπολογίστηκαν· μηδέν νέο projection). Ο consumer (wall ghost) μετρά αποστάσεις
    // φαντάσματος → άκρα/κέντρο παρειάς κατά μήκος του άξονα u.
    const faceFrame: GhostFaceFrame = {
      origin: { x: a.x, y: a.y },
      axisDir: { x: u.x, y: u.y },
      perpDir: { x: p.x, y: p.y },
      facePerp: nearPerp,
      outwardSign,
      faceAlongMin: alongMin,
      faceAlongMax: alongMax,
      ghostCenterAlong: centerAlong,
      ghostHalfWidth: half,
      arc: bestArc, // §3.12 — κύκλος/τόξο → arc-length listening dims (αλλιώς undefined)
    };
    return { start, end, status: 'beam', faceFrame, targetId: bestId };
  }

  // ── cursor πέρα από κοντή άκρη → 🔴 συγγραμμική συνέχεια («extend instead») ─────────
  const beyondStart = cAlong < alongMin;
  const tEnd = beyondStart ? alongMin : alongMax;
  const dir = beyondStart ? -1 : 1;
  const start: Point2D = {
    x: a.x + tEnd * u.x + mid * p.x,
    y: a.y + tEnd * u.y + mid * p.y,
  };
  const end: Point2D = {
    x: start.x + dir * len * u.x,
    y: start.y + dir * len * u.y,
  };
  return { start, end, status: 'overlap', targetId: bestId };
}

/** Συνημίτονο ορίου «παράλληλων αξόνων» (≈ ±10°). |u₁·u₂| ≥ τιμή ⇒ παράλληλα. */
const PARALLEL_COS = 0.985;

/**
 * `true` αν το νέο μέλος (`start→end`) θα κείτεται **ομοαξονικά / πάνω** σε υφιστάμενο μέλος —
 * duplication, ΟΧΙ έγκυρο κάθετο Τ-framing. Δύο κριτήρια:
 *   1. **παράλληλοι** άξονες (`|u_new·u_target| ≥ PARALLEL_COS`) → αποκλείει το ⊥ Τ-framing,
 *   2. ο **άξονας** του νέου περνά **μέσα** από το outline του υφιστάμενου (on-top) — μέσω του
 *      SSoT `coveredIntervals` (segment ∩ polygon coverage· robust convex/concave).
 *
 * Παράλληλο μέλος **δίπλα** (άξονας εκτός outline) → coverage 0 → false. Άκρο-με-άκρο άγγιγμα
 * (μηδέν coverage) → νόμιμη επέκταση → false. **Reuse** `coveredIntervals`. Pure (scene units).
 */
export function isMemberCollinearOverlap(
  start: Readonly<Point2D>,
  end: Readonly<Point2D>,
  targets: readonly LinearMemberSnapTarget[],
  newHalfScene?: number,
): boolean {
  const ndx = end.x - start.x;
  const ndy = end.y - start.y;
  const nlen = Math.hypot(ndx, ndy);
  if (nlen < 1e-9) return false;
  const nu: Point2D = { x: ndx / nlen, y: ndy / nlen };

  for (const t of targets) {
    if (t.axis.length < 2 || t.outline.length < 3) continue;
    const a = t.axis[0];
    const b = t.axis[t.axis.length - 1];
    const tlen = Math.hypot(b.x - a.x, b.y - a.y);
    if (tlen < 1e-9) continue;
    const tu: Point2D = { x: (b.x - a.x) / tlen, y: (b.y - a.y) / tlen };

    // (1) παράλληλοι άξονες; (αποκλείει κάθετο Τ-framing)
    if (Math.abs(nu.x * tu.x + nu.y * tu.y) < PARALLEL_COS) continue;
    // (2) ο άξονας του νέου περνά ΜΕΣΑ από το outline του υφιστάμενου (on-top) — SSoT
    if (coveredIntervals(start, end, t.outline).length > 0) return true;
    // (3) ADR-508 — body-overlap: όταν δίνεται `newHalfScene` (τοίχος), πιάσε ΚΑΙ την περίπτωση
    //     που ο άξονας του νέου τρέχει στην ΠΑΡΕΙΑ (ακμή outline) του υφιστάμενου — face-anchored
    //     1ο κλικ → ο άξονας στο όριο, αλλά τα ΣΩΜΑΤΑ επικαλύπτονται. Beams (χωρίς newHalfScene)
    //     → αμετάβλητα.
    if (newHalfScene !== undefined && bodyOverlapsAlongMember(start, end, a, tu, t.outline, newHalfScene)) {
      return true;
    }
  }
  return false;
}

/**
 * `true` όταν το παράλληλο νέο μέλος `[start,end]` (μισό πλάτος `newHalf`) επικαλύπτει το ΣΩΜΑ του
 * υφιστάμενου μέλους τόσο κατά τον άξονα ΟΣΟ ΚΑΙ κάθετα — πιάνει το face-anchored (άξονας στην
 * ακμή). «Δίπλα» (κενό faces) ή «άκρο-με-άκρο» → false. Pure (scene units, reuse projections).
 */
function bodyOverlapsAlongMember(
  start: Readonly<Point2D>,
  end: Readonly<Point2D>,
  a: Readonly<Point2D>,
  u: Readonly<Point2D>,
  outline: readonly Point2D[],
  newHalf: number,
): boolean {
  const EPS = 1e-6;
  const poly = projectPolygonOnAxis(outline, a.x, a.y, u.x, u.y);
  const existingHalf = (poly.perpMax - poly.perpMin) / 2;
  const centerPerp = (poly.perpMin + poly.perpMax) / 2;
  // Παράλληλο ⇒ ίδιο perp σε όλο το μήκος· χρησιμοποίησε το μέσο (signed perp = ίδιο frame).
  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;
  const newPerp = (mx - a.x) * u.y - (my - a.y) * u.x;
  // Κάθετη επικάλυψη σωμάτων (αυστηρά — άγγιγμα faces δεν μετράει).
  if (Math.abs(newPerp - centerPerp) >= existingHalf + newHalf - EPS) return false;
  // Διαμήκης επικάλυψη (άκρο-με-άκρο = 0 → false).
  const sA = projectPointOnAxis(start.x, start.y, a.x, a.y, u.x, u.y).along;
  const eA = projectPointOnAxis(end.x, end.y, a.x, a.y, u.x, u.y).along;
  const overlap = Math.min(Math.max(sA, eA), poly.alongMax) - Math.max(Math.min(sA, eA), poly.alongMin);
  return overlap > EPS;
}

/**
 * ADR-508 §dim — `GhostFaceFrame` για listening dimensions πάνω σε **world-aligned bbox** παρειά
 * (κολώνα-στόχος): άξονας κατά μήκος της παρειάς, `ghostHalfWidth=0` (μετράμε προς το ΚΕΝΤΡΟ —
 * Revit centerline). **ΕΝΑ SSoT** μοιρασμένο από «κολώνα → παρειά» (`column-face-snap`, μέσω re-export
 * alias στο `column-face-snap-helpers`) ΚΑΙ «τοίχος/δοκάρι → κολώνα» (`member-column-face-snap`).
 * Ζει εδώ (δίπλα στο `GhostFaceFrame`) ώστε το `bim/framing` να μην εξαρτάται από το `bim/columns`.
 * `position` = θέση centerline φαντάσματος κατά μήκος της παρειάς.
 */
export function buildColumnBboxFaceFrame(b: FootprintBounds, face: FootprintFace, position: Point2D): GhostFaceFrame {
  if (face === 'N' || face === 'S') {
    const faceY = face === 'N' ? b.maxY : b.minY;
    return {
      origin: { x: b.minX, y: faceY }, axisDir: { x: 1, y: 0 }, perpDir: { x: 0, y: -1 },
      facePerp: 0, outwardSign: face === 'N' ? -1 : 1,
      faceAlongMin: 0, faceAlongMax: b.maxX - b.minX,
      ghostCenterAlong: position.x - b.minX, ghostHalfWidth: 0,
    };
  }
  const faceX = face === 'E' ? b.maxX : b.minX;
  return {
    origin: { x: faceX, y: b.minY }, axisDir: { x: 0, y: 1 }, perpDir: { x: 1, y: 0 },
    facePerp: 0, outwardSign: face === 'E' ? 1 : -1,
    faceAlongMin: 0, faceAlongMax: b.maxY - b.minY,
    ghostCenterAlong: position.y - b.minY, ghostHalfWidth: 0,
  };
}

/**
 * ADR-398 §3.11 — **κοινό** centered `GhostFaceFrame` (μοιράζεται §3.9 wall-axis, §3.11 slab-edge ΚΑΙ
 * το §3.9-mirror «τοίχος → κέντρο κολώνας»): το φάντασμα κάθεται ΚΕΝΤΡΑΡΙΣΜΕΝΟ στον άξονα → `facePerp:0`,
 * `ghostHalfWidth:0` (listening dims προς το κέντρο, Revit centerline), `outwardSign:1` (ουδέτερο).
 * Ζει εδώ (δίπλα στο `GhostFaceFrame` + `buildColumnBboxFaceFrame`) ώστε το `bim/framing` να μην
 * εξαρτάται από το `bim/columns`· re-export alias στο `column-face-snap-helpers` για column consumers.
 * Μηδέν διπλό literal (N.0.2).
 */
export function buildCenteredAxisFaceFrame(
  origin: Readonly<Point2D>,
  axisDir: Readonly<Point2D>,
  perpDir: Readonly<Point2D>,
  faceAlongMin: number,
  faceAlongMax: number,
  ghostCenterAlong: number,
  arc?: ArcMeta,
  ghostPerpOffset?: number,
): GhostFaceFrame {
  return {
    origin, axisDir, perpDir,
    facePerp: 0, outwardSign: 1,
    faceAlongMin, faceAlongMax,
    ghostCenterAlong, ghostHalfWidth: 0,
    ...(arc ? { arc } : {}), // ADR-398 §3.12 — κύκλος/τόξο → arc-length listening dims
    // ADR-398 §3.20b — κάθετο (dy) offset κέντρου → επιπλέον κάθετη listening dim (πλήρες καρτεσιανό).
    ...(ghostPerpOffset ? { ghostPerpOffset } : {}),
  };
}
