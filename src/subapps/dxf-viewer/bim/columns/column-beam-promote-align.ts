/**
 * ADR-529 — Beam PROMOTES one-directional corner column (Ι → Γ boundary element).
 *
 * **Το ΑΝΤΙΣΤΡΟΦΟ του ADR-496 align (που ΣΥΡΡΙΚΝΩΝΕΙ μέσα στο υπάρχον bbox).** Όταν ένα δοκάρι
 * πλαισιώνεται σε **μη-αναπτυσσόμενη (στενή) παρειά** γωνιακής κολόνας μίας κατεύθυνσης (EC8 §5.4.2.1.2 —
 * ανεπαρκής κόμβος), η εφαρμογή ΠΡΟΑΓΕΙ την κολόνα σε **Γ/L boundary element** (EC8 §5.4.2.4): η αρχική
 * διατομή ΔΙΑΤΗΡΕΙΤΑΙ ως το **κατακόρυφο σκέλος** (πάχος = στενή διάσταση, μήκος = μεγάλη διάσταση) και
 * **μεγαλώνει** ένα **οριζόντιο σκέλος (foot)** προς το δοκάρι (πάχος = πλάτος δοκαριού = δομική συνέχεια,
 * mirror ADR-496/525· μήκος προεξοχής = `bearingMm`).
 *
 * **Orientation-agnostic κλειστή λύση (ίδιο μοτίβο με ADR-496):**
 *   · `uArm` = η στενή (μη-αναπτυσσόμενη) αξονική διεύθυνση, snapped στη φορά «προς το άνοιγμα» του δοκαριού.
 *   · `uLong = (−uArm.y, uArm.x)` ⇒ μετά το `rotationDegToAlignLocalY(uLong)`, το τοπικό +X (foot) δείχνει
 *     ΑΚΡΙΒΩΣ στο `uArm` (R(θ)·(+X) = (uLong.y, −uLong.x) = uArm) — καμία hard-coded γωνία.
 *   · `flipY` = ποιο άκρο (η μεριά του δοκαριού) → ο foot/γωνία.
 *   · `position`: το κέντρο της αρχικής κολόνας απεικονίζεται στο L-local `(−bearing/2, 0)` (το κατακόρυφο
 *     σκέλος είναι συμμετρικό κατά y, στο αριστερό armWidth του bbox) ⇒ `position = C − R(θ)·((−bearing/2)·s, 0)`
 *     → η αρχική διατομή μένει **ακριβώς στη θέση της**, ο foot προεκτείνεται προς το δοκάρι.
 *
 * Pure + unit-testable. Reuse `unitVector`/`rotateVector`/`rotationDegToAlignLocalY` (grip-math SSoT) +
 * `beamEndsByProximity` (column-beam-align SSoT) + `mmToSceneUnits`. Η τελική γεωμετρία βγαίνει από
 * `computeColumnGeometry` (lshape override) → preview ≡ commit. Ο caller (`column-beam-promote-junction`)
 * κάνει το gating.
 *
 * @see ./column-beam-align.ts — beamEndsByProximity (module SSoT) + ο align δίδυμος (ADR-496, που συρρικνώνει)
 * @see ./column-beam-promote-junction.ts — ο caller που κάνει το gating
 * @see docs/centralized-systems/reference/adrs/ADR-529-beam-promotes-corner-column-to-boundary-element.md
 */

import type { ColumnEntity, ColumnParams } from '../types/column-types';
import type { BeamEntity } from '../types/beam-types';
import { rotateVector, rotationDegToAlignLocalY, unitVector } from '../grips/grip-math';
import { mmToSceneUnits } from '../../utils/scene-units';
import { beamEndsByProximity } from './column-beam-align';

/**
 * Προάγει μια ορθογωνική/τοιχείο κολόνα μίας κατεύθυνσης σε **Γ/L** ώστε να αποκτήσει σκέλος προς το
 * πλαισιωτικό `beam`. Επιστρέφει νέα `ColumnParams` (L-shape) διατηρώντας την αρχική διατομή ως κατακόρυφο
 * σκέλος, ή `null` σε εκφυλισμένο δοκάρι. `bearingMm` = μήκος προεξοχής του νέου σκέλους (EC8 bearing).
 */
export function promoteColumnToBoundaryL(
  column: ColumnEntity,
  beam: BeamEntity,
  bearingMm: number,
): ColumnParams | null {
  const W0 = column.params.width;
  const D0 = column.params.depth;
  const shortDim = Math.min(W0, D0);
  const longDim = Math.max(W0, D0);

  // Στενός (μη-αναπτυσσόμενος) άξονας της κολόνας σε world (column-local axes από το rotation).
  const rad = ((column.params.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const shortAxis = W0 <= D0 ? { x: cos, y: sin } : { x: -sin, y: cos };

  // near = παρειά πλευράς κολόνας· far = προς το άνοιγμα. uArm = στενός άξονας προς το άνοιγμα.
  const cx = column.params.position.x;
  const cy = column.params.position.y;
  const ends = beamEndsByProximity(beam, cx, cy);
  const uOut = unitVector(ends.near, ends.far);
  if (!uOut) return null;
  const sgn = uOut.x * shortAxis.x + uOut.y * shortAxis.y >= 0 ? 1 : -1;
  const uArm = { x: sgn * shortAxis.x, y: sgn * shortAxis.y };

  // uLong ⊥ uArm (chirality: foot → uArm). flipY = η μεριά του δοκαριού κατά μήκος της κολόνας.
  const uLong = { x: -uArm.y, y: uArm.x };
  const rotationDeg = rotationDegToAlignLocalY(uLong);
  const sBeam = (ends.near.x - cx) * uLong.x + (ends.near.y - cy) * uLong.y;
  const flipY = sBeam > 0;

  const s = mmToSceneUnits(column.params.sceneUnits ?? 'mm');
  // κέντρο αρχικής κολόνας → L-local (−bearing/2, 0) (κατακόρυφο σκέλος, αριστερό armWidth, y-συμμετρικό).
  const pC = rotateVector({ x: (-bearingMm / 2) * s, y: 0 }, rotationDeg);

  return {
    ...column.params,
    kind: 'L-shape',
    anchor: 'center',
    rotation: rotationDeg,
    width: shortDim + bearingMm, // bbox-x: στενή διάσταση (σκέλος) + προεξοχή foot προς το δοκάρι
    depth: longDim,              // bbox-y: μήκος αρχικής κολόνας (κατακόρυφο σκέλος, πλήρες depth)
    position: { x: cx - pC.x, y: cy - pC.y, z: column.params.position.z },
    lshape: {
      ...column.params.lshape,
      armWidth: shortDim,        // πάχος κατακόρυφου σκέλους = στενή διάσταση αρχικής κολόνας
      armLength: beam.params.width, // πάχος foot = πλάτος δοκαριού (δομική συνέχεια· EC2/EC8 έδραση ≥ δοκάρι)
      flipY,
      promotedFromBeamId: beam.id, // ADR-529 Φ5 — associative: το foot ακολουθεί το πλάτος δοκαριού
    },
  };
}
