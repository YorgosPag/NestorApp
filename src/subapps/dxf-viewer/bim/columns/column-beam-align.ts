/**
 * ADR-496 — Smart column→beam alignment on type-change (Revit-canonical placement).
 *
 * **Το πρόβλημα:** όταν ο χρήστης αλλάζει τον τύπο μιας κολώνας σε ασύμμετρη διατομή
 * (π.χ. ορθογωνική → L-shape), το `buildLshapeLocal` στήνει το νέο σχήμα γύρω από το
 * ΙΔΙΟ insertion point με catalog defaults (`armWidth=width/3`) → ασύμμετρο footprint
 * γύρω από το `position` → το σκέλος δεν «πατά» στο δοκάρι που πλαισιώνει την κολώνα →
 * **έκκεντρο** (ADR-494 έλυσε το *στατικό* — η L αναγνωρίζεται ως στήριξη — αλλά ΟΧΙ το
 * *γεωμετρικό* alignment τοποθέτησης).
 *
 * **Η λύση (Revit-grade, το ΔΟΚΑΡΙ είναι ο reference):** το νέο σχήμα ταιριάζεται στον
 * φορέα ώστε ένα σκέλος του («bearing arm») να γίνεται **δομική συνέχεια του δοκαριού**:
 *   1. πάχος bearing arm = πλάτος δοκαριού (`armWidth == beam.width`)
 *   2. άξονας bearing arm ≡ άξονας δοκαριού (perpendicular-coincident centerline)
 *   3. η ελεύθερη όψη «α» του bearing arm flush στην παρειά #1 (near-end) του δοκαριού
 *   4. το δεύτερο σκέλος ακολουθεί αυτόματα (η παρειά του = παρειά δοκαριού, derived)
 *
 * **Bearing arm = το κατακόρυφο σκέλος του L** (στο `buildLshapeLocal`: το σκέλος με
 * πάχος `armWidth`, που εκτείνεται σε όλο το `depth` στον τοπικό άξονα +Y, με ελεύθερο
 * άκρο στην κορυφή `+D/2` και τη γωνία/foot στη βάση). Το catalog default του `armWidth`
 * είναι placeholder — το smart-fit το υπερισχύει βάσει του δοκαριού (Giorgio §1.5).
 *
 * **Κλειστή λύση (anchor='center'):** με anchor κεντρικό, ο transform γίνεται
 * `world = position + R(rotation)·p_local` (`centredPolyToWorld`). Άρα για να πιάσουμε
 * το near-end centerline του bearing arm (`P_local`) στην παρειά του δοκαριού (`E_n`) με
 * τον bearing arm συγγραμμικό στον άξονα `u_span`:
 *   · `rotation = θ` ώστε `R(θ)·(0,1) = u_span` (τοπικό +Y → άξονας δοκαριού)
 *   · `position = E_n − R(θ)·(P_local·s)` (αντιστροφή — μηδέν per-engine cos/sin)
 *
 * **Pure + unit-testable·** καμία γνώση σκηνής/React/three.js (mirror `beam-column-flush`).
 * Reuse: `rotateVector` (→ `rotatePoint`, ADR-188) + `mmToSceneUnits`. Η ανίχνευση του
 * πλαισιωτικού δοκαριού γίνεται έξω (`findBeamsFramingColumn`, reuse `beamFramesColumn`
 * ADR-494) και τα framing beams περνιούνται μέσα → decoupled SSoT.
 *
 * **Scope v1: L-shape μόνο** (η περίπτωση των στιγμιότυπων). T/U/I/composite → `null`
 * (ο caller κρατά τα raw params — μηδέν regression)· καθαρά fast-follow.
 *
 * @see ./column-structural-attach-coordinator.ts — findBeamsFramingColumn / beamFramesColumn (framing SSoT)
 * @see ../grips/centred-anchor-frame.ts — centredPolyToWorld (ο transform που αντιστρέφουμε)
 * @see ../beams/beam-column-flush.ts — ο γεωμετρικός δίδυμος (freehand δοκάρι → flush justification)
 * @see docs/centralized-systems/reference/adrs/ADR-496-smart-column-type-change-align-to-beam.md
 */

import type { ColumnEntity, ColumnParams } from '../types/column-types';
import type { BeamEntity } from '../types/beam-types';
import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../types/bim-base';
import { rotateVector, rotationDegToAlignLocalY, unitVector } from '../grips/grip-math';
import { lineIntersectionPoint } from '../geometry/shared/polygon-utils';
import { mmToSceneUnits } from '../../utils/scene-units';

/** |dot| δύο μοναδιαίων διευθύνσεων κάτω από αυτό ⇒ «κάθετα» (~15° ανοχή). */
const PERPENDICULAR_DOT_TOL = 0.26;

/**
 * Τα άκρα ενός δοκαριού ταξινομημένα ως προς απόσταση από σημείο `(px,py)` — ΕΝΑ SSoT για
 * κάθε «ποιο άκρο είναι κοντά/μακριά» ερώτημα του module (πλησιέστερο πλαισιωτικό δοκάρι,
 * near/far-end του bearing arm, terminating-vs-passing για το T-junction). Πριν ήταν 3
 * inline `Math.hypot` επαναλήψεις (N.0.2 de-dup).
 */
interface BeamEndsByProximity {
  readonly near: Point3D;
  readonly far: Point3D;
  readonly nearDist: number;
  readonly farDist: number;
}
function beamEndsByProximity(beam: BeamEntity, px: number, py: number): BeamEndsByProximity {
  const s = beam.params.startPoint;
  const e = beam.params.endPoint;
  const dS = Math.hypot(s.x - px, s.y - py);
  const dE = Math.hypot(e.x - px, e.y - py);
  return dS <= dE
    ? { near: s, far: e, nearDist: dS, farDist: dE }
    : { near: e, far: s, nearDist: dE, farDist: dS };
}

/**
 * Διαλέγει το πλησιέστερο πλαισιωτικό δοκάρι: εκείνο του οποίου το **εγγύτερο άκρο**
 * (near-end) απέχει λιγότερο από το κέντρο της κολώνας. Για corner-κολώνες με 2 δοκάρια,
 * v1 ευθυγραμμίζει στο πλησιέστερο (true dual-leg alignment = DEFER).
 */
function nearestFramingBeam(beams: readonly BeamEntity[], column: ColumnEntity): BeamEntity {
  const cx = column.params.position.x;
  const cy = column.params.position.y;
  let best = beams[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const b of beams) {
    const dNear = beamEndsByProximity(b, cx, cy).nearDist;
    if (dNear < bestDist) {
      best = b;
      bestDist = dNear;
    }
  }
  return best;
}

/**
 * Ταιριάζει τα `nextParams` μιας κολώνας που αλλάζει τύπο ώστε το bearing arm της νέας
 * διατομής να ευθυγραμμιστεί στο πλαισιωτικό δοκάρι (βλ. module doc). Επιστρέφει νέα
 * `ColumnParams` (override μόνο `position/anchor/rotation/armWidth/flipY`· κρατά τα catalog
 * `width/depth/armLength`) ή `null` όταν δεν εφαρμόζεται fit (μη-υποστηριζόμενο kind, κανένα
 * πλαισιωτικό δοκάρι, ή εκφυλισμένος άξονας) → ο caller κρατά τα raw params.
 *
 * @param column        Η ΥΠΑΡΧΟΥΣΑ κολώνα (τρέχουσα γεωμετρία — η φυσική σύνδεση πριν το reshape).
 * @param nextParams    Τα νέα params (νέο kind + catalog defaults).
 * @param framingBeams  Τα δοκάρια που πλαισιώνουν την κολώνα (από `findBeamsFramingColumn`).
 */
export function alignColumnToFramingBeam(
  column: ColumnEntity,
  nextParams: ColumnParams,
  framingBeams: readonly BeamEntity[],
): ColumnParams | null {
  // v1 — L-shape μόνο (ADR-496). Άλλες ασύμμετρες διατομές → fast-follow.
  if (nextParams.kind !== 'L-shape') return null;
  if (framingBeams.length === 0) return null;

  const beam = framingBeams.length === 1 ? framingBeams[0] : nearestFramingBeam(framingBeams, column);

  // near-end = το άκρο του δοκαριού πλησιέστερα στο κέντρο της κολώνας = η παρειά #1 όπου
  // πατά το bearing arm. far-end ορίζει το `u_span` (φορά προς το άνοιγμα).
  const cx = column.params.position.x;
  const cy = column.params.position.y;
  const { near: nearEnd, far: farEnd } = beamEndsByProximity(beam, cx, cy);

  // u_span = μοναδιαία φορά near-end → far-end (προς το άνοιγμα). Reuse `unitVector` SSoT
  // (grip-math, ίδιο module με το `rotateVector`) — μηδέν χειροκίνητο normalize· null σε
  // εκφυλισμένο (μηδενικού μήκους) δοκάρι.
  const uSpan = unitVector(nearEnd, farEnd);
  if (!uSpan) return null;

  const s = mmToSceneUnits(nextParams.sceneUnits ?? 'mm');
  const armWidth = beam.params.width; // mm — πάχος bearing arm = πλάτος δοκαριού (απαίτηση 3)

  // bbox: width = μήκος foot (X), depth = μήκος bearing arm (Y). Εγγύηση ότι το bbox
  // χωρά το bearing arm (αλλιώς το `Math.max(s, …)` clamp στο `buildLshapeLocal` θα
  // εκφύλιζε το σχήμα). Κρατά τα catalog defaults όταν είναι ήδη επαρκή.
  const W = Math.max(nextParams.width, armWidth);
  const D = Math.max(nextParams.depth, armWidth);

  // rotation θ: τοπικό +Y (bearing arm, ελεύθερο άκρο στην κορυφή) → άξονας δοκαριού u_span.
  const rotationDeg = rotationDegToAlignLocalY(uSpan);

  // near-end centerline του bearing arm σε LOCAL mm (flipY=false: σκέλος αριστερά
  // x∈[−W/2, −W/2+armWidth], ελεύθερο άκρο στην κορυφή y=+D/2).
  const pLocalX = -W / 2 + armWidth / 2;
  const pLocalY = D / 2;
  const rotated = rotateVector({ x: pLocalX * s, y: pLocalY * s }, rotationDeg);

  // position = E_n − R(θ)·(P_local·s)  → η όψη «α» πέφτει flush στο near-end (παρειά #1).
  const position: Point3D = {
    x: nearEnd.x - rotated.x,
    y: nearEnd.y - rotated.y,
    z: nextParams.position.z,
  };

  return {
    ...nextParams,
    position,
    anchor: 'center',
    rotation: rotationDeg,
    width: W,
    depth: D,
    lshape: { ...nextParams.lshape, armWidth, flipY: false },
  };
}

// ─── ADR-496 Phase 2 — T-shape dual-beam alignment (T-junction) ───────────────

/** Άξονας ενός δοκαριού: η οντότητα + η μοναδιαία διεύθυνσή του (start→end). */
interface BeamAxis {
  readonly beam: BeamEntity;
  readonly u: { x: number; y: number };
}

/** Beams → άξονες (skip τα εκφυλισμένα μηδενικού μήκους). */
function beamAxes(beams: readonly BeamEntity[]): BeamAxis[] {
  const out: BeamAxis[] = [];
  for (const beam of beams) {
    const u = unitVector(beam.params.startPoint, beam.params.endPoint);
    if (u) out.push({ beam, u });
  }
  return out;
}

/**
 * Διαλέγει το καλύτερο ΚΑΘΕΤΟ ζεύγος δοκαριών — εκείνο του οποίου ο κόμβος (τομή των
 * αξόνων) είναι **πλησιέστερα στο κέντρο** της κολώνας (= η πραγματική συμβολή Τ). Για το
 * στιγμιότυπο (ακριβώς 2 κάθετα) υπάρχει ένα μόνο ζεύγος· >2 διαλέγει το γνήσιο junction.
 */
function bestPerpendicularPair(
  axes: readonly BeamAxis[],
  cx: number,
  cy: number,
): { a: BeamAxis; b: BeamAxis; node: Point2D } | null {
  let best: { a: BeamAxis; b: BeamAxis; node: Point2D } | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < axes.length; i++) {
    for (let j = i + 1; j < axes.length; j++) {
      const dot = Math.abs(axes[i].u.x * axes[j].u.x + axes[i].u.y * axes[j].u.y);
      if (dot > PERPENDICULAR_DOT_TOL) continue; // όχι κάθετα → skip
      const node = lineIntersectionPoint(
        axes[i].beam.params.startPoint, axes[i].u,
        axes[j].beam.params.startPoint, axes[j].u,
      );
      if (!node) continue;
      const d = Math.hypot(node.x - cx, node.y - cy);
      if (d < bestDist) {
        best = { a: axes[i], b: axes[j], node };
        bestDist = d;
      }
    }
  }
  return best;
}

/**
 * ADR-496 Phase 2 — ταιριάζει μια κολώνα που αλλάζει τύπο σε **Τ (T-shape)** σε ΔΥΟ
 * κάθετα πλαισιωτικά δοκάρια (T-junction), ώστε **κάθε σκέλος του Τ να γίνεται δομική
 * συνέχεια του αντίστοιχου δοκαριού**:
 *
 *   · **πέλμα (flange)** ∥ το **συνεχόμενο** δοκάρι (αυτό που «περνά ευθεία» — ο κόμβος
 *     είναι εσωτερικός στο span του)· `flangeThickness = flangeBeam.width`, flange
 *     centerline ≡ άξονάς του.
 *   · **κορμός (web)** ∥ το **καταλήγον** δοκάρι (το ένα άκρο του στον κόμβο)·
 *     `webThickness = webBeam.width`, web centerline ≡ άξονάς του.
 *
 * Επειδή `πάχος σκέλους == πλάτος δοκαριού` ΚΑΙ `centerline ≡ άξονας`, **και οι δύο
 * παρειές** κάθε σκέλους πέφτουν flush αυτόματα (το «flush» = συνέπεια της συνέχειας).
 *
 * **Κλειστή λύση (anchor='center', ίδιο μοτίβο με το single-beam {@link alignColumnToFramingBeam}):**
 *   · τοπικό +Y (κορμός→πέλμα) = `−u_webOut` (αντίθετο της φοράς που εκτείνεται ο κορμός-
 *     δοκάρι) → `rotationDegToAlignLocalY(−u_webOut)`.
 *   · `P_local = (0, D/2 − flangeThickness/2)` = ο κόμβος σε τοπικές mm (τομή flange-
 *     centerline × web-centerline) → `position = N − R(θ)·(P_local·s)`.
 *
 * Reuse: `unitVector` + `rotateVector` + `rotationDegToAlignLocalY` (grip-math SSoT),
 * `lineIntersectionPoint` (polygon-utils SSoT), `mmToSceneUnits`. Πλήρως pure + unit-testable.
 *
 * @returns νέα `ColumnParams` (override `position/anchor/rotation/width/depth/tshape`) ή
 *   `null` όταν δεν βρεθεί κάθετο ζεύγος (caller κρατά τα raw catalog params — μηδέν regression).
 */
export function alignTShapeColumnToFramingBeams(
  column: ColumnEntity,
  nextParams: ColumnParams,
  framingBeams: readonly BeamEntity[],
): ColumnParams | null {
  if (nextParams.kind !== 'T-shape') return null;

  const cx = column.params.position.x;
  const cy = column.params.position.y;
  const pair = bestPerpendicularPair(beamAxes(framingBeams), cx, cy);
  if (!pair) return null;

  // flange-beam = «περνά ευθεία» (μεγαλύτερη απόσταση κόμβου από τα άκρα του = εσωτερικός)·
  // web-beam = «καταλήγει» (το ένα άκρο στον κόμβο = μικρότερη απόσταση). Reuse του ΕΝΟΣ
  // `beamEndsByProximity` SSoT (near = το πλησιέστερο άκρο, far = η φορά που εκτείνεται).
  const { node } = pair;
  const endsA = beamEndsByProximity(pair.a.beam, node.x, node.y);
  const endsB = beamEndsByProximity(pair.b.beam, node.x, node.y);
  const aIsFlange = endsA.nearDist >= endsB.nearDist;
  const flangeBeam = (aIsFlange ? pair.a : pair.b).beam;
  const webBeam = (aIsFlange ? pair.b : pair.a).beam;
  const webEnds = aIsFlange ? endsB : endsA;

  // u_webOut = φορά που εκτείνεται το σώμα του κορμού-δοκαριού από τον κόμβο (node → far).
  const uWebOut = unitVector(node, webEnds.far);
  if (!uWebOut) return null;

  // rotation: τοπικό +Y (κορμός→πέλμα) = −u_webOut (αντίθετο της φοράς που εκτείνεται ο κορμός).
  const rotationDeg = rotationDegToAlignLocalY({ x: -uWebOut.x, y: -uWebOut.y });

  const s = mmToSceneUnits(nextParams.sceneUnits ?? 'mm');
  const webThickness = webBeam.params.width; // mm — πάχος κορμού = πλάτος καταλήγοντος δοκαριού
  const flangeThickness = flangeBeam.params.width; // mm — πάχος πέλματος = πλάτος συνεχόμενου

  // bbox: W ≥ webThickness (ο κορμός χωρά κατά X)· D ≥ flangeThickness + webThickness
  // (θετικό μήκος κορμού κάτω από το πέλμα). Κρατά catalog defaults όταν επαρκούν.
  const W = Math.max(nextParams.width, webThickness);
  const D = Math.max(nextParams.depth, flangeThickness + webThickness);

  // P_local = ο κόμβος (τομή flange-centerline y=D/2−ft/2 × web-centerline x=0) σε τοπικές mm.
  const pLocalY = D / 2 - flangeThickness / 2;
  const rotated = rotateVector({ x: 0, y: pLocalY * s }, rotationDeg);

  const position: Point3D = {
    x: node.x - rotated.x,
    y: node.y - rotated.y,
    z: nextParams.position.z,
  };

  return {
    ...nextParams,
    position,
    anchor: 'center',
    rotation: rotationDeg,
    width: W,
    depth: D,
    // flangeLength = W ⇒ το πέλμα καλύπτει όλο το bbox-πλάτος (πλήρης συνέχεια στο
    // συνεχόμενο δοκάρι). webThickness/flangeThickness = πλάτη δοκαριών· flipY=false.
    tshape: { ...nextParams.tshape, flangeLength: W, webThickness, flangeThickness, flipY: false },
  };
}

// ─── ADR-496 Phase 3 — L-shape dual-beam corner alignment (Γ στη ΓΩΝΙΑ) ───────

/** 2D cross-product z-component `a × b` — πρόσημο = chirality του ζεύγους διευθύνσεων. */
function crossZ(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return a.x * b.y - a.y * b.x;
}

/**
 * ADR-496 Phase 3 — ταιριάζει μια κολώνα που αλλάζει τύπο σε **Γ (L-shape)** σε ΔΥΟ
 * κάθετα πλαισιωτικά δοκάρια που **καταλήγουν στην ίδια γωνία** (corner junction), ώστε
 * **κάθε σκέλος του Γ να γίνεται δομική συνέχεια του αντίστοιχου δοκαριού**:
 *
 *   · **κατακόρυφο σκέλος** (πάχος `armWidth`, εκτείνεται κατά τοπικό +Y) ∥ το ένα δοκάρι·
 *     `armWidth = (vertical-leg beam).width`, centerline ≡ άξονάς του.
 *   · **οριζόντιο σκέλος / foot** (πάχος `armLength`, εκτείνεται κατά τοπικό +X) ∥ το άλλο·
 *     `armLength = (foot beam).width`, centerline ≡ άξονάς του.
 *
 * Η **γωνία** του Γ κάθεται στον **κόμβο** N = τομή των δύο αξόνων· τα δύο ελεύθερα άκρα
 * βλέπουν προς τα ανοίγματα. Επειδή `πάχος σκέλους == πλάτος δοκαριού` ΚΑΙ `centerline ≡
 * άξονας`, **και οι δύο παρειές** κάθε σκέλους πέφτουν flush αυτόματα (συνέπεια της συνέχειας).
 *
 * **Handedness (κλειστή λύση, ΟΧΙ hard-coded ανά γωνία):** μετά το
 * `rotationDegToAlignLocalY(u_v)` ισχύει `R(θ)·(+X) = (u_v.y, −u_v.x)`, άρα ο foot δείχνει
 * πάντα στη φορά με `crossZ(u_v, foot_out) = −1`. Διαλέγουμε λοιπόν ποιο δοκάρι είναι το
 * **κατακόρυφο σκέλος** βάσει του προσήμου του `crossZ` των δύο outward διευθύνσεων ⇒ καμία
 * ανάγκη για `flipY`/`flipX` — η σωστή γωνία και για τις 4 περιπτώσεις προκύπτει από τη
 * συνεχή rotation + τη χειρότητα (scale/rotation-invariant).
 *
 * **Κλειστή λύση (anchor='center', ίδιο μοτίβο §4/§9.2):** `P_local = (−W/2 + armWidth/2,
 * −D/2 + armLength/2)` = ο κόμβος σε τοπικές mm (τομή leg-centerlines) → `position =
 * N − R(θ)·(P_local·s)`.
 *
 * @returns νέα `ColumnParams` (override `position/anchor/rotation/width/depth/lshape`) ή
 *   `null` όταν δεν βρεθεί κάθετο ζεύγος / εκφυλισμένος άξονας (ο caller κάνει fallback στο
 *   single-beam {@link alignColumnToFramingBeam} — μηδέν regression).
 */
export function alignLShapeColumnToFramingBeams(
  column: ColumnEntity,
  nextParams: ColumnParams,
  framingBeams: readonly BeamEntity[],
): ColumnParams | null {
  if (nextParams.kind !== 'L-shape') return null;

  const cx = column.params.position.x;
  const cy = column.params.position.y;
  const pair = bestPerpendicularPair(beamAxes(framingBeams), cx, cy);
  if (!pair) return null;

  // outward κάθε δοκαριού από τον κόμβο N (φορά προς το ελεύθερο άκρο = προς το άνοιγμα).
  const { node } = pair;
  const outA = unitVector(node, beamEndsByProximity(pair.a.beam, node.x, node.y).far);
  const outB = unitVector(node, beamEndsByProximity(pair.b.beam, node.x, node.y).far);
  if (!outA || !outB) return null;

  // Chirality: το foot (τοπικό +X μετά την rotation) πέφτει στη φορά με crossZ(u_v, foot)=−1.
  // Διαλέγουμε ως κατακόρυφο σκέλος το δοκάρι που αφήνει το άλλο σε αυτή τη φορά — ΕΝΑ
  // πρόσημο cross-product καλύπτει και τις 4 γωνίες (αντί 4 hard-coded if).
  const aIsVerticalLeg = crossZ(outA, outB) < 0;
  const vBeam = (aIsVerticalLeg ? pair.a : pair.b).beam; // κατακόρυφο σκέλος (∥ τοπικό +Y)
  const hBeam = (aIsVerticalLeg ? pair.b : pair.a).beam; // foot / οριζόντιο σκέλος (∥ τοπικό +X)
  const uVerticalOut = aIsVerticalLeg ? outA : outB;

  const s = mmToSceneUnits(nextParams.sceneUnits ?? 'mm');
  const armWidth = vBeam.params.width; // mm — πάχος κατακόρυφου σκέλους = πλάτος δοκαριού του
  const armLength = hBeam.params.width; // mm — πάχος foot = πλάτος δοκαριού του

  // bbox: το κατακόρυφο σκέλος έχει πάχος armWidth κατά X → W ≥ armWidth· ο foot έχει πάχος
  // armLength κατά Y → D ≥ armLength. Κρατά τα catalog defaults όταν επαρκούν.
  const W = Math.max(nextParams.width, armWidth);
  const D = Math.max(nextParams.depth, armLength);

  // rotation: τοπικό +Y (κατακόρυφο σκέλος) → outward διεύθυνση του δοκαριού του.
  const rotationDeg = rotationDegToAlignLocalY(uVerticalOut);

  // P_local = ο κόμβος (τομή leg-centerlines) σε τοπικές mm (flipY=false: κατακόρυφο σκέλος
  // αριστερά x∈[−W/2,−W/2+armWidth], foot κάτω y∈[−D/2,−D/2+armLength]).
  const pLocalX = -W / 2 + armWidth / 2;
  const pLocalY = -D / 2 + armLength / 2;
  const rotated = rotateVector({ x: pLocalX * s, y: pLocalY * s }, rotationDeg);

  const position: Point3D = {
    x: node.x - rotated.x,
    y: node.y - rotated.y,
    z: nextParams.position.z,
  };

  return {
    ...nextParams,
    position,
    anchor: 'center',
    rotation: rotationDeg,
    width: W,
    depth: D,
    lshape: { ...nextParams.lshape, armWidth, armLength, flipY: false },
  };
}

/**
 * ADR-496 — dispatcher ανά kind για το command-time smart-fit κατά την αλλαγή τύπου.
 * L-shape → **dual-beam corner** (Phase 3, {@link alignLShapeColumnToFramingBeams}) όταν
 * υπάρχουν 2 κάθετα δοκάρια σε γωνία· αλλιώς fallback στο **single-beam** bearing-arm
 * (Phase 1, {@link alignColumnToFramingBeam}). T-shape (Phase 2) →
 * {@link alignTShapeColumnToFramingBeams}· κάθε άλλο kind → `null` (ο caller κρατά τα raw
 * params). ΕΝΑ σημείο routing ώστε ο hook (`useColumnParamsDispatcher`) να μένει thin.
 */
export function alignColumnOnTypeChange(
  column: ColumnEntity,
  nextParams: ColumnParams,
  framingBeams: readonly BeamEntity[],
): ColumnParams | null {
  switch (nextParams.kind) {
    case 'L-shape':
      return alignLShapeColumnToFramingBeams(column, nextParams, framingBeams)
        ?? alignColumnToFramingBeam(column, nextParams, framingBeams);
    case 'T-shape': return alignTShapeColumnToFramingBeams(column, nextParams, framingBeams);
    default:        return null;
  }
}
