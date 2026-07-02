/**
 * ADR-362 Phase M — Preview dim text-fit resolver (SRP split of
 * preview-dimension-renderer.ts).
 *
 * Decides the DIMATFIT/DIMTMOVE fit for the live preview using the REAL
 * (committed) dimscale metrics — NOT the arrow autoScale — so the preview's
 * move-out decision is byte-identical to the persistent `DimensionRenderer`.
 * Delegates the decision + placement to the shared `assembleDimFit` SSoT (same
 * function the main renderer uses), after measuring the primary text with the
 * `dim-text-renderer` font SSoT. Returns `null` for non-linear/angular geometry,
 * ordinate, suppressed text, or a degenerate scale.
 */

import type { DimensionEntity, DimStyle } from '../../types/dimension';
import type { ViewTransform } from '../../rendering/types/Types';
import type { DimGeometry } from '../../systems/dimensions/dim-geometry-builder';
import { measureDimPrimaryText } from '../../rendering/entities/dimension/dim-text-renderer';
import { resolveEffectiveDimscale } from '../../utils/annotation-scale';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import {
  assembleDimFit,
  type AssembledDimFit,
} from '../../systems/dimensions/builders/dim-fit-assemble';

/** Resolved preview fit — same shape the persistent renderer produces. */
export type PreviewFit = AssembledDimFit;

export interface ComputePreviewFitInput {
  readonly ctx: CanvasRenderingContext2D;
  readonly entity: DimensionEntity;
  readonly style: DimStyle;
  readonly geometry: DimGeometry;
  readonly transform: ViewTransform;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly sceneUnits?: 'mm' | 'cm' | 'm' | 'in' | 'ft';
  /** Screen px per world/scene unit (transform scale or projector scale). */
  readonly viewScale: number;
}

export function computePreviewFit(input: ComputePreviewFitInput): PreviewFit | null {
  const { ctx, entity, style, geometry, transform, viewport, viewScale } = input;
  if (geometry.kind === 'radial') return null;
  if (geometry.kind === 'linear' && entity.dimensionType === 'ordinate') return null;
  if (!(viewScale > 0)) return null;

  const drawingScale = useDrawingScaleStore.getState().drawingScale;
  const healedStyle: DimStyle = {
    ...style,
    dimscale: resolveEffectiveDimscale(style.dimscale, drawingScale),
  };
  const sceneUnits = input.sceneUnits ?? 'mm';
  const measured = measureDimPrimaryText(ctx, {
    entity,
    geometry,
    style: healedStyle,
    transform,
    viewport,
    layerColour: undefined,
    sceneUnits,
  });
  if (!measured) return null;

  return assembleDimFit({
    geometry,
    style: healedStyle,
    sceneUnits,
    viewScale,
    measuredWidthPx: measured.widthPx,
  });
}
