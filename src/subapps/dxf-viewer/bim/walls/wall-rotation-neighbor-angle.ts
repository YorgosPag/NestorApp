/**
 * ADR-397 §15b — LIVE corner-angle indicator while rotating a joined wall.
 *
 * Ζητούμενο (Giorgio, στιγμιότυπο 153825): όταν περιστρέφεις έναν τοίχο που είναι
 * ΕΝΩΜΕΝΟΣ με άλλον, εκτός από την ένδειξη ΠΕΡΙΣΤΡΟΦΗΣ (πόσο γύρισε ο τοίχος ως προς
 * την αρχική του θέση), να βλέπεις ΚΑΙ την **πραγματική γωνία της κορυφής** που
 * σχηματίζουν οι δύο ΑΞΟΝΕΣ των τοίχων αυτή τη στιγμή (90°, 60°, 30°, 120°, …).
 *
 * Αυτό το module ΔΕΝ ζωγραφίζει — επιστρέφει καθαρά τα geometry inputs για ΤΗΝ ΙΔΙΑ
 * SSoT ένδειξη τόξου (`paintDirectionArc`, ίδιο 🟢/🔴 στυλ με την περιστροφή): pivot =
 * ο κόμβος ένωσης, anchor = σημείο στον άξονα του ΓΕΙΤΟΝΑ (σταθερή αναφορά), cursor =
 * σημείο στον ΖΩΝΤΑΝΟ άξονα του περιστρεφόμενου τοίχου, sweepDeg = signed γωνία μεταξύ
 * τους (για το χρώμα/πρόσημο). Έτσι το δεύτερο τόξο = δεύτερη κλήση του ίδιου paint.
 *
 * Reuse: το SSoT κατώφλι ένωσης `JOIN_THRESHOLD_MM` (ίδιο με τον trim-solver), ώστε ένας
 * τοίχος που το commit θα ένωνε να είναι ο τοίχος που δείχνουμε τη γωνία του.
 *
 * @see canvas-v2/preview-canvas/direction-arc-paint — ο SSoT paint που καταναλώνει το output
 * @see bim/walls/wall-joint-miter-preview — αδελφό feature (ίδιο neighbour-proximity SSoT)
 * @see ADR-397 §15 (rotation direction arc) / §15b (neighbour corner angle)
 */

import type { WallEntity } from '../types/wall-types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { JOIN_THRESHOLD_MM } from './wall-trims';

interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** Geometry inputs for a second `paintDirectionArc` call (all canvas world units). */
export interface NeighborAxisAngle {
  /** Junction corner (shared endpoint) — arc centre. */
  readonly pivotW: Vec2;
  /** Point along the NEIGHBOUR axis, away from the junction — the 0° reference edge. */
  readonly anchorW: Vec2;
  /** Point along the ROTATING wall's LIVE axis, away from the junction — the cursor edge. */
  readonly cursorW: Vec2;
  /** Signed corner angle neighbour→rotating (degrees); sign drives the 🟢/🔴 colour. */
  readonly sweepDeg: number;
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

/** Unit vector from (0,0)→(dx,dy), or null when degenerate (zero-length). */
function unit(dx: number, dy: number): Vec2 | null {
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  return { x: dx / len, y: dy / len };
}

/**
 * Find the wall the rotating wall is joined to at a corner and return the geometry for
 * the corner-angle arc. Scans BOTH rotating endpoints against every neighbour endpoint;
 * a junction exists when they sit within the SSoT `JOIN_THRESHOLD_MM`. When the wall is
 * joined at more than one end, the junction NEAREST `preferNearW` (the rotation pivot —
 * the corner being rotated) wins. Returns `null` when the wall is not joined to any
 * straight neighbour, or when either axis is degenerate.
 *
 * The junction `pivotW` is taken at the rotating wall's LIVE endpoint, so the arc tracks
 * the rotation. The reference (`anchorW`) points OUT along the neighbour (fixed), the
 * cursor (`cursorW`) points OUT along the rotating wall (live) — both at `refRadiusWorld`
 * from the junction so the arc is a stable, on-screen size proportional to the drawing.
 */
export function resolveNeighborAxisAngle(
  rotating: WallEntity,
  neighbours: readonly WallEntity[],
  sceneUnits: SceneUnits,
  refRadiusWorld: number,
  preferNearW?: Vec2 | null,
): NeighborAxisAngle | null {
  if (rotating.kind !== 'straight' || refRadiusWorld <= 0) return null;

  const thr = JOIN_THRESHOLD_MM * mmToSceneUnits(sceneUnits);
  const thr2 = thr * thr;

  const rotEndpoints = [
    { at: rotating.params.start, other: rotating.params.end },
    { at: rotating.params.end, other: rotating.params.start },
  ];

  let best: NeighborAxisAngle | null = null;
  let bestScore = Infinity;

  for (const rEp of rotEndpoints) {
    const rDir = unit(rEp.other.x - rEp.at.x, rEp.other.y - rEp.at.y);
    if (!rDir) continue;

    for (const w of neighbours) {
      if (w.id === rotating.id || w.kind !== 'straight') continue;
      const nEndpoints = [
        { at: w.params.start, other: w.params.end },
        { at: w.params.end, other: w.params.start },
      ];
      for (const nEp of nEndpoints) {
        if (dist2(rEp.at.x, rEp.at.y, nEp.at.x, nEp.at.y) > thr2) continue;
        const nDir = unit(nEp.other.x - nEp.at.x, nEp.other.y - nEp.at.y);
        if (!nDir) continue;

        const jx = rEp.at.x, jy = rEp.at.y; // live corner
        // Prefer the junction closest to the rotation pivot (the corner being rotated).
        const score = preferNearW ? dist2(jx, jy, preferNearW.x, preferNearW.y) : 0;
        if (score >= bestScore) continue;
        bestScore = score;

        const cross = nDir.x * rDir.y - nDir.y * rDir.x;
        const dot = nDir.x * rDir.x + nDir.y * rDir.y;
        best = {
          pivotW: { x: jx, y: jy },
          anchorW: { x: jx + nDir.x * refRadiusWorld, y: jy + nDir.y * refRadiusWorld },
          cursorW: { x: jx + rDir.x * refRadiusWorld, y: jy + rDir.y * refRadiusWorld },
          sweepDeg: (Math.atan2(cross, dot) * 180) / Math.PI,
        };
      }
    }
  }

  return best;
}
