/**
 * Column **head multi-reference** flush snap — Revit «alignment references» (ADR-523, pure SSoT).
 *
 * Γενικεύει το center-on-axis (`resolveAxisCenterFoot`/`resolveMemberAxisCenter`, ADR-398 §3.9/§3.11)
 * από «ΚΕΝΤΡΟ κολόνας ↔ άξονας τοίχου» σε **reference-line ↔ reference-line**: η κεφαλή (flange) μιας
 * Τ-κολόνας εκθέτει ΤΡΕΙΣ παράλληλες γραμμές αναφοράς (βόρεια 1-2 / άξονας Γ / νότια ε) και κουμπώνει
 * στις ΤΡΕΙΣ του τοίχου (βόρεια +ημι-πάχος / άξονας 0 / νότια −ημι-πάχος), **nearest-wins** κάθετα +
 * **ολίσθηση κατά μήκος** της παρειάς. Ισοδύναμο με τις «alignment references» της Revit.
 *
 * **Orientation-agnostic:** δοκιμάζονται ΚΑΙ οι δύο προσανατολισμοί κεφαλής (sgn ∈ {+1,−1}); ο nearest
 * επιλέγει αυτόματα τον προσανατολισμό που τοποθετεί την κολόνα στην πλευρά του κέρσορα (η κεφαλή
 * «κοιτάει» τον τοίχο). Έτσι δουλεύει για `flipY`, λοξό τοίχο, και κίνηση Ν↔Β χωρίς special-case.
 *
 * **FULL SSoT reuse (μηδέν διπλότυπο):** wall refs από `buildMemberAxisFrame` (axis ± ημι-πάχος)·
 * flange refs από `tshapeHeadReferences` (ΙΔΙΕΣ φόρμουλες με το footprint)· `buildCenteredAxisFaceFrame`
 * για τις CL listening dims· `axisAlignmentRotationDeg` για flush στροφή· `clamp` για ολίσθηση. Pure
 * (zero React/DOM/store). Μονάδες: scene units. Kind-dispatch: **T-shape** (κεφαλή) + **L-shape**
 * (οριζόντιο σκέλος) σήμερα με τον ΙΔΙΟ generic matcher· I/U flanges αργότερα.
 *
 * @see ./column-face-snap.ts — ο resolver/tier που το καταναλώνει (nearest-wins με edge/bbox/polar/rect)
 * @see ../geometry/column-head-references.ts — tshapeHeadReferences (SSoT γεωμετρία κεφαλής)
 * @see docs/centralized-systems/reference/adrs/ADR-523-column-head-multi-reference-snap.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnKind, ColumnTshapeParams, ColumnLshapeParams } from '../types/column-types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { tshapeHeadReferences, lshapeHeadReferences } from '../geometry/column-head-references';
import { MEMBER_GHOST_CAPTURE_MM } from '../framing/member-column-face-snap';
import type { LinearMemberSnapTarget, GhostFaceFrame } from '../framing/linear-member-face-snap';
import {
  clamp,
  buildMemberAxisFrame,
  axisAlignmentRotationDeg,
  buildCenteredAxisFaceFrame,
} from './column-face-snap-helpers';

/**
 * Οι reference lines της κεφαλής ενός ghost — signed perpendicular offsets από το ΚΕΝΤΡΟ κατά τον
 * τοπικό y (scene units) + ημι-μήκος κεφαλής (along). Index 1 = ο κεντρικός άξονας (Γ) → tie-break.
 */
export interface HeadReferenceLines {
  readonly perps: readonly number[];
  readonly alongHalf: number;
}

/**
 * SSoT builder — οι head reference lines του ενεργού ghost ανά `kind` (scene units). **T-shape**
 * (κεφαλή/flange) ΚΑΙ **L-shape** (οριζόντιο σκέλος) σήμερα· για κάθε άλλο kind → `null` (ο tier μένει
 * αδρανής → μηδέν regression). Η διάσταση width/depth δίνεται ΗΔΗ resolved από τον caller (ίδιο SSoT
 * defaults με το commit). Kind-dispatch σε ΚΟΙΝΟ `*HeadReferences` SSoT (ΙΔΙΑ γεωμετρία με το footprint).
 */
export function buildColumnHeadReferences(
  kind: ColumnKind,
  widthMm: number,
  depthMm: number,
  tshape: ColumnTshapeParams | undefined,
  lshape: ColumnLshapeParams | undefined,
  sceneUnits: SceneUnits,
): HeadReferenceLines | null {
  const s = mmToSceneUnits(sceneUnits);
  if (kind === 'T-shape') {
    const { perps, alongHalf } = tshapeHeadReferences(widthMm, depthMm, s, tshape);
    return { perps, alongHalf };
  }
  if (kind === 'L-shape') {
    const { perps, alongHalf } = lshapeHeadReferences(widthMm, depthMm, s, lshape);
    return { perps, alongHalf };
  }
  return null;
}

/** Αποτέλεσμα multi-reference snap (ο `column-face-snap` το τυλίγει σε `ColumnFaceSnap`). */
export interface HeadReferenceSnapResult {
  readonly position: Point2D;
  /** Flush στροφή (μοίρες, world) — 0/180 για axis-aligned τοίχο, λοξός → atan2(±180). */
  readonly rotation: number;
  readonly faceFrame: GhostFaceFrame;
  /** Κάθετο υπόλοιπο (scene units) — για nearest-wins με τα υπόλοιπα tiers. */
  readonly dist: number;
}

/** Wall reference offsets ως πολλαπλάσια του ημι-πάχους: βόρεια / άξονας / νότια. */
const WALL_REF_SIGNS = [1, 0, -1] as const;
const EPS = 1e-9;

/**
 * ADR-523 — multi-reference matcher. Για κάθε τοίχο: προβάλλει τον cursor (along/perp) στον άξονα,
 * δοκιμάζει κάθε ζεύγος (flangeRef × wallRef) × προσανατολισμό, και κρατά το **πλησιέστερο κάθετα**
 * εντός capture (tie → άξονας↔άξονας). `position` = a + along·u + centerPerp·n ώστε η flangeRef να
 * πέσει ΑΚΡΙΒΩΣ πάνω στη wallRef· `rotation` = flush. `null` όταν ο cursor είναι εκτός μήκους/ζώνης
 * (→ ο caller πέφτει σε flush περιμετρικά). Pure (scene units).
 */
export function resolveColumnHeadReferenceSnap(
  cursor: Readonly<Point2D>,
  walls: readonly LinearMemberSnapTarget[],
  head: Readonly<HeadReferenceLines>,
  sceneUnits: SceneUnits,
): HeadReferenceSnapResult | null {
  if (walls.length === 0 || head.perps.length === 0) return null;
  // `dist` = απόσταση cursor→υποψήφιο κέντρο κολόνας → capture = το καθιερωμένο magnet (ίδιο με edge/bbox).
  const perpCapture = MEMBER_GHOST_CAPTURE_MM * mmToSceneUnits(sceneUnits);
  let best: HeadReferenceSnapResult | null = null;
  let bestIsAxisAxis = false;

  for (const w of walls) {
    const fr = buildMemberAxisFrame(w.axis, w.outline);
    if (!fr) continue;
    const n: Point2D = { x: -fr.u.y, y: fr.u.x }; // αριστερό κάθετο (signed perp)
    const relX = cursor.x - fr.a.x;
    const relY = cursor.y - fr.a.y;
    const cursorAlong = relX * fr.u.x + relY * fr.u.y;
    const cursorPerp = relX * n.x + relY * n.y;
    // Εκτός μήκους τοίχου (με υπέρβαση = ημι-κεφαλή) → flush περιμετρικά (άλλος tier).
    if (cursorAlong < fr.alongMin - head.alongHalf || cursorAlong > fr.alongMax + head.alongHalf) continue;
    const along = clamp(cursorAlong, fr.alongMin, fr.alongMax);
    const rot0 = axisAlignmentRotationDeg(fr.u);

    for (let pi = 0; pi < head.perps.length; pi++) {
      const p = head.perps[pi];
      for (let wi = 0; wi < WALL_REF_SIGNS.length; wi++) {
        const wp = WALL_REF_SIGNS[wi] * fr.halfThickness;
        for (const sgn of [1, -1] as const) {
          const centerPerp = wp - sgn * p; // flangeRef@(centerPerp + sgn·p) === wallRef@wp
          const dist = Math.abs(cursorPerp - centerPerp);
          if (dist > perpCapture) continue;
          const isAxisAxis = pi === 1 && wi === 1; // Γ↔Δ
          const wins =
            !best ||
            dist < best.dist - EPS ||
            (Math.abs(dist - best.dist) <= EPS && isAxisAxis && !bestIsAxisAxis);
          if (!wins) continue;
          best = {
            position: {
              x: fr.a.x + along * fr.u.x + centerPerp * n.x,
              y: fr.a.y + along * fr.u.y + centerPerp * n.y,
            },
            rotation: sgn === 1 ? rot0 : rot0 + 180,
            faceFrame: buildCenteredAxisFaceFrame(fr.a, fr.u, n, fr.alongMin, fr.alongMax, along),
            dist,
          };
          bestIsAxisAxis = isAxisAxis;
        }
      }
    }
  }
  return best;
}
