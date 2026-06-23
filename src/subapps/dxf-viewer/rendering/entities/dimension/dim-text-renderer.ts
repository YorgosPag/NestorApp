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
  DimInspectionMode,
} from '../../../types/dimension';
import type { DimGeometry } from '../../../systems/dimensions/dim-geometry-builder';
import {
  composePrimaryText,
  composeFullDimText,
  formatAngularMeasurement,
  formatAlternateUnit,
  type FullDimText,
} from '../../../systems/dimensions/dim-text-formatter';
import { resolveDimColor } from './dim-color-resolver';
import { buildUIFont } from '../../../config/text-rendering-config';
import { UI_COLORS, HOVER_HIGHLIGHT } from '../../../config/color-config';
import type { ViewTransform } from '../../types/Types';
import { CoordinateTransforms } from '../../core/CoordinateTransforms';
// ADR-362 Round 5 — paper-mm DIMSTYLE values must be converted to scene world
// units before view-scale, otherwise meters/cm scenes draw text at the world-unit
// size of the paper-mm number (huge).
import { type SceneUnits } from '../../../utils/scene-units';
import { paperHeightToModel } from '../../../utils/annotation-scale';

const RADIAL_DIAMETER_PREFIX = 'Ø ';
const RADIAL_RADIUS_PREFIX = 'R ';

/** Screen-px canvas background used for DIMTFILL='backgroundColor'. */
const CANVAS_BG_DEFAULT = UI_COLORS.CANVAS_BACKGROUND_AUTOCAD_DARK;

interface DimTextRenderParams {
  readonly entity: DimensionEntity;
  readonly geometry: DimGeometry;
  readonly style: DimStyle;
  readonly transform: ViewTransform;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly layerColour: string | undefined;
  /** Canvas background color for DIMTFILL='backgroundColor' mode. Defaults to AutoCAD dark. */
  readonly canvasBackground?: string;
  /**
   * ADR-362 Round 5 — active scene unit system. Drives the paper-mm →
   * world-unit conversion for `dimtxt` (and the alternate/tolerance heights
   * derived from it) before the view-scale multiplier. Defaults to `'mm'` so
   * tests + legacy mm-baked DXFs keep their historical behaviour.
   */
  readonly sceneUnits?: SceneUnits;
  readonly hovered?: boolean;
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
  // DIMTXT is paper-mm by DIMSTYLE convention. ADR-362 Round 14: `style.dimscale`
  // arrives ALREADY resolved to the effective annotation scale (DimensionRenderer
  // heals it once via `resolveEffectiveDimscale` — imported DIMSCALE>1 or the
  // `drawingScale` SSoT). So this leaf is "dumb": same paper→model SSoT as ribbon
  // Text (`paperHeightToModel`), then × view scale to reach screen px. No local
  // rescue heuristic (that lived here only for meters and missed mm/cm).
  const primaryHeight =
    paperHeightToModel(params.style.dimtxt, params.style.dimscale, params.sceneUnits ?? 'mm') *
    params.transform.scale;
  // DXF angles are CCW, canvas is CW with Y-flip → negate (matches TextRenderer note).
  const screenRotation = -params.geometry.textRotation;
  const colour = params.hovered
    ? HOVER_HIGHLIGHT.ENTITY.glowColor
    : resolveDimColor(params.style.dimclrt, params.layerColour);
  const fontFamily = params.style.textFontFamily || 'arial';

  // Angular dims: simplified path (no tolerance/limits/inspection in G2/G3).
  if (params.geometry.kind === 'angular') {
    const text = buildPrimaryText(params.geometry, params.style, params.entity.userText);
    if (!text) return;
    ctx.save();
    ctx.translate(screenAnchor.x, screenAnchor.y);
    ctx.rotate(screenRotation);
    ctx.font = buildUIFont(primaryHeight, fontFamily);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawTextBackgroundMask(ctx, text, primaryHeight, params.style, params.layerColour, params.canvasBackground);
    ctx.fillStyle = colour;
    ctx.fillText(text, 0, 0);
    ctx.restore();
    return;
  }

  const full = buildFullText(params.geometry, params.style, params.entity.userText);
  if (!full.primary && !full.limitsUpper) return;

  ctx.save();
  ctx.translate(screenAnchor.x, screenAnchor.y);
  ctx.rotate(screenRotation);
  ctx.font = buildUIFont(primaryHeight, fontFamily);
  ctx.textAlign = 'center';
  // ADR-362 Phase K3 — DIMTFILL background mask drawn before text + arrowheads.
  if (full.primary) {
    drawTextBackgroundMask(ctx, full.primary, primaryHeight, params.style, params.layerColour, params.canvasBackground);
  }
  ctx.fillStyle = colour;

  // Inspection marker drawn before text so text renders on top.
  if (params.style.dimInspect !== 'off' && full.primary) {
    drawInspectionMarker(
      ctx, full.primary, params.style.dimInspect,
      params.style.dimInspectRate, primaryHeight, colour,
    );
  }

  let mainBottomY: number;
  if (full.limitsUpper !== undefined && full.limitsLower !== undefined) {
    drawLimitsStack(ctx, full.limitsUpper, full.limitsLower, primaryHeight, fontFamily);
    mainBottomY = primaryHeight * 0.75 + primaryHeight * 0.75 * 0.1 / 2 + primaryHeight * 0.75 / 2;
  } else if (full.tolerancePlus !== undefined && full.toleranceMinus !== undefined) {
    drawToleranceStack(
      ctx, full.primary, full.tolerancePlus, full.toleranceMinus,
      primaryHeight, params.style.dimtfac, params.style.dimtolj, fontFamily,
    );
    mainBottomY = primaryHeight / 2 + primaryHeight * Math.max(params.style.dimtfac, 0.1) * 1.1;
  } else {
    if (!full.primary) { ctx.restore(); return; }
    ctx.textBaseline = 'middle';
    ctx.fillText(full.primary, 0, 0);
    mainBottomY = primaryHeight / 2;
  }

  // Alternate units drawn on a second line below primary stack (linear/aligned only).
  const altText = formatAlternateUnit(params.geometry.measurementValue, params.style);
  if (altText) {
    drawAltUnit(ctx, altText, primaryHeight, params.style.dimtfac, mainBottomY, fontFamily);
  }

  ctx.restore();
}

/**
 * Draws alternate unit text `[value]` below the main text stack.
 * `mainBottomY` = canvas Y where the main text block ends (positive = down in screen coords).
 */
function drawAltUnit(
  ctx: CanvasRenderingContext2D,
  text: string,
  primaryHeight: number,
  dimtfac: number,
  mainBottomY: number,
  fontFamily: string,
): void {
  const altHeight = primaryHeight * Math.max(dimtfac, 0.1);
  const gap = primaryHeight * 0.15;
  const y = mainBottomY + gap + altHeight / 2;
  ctx.font = buildUIFont(altHeight, fontFamily);
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, y);
}

/**
 * Draws an ASME-style inspection frame (pill oval) around the primary label.
 * When `mode !== 'off'` the pill is stroked with `colour`; the rate label is
 * drawn to the right of the measurement, separated by a vertical divider line.
 */
function drawInspectionMarker(
  ctx: CanvasRenderingContext2D,
  label: string,
  mode: DimInspectionMode,
  rate: number,
  primaryHeight: number,
  colour: string,
): void {
  const rateText =
    mode === 'rate0' ? '0%' :
    mode === 'rate100' ? '100%' :
    `${Math.round(rate)}%`;

  const charWidth = primaryHeight * 0.55;
  const labelW = (ctx.measureText ? ctx.measureText(label).width : label.length * charWidth);
  const rateW = (ctx.measureText ? ctx.measureText(rateText).width : rateText.length * charWidth);
  const hPad = primaryHeight * 0.4;
  const halfH = primaryHeight * 0.65;

  // Total pill half-width: label + padding + optional (divider + rate + padding).
  const halfW = labelW / 2 + hPad + rateW / 2 + hPad / 2;
  const dividerX = labelW / 2 + hPad / 2;

  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = Math.max(primaryHeight * 0.06, 0.5);
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.arc(-halfW, 0, halfH, Math.PI / 2, -Math.PI / 2, true);
  ctx.lineTo(halfW, -halfH);
  ctx.arc(halfW, 0, halfH, -Math.PI / 2, Math.PI / 2, false);
  ctx.lineTo(-halfW, halfH);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(dividerX, -halfH);
  ctx.lineTo(dividerX, halfH);
  ctx.stroke();

  ctx.font = buildUIFont(primaryHeight * 0.75, 'arial');
  ctx.textBaseline = 'middle';
  ctx.fillText(rateText, dividerX + rateW / 2 + hPad / 4, 0);
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

/**
 * ADR-362 Phase K3 — DIMTFILL background mask.
 *
 * Draws a filled rect behind dim text before text is painted (render order:
 * ext lines → dim line → mask rect → arrowheads → text).
 *
 * Must be called after `ctx.translate(anchor)` + `ctx.rotate(angle)` so the
 * rect is aligned with the text local frame. `ctx.font` MUST be set before
 * calling so `ctx.measureText` returns correct metrics.
 *
 * @param ctx           - Canvas context (already translated + rotated).
 * @param text          - Primary text string (used only for width measurement).
 * @param primaryHeight - Text height in screen px.
 * @param style         - Resolved DimStyle — reads `dimtfill`, `dimtfillclr`, `dimgap`.
 * @param layerColour   - Layer colour for ACI fallback.
 * @param canvasBackground - Canvas background for 'backgroundColor' mode.
 */
function drawTextBackgroundMask(
  ctx: CanvasRenderingContext2D,
  text: string,
  primaryHeight: number,
  style: DimStyle,
  layerColour: string | undefined,
  canvasBackground: string | undefined,
): void {
  if (style.dimtfill === 'none') return;

  const fillColor =
    style.dimtfill === 'customColor'
      ? resolveDimColor(style.dimtfillclr, layerColour)
      : (canvasBackground ?? CANVAS_BG_DEFAULT);

  const textWidth = ctx.measureText ? ctx.measureText(text).width : text.length * primaryHeight * 0.6;
  const gapPx = style.dimgap * primaryHeight * 0.15;
  const halfW = textWidth / 2 + gapPx;
  const halfH = primaryHeight / 2 + gapPx;

  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.fillRect(-halfW, -halfH, halfW * 2, halfH * 2);
  ctx.restore();
}
