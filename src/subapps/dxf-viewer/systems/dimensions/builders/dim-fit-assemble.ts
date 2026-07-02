/**
 * ADR-362 Phase M — Shared dim text-fit assembler (SSoT).
 *
 * The persistent `DimensionRenderer` (main canvas) and the live
 * `renderPreviewDimension` (preview overlay) both need the SAME DIMATFIT/DIMTMOVE
 * decision + placement so the preview is byte-identical to the committed dim.
 * The tail of that computation (textWidth → arrowSize → gap → resolveTextFit →
 * linear/angular placement) was duplicated in both. This module is the single
 * source: each caller measures the primary text with its OWN font SSoT
 * (`measureDimPrimaryText`) and forwards the measured width + view scale here.
 *
 * Unit-agnostic: all lengths are in scene/world units (the callers pre-heal
 * `dimscale` and pass `sceneUnits`). Returns `null` for radial (no DIMATFIT) or a
 * degenerate view scale. The ordinate exclusion is caller-side (needs the entity).
 */

import type { DimStyle } from '../../../types/dimension';
import type { SceneUnits } from '../../../utils/scene-units';
import type { DimGeometry } from '../dim-geometry-builder';
import { paperHeightToModel } from '../../../utils/annotation-scale';
import { calculateDistance } from '../../../rendering/entities/shared/geometry-vector-utils';
import {
  resolveTextFit,
  computeLinearFitPlacement,
  computeAngularFitPlacement,
  type DimFitPlacement,
  type TextFitResult,
} from './dim-text-fit';

/** Resolved fit for a linear/aligned OR angular dim (mirrors both renderers). */
export interface AssembledDimFit {
  readonly fit: TextFitResult;
  readonly placement: DimFitPlacement;
  /** Scene-unit arrow size — needed to draw the outside stubs. */
  readonly arrowSize: number;
}

export interface AssembleDimFitInput {
  /** Built geometry (radial short-circuits to `null`). */
  readonly geometry: DimGeometry;
  /** DIMSTYLE with an already-effective `dimscale` (caller heals it). */
  readonly style: DimStyle;
  readonly sceneUnits: SceneUnits;
  /** Screen px per world unit at the dim (transform scale or projector scale). */
  readonly viewScale: number;
  /** `ctx.measureText(...).width` of the primary text (screen px). */
  readonly measuredWidthPx: number;
}

/**
 * Assemble the DIMATFIT/DIMTMOVE fit from pre-measured metrics. Pure — no canvas,
 * no store reads. Both the main + preview dim renderers call this so their
 * move-out decision + placement match exactly.
 */
export function assembleDimFit(input: AssembleDimFitInput): AssembledDimFit | null {
  const { geometry, style, sceneUnits, viewScale, measuredWidthPx } = input;
  if (geometry.kind === 'radial') return null;
  if (!(viewScale > 0)) return null;

  const textWidth = measuredWidthPx / viewScale;
  const arrowSize = paperHeightToModel(style.dimasz, style.dimscale, sceneUnits);
  const textGap = paperHeightToModel(style.dimgap, style.dimscale, sceneUnits);
  // Available room: linear = distance between feet; angular = arc length at the
  // text radius (arcRadius × sweep). The DIMATFIT decision is unit-agnostic.
  const gap =
    geometry.kind === 'angular'
      ? geometry.arcRadius * geometry.measurementValue
      : calculateDistance(geometry.dimLine.start, geometry.dimLine.end);

  const fit = resolveTextFit({
    gap,
    textWidth,
    arrowSize,
    textGap,
    dimatfit: style.dimatfit,
    dimtix: style.dimtix,
    dimtofl: style.dimtofl,
    dimtmove: style.dimtmove,
  });
  const placement =
    geometry.kind === 'angular'
      ? computeAngularFitPlacement({
          arcCenter: geometry.arcCenter,
          arcRadius: geometry.arcRadius,
          arcStartAngle: geometry.arcStartAngle,
          arcEndAngle: geometry.arcEndAngle,
          textAnchor: geometry.textAnchor,
          textWidth,
          arrowSize,
          textGap,
          arrowDirection1: geometry.arrowDirection1,
          arrowDirection2: geometry.arrowDirection2,
          fit,
        })
      : computeLinearFitPlacement({
          foot1: geometry.dimLine.start,
          foot2: geometry.dimLine.end,
          textAnchor: geometry.textAnchor,
          textWidth,
          arrowSize,
          textGap,
          arrowDirection1: geometry.arrowDirection1,
          arrowDirection2: geometry.arrowDirection2,
          fit,
        });
  return { fit, placement, arrowSize };
}
