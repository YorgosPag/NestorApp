/**
 * ADR-458 — Beam-to-column **cutback** (Revit join-geometry, «η κολόνα νικάει»).
 *
 * Beam facade πάνω από το generic `member-column-cutback` SSoT (ADR-458 γενίκευση:
 * beam + wall). Ο πυρήνας κοπής/net-area είναι κοινός· εδώ ζουν ΜΟΝΟ τα **beam-specific**
 * helpers (axis-to-column contact = location-line, framing-end extension) + backward-compat
 * aliases ώστε τα υπάρχοντα beam call-sites να μένουν byte-for-byte αμετάβλητα.
 *
 * **Αρχή — DERIVED, ΠΟΤΕ persisted:** βλ. `member-column-cutback.ts`.
 *
 * @see bim/geometry/member-column-cutback.ts — pure generic SSoT (outline/net/ratio)
 * @see docs/centralized-systems/reference/adrs/ADR-458-beam-column-cutback.md
 * @see bim/geometry/foundation-grid-boq.ts — `foundationStripNetGeometry` (net-volume precedent)
 */

import type { Point3D } from '../types/bim-base';
import {
  pointInPolygon,
  projectPolygonOnAxis,
} from './shared/polygon-utils';
import type { Pt2 } from './shared/segment-polygon-coverage';
import {
  bboxOf,
  bboxOverlap,
  computeMemberCutbackOutline,
  computeMemberCutbackNetAreaM2,
} from './member-column-cutback';

// ─── Backward-compat aliases (beam call-sites) ───────────────────────────────
// Το outline/net-area είναι generic (member ↔ column). Τα beam call-sites/tests
// συνεχίζουν να εισάγουν αυτά τα ονόματα — μηδέν blast radius από τη γενίκευση.

/** Εμβαδόν πολυγώνου (shoelace, canvas units²). */
function ringArea2(r: readonly Pt2[]): number {
  let s = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i];
    const b = r[(i + 1) % r.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s / 2);
}

/** Κλάσμα εμβαδού κάτω από το οποίο ένα cutback-κομμάτι θεωρείται spurious sliver → απορρίπτεται. */
const SLIVER_AREA_FRACTION = 0.02;

/**
 * ADR-458/493 — beam cutback outline + απόρριψη spurious slivers. Η βαθιά «diagonal corner-seat»
 * επέκταση ({@link extendBeamOutlineIntoFramingColumns}) μπορεί να αφήσει μικροσκοπικό ΑΠΟΜΟΝΩΜΕΝΟ
 * κομμάτι στην κοίλη εγκοπή L/Γ κολώνας (over-extension artifact, ADR-529). Κρατά μόνο κομμάτια ≥ 2%
 * του μεγαλύτερου· τα ΓΝΗΣΙΑ mid-span splits (κολόνα που χωρίζει το δοκάρι) είναι συγκρίσιμα → μένουν.
 */
export function computeBeamCutbackOutline(
  memberOutline: readonly Pt2[],
  columnFootprints: readonly (readonly Pt2[])[],
): Pt2[][] | null {
  const pieces = computeMemberCutbackOutline(memberOutline, columnFootprints);
  if (!pieces || pieces.length <= 1) return pieces;
  const areas = pieces.map(ringArea2);
  const maxA = Math.max(...areas);
  const kept = pieces.filter((_, i) => areas[i] >= maxA * SLIVER_AREA_FRACTION);
  return kept.length > 0 ? kept : pieces;
}
/** @see computeMemberCutbackNetAreaM2 — beam alias (ADR-458). */
export const computeBeamCutbackNetAreaM2 = computeMemberCutbackNetAreaM2;

// ─── Axis-to-column contact (centerline) ─────────────────────────────────────

/** Αριθμητικό όριο για μη-εκφυλισμένο t / non-parallel cross product. */
const AXIS_T_EPS = 1e-9;
/**
 * Μέγιστο t για επέκταση άκρου (anti-spurious-extend guard): t≤1.5 → ο άξονας
 * επεκτείνεται το πολύ κατά 50% του μήκους του για να φτάσει σε παρειά κολόνας.
 * Κολόνα που πλαισιώνει άκρο δοκαριού είναι πάντα πολύ πιο κοντά από αυτό.
 */
const AXIS_EXT_CAP = 1.5;

const lerp2 = (a: Pt2, b: Pt2, t: number): Pt2 => ({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });

/**
 * Unclamped παράμετρος `t` κατά μήκος της ευθείας `a→b` (μπορεί <0 ή >1) όπου τέμνει
 * την ακμή `p→q` (κρατάμε μόνο 0≤u≤1, η τομή πέφτει πάνω στην ακμή)· `null` όταν
 * παράλληλες/collinear ή η τομή πέφτει εκτός ακμής.
 */
function lineEdgeT(a: Pt2, b: Pt2, p: { x: number; y: number }, q: { x: number; y: number }): number | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const ex = q.x - p.x;
  const ey = q.y - p.y;
  const denom = dx * ey - dy * ex;
  if (Math.abs(denom) < AXIS_T_EPS) return null;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const u = (apx * dy - apy * dx) / denom; // κατά μήκος ακμής
  if (u < -AXIS_T_EPS || u > 1 + AXIS_T_EPS) return null;
  return (apx * ey - apy * ex) / denom; // κατά μήκος άξονα (unclamped)
}

/** Όλα τα crossings (unclamped t) της ευθείας `a→b` με τις ακμές ΟΛΩΝ των cutters. */
function allLineCrossings(a: Pt2, b: Pt2, cutters: readonly (readonly Point3D[])[]): number[] {
  const ts: number[] = [];
  for (const poly of cutters) {
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const t = lineEdgeT(a, b, poly[i], poly[(i + 1) % n]);
      if (t !== null) ts.push(t);
    }
  }
  return ts;
}

/**
 * Νέα παράμετρος `t` του άκρου `b` (t=1) ώστε ο άξονας `a→b` να καταλήγει στην παρειά
 * της κολόνας που πλαισιώνει αυτό το άκρο. `null` → καμία προσαρμογή.
 *  - `b` ΜΕΣΑ σε κολόνα → pull-back στην εσωτερική παρειά (μεγαλύτερο crossing με t<1).
 *  - `b` έξω, κολόνα πιο πέρα → extend στην κοντινή παρειά (μικρότερο crossing με t>1,
 *    εντός `AXIS_EXT_CAP`).
 */
function contactT(a: Pt2, b: Pt2, cutters: readonly (readonly Point3D[])[]): number | null {
  const ts = allLineCrossings(a, b, cutters);
  if (ts.length === 0) return null;
  const bInside = cutters.some((poly) => pointInPolygon(b, poly));
  if (bInside) {
    let best = -Infinity;
    for (const t of ts) if (t < 1 - AXIS_T_EPS && t > best) best = t;
    return best > -Infinity ? best : null;
  }
  let best = Infinity;
  for (const t of ts) if (t > 1 + AXIS_T_EPS && t < best) best = t;
  return best <= AXIS_EXT_CAP ? best : null;
}

/**
 * Προσαρμόζει τα άκρα του straight-beam centerline ώστε όποιο πλαισιώνεται από κολόνα να
 * καταλήγει ΑΚΡΙΒΩΣ στην παρειά της (σημείο επαφής δοκαριού-κολόνας, Revit location-line).
 *
 * DERIVED — ίδια column footprints με το cutback outline· τα footprints είναι ήδη
 * world-rotated/composite-baked (`computeColumnGeometry`) → λοξά/περιστραμμένα δοκάρια
 * δουλεύουν χωρίς ειδική μεταχείριση. Cheap reject: μόνο κολόνες με bbox που επικαλύπτει
 * το beam outline. Split (κολόνα στη ΜΕΣΗ → 2 ελεύθερα άκρα) → κανένα crossing κοντά σε
 * άκρο → identity (DEFER axis-split).
 *
 * @returns `[newStart, newEnd]` ή `null` (καμία προσαρμογή → ο caller κρατά τον αρχικό άξονα).
 */
export function computeBeamAxisToColumnContact(
  axisStart: Pt2,
  axisEnd: Pt2,
  beamOutline: readonly Pt2[],
  columnFootprints: readonly (readonly Point3D[])[],
): [Pt2, Pt2] | null {
  if (beamOutline.length < 3 || columnFootprints.length === 0) return null;
  const beamBbox = bboxOf(beamOutline);
  const cutters = columnFootprints.filter((fp) => fp.length >= 3 && bboxOverlap(beamBbox, bboxOf(fp)));
  if (cutters.length === 0) return null;

  // Άκρο end (t=1): a=start,b=end. Άκρο start: συμμετρικά με a=end,b=start.
  const tEnd = contactT(axisStart, axisEnd, cutters);
  const tStart = contactT(axisEnd, axisStart, cutters);
  if (tEnd === null && tStart === null) return null;

  return [
    tStart !== null ? lerp2(axisEnd, axisStart, tStart) : axisStart,
    tEnd !== null ? lerp2(axisStart, axisEnd, tEnd) : axisEnd,
  ];
}

// ─── ADR-493 — framing-end extension (Revit-grade derived carve, any face) ────
//
// Πρόβλημα: το persisted άκρο ενός δοκαριού κόβεται στην ΕΠΙΠΕΔΗ παρειά της κολώνας
// (location-line = παρειά, ADR-441/363 §5.7). Όταν η κολώνα γίνει ΚΥΚΛΙΚΗ (ή λοξή/
// σύνθετη), η παρειά ΥΠΟΧΩΡΕΙ ενώ το άκρο μένει ευθύ → beam (έξω) και κολώνα (μέσα)
// εφάπτονται σε ΕΝΑ σημείο → `safeDifference` αφαιρεί ~0 → identity → ευθύ άκρο πάνω
// σε υποχωρούσα άψιδα → ορατό **μηνίσκος-κενό**.
//
// Λύση (Revit «location-line → node, join derived»): πριν το boolean, επέκτεινε ΜΟΝΟ
// το derived carve-outline του πλαισιωμένου άκρου ΕΣΩΤΕΡΙΚΑ μέχρι το ΚΕΝΤΡΟ της κολώνας
// (όχι την απέναντι παρειά — αλλιώς μένουν far-side stubs σε κοίλη/κυκλική παρειά). Το
// `safeDifference` τότε σκαλίζει την ΑΚΡΙΒΗ παρειά (άψιδα/επίπεδη/σύνθετη) για κάθε σχήμα.
// Persisted axis/outline ΑΜΕΤΑΒΛΗΤΑ — μηδέν persisted churn, μηδέν επαφή με ADR-492.

/** Half-width του outline = μέγιστη κάθετη απόσταση κορυφής από τον άξονα (canvas units). */
function outlineHalfWidth(outline: readonly Pt2[], ax: Pt2, ux: number, uy: number): number {
  const { perpMin, perpMax } = projectPolygonOnAxis(outline, ax.x, ax.y, ux, uy);
  return Math.max(Math.abs(perpMin), Math.abs(perpMax));
}

/**
 * Πόση εσωτερική επέκταση (canvas units) χρειάζεται το άκρο `endpoint` κατά τον
 * μοναδιαίο `(ix,iy)` (= −u για start, +u για end) ώστε το carve-outline να καλύψει
 * το footprint κολώνας που πλαισιώνει αυτό το άκρο. Επιστρέφει το **«κέντρο» κατά τον
 * άξονα** = midpoint των παρειών (clamped στο εσωτερικό του άκρου). 0 όταν καμία κολώνα
 * δεν πλαισιώνει: (α) footprint εκτός εσωτερικού του άκρου, (β) footprint εκτός μισού-
 * πλάτους από τον άξονα, (γ) κοντινή παρειά μακριά από το άκρο.
 *
 * **ADR-529 (footprint-aware fix):** πριν χρησιμοποιούσε `polygonCentroid` → για **ασύμμετρες
 * διατομές** (L/T/U boundary columns, ADR-529 promotion) το κεντροειδές **μετατοπίζεται** προς το
 * σκέλος → η επέκταση τραβούσε το carve βαθύτερα → ορατή **υπερ-επέκταση** + ασύμμετρο reprofiling
 * του cutback (φαινομενική «πτώση» νότια του δοκαριού). Το «κέντρο κατά τον άξονα» ορίζεται πλέον
 * **position-independent & kind-agnostic** = `(alongMin+alongMax)/2` των footprint παρειών (ίδιο
 * SSoT root με `projectColumnFootprintOnAxis`/ADR-494). Κύκλος/ορθογώνιο: midpoint = centroid
 * (μηδέν regression). Reuse `projectPolygonOnAxis` (N.0.2 — μηδέν διπλότυπη geometry).
 */
/**
 * Απόσταση κατά τη μοναδιαία `(ix,iy)` από τη γωνία `c` μέχρι την ΠΡΩΤΗ τομή με ακμή του
 * `footprint` (= είσοδος στην κολώνα όταν η γωνία είναι έξω). `0` αν καμία τομή μπροστά.
 * Reuse `lineEdgeT` (unit βήμα → η επιστρεφόμενη παράμετρος = απόσταση).
 */
function cornerEntryDistance(c: Pt2, ix: number, iy: number, footprint: readonly Pt2[]): number {
  const b: Pt2 = { x: c.x + ix, y: c.y + iy };
  let best = Infinity;
  const n = footprint.length;
  for (let i = 0; i < n; i++) {
    const t = lineEdgeT(c, b, footprint[i], footprint[(i + 1) % n]);
    if (t !== null && t > AXIS_T_EPS && t < best) best = t;
  }
  return best === Infinity ? 0 : best;
}

function framingInwardExtent(
  endpoint: Pt2,
  ix: number,
  iy: number,
  halfWidth: number,
  footprints: readonly (readonly Pt2[])[],
): number {
  let best = 0;
  let bestScore = -Infinity;
  // Εγκάρσια μοναδιαία (πλάτος δοκαριού): οι δύο γωνίες της απόληξης = endpoint ± halfWidth·perp.
  const perpx = -iy;
  const perpy = ix;
  for (const fp of footprints) {
    if (fp.length < 3) continue;
    // Footprint-aware προβολή στον ΕΣΩΤΕΡΙΚΟ άξονα (ix,iy): παρειές [alongMin,alongMax] + perp
    // (0 όταν το footprint τέμνει τον άξονα — ίδια framing-semantic με `projectColumnFootprintOnAxis`).
    const { alongMin, alongMax, perpMin, perpMax } = projectPolygonOnAxis(fp, endpoint.x, endpoint.y, ix, iy);
    if (alongMax <= 0) continue; // footprint όχι εσωτερικά αυτού του άκρου (π.χ. mid-span / outward)
    const perp = perpMin <= 0 && perpMax >= 0 ? 0 : Math.min(Math.abs(perpMin), Math.abs(perpMax));
    if (perp > halfWidth) continue; // footprint εκτός πλάτους δοκαριού
    if (alongMin > halfWidth) continue; // κοντινή παρειά μακριά από το άκρο → όχι framing join
    // «Κέντρο» body εσωτερικά του άκρου = midpoint παρειών (clamp near-face στο 0 ώστε τυχόν
    // outward σκέλος —foot πέρα από το άκρο— να μη μειώνει την επέκταση μέσα στο σώμα).
    const centerAlong = (Math.max(alongMin, 0) + alongMax) / 2;
    // ADR-493 §diagonal-corner-seat: για ΛΟΞΟ δοκάρι σε ΕΠΙΠΕΔΗ παρειά, η καθυστερημένη γωνία της
    // απόληξης μένει έξω από την παρειά ακόμη και μετά την «ως το κέντρο» επέκταση → μερική έδραση +
    // εγκοπή/tab. Επέκτεινε ΟΣΟ ώστε ΚΑΙ οι δύο γωνίες να ΜΠΟΥΝ στην κολώνα. Οι γωνίες γίνονται inset
    // ελαφρώς προς τον άξονα (αποφυγή ασάφειας ορίου όταν η παρειά δοκαριού είναι collinear με την
    // παρειά κολώνας — π.χ. north-flush). Κριτήριο: αν η γωνία-ΜΕΤΑ-το-center είναι ΜΕΣΑ → seated
    // (κράτα center· ADR-529 κάθετο/receding ΔΕΝ ρηχύνει)· αλλιώς πρόσθεσε το επιπλέον reach ως εκεί.
    const inset = halfWidth * 0.999;
    const cornerExt = (sx: number, sy: number): number => {
      const start: Pt2 = { x: sx + ix * centerAlong, y: sy + iy * centerAlong };
      return pointInPolygon(start, fp) ? centerAlong : centerAlong + cornerEntryDistance(start, ix, iy, fp);
    };
    const reach = Math.max(
      cornerExt(endpoint.x + perpx * inset, endpoint.y + perpy * inset),
      cornerExt(endpoint.x - perpx * inset, endpoint.y - perpy * inset),
    );
    if (centerAlong > bestScore) { bestScore = centerAlong; best = Math.max(centerAlong, reach); }
  }
  return best;
}

/**
 * Revit-grade DERIVED pre-pass: επεκτείνει το carve-outline ευθύγραμμου δοκαριού στα
 * άκρα που πλαισιώνονται από κολώνα, ώστε το επόμενο `safeDifference` να σκαλίσει την
 * ακριβή (υποχωρούσα) παρειά. Επιστρέφει νέο outline ή `null` (κανένα άκρο δεν χρειάζεται
 * επέκταση → ο caller κρατά το αρχικό, μηδέν regression). Μόνο straight 2-σημείων άξονας.
 */
export function extendBeamOutlineIntoFramingColumns(
  beamOutline: readonly Pt2[],
  axisStart: Pt2,
  axisEnd: Pt2,
  columnFootprints: readonly (readonly Pt2[])[],
): Pt2[] | null {
  if (beamOutline.length < 3 || columnFootprints.length === 0) return null;
  const dx = axisEnd.x - axisStart.x;
  const dy = axisEnd.y - axisStart.y;
  const len = Math.hypot(dx, dy);
  if (len < AXIS_T_EPS) return null;
  const ux = dx / len;
  const uy = dy / len;
  const halfWidth = outlineHalfWidth(beamOutline, axisStart, ux, uy);
  if (halfWidth <= 0) return null;

  const startExt = framingInwardExtent(axisStart, -ux, -uy, halfWidth, columnFootprints);
  const endExt = framingInwardExtent(axisEnd, ux, uy, halfWidth, columnFootprints);
  if (startExt <= 0 && endExt <= 0) return null;

  // Διαμέρισε κορυφές ανά διαμήκη προβολή: < μέσον → start edge (−u), ≥ μέσον → end edge (+u).
  const mid = len / 2;
  return beamOutline.map((v) => {
    const proj = (v.x - axisStart.x) * ux + (v.y - axisStart.y) * uy;
    if (proj < mid && startExt > 0) return { x: v.x - ux * startExt, y: v.y - uy * startExt };
    if (proj >= mid && endExt > 0) return { x: v.x + ux * endExt, y: v.y + uy * endExt };
    return { x: v.x, y: v.y };
  });
}
