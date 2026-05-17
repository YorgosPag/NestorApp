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
} from '../../../types/dimension';
import type { DimGeometry } from '../../../systems/dimensions/dim-geometry-builder';
import {
  composePrimaryText,
  formatAngularMeasurement,
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
  const text = buildPrimaryText(params.geometry, params.style, params.entity.userText);
  if (!text) return;

  const screenAnchor = CoordinateTransforms.worldToScreen(
    params.geometry.textAnchor,
    params.transform,
    params.viewport,
  );
  // DIMTXT is world-mm; screen height = DIMTXT × view scale (mirrors TextRenderer ADR-344).
  const screenHeight = params.style.dimtxt * params.transform.scale;
  // DXF angles are CCW, canvas is CW with Y-flip → negate (matches TextRenderer note).
  const screenRotation = -params.geometry.textRotation;

  ctx.save();
  ctx.translate(screenAnchor.x, screenAnchor.y);
  ctx.rotate(screenRotation);
  ctx.fillStyle = resolveDimColor(params.style.dimclrt, params.layerColour);
  ctx.font = buildUIFont(screenHeight, params.style.textFontFamily || 'arial');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
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
