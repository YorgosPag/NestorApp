/**
 * ADR-363/396 — 3D straight-wall opening pieces (κάθετη παρειά SSoT).
 *
 * Το 3D wall punch (`buildStraightWallWithOpenings`) σπάει έναν straight τοίχο σε
 * κατακόρυφα solid κομμάτια γύρω/ανάμεσα στα ανοίγματα (jambs + ποδιά + πρέκι).
 * Κάθε κομμάτι = footprint quad (outer/inner) εξωθημένο καθ' ύψος.
 *
 * 🔴 **Root του «τραπεζοειδούς τοίχου» στο 3D (Giorgio 2026-05-30):** η παλιά
 * έκδοση όριζε την παρειά κάθε ανοίγματος ως `lerp(outerEdge, sF)` + `lerp(innerEdge, sF)`
 * με **κοινό fraction** `sF = offset/axisLen`. Σε τοίχο με **miters**, η `outerEdge`
 * και η `innerEdge` έχουν διαφορετικό μήκος/start → το ίδιο fraction πέφτει σε
 * **διαφορετική αξονική θέση** ανά πλευρά → η παρειά βγαίνει **λοξή** (ο τοίχος
 * μαζεύεται στη μία όψη, επεκτείνεται στην άλλη) → κενά/υπερβάσεις με τη μόνωση
 * περβαζιού Z4 (που χρησιμοποιεί το κάθετο `outline`).
 *
 * **Fix (κοινό jamb-plane SSoT):** η παρειά στις άκρες κάθε ανοίγματος παίρνεται
 * από τις **κάθετες γωνίες του `opening.geometry.outline`** (ίδιο SSoT με wall
 * punch 2D + Z4 reveal + Z1 cut) → collinear σε 2D ΚΑΙ 3D. Fallback σε fraction-lerp
 * μόνο όταν λείπει το outline (legacy/pre-geometry callers).
 *
 * @see ../../bim/geometry/opening-geometry (buildOutline — κάθετες jamb γωνίες)
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3
 */

import type { Point3D } from '../../bim/types/bim-base';
import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import { mmToSceneUnits } from '../../utils/scene-units';
import { structuralRevealHeightRangeMm } from '../../bim/geometry/opening-geometry';

const MM_TO_M = 0.001;

/** Ένα κατακόρυφο κομμάτι τοίχου: footprint quad (plan) + κατακόρυφο εύρος (ΜΕΤΡΑ). */
export interface WallOpeningPiece {
  /** 4 plan κορυφές `[outer@a, outer@b, inner@b, inner@a]` (ίδιο winding με buildWallShape). */
  readonly quad: readonly [Point3D, Point3D, Point3D, Point3D];
  readonly zBotM: number;
  readonly zTopM: number;
}

interface Boundary {
  readonly f: number;
  readonly outer: Point3D;
  readonly inner: Point3D;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerpPt(p: Point3D, q: Point3D, t: number): Point3D {
  return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, z: 0 };
}

/** Απόσταση² σημείου `p` από την άπειρη γραμμή `a→b`. */
function distToLine2(p: Point3D, a: Point3D, b: Point3D): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) { const ex = p.x - a.x, ey = p.y - a.y; return ex * ex + ey * ey; }
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  const cx = a.x + t * dx, cy = a.y + t * dy;
  const ex = p.x - cx, ey = p.y - cy;
  return ex * ex + ey * ey;
}

/**
 * Υπολογίζει τα κατακόρυφα κομμάτια ενός straight τοίχου με ανοίγματα. Pure SSoT —
 * ο 3D builder κάνει μόνο extrude + position. Επιστρέφει null σε degenerate input.
 */
export function computeWallOpeningPieces(
  wall: WallEntity,
  openings: readonly OpeningEntity[],
): WallOpeningPiece[] | null {
  const outer = wall.geometry.outerEdge.points;
  const inner = wall.geometry.innerEdge.points;
  if (outer.length < 2 || inner.length < 2) return null;
  const oS = outer[0], oE = outer[outer.length - 1];
  const iS = inner[0], iE = inner[inner.length - 1];

  const aS = wall.params.start, aE = wall.params.end;
  const axisLen = Math.hypot(aE.x - aS.x, aE.y - aS.y);
  if (axisLen < 1e-9) return null;

  const mmFactor = mmToSceneUnits(wall.params.sceneUnits ?? 'mm');
  const heightM = wall.params.height * MM_TO_M;

  const lerpBoundary = (f: number): Boundary => ({ f, outer: lerpPt(oS, oE, f), inner: lerpPt(iS, iE, f) });

  // Από δύο jamb γωνίες outline → ποια είναι στην εξωτ. (πλησιέστερη στη γραμμή outer).
  const classify = (cA: Point3D, cB: Point3D): { outer: Point3D; inner: Point3D } =>
    distToLine2(cA, oS, oE) <= distToLine2(cB, oS, oE)
      ? { outer: cA, inner: cB }
      : { outer: cB, inner: cA };

  const makePiece = (a: Boundary, b: Boundary, zBotM: number, zTopM: number): WallOpeningPiece => ({
    quad: [a.outer, b.outer, b.inner, a.inner],
    zBotM,
    zTopM,
  });

  const pieces: WallOpeningPiece[] = [];
  const sorted = [...openings].sort((a, b) => a.params.offsetFromStart - b.params.offsetFromStart);
  let cursor: Boundary = lerpBoundary(0);

  for (const op of sorted) {
    // ADR-396 — STRUCTURAL κενό: η μόνωση Z4 τρώει τον τοίχο → το κόψιμο διευρύνεται
    // κατά `t` περιμετρικά (πλάτος ±t κατά άξονα· ύψος structuralRevealHeightRangeMm).
    // Χωρίς reveal → tScene=0 + structural range = free (αμετάβλητο).
    const tScene = (op.params.revealInsulation?.thickness_m ?? 0) * 1000 * mmFactor;
    const startMm = op.params.offsetFromStart * mmFactor;
    const sF = clamp01((startMm - tScene) / axisLen);
    const eF = clamp01((startMm + op.params.width * mmFactor + tScene) / axisLen);
    if (eF <= sF) continue;

    // Κάθετη παρειά από το STRUCTURAL outline (SSoT)· fallback fraction-lerp όταν λείπει.
    const verts = (op.geometry?.revealOutline ?? op.geometry?.outline)?.vertices;
    let sBound: Boundary, eBound: Boundary;
    if (verts && verts.length >= 4) {
      const s = classify(verts[0], verts[3]); // start jamb γωνίες
      const e = classify(verts[1], verts[2]); // end jamb γωνίες
      sBound = { f: sF, outer: s.outer, inner: s.inner };
      eBound = { f: eF, outer: e.outer, inner: e.inner };
    } else {
      sBound = lerpBoundary(sF);
      eBound = lerpBoundary(eF);
    }

    if (sF > cursor.f + 1e-6) pieces.push(makePiece(cursor, sBound, 0, heightM)); // jamb πριν
    const { bottomMm, topMm } = structuralRevealHeightRangeMm(op.params);
    const bottomM = bottomMm * MM_TO_M;
    const topM = topMm * MM_TO_M;
    if (bottomM > 1e-6) pieces.push(makePiece(sBound, eBound, 0, Math.min(bottomM, heightM))); // ποδιά
    if (topM < heightM - 1e-6) pieces.push(makePiece(sBound, eBound, topM, heightM)); // πρέκι
    cursor = eBound;
  }
  if (cursor.f < 1 - 1e-6) pieces.push(makePiece(cursor, lerpBoundary(1), 0, heightM)); // jamb μετά

  return pieces.length > 0 ? pieces : null;
}
