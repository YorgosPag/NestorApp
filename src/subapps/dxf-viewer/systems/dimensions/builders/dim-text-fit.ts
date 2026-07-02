/**
 * ADR-362 Phase M — Text-fit / overlap handling (DIMATFIT / DIMTMOVE consumption).
 *
 * Pure helpers that decide + place dimension text + arrowheads when the measured
 * value does NOT fit between the extension lines — the AutoCAD Fit-tab behaviour
 * (DIMATFIT 0/1/2/3, DIMTIX, DIMTOFL, DIMTMOVE=1 leader). Applies to the
 * linear/aligned family only (single straight dim line + two feet); ordinate/
 * radial/angular have their own leader semantics and are out of scope, matching
 * AutoCAD (DIMATFIT is a linear/rotated/aligned concept).
 *
 * SSoT note: the `dimatfit`/`dimtmove`/`dimtix`/`dimtofl` fields already exist
 * end-to-end (DimStyle type + DXF I/O + FitSection UI + templates). Until now
 * they were DORMANT — no builder/renderer read them, so text always drew at the
 * span midpoint and overlapped the extension lines on narrow dims. This module
 * is the missing CONSUMPTION step; it introduces no new DimStyle field.
 *
 * Architectural node: the "does it fit?" test needs the RENDERED text width,
 * which comes from `ctx.measureText` (render-time). So this module is pure math
 * over already-measured scalars — the renderer measures once (reusing the
 * existing `dim-text-renderer` font SSoT) and passes `textWidth` in. All inputs
 * are in the SAME unit (scene/world units); the resolver is unit-agnostic.
 *
 * Big-player reference (do not invent — AutoCAD Fit tab, web-verified):
 *   - DIMATFIT 0 = both text + arrows outside when they don't both fit.
 *   - DIMATFIT 1 = "arrows": move arrows outside first, then text.
 *   - DIMATFIT 2 = "text": move text outside first, then arrows.
 *   - DIMATFIT 3 = "best fit": move whichever doesn't fit (text kept inside when
 *                  it alone fits — the common preference).
 *   - DIMTIX     = force text between the ext lines regardless of space.
 *   - DIMTOFL    = draw the dim line between the feet even when arrows go outside.
 *   - DIMTMOVE 1 = add a leader connecting the moved text back to the dim line.
 */

import type { Point2D } from '../../../rendering/types/Types';
import {
  addPoints,
  getUnitVector,
  pointOnCircle,
  scalePoint,
} from '../../../rendering/entities/shared/geometry-vector-utils';

/**
 * Scalar inputs for the fit decision. Every length is in the SAME unit (the
 * caller uses scene/world units): `gap` from `|foot2 - foot1|`, `arrowSize` from
 * `paperHeightToModel(dimasz, ...)`, `textGap` from `paperHeightToModel(dimgap,
 * ...)`, `textWidth` from `ctx.measureText(...).width / transform.scale`.
 */
export interface TextFitInput {
  /** Distance between the two feet (span available between the extension lines). */
  readonly gap: number;
  /** Rendered width of the primary text. */
  readonly textWidth: number;
  /** Length of one arrowhead along the dim line. */
  readonly arrowSize: number;
  /** DIMGAP margin between text and the extension line / arrow. */
  readonly textGap: number;
  /** DIMATFIT — 0=both out, 1=arrows first, 2=text first, 3=best fit. */
  readonly dimatfit: number;
  /** DIMTIX — force text between ext lines regardless of space. */
  readonly dimtix: boolean;
  /** DIMTOFL — draw dim line between feet even when arrows go outside. */
  readonly dimtofl: boolean;
  /** DIMTMOVE — 0=with dim line, 1=add leader, 2=free move. */
  readonly dimtmove: number;
}

/** Decision output — consumed by the renderer to place arrows + text + leader. */
export interface TextFitResult {
  /** Text moved beyond the second foot (beside the dim line). */
  readonly textOutside: boolean;
  /** Arrowheads flipped to the outside of the extension lines (tips inward). */
  readonly arrowsOutside: boolean;
  /** Draw the dim line between the two feet (false only when both go outside w/o DIMTOFL). */
  readonly drawDimLineInside: boolean;
  /** Draw a leader from the dim line to the moved text (DIMTMOVE=1 + textOutside). */
  readonly useLeader: boolean;
}

/**
 * Decide text + arrow placement for a linear/aligned dim per the DIMATFIT/DIMTMOVE
 * rules. When everything fits (the common case) returns the "all inside" result —
 * byte-identical to the pre-fit behaviour, so wide dims are untouched.
 */
export function resolveTextFit(input: TextFitInput): TextFitResult {
  const { gap, textWidth, arrowSize, textGap, dimatfit, dimtix, dimtofl, dimtmove } = input;

  const arrowsSpan = 2 * arrowSize;
  // Everything fits between the ext lines → current behaviour (zero regression).
  const textFitsWithArrows = textWidth + arrowsSpan + 2 * textGap <= gap;
  if (textFitsWithArrows) {
    return { textOutside: false, arrowsOutside: false, drawDimLineInside: true, useLeader: false };
  }

  // Individual fit tests drive the DIMATFIT prioritisation.
  const textFitsAlone = textWidth + 2 * textGap <= gap;
  const arrowsFitAlone = arrowsSpan <= gap;

  let textOutside: boolean;
  let arrowsOutside: boolean;
  switch (dimatfit) {
    case 0: // Both text and arrows outside.
      textOutside = true;
      arrowsOutside = true;
      break;
    case 1: // Arrows first: arrows leave; text stays if it then fits alone.
      arrowsOutside = true;
      textOutside = !textFitsAlone;
      break;
    case 2: // Text first: text leaves; arrows stay if they then fit alone.
      textOutside = true;
      arrowsOutside = !arrowsFitAlone;
      break;
    case 3: // Best fit — keep text inside when it alone fits, else keep arrows.
    default:
      if (textFitsAlone) {
        textOutside = false;
        arrowsOutside = true;
      } else if (arrowsFitAlone) {
        textOutside = true;
        arrowsOutside = false;
      } else {
        textOutside = true;
        arrowsOutside = true;
      }
      break;
  }

  // DIMTIX forces text between the ext lines even when it doesn't fit (AutoCAD
  // "Always keep text between ext lines" — faithful even though it may overlap).
  if (dimtix) textOutside = false;

  // Inside dim line drawn unless BOTH go outside AND DIMTOFL is off.
  const drawDimLineInside = dimtofl || !(arrowsOutside && textOutside);
  const useLeader = textOutside && dimtmove === 1;

  return { textOutside, arrowsOutside, drawDimLineInside, useLeader };
}

/** Geometry inputs for placing arrows + text once the fit decision is known. */
export interface LinearFitPlacementInput {
  /** First foot (dim line start, arrow anchor 1). */
  readonly foot1: Point2D;
  /** Second foot (dim line end, arrow anchor 2). */
  readonly foot2: Point2D;
  /** Ideal (inside) text anchor from the geometry builder. */
  readonly textAnchor: Point2D;
  /** Rendered text width (scene units). */
  readonly textWidth: number;
  /** Arrowhead length (scene units). */
  readonly arrowSize: number;
  /** DIMGAP margin (scene units). */
  readonly textGap: number;
  /** Outward unit vector at foot1 from the geometry (`unit(foot2 → foot1)`). */
  readonly arrowDirection1: Point2D;
  /** Outward unit vector at foot2 from the geometry (`unit(foot1 → foot2)`). */
  readonly arrowDirection2: Point2D;
  readonly fit: TextFitResult;
}

/**
 * Adjusted placement — the renderer draws arrows/text/leader from these. Shared
 * by the linear and angular producers (`computeLinearFitPlacement` /
 * `computeAngularFitPlacement`); the shape is identical.
 */
export interface DimFitPlacement {
  readonly arrowDirection1: Point2D;
  readonly arrowDirection2: Point2D;
  readonly textAnchor: Point2D;
  /** Present only when `fit.useLeader` — linear: [dim-line-end, near, far]; angular: [arc-mid, text]. */
  readonly leaderPath?: readonly Point2D[];
}

/**
 * Turn the fit DECISION into concrete arrow directions + text anchor (+ optional
 * leader) for a linear/aligned dim. Text goes beyond the SECOND foot (Giorgio:
 * always past the end, +axis). Arrows-outside = flip the outward directions so
 * the heads sit outside the ext lines pointing inward (`>|  |<`); the renderer
 * keeps the anchors at the feet and adds outside stubs.
 */
export function computeLinearFitPlacement(input: LinearFitPlacementInput): DimFitPlacement {
  const { foot1, foot2, textAnchor, textWidth, arrowSize, textGap, fit } = input;

  const arrowDirection1 = fit.arrowsOutside ? negate(input.arrowDirection1) : input.arrowDirection1;
  const arrowDirection2 = fit.arrowsOutside ? negate(input.arrowDirection2) : input.arrowDirection2;

  if (!fit.textOutside) {
    return { arrowDirection1, arrowDirection2, textAnchor };
  }

  // Text beside the dim line, past foot2. Clear the outside arrow (if any) + gap,
  // then half the text so the whole label sits beyond the extension line.
  const axis = getUnitVector(foot1, foot2);
  const beyond = (fit.arrowsOutside ? 2 * arrowSize : 0) + textGap + textWidth / 2;
  const movedAnchor = addPoints(foot2, scalePoint(axis, beyond));

  if (!fit.useLeader) {
    return { arrowDirection1, arrowDirection2, textAnchor: movedAnchor };
  }

  // AutoCAD-style landing: dogleg from the dim-line end to the text's near edge,
  // then a shelf under the text (near edge → far edge).
  const nearEdge = addPoints(movedAnchor, scalePoint(axis, -textWidth / 2));
  const farEdge = addPoints(movedAnchor, scalePoint(axis, textWidth / 2));
  const leaderPath: readonly Point2D[] = [foot2, nearEdge, farEdge];
  return { arrowDirection1, arrowDirection2, textAnchor: movedAnchor, leaderPath };
}

/** Geometry inputs for placing arrows + text on an ANGULAR dim (arc-aware). */
export interface AngularFitPlacementInput {
  /** Arc centre (the angle vertex). */
  readonly arcCenter: Point2D;
  /** Arc radius (distance vertex → arcPoint). */
  readonly arcRadius: number;
  /** Unwrapped start/end angles (radians); the text sits at their midpoint. */
  readonly arcStartAngle: number;
  readonly arcEndAngle: number;
  /** Ideal (inside) text anchor from the geometry builder (arc midpoint). */
  readonly textAnchor: Point2D;
  readonly textWidth: number;
  readonly arrowSize: number;
  readonly textGap: number;
  /** Tangent-outward unit vectors at the two arc ends (from the geometry). */
  readonly arrowDirection1: Point2D;
  readonly arrowDirection2: Point2D;
  readonly fit: TextFitResult;
}

/** Below this sweep (rad) the arc is treated as degenerate for the radial push. */
const MIN_SWEEP_RAD = 1e-6;

/**
 * Angular counterpart of `computeLinearFitPlacement`. When DIMATFIT moves the
 * text outside, the arc's tangential room is too small — so the text is pushed
 * RADIALLY OUTWARD along the bisector to a radius where the arc is wide enough
 * to hold it (`requiredRadius = (textWidth + 2·textGap) / sweep`), clamped to a
 * sane band so a very small angle doesn't fling the text to infinity (leader
 * covers the residual when DIMTMOVE=1). Arrows-outside flips the tangent
 * directions, exactly like the linear case.
 */
export function computeAngularFitPlacement(input: AngularFitPlacementInput): DimFitPlacement {
  const { arcCenter, arcRadius, arcStartAngle, arcEndAngle, textWidth, arrowSize, textGap, fit } =
    input;

  const arrowDirection1 = fit.arrowsOutside ? negate(input.arrowDirection1) : input.arrowDirection1;
  const arrowDirection2 = fit.arrowsOutside ? negate(input.arrowDirection2) : input.arrowDirection2;

  if (!fit.textOutside) {
    return { arrowDirection1, arrowDirection2, textAnchor: input.textAnchor };
  }

  const midAngle = (arcStartAngle + arcEndAngle) / 2;
  const sweepAbs = Math.abs(arcEndAngle - arcStartAngle);
  const requiredRadius = (textWidth + 2 * textGap) / Math.max(sweepAbs, MIN_SWEEP_RAD);
  const minRadius = arcRadius + textGap + (fit.arrowsOutside ? 2 * arrowSize : 0);
  const maxRadius = arcRadius * 3 + textWidth;
  const outerRadius = Math.min(maxRadius, Math.max(minRadius, requiredRadius));
  const movedAnchor = pointOnCircle(arcCenter, outerRadius, midAngle);

  if (!fit.useLeader) {
    return { arrowDirection1, arrowDirection2, textAnchor: movedAnchor };
  }

  // Radial leader from the arc midpoint out to the moved text.
  const arcMid = pointOnCircle(arcCenter, arcRadius, midAngle);
  const leaderPath: readonly Point2D[] = [arcMid, movedAnchor];
  return { arrowDirection1, arrowDirection2, textAnchor: movedAnchor, leaderPath };
}

function negate(v: Point2D): Point2D {
  return { x: -v.x, y: -v.y };
}
