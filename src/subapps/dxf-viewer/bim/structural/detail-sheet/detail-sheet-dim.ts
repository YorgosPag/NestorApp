/**
 * ADR-457 — Detail sheet dimension geometry (pure SSoT).
 *
 * Resolves a declarative {@link DimPrimitive} (two measured points + a
 * perpendicular offset + text) into the concrete geometry of a linear
 * dimension in **sheet-millimetres**: extension lines, the dimension line,
 * two filled arrowheads and the (rotation-corrected) text anchor.
 *
 * Backend-agnostic: both the Canvas preview and the jsPDF export consume this
 * one resolver so the dimensions look identical (preview === PDF). Kept
 * deliberately self-contained (a lightweight AutoCAD/Revit-style linear dim)
 * rather than coupling to the live `DimensionRenderer`/DIMSTYLE pipeline.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/detail-sheet-dim
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { DimPrimitive } from './detail-sheet-types';

/** Gap (mm) between the measured object and the start of the extension line. */
const EXT_GAP_MM = 1;
/** Overshoot (mm) of the extension line past the dimension line. */
const EXT_OVERSHOOT_MM = 1.5;
/** Arrowhead length (mm) along the dimension axis. */
const ARROW_LEN_MM = 2.4;
/** Arrowhead half-width (mm) across the dimension axis. */
const ARROW_HALF_W_MM = 0.8;
/** Gap (mm) between the dimension line and the text centre. */
const TEXT_GAP_MM = 1.1;
/** Default text cap height (mm) when the primitive omits it. */
const DEFAULT_TEXT_HEIGHT_MM = 2.6;

/** A resolved linear dimension, ready for either render backend (sheet-mm). */
export interface ResolvedDimGeometry {
  readonly extensionLines: readonly (readonly [Point2D, Point2D])[];
  readonly dimensionLine: readonly [Point2D, Point2D];
  /** Two filled arrowhead triangles (3 points each). */
  readonly arrowheads: readonly (readonly Point2D[])[];
  readonly textPosition: Point2D;
  readonly textAngleRad: number;
  readonly textHeightMm: number;
  readonly text: string;
}

function sub(a: Point2D, b: Point2D): Point2D { return { x: a.x - b.x, y: a.y - b.y }; }
function add(a: Point2D, b: Point2D): Point2D { return { x: a.x + b.x, y: a.y + b.y }; }
function scale(a: Point2D, k: number): Point2D { return { x: a.x * k, y: a.y * k }; }
function mid(a: Point2D, b: Point2D): Point2D { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

function normalize(v: Point2D): Point2D {
  const len = Math.hypot(v.x, v.y);
  return len < 1e-9 ? { x: 1, y: 0 } : { x: v.x / len, y: v.y / len };
}

/** Resolves the full geometry of a linear dimension (pure, sheet-mm). */
export function resolveDimGeometry(dim: DimPrimitive): ResolvedDimGeometry {
  const axis = normalize(sub(dim.p2, dim.p1));
  // Left-hand normal; the offset sign chooses the side the dim line sits on.
  const normal: Point2D = { x: -axis.y, y: axis.x };
  const offSign = dim.offsetMm >= 0 ? 1 : -1;
  const offAbs = Math.abs(dim.offsetMm);
  const offDir = scale(normal, offSign);

  const dimP1 = add(dim.p1, scale(normal, dim.offsetMm));
  const dimP2 = add(dim.p2, scale(normal, dim.offsetMm));

  const extLine1: [Point2D, Point2D] = [
    add(dim.p1, scale(offDir, EXT_GAP_MM)),
    add(dim.p1, scale(offDir, offAbs + EXT_OVERSHOOT_MM)),
  ];
  const extLine2: [Point2D, Point2D] = [
    add(dim.p2, scale(offDir, EXT_GAP_MM)),
    add(dim.p2, scale(offDir, offAbs + EXT_OVERSHOOT_MM)),
  ];

  const arrow1 = buildArrowhead(dimP1, axis, normal);
  const arrow2 = buildArrowhead(dimP2, scale(axis, -1), normal);

  // Rotation-corrected text angle (never upside-down).
  let angle = Math.atan2(axis.y, axis.x);
  if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;

  const textHeightMm = dim.textHeightMm ?? DEFAULT_TEXT_HEIGHT_MM;
  const textPosition = add(
    mid(dimP1, dimP2),
    scale(offDir, TEXT_GAP_MM + textHeightMm / 2),
  );

  return {
    extensionLines: [extLine1, extLine2],
    dimensionLine: [dimP1, dimP2],
    arrowheads: [arrow1, arrow2],
    textPosition,
    textAngleRad: angle,
    textHeightMm,
    text: dim.text,
  };
}

/** Filled triangle with its tip at `tip`, opening along `dir`. */
function buildArrowhead(tip: Point2D, dir: Point2D, normal: Point2D): readonly Point2D[] {
  const base = add(tip, scale(dir, ARROW_LEN_MM));
  return [
    tip,
    add(base, scale(normal, ARROW_HALF_W_MM)),
    add(base, scale(normal, -ARROW_HALF_W_MM)),
  ];
}
