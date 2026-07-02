/**
 * ADR-362 Phase M3 — Radial text-fit (DIMTIX / DIMTOFL / DIMTMOVE consumption).
 *
 * Pure helpers that decide + place radial dimension text + leader for the radial
 * family (radius / diameter / arcLength / joggedRadius). This is the radial
 * counterpart of the linear/angular `dim-text-fit.ts` — but radial is a
 * GEOMETRY-LEVEL decision (text inside vs outside the circle/arc), so — unlike
 * linear/angular — it needs NO render-time `ctx.measureText`. It is therefore
 * pure math over the anchors/leader segments the builder already computes, which
 * is why it lives at the builder level and the `assembleDimFit` radial
 * short-circuit stays `null`.
 *
 * SSoT note: `dimtix`/`dimtofl`/`dimtmove` already exist end-to-end (DimStyle type
 * + DXF I/O + FitSection UI + templates). Until now they were DORMANT for radial —
 * no builder/renderer read them, so radial text sat at one fixed spot regardless
 * of style. This module is the missing CONSUMPTION step; it introduces no new
 * DimStyle field and no new DXF I/O.
 *
 * Big-player reference (do NOT invent — AutoCAD DIMTIX/DIMTOFL/DIMTMOVE for
 * radial, web-verified against Autodesk docs):
 *   - DIMTIX on  = forces radial dimension text OUTSIDE the circle or arc
 *                  (counterintuitive but the documented AutoCAD behaviour).
 *   - DIMTOFL on = draws the dimension line/leader INSIDE the circle/arc even
 *                  when the text is placed outside.
 *   - DIMTMOVE 1 = adds a landing leader connecting the moved-out text.
 */

import type { Point2D } from '../../../rendering/types/Types';
import {
  addPoints,
  pointsEqual,
  scalePoint,
} from '../../../rendering/entities/shared/geometry-vector-utils';

/** DIMTMOVE=1 landing tail length as a multiple of the arrow size (pure — no text
 *  width needed at builder time; mirrors AutoCAD's short horizontal landing). */
const LANDING_ARROW_FACTOR = 2;

/** Style flags + variant default that drive the radial fit decision. */
export interface RadialTextFitInput {
  /** Where the text sits with DIMTIX off: radius/jogged = true, diameter/arcLength = false. */
  readonly defaultOutside: boolean;
  /** The diameter chord is the dimension line itself → always drawn inside. */
  readonly isDiameter: boolean;
  /** DIMTIX — on forces radial text outside the circle/arc. */
  readonly dimtix: boolean;
  /** DIMTOFL — draw the dim line/leader inside even when text is outside. */
  readonly dimtofl: boolean;
  /** DIMTMOVE — 0=with dim line, 1=add leader landing, 2=free move. */
  readonly dimtmove: number;
}

/** Decision output — consumed by `computeRadialPlacement` to assemble the leader. */
export interface RadialTextFitResult {
  /** Text placed outside the circle/arc (else at the inside anchor). */
  readonly textOutside: boolean;
  /** Draw the inside portion of the leader (radial line / chord / arc). */
  readonly drawLineInside: boolean;
  /** Append a landing tail to the moved-out text (DIMTMOVE=1 + textOutside). */
  readonly useLeader: boolean;
}

/**
 * Decide radial text + leader placement per the faithful-AutoCAD DIMTIX/DIMTOFL/
 * DIMTMOVE rules. When every flag is at its default (dimtix off, dimtofl off,
 * dimtmove 0) the result reproduces the pre-M3 behaviour exactly, so existing
 * radial dims are untouched (zero regression).
 */
export function resolveRadialTextFit(input: RadialTextFitInput): RadialTextFitResult {
  const { defaultOutside, isDiameter, dimtix, dimtofl, dimtmove } = input;

  // DIMTIX on forces the text outside; radius/jogged are already outside by default.
  const textOutside = defaultOutside || dimtix;
  // The inside line is drawn: always for the diameter chord, when the text is
  // inside anyway, or when DIMTOFL forces it inside while the text is outside.
  const drawLineInside = isDiameter || !textOutside || dimtofl;
  const useLeader = textOutside && dimtmove === 1;

  return { textOutside, drawLineInside, useLeader };
}

/** Geometry inputs for materialising the radial placement once the fit is known. */
export interface RadialPlacementInput {
  readonly fit: RadialTextFitResult;
  /** Text anchor when the label sits inside the circle/arc. */
  readonly insideAnchor: Point2D;
  /** Text anchor when the label sits outside the circle/arc. */
  readonly outsideAnchor: Point2D;
  /** Inside portion of the leader (radius: `[center, arcPoint]`; diameter chord;
   *  arcLength: arc samples). Ends where `outsideLeaderPath` begins. */
  readonly insideLinePath: readonly Point2D[];
  /** Outside portion of the leader (radius: `[arcPoint, leaderEnd]`). */
  readonly outsideLeaderPath: readonly Point2D[];
  /** Outward unit direction for the DIMTMOVE landing tail. */
  readonly outwardDir: Point2D;
  /** Arrow size (scene units) — drives the landing tail length. */
  readonly arrowSize: number;
}

/** Resolved radial placement — the builder writes these onto the geometry. */
export interface RadialPlacement {
  readonly textAnchor: Point2D;
  readonly leaderPath: readonly Point2D[];
}

/**
 * Turn the radial fit DECISION into a concrete text anchor + leader polyline.
 * Assembles `[insideLinePath?] + [outsideLeaderPath?] + [landing?]`, de-duplicating
 * the shared junction point so the inside line and outside leader join cleanly.
 * The returned `leaderPath` also feeds the radial hit-test (which walks
 * `leaderPath`), so the DIMTOFL inside line becomes pickable for free.
 */
export function computeRadialPlacement(input: RadialPlacementInput): RadialPlacement {
  const { fit, insideAnchor, outsideAnchor, insideLinePath, outsideLeaderPath } = input;

  const path: Point2D[] = [];
  if (fit.drawLineInside) appendPath(path, insideLinePath);
  if (fit.textOutside) appendPath(path, outsideLeaderPath);

  if (fit.useLeader && path.length > 0) {
    const tail = path[path.length - 1];
    path.push(addPoints(tail, scalePoint(input.outwardDir, LANDING_ARROW_FACTOR * input.arrowSize)));
  }

  return {
    textAnchor: fit.textOutside ? outsideAnchor : insideAnchor,
    leaderPath: path,
  };
}

/** Append `next` onto `path`, skipping a leading point equal to the current tail. */
function appendPath(path: Point2D[], next: readonly Point2D[]): void {
  for (const p of next) {
    if (path.length > 0 && pointsEqual(path[path.length - 1], p)) continue;
    path.push(p);
  }
}
