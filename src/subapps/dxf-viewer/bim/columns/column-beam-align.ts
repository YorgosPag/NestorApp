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
import type { Point3D } from '../types/bim-base';
import { rotateVector } from '../grips/grip-math';
import { mmToSceneUnits } from '../../utils/scene-units';

const DEG_PER_RAD = 180 / Math.PI;

/** Διανυσματικό μήκος (scene units) κάτω από το οποίο ο άξονας θεωρείται εκφυλισμένος. */
const MIN_AXIS_LEN = 1e-6;

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
    const s = b.params.startPoint;
    const e = b.params.endPoint;
    const dNear = Math.min(Math.hypot(s.x - cx, s.y - cy), Math.hypot(e.x - cx, e.y - cy));
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
  const start = beam.params.startPoint;
  const end = beam.params.endPoint;

  // near-end = το άκρο του δοκαριού πλησιέστερα στο κέντρο της κολώνας = η παρειά #1 όπου
  // πατά το bearing arm. far-end ορίζει το `u_span` (φορά προς το άνοιγμα).
  const cx = column.params.position.x;
  const cy = column.params.position.y;
  const dStart = Math.hypot(start.x - cx, start.y - cy);
  const dEnd = Math.hypot(end.x - cx, end.y - cy);
  const nearEnd = dStart <= dEnd ? start : end;
  const farEnd = dStart <= dEnd ? end : start;

  const spanX = farEnd.x - nearEnd.x;
  const spanY = farEnd.y - nearEnd.y;
  const spanLen = Math.hypot(spanX, spanY);
  if (spanLen < MIN_AXIS_LEN) return null;
  const ux = spanX / spanLen;
  const uy = spanY / spanLen;

  const s = mmToSceneUnits(nextParams.sceneUnits ?? 'mm');
  const armWidth = beam.params.width; // mm — πάχος bearing arm = πλάτος δοκαριού (απαίτηση 3)

  // bbox: width = μήκος foot (X), depth = μήκος bearing arm (Y). Εγγύηση ότι το bbox
  // χωρά το bearing arm (αλλιώς το `Math.max(s, …)` clamp στο `buildLshapeLocal` θα
  // εκφύλιζε το σχήμα). Κρατά τα catalog defaults όταν είναι ήδη επαρκή.
  const W = Math.max(nextParams.width, armWidth);
  const D = Math.max(nextParams.depth, armWidth);

  // rotation θ: τοπικό +Y (bearing arm, ελεύθερο άκρο στην κορυφή) → άξονας δοκαριού u_span.
  //   R(θ)·(0,1) = (−sinθ, cosθ) = (ux, uy) → sinθ = −ux, cosθ = uy.
  const rotationDeg = Math.atan2(-ux, uy) * DEG_PER_RAD;

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
