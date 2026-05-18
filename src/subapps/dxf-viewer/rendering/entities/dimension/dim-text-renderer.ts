/**
 * ADR-362 Phase C1 — DIMSTYLE-driven text rendering.
 *
 * Composes + draws the primary dim text at the geometry's `textAnchor` with
 * its `textRotation`. Reuses `composePrimaryText` / `formatAngularMeasurement`
 * (Phase A3) for content + DIMSTYLE-aware formatting; reuses `buildUIFont` for
 * font composition (ADR-091).
 *
 * Scope:
 *   - Linear/Radial: `composePrimaryText` (DIMLFAC → DIMRND → DIMLUNIT → DIMDSEP → DIMPOST).
 *   - Angular: `formatAngularMeasurement` (DIMAUNIT/DIMADEC → DIMDSEP). Angular
 *     dims never honour DIMLFAC.
 *   - `isDiameter` → 'Ø ' prefix.
 *   - `userText === ''` (suppress) → no draw.
 *
 * Out of scope (later phases):
 *   - Tolerance / limits stacking (Phase G2)
 *   - Alternate-unit dual display (Phase G3)
 *   - Background mask (DIMTFILL, Phase G2)
 *   - Inspection marker (Phase G3)
 */

import type {
  DimensionEntity,
  DimStyle,
  DimToleranceJustify,
} from '../../../types/dimension';
import type { DimGeometry } from '../../../systems/dimensions/dim-geometry-builder';
import {
  composePrimaryText,
  composeFullDimText,
  formatAngularMeasurement,
  type FullDimText,
} from '../../../systems/dimensions/dim-text-formatter';
import { resolveDimColor } from './dim-color-resolver';
import { buildUIFont } from '../../../config/text-rendering-config';
import type { ViewTransform } from '../../types/Types';
import { CoordinateTransforms } from '../../core/CoordinateTransforms';

const RADIAL_DIAMETER_PREFIX = 'Ø ';
const RADIAL_RADIUS_PREFIX = 'R ';

interface DimTextRenderParams {
  readonly entity: DimensionEntity;
  readonly geometry: DimGeometry;
  readonly style: DimStyle;
  readonly transform: ViewTransform;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly layerColour: string | undefined;
}

export function renderDimensionText(
  ctx: CanvasRenderingContext2D,
  params: DimTextRenderParams,
): void {
  const screenAnchor = CoordinateTransforms.worldToScreen(
    params.geometry.textAnchor,
    params.transform,
    params.viewport,
  );
  // DIMTXT is world-mm; screen height = DIMTXT × view scale (mirrors TextRenderer ADR-344).
  const primaryHeight = params.style.dimtxt * params.transform.scale;
  // DXF angles are CCW, canvas is CW with Y-flip → negate (matches TextRenderer note).
  const screenRotation = -params.geometry.textRotation;
  const colour = resolveDimColor(params.style.dimclrt, params.layerColour);
  const fontFamily = params.style.textFontFamily || 'arial';

  // Angular dims have their own formatting path — no tolerance/limits support in G2.
  if (params.geometry.kind === 'angular') {
    const text = buildPrimaryText(params.geometry, params.style, params.entity.userText);
    if (!text) return;
    ctx.save();
    ctx.translate(screenAnchor.x, screenAnchor.y);
    ctx.rotate(screenRotation);
    ctx.fillStyle = colour;
    ctx.font = buildUIFont(primaryHeight, fontFamily);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);
    ctx.restore();
    return;
  }

  const full = buildFullText(params.geometry, params.style, params.entity.userText);
  if (!full.primary && !full.limitsUpper) return;

  ctx.save();
  ctx.translate(screenAnchor.x, screenAnchor.y);
  ctx.rotate(screenRotation);
  ctx.fillStyle = colour;
  ctx.textAlign = 'center';

  if (full.limitsUpper !== undefined && full.limitsLower !== undefined) {
    drawLimitsStack(ctx, full.limitsUpper, full.limitsLower, primaryHeight, fontFamily);
  } else if (full.tolerancePlus !== undefined && full.toleranceMinus !== undefined) {
    drawToleranceStack(
      ctx, full.primary, full.tolerancePlus, full.toleranceMinus,
      primaryHeight, params.style.dimtfac, params.style.dimtolj, fontFamily,
    );
  } else {
    if (!full.primary) { ctx.restore(); return; }
    ctx.font = buildUIFont(primaryHeight, fontFamily);
    ctx.textBaseline = 'middle';
    ctx.fillText(full.primary, 0, 0);
  }

  ctx.restore();
}

/**
 * Draws upper/lower limits stacked vertically (no primary text).
 * Both drawn at tolerance size (dimtxt × dimtfac).
 */
function drawLimitsStack(
  ctx: CanvasRenderingContext2D,
  upper: string,
  lower: string,
  primaryHeight: number,
  fontFamily: string,
): void {
  const tolHeight = primaryHeight * 0.75;
  const gap = tolHeight * 0.1;
  const halfStack = tolHeight + gap / 2;
  ctx.font = buildUIFont(tolHeight, fontFamily);
  ctx.textBaseline = 'middle';
  ctx.fillText(upper, 0, -halfStack);
  ctx.fillText(lower, 0, halfStack);
}

/**
 * Draws primary text with +/− tolerance lines stacked above/below.
 * DIMTOLJ: 0=bottom-align, 1=middle-align (default), 2=top-align.
 */
function drawToleranceStack(
  ctx: CanvasRenderingContext2D,
  primary: string,
  plus: string,
  minus: string,
  primaryHeight: number,
  dimtfac: number,
  dimtolj: DimToleranceJustify,
  fontFamily: string,
): void {
  const tolHeight = primaryHeight * Math.max(dimtfac, 0.1);
  const gap = tolHeight * 0.1;
  // Full height of stacked ± block (two lines of tolerance text).
  const stackHeight = tolHeight * 2 + gap;

  // Vertical offset of primary baseline relative to textAnchor by DIMTOLJ.
  let primaryOffsetY: number;
  if (dimtolj === 'bottom') {
    // primary top-aligns with tolerance stack top.
    primaryOffsetY = stackHeight / 2 - primaryHeight / 2;
  } else if (dimtolj === 'top') {
    // primary bottom-aligns with tolerance stack bottom.
    primaryOffsetY = -(stackHeight / 2 - primaryHeight / 2);
  } else {
    // middle (default) — primary centred relative to tolerance stack.
    primaryOffsetY = 0;
  }

  const tolTopY = primaryOffsetY - primaryHeight / 2 - gap / 2 - tolHeight / 2;
  const tolBotY = primaryOffsetY + primaryHeight / 2 + gap / 2 + tolHeight / 2;

  ctx.font = buildUIFont(primaryHeight, fontFamily);
  ctx.textBaseline = 'middle';
  ctx.fillText(primary, 0, primaryOffsetY);

  ctx.font = buildUIFont(tolHeight, fontFamily);
  ctx.fillText(plus, 0, tolTopY);
  ctx.fillText(minus, 0, tolBotY);
}

function buildPrimaryText(
  geometry: DimGeometry,
  style: DimStyle,
  userText: string | undefined,
): string {
  // Empty user text = suppress (AutoCAD parity, `composePrimaryText` returns '').
  if (userText === '') return '';

  if (geometry.kind === 'angular') {
    const measured = formatAngularMeasurement(geometry.measurementValue, style);
    return applyUserTextToken(userText, measured);
  }

  if (geometry.kind === 'radial') {
    const measured = composePrimaryText(geometry.measurementValue, style, userText);
    if (!measured) return '';
    // Only prefix when user text is the measured token ('' / undefined / '<>'),
    // otherwise the user already provided custom text (don't double-prefix).
    if (userText === undefined || userText === '<>') {
      return (geometry.isDiameter ? RADIAL_DIAMETER_PREFIX : RADIAL_RADIUS_PREFIX) + measured;
    }
    return measured;
  }

  // Linear / aligned / ordinate / baseline / continued — all consume linear formatting.
  return composePrimaryText(geometry.measurementValue, style, userText);
}

function applyUserTextToken(userText: string | undefined, measured: string): string {
  if (userText === undefined || userText === '<>') return measured;
  return userText.replace('<>', measured);
}

/**
 * Builds full text payload (primary + optional tolerance/limits) for non-angular dims.
 * Radial dims get the R/Ø prefix injected into `primary`; tolerance/limits stacking
 * for radial is not in scope for G2 (same as AutoCAD — rare use case).
 */
function buildFullText(
  geometry: DimGeometry,
  style: DimStyle,
  userText: string | undefined,
): FullDimText {
  if (userText === '') return { primary: '' };

  if (geometry.kind === 'radial') {
    const measured = composePrimaryText(geometry.measurementValue, style, userText);
    if (!measured) return { primary: '' };
    const prefixed =
      userText === undefined || userText === '<>'
        ? (geometry.isDiameter ? RADIAL_DIAMETER_PREFIX : RADIAL_RADIUS_PREFIX) + measured
        : measured;
    return { primary: prefixed };
  }

  return composeFullDimText(geometry.measurementValue, style, userText);
}
