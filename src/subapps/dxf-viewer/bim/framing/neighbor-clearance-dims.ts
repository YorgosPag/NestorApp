/**
 * neighbor-clearance-dims — pure SSoT για τις **έξυπνες προσωρινές διαστάσεις** που εμφανίζονται
 * γύρω από ένα **ελεύθερο** placement ghost (Revit temporary dimensions), ADR-508 §neighbor-clearance.
 *
 * **Το κενό που καλύπτει:** ο υπάρχων `resolveGhostFaceDimensions` δείχνει listening dims ΜΟΝΟ όταν
 * το ghost έχει ήδη κουμπώσει σε μία παρειά (`GhostFaceFrame`). Όταν το ghost αιωρείται ελεύθερο,
 * ο χρήστης δεν έχει καμία αναφορά απόστασης. Εδώ, δοθέντος του **footprint του ghost** + των
 * προ-συλλεγμένων `SceneSnapTargets`, βρίσκουμε την **πλησιέστερη γειτονική οντότητα ανά κατεύθυνση**
 * (E/W/N/S, max 4) και μετράμε **παρειά-προς-παρειά** διάκενο. Giorgio (2026-07-02):
 *   1. πλησιέστερη ανά κατεύθυνση (max ~4)· 2. παρειά-προς-παρειά· 3. γωνία μόνο σε λοξές θέσεις.
 *
 * «Έξυπνο» φιλτράρισμα (δεν πλημμυρίζει ο καμβάς):
 *   · **overlap gating** — γείτονας μετράει μόνο αν η προβολή του «βλέπει» το ghost στον εγκάρσιο άξονα·
 *   · **nearest-per-direction** — μία dim ανά ημιάξονα (η πλησιέστερη)·
 *   · **threshold** — απόρριψη διακένων > `maxClearanceScene` (screen-relative → ό,τι φαίνεται).
 *
 * Reuse (μηδέν νέα γεωμετρία): `footprintBounds` (AABB), `projectPolygonOnAxis` (perp/along έκταση),
 * `buildMemberTargetFrame` (axis frame λοξού μέλους). Επιστρέφει το ΙΔΙΟ `GhostFaceDimensionsMeta`
 * σχήμα με τις snapped listening dims → ζωγραφίζεται από τον υπάρχοντα `paintGhostFaceDimensions`.
 *
 * Pure — zero React/DOM/store. Μονάδες: scene units (footprint/targets world-baked).
 *
 * @see ./ghost-face-dim-references.ts — GhostFaceDimension / GhostFaceDimensionsMeta (κοινό σχήμα)
 * @see ./linear-member-face-snap.ts — buildMemberTargetFrame / LinearMemberSnapTarget
 * @see ../geometry/shared/footprint-face-frame.ts — footprintBounds (AABB SSoT)
 * @see ../placement/placement-ghost-assembly.ts — consumer (fallback όταν ελεύθερο ghost)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import type { SceneSnapTargets } from './scene-snap-targets';
import type { LinearMemberSnapTarget } from './linear-member-face-snap';
import type { GhostFaceDimension, GhostFaceDimensionsMeta } from './ghost-face-dim-references';
import { footprintBounds, footprintCenter, type FootprintBounds, type FootprintFace } from '../geometry/shared/footprint-face-frame';
import { projectPolygonOnAxis } from '../geometry/shared/polygon-axis-projection';
import { buildMemberTargetFrame } from './linear-member-face-snap';
import { quantizeMagnitude } from '../../systems/tracking/adaptive-distance-snap';

/** Default μέγιστο διάκενο σε **screen px** (× worldPerPixel από τον caller) — πέρα από αυτό δεν δείχνουμε. */
export const NEIGHBOR_DIM_MAX_CLEARANCE_PX = 700;

export interface NeighborClearanceOptions {
  /** Perpendicular offset (scene units) της dim line από τη γραμμή σύνδεσης παρειών (zoom-adaptive). */
  readonly gapOffsetScene: number;
  /** Διάκενα κάτω από αυτό (scene units) απορρίπτονται (flush / επικάλυψη → ο snap αναλαμβάνει). */
  readonly minValueScene: number;
  /** Διάκενα πάνω από αυτό (scene units) απορρίπτονται (μακρινός/εκτός-οθόνης γείτονας). */
  readonly maxClearanceScene: number;
  /** Ανοχή (μοίρες) γύρω από 0/90/180/270 όπου η dim θεωρείται **ορθή** → χωρίς γωνία. */
  readonly orthoToleranceDeg: number;
}

/** Ενδιάμεσος υποψήφιος: μία dim + ο ημιάξονας στον οποίο ανήκει (για nearest-per-direction). */
interface Candidate {
  readonly face: FootprintFace;
  readonly gap: number;
  readonly dim: GhostFaceDimension;
}

/**
 * Υπολόγισε τις ≤4 neighbor-clearance dims για ένα ελεύθερο ghost. `null` όταν κανένας έγκυρος
 * γείτονας (κανένα διάκενο εντός [min,max] με overlap). Pure.
 */
export function resolveNeighborClearanceDims(
  ghostFootprint: readonly Point2D[],
  targets: Readonly<SceneSnapTargets>,
  sceneUnits: SceneUnits,
  opts: Readonly<NeighborClearanceOptions>,
): GhostFaceDimensionsMeta | null {
  const g = footprintBounds(ghostFootprint);
  if (!g) return null;

  const cands: Candidate[] = [];
  // Ορθογώνιοι/axis-aligned γείτονες (κολόνες + κυκλικές ως bbox): AABB face-to-face ανά ημιάξονα.
  for (const verts of [...targets.footprints, ...targets.circularFootprints]) {
    const nb = footprintBounds(verts);
    if (nb) pushAabbCandidate(cands, g, nb, opts);
  }
  // Γραμμικά μέλη + DXF: perpendicular clearance στην παρειά/ακμή (λοξό → γωνία). ADR-508 §move-clearance
  // (2026-07-04): πέραν των δομικών (τοίχοι/δοκάρια), ΚΑΙ `lineTargets` (σκέτες γραμμές/πολυγραμμές/
  // ορθογώνια/κύκλοι-τόξα ως zero-width edges) + `slabTargets` (ακμές πλάκας) ώστε η μετακίνηση κοντά σε
  // ΟΠΟΙΑΔΗΠΟΤΕ οντότητα (BIM ή DXF) να δείχνει κυανές διαστάσεις (Giorgio: «οποιαδήποτε οντότητα»).
  for (const t of [...targets.wallTargets, ...targets.beamTargets, ...targets.lineTargets, ...targets.slabTargets]) {
    pushMemberCandidate(cands, ghostFootprint, g, t, opts);
  }

  // nearest-per-direction: κράτα μόνο τον πλησιέστερο υποψήφιο ανά ημιάξονα (max 4).
  const best = new Map<FootprintFace, Candidate>();
  for (const c of cands) {
    const cur = best.get(c.face);
    if (!cur || c.gap < cur.gap) best.set(c.face, c);
  }
  const dims = [...best.values()].map((c) => c.dim);
  return dims.length > 0 ? { sceneUnits, dims } : null;
}

/** Interval overlap [lo,hi] — θετικό μήκος όταν επικαλύπτονται, ≤0 όταν όχι. */
function overlapLen(aLo: number, aHi: number, bLo: number, bHi: number): number {
  return Math.min(aHi, bHi) - Math.max(aLo, bLo);
}

/** Ένα AABB face-to-face διάκενο ανά ημιάξονα (E/W/N/S) — μόνο με εγκάρσια επικάλυψη. */
function pushAabbCandidate(
  out: Candidate[],
  g: FootprintBounds,
  nb: FootprintBounds,
  opts: Readonly<NeighborClearanceOptions>,
): void {
  const yOv = overlapLen(g.minY, g.maxY, nb.minY, nb.maxY);
  const xOv = overlapLen(g.minX, g.maxX, nb.minX, nb.maxX);
  // +X (E): γείτονας δεξιά + κατακόρυφη επικάλυψη.
  if (yOv > 0 && nb.minX >= g.maxX) {
    const y = (Math.max(g.minY, nb.minY) + Math.min(g.maxY, nb.maxY)) / 2;
    addGap(out, 'E', g.maxX, nb.minX, y, y, opts);
  }
  // −X (W).
  if (yOv > 0 && nb.maxX <= g.minX) {
    const y = (Math.max(g.minY, nb.minY) + Math.min(g.maxY, nb.maxY)) / 2;
    addGap(out, 'W', g.minX, nb.maxX, y, y, opts);
  }
  // +Y (N).
  if (xOv > 0 && nb.minY >= g.maxY) {
    const x = (Math.max(g.minX, nb.minX) + Math.min(g.maxX, nb.maxX)) / 2;
    addGap(out, 'N', x, x, g.maxY, nb.minY, opts);
  }
  // −Y (S).
  if (xOv > 0 && nb.maxY <= g.minY) {
    const x = (Math.max(g.minX, nb.minX) + Math.min(g.maxX, nb.maxX)) / 2;
    addGap(out, 'S', x, x, g.minY, nb.maxY, opts);
  }
}

/** Χτίσε μια axis-aligned dim από (x1,y1)→(x2,y2)· threshold-gated· χωρίς γωνία (ορθή). */
function addGap(
  out: Candidate[],
  face: FootprintFace,
  x1: number,
  x2: number,
  y1: number,
  y2: number,
  opts: Readonly<NeighborClearanceOptions>,
): void {
  const p1: Point2D = { x: x1, y: y1 };
  const p2: Point2D = { x: x2, y: y2 };
  const gap = Math.hypot(x2 - x1, y2 - y1);
  if (gap < opts.minValueScene || gap > opts.maxClearanceScene) return;
  out.push({ face, gap, dim: buildDim(face, p1, p2, opts.gapOffsetScene) });
}

/** Perpendicular clearance ghost→παρειά γραμμικού μέλους (axis-relative· λοξό → angleDeg). */
function pushMemberCandidate(
  out: Candidate[],
  ghostFootprint: readonly Point2D[],
  g: FootprintBounds,
  t: LinearMemberSnapTarget,
  opts: Readonly<NeighborClearanceOptions>,
): void {
  if (t.axis.length < 2 || t.outline.length < 3) return;
  const gc = footprintCenter(g);
  const fr = buildMemberTargetFrame(gc, t);
  if (!fr) return;
  const { a, u, p } = fr;
  // Πρόβαλε ghost + μέλος στον ΙΔΙΟ άξονα → along-overlap gating + perp intervals.
  const gp = projectPolygonOnAxis(ghostFootprint, a.x, a.y, u.x, u.y);
  if (overlapLen(gp.alongMin, gp.alongMax, fr.alongMin, fr.alongMax) <= 0) return; // δεν «βλέπει»

  let facePerp: number, ghostPerp: number;
  if (gp.perpMin >= fr.perpMax) { facePerp = fr.perpMax; ghostPerp = gp.perpMin; }      // ghost κατά +p
  else if (gp.perpMax <= fr.perpMin) { facePerp = fr.perpMin; ghostPerp = gp.perpMax; } // ghost κατά −p
  else return; // perp overlap → πολύ κοντά (ο face-snap αναλαμβάνει)

  const gap = Math.abs(facePerp - ghostPerp);
  if (gap < opts.minValueScene || gap > opts.maxClearanceScene) return;

  const alongMid = (Math.max(gp.alongMin, fr.alongMin) + Math.min(gp.alongMax, fr.alongMax)) / 2;
  const p1: Point2D = { x: a.x + alongMid * u.x + ghostPerp * p.x, y: a.y + alongMid * u.y + ghostPerp * p.y };
  const p2: Point2D = { x: a.x + alongMid * u.x + facePerp * p.x, y: a.y + alongMid * u.y + facePerp * p.y };
  const face = dominantFace(p2.x - p1.x, p2.y - p1.y);
  out.push({ face, gap, dim: buildDim(face, p1, p2, opts.gapOffsetScene, opts.orthoToleranceDeg) });
}

/** Ημιάξονας από διάνυσμα κατεύθυνσης (dominant component). */
function dominantFace(dx: number, dy: number): FootprintFace {
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'E' : 'W') : dy >= 0 ? 'N' : 'S';
}

/**
 * Χτίσε ένα `GhostFaceDimension` (kind 'clearance'). Η dim line μπαίνει με perpendicular offset από τη
 * γραμμή σύνδεσης p1→p2. `angleDeg` τίθεται ΜΟΝΟ όταν η κατεύθυνση ΔΕΝ είναι ορθή (Giorgio §3).
 */
function buildDim(
  face: FootprintFace,
  p1: Point2D,
  p2: Point2D,
  offsetScene: number,
  orthoToleranceDeg?: number,
): GhostFaceDimension {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  // Κάθετη μοναδιαία της dim· φορά «μακριά από ghost» ώστε ο αριθμός να μη κάθεται πάνω στο μέλος.
  const perp = outwardPerp(face, dx / len, dy / len);
  const mid: Point2D = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const dim: GhostFaceDimension = {
    kind: 'clearance',
    p1,
    p2,
    dimLineRef: { x: mid.x + perp.x * offsetScene, y: mid.y + perp.y * offsetScene },
    valueScene: len,
  };
  const angleDeg = obliqueAngleDeg(dx, dy, orthoToleranceDeg ?? 0);
  return angleDeg === null ? dim : { ...dim, angleDeg };
}

/** Κάθετη μοναδιαία της dim κατεύθυνσης, με σταθερή «προς τα έξω» φορά ανά ημιάξονα. */
function outwardPerp(face: FootprintFace, ux: number, uy: number): Point2D {
  const perp: Point2D = { x: -uy, y: ux };
  // Οριζόντιες (E/W) → ο αριθμός πάνω (−Y screen)· κάθετες (N/S) → δεξιά (+X). Σταθερό, anti-collision.
  const wantY = face === 'E' || face === 'W' ? -1 : 0;
  const wantX = face === 'N' || face === 'S' ? 1 : 0;
  const dot = perp.x * wantX + perp.y * wantY;
  return dot >= 0 ? perp : { x: -perp.x, y: -perp.y };
}

/** Γωνία (μοίρες, [0,180)) της dim αν ΔΕΝ είναι ορθή (±tol γύρω από 0/90/180)· αλλιώς `null`. */
function obliqueAngleDeg(dx: number, dy: number, tolDeg: number): number | null {
  const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 180) % 180; // [0,180)
  const nearest = Math.min(deg, Math.abs(deg - 90), Math.abs(deg - 180));
  return nearest <= tolDeg ? null : deg;
}

// ── ADR-363 §neighbor-gap-step ────────────────────────────────────────────────────────────────────
// «Στρογγύλεμα του διάκενου προς τη μεριά κίνησης» (Giorgio 2026-07-02, επιλογή β). Όταν ο χρήστης
// κρατά Q, στρογγυλοποιούμε το ΕΜΦΑΝΙΖΟΜΕΝΟ παρειά-προς-παρειά διάκενο (όχι την απόσταση κέντρου-από-
// anchor) στο βήμα, ώστε ο αριθμός που διαβάζει ο χρήστης να είναι στρογγυλός (Revit temp-dim snap).

/** Ένας υποψήφιος γείτονας: ημιάξονας + τρέχον διάκενο + μοναδιαία μετατόπιση ΚΕΝΤΡΟΥ ανά μονάδα
 *  αύξησης του διάκενου (π.χ. γείτονας +X → αύξηση διάκενου = κέντρο προς −X). */
interface GapStepCandidate {
  readonly face: FootprintFace;
  readonly gap: number;
  readonly widen: Point2D;
}

/** Κατεύθυνση προς τον γείτονα ανά ημιάξονα (world frame) — για dot με το moveDir. */
function faceOutward(face: FootprintFace): Point2D {
  return face === 'E' ? { x: 1, y: 0 } : face === 'W' ? { x: -1, y: 0 } : face === 'N' ? { x: 0, y: 1 } : { x: 0, y: -1 };
}

/** AABB face-to-face διάκενα ghost↔γείτονα ανά ημιάξονα (μόνο με εγκάρσια επικάλυψη, εντός [ε,max]). */
function pushGapCandidates(
  out: GapStepCandidate[],
  g: FootprintBounds,
  nb: FootprintBounds,
  maxClearance: number,
): void {
  const yOv = overlapLen(g.minY, g.maxY, nb.minY, nb.maxY);
  const xOv = overlapLen(g.minX, g.maxX, nb.minX, nb.maxX);
  const keep = (gap: number): boolean => gap > 1e-9 && gap <= maxClearance;
  // +X (E): γείτονας δεξιά· διάκενο μεγαλώνει όταν το κέντρο πάει −X.
  if (yOv > 0 && nb.minX >= g.maxX && keep(nb.minX - g.maxX)) out.push({ face: 'E', gap: nb.minX - g.maxX, widen: { x: -1, y: 0 } });
  // −X (W): γείτονας αριστερά· μεγαλώνει όταν το κέντρο πάει +X.
  if (yOv > 0 && nb.maxX <= g.minX && keep(g.minX - nb.maxX)) out.push({ face: 'W', gap: g.minX - nb.maxX, widen: { x: 1, y: 0 } });
  // +Y (N): μεγαλώνει όταν το κέντρο πάει −Y.
  if (xOv > 0 && nb.minY >= g.maxY && keep(nb.minY - g.maxY)) out.push({ face: 'N', gap: nb.minY - g.maxY, widen: { x: 0, y: -1 } });
  // −Y (S): μεγαλώνει όταν το κέντρο πάει +Y.
  if (xOv > 0 && nb.maxY <= g.minY && keep(g.minY - nb.maxY)) out.push({ face: 'S', gap: g.minY - nb.maxY, widen: { x: 0, y: 1 } });
}

/** Διάλεξε τον γείτονα προς τον οποίο ΚΙΝΕΙΤΑΙ ο κέρσορας (max positive dot moveDir↔outward)·
 *  fallback: ο πλησιέστερος (μικρότερο διάκενο) όταν δεν υπάρχει κίνηση ή καμία μεριά δεν ταιριάζει. */
function pickGapCandidate(cands: readonly GapStepCandidate[], moveDir: Point2D | null): GapStepCandidate | null {
  if (cands.length === 0) return null;
  if (moveDir) {
    const len = Math.hypot(moveDir.x, moveDir.y);
    if (len > 1e-9) {
      const mx = moveDir.x / len, my = moveDir.y / len;
      let best: GapStepCandidate | null = null;
      let bestDot = 1e-6; // απαίτησε ουσιαστική συμφωνία κατεύθυνσης (όχι απλώς μη-αρνητική)
      for (const c of cands) {
        const o = faceOutward(c.face);
        const dot = o.x * mx + o.y * my;
        if (dot > bestDot) { bestDot = dot; best = c; }
      }
      if (best) return best;
    }
  }
  return cands.reduce((a, b) => (b.gap < a.gap ? b : a));
}

/**
 * Υπολόγισε τη μετατόπιση θέσης ενός ελεύθερου ghost ώστε το διάκενο προς τον γείτονα **στη μεριά
 * κίνησης** (`moveDir`) να στρογγυλέψει στο `stepScene` (Revit temp-dimension snap). Reuse του ΙΔΙΟΥ
 * `quantizeMagnitude` SSoT (με το zoom-adaptive & fixed step) + της ΙΔΙΑΣ AABB face-to-face λογικής με
 * το `resolveNeighborClearanceDims` (μηδέν διπλή γεωμετρία). Επιστρέφει `{0,0}` όταν το διάκενο είναι
 * ήδη στρογγυλό· `null` όταν το βήμα δεν είναι ενεργό, καμία AABB γείτονας ή degenerate footprint.
 *
 * Μόνο ορθογώνιοι/κυκλικοί (AABB) γείτονες — τοίχοι/δοκάρια (λοξά μέλη) όχι σε αυτή τη φάση (η ένδειξη
 * τους παραμένει, απλώς δεν οδηγούν το βήμα· επέκταση αργότερα αν ζητηθεί).
 */
export function resolveGapStepShift(
  ghostFootprint: readonly Point2D[],
  targets: Readonly<SceneSnapTargets>,
  stepScene: number,
  maxClearanceScene: number,
  moveDir: Point2D | null,
): Point2D | null {
  if (!(stepScene > 0)) return null;
  const g = footprintBounds(ghostFootprint);
  if (!g) return null;

  const cands: GapStepCandidate[] = [];
  for (const verts of [...targets.footprints, ...targets.circularFootprints]) {
    const nb = footprintBounds(verts);
    if (nb) pushGapCandidates(cands, g, nb, maxClearanceScene);
  }
  const chosen = pickGapCandidate(cands, moveDir);
  if (!chosen) return null;

  const delta = quantizeMagnitude(chosen.gap, stepScene) - chosen.gap; // πόσο πρέπει να αλλάξει το διάκενο
  if (Math.abs(delta) < 1e-9) return { x: 0, y: 0 };
  return { x: chosen.widen.x * delta, y: chosen.widen.y * delta };
}
