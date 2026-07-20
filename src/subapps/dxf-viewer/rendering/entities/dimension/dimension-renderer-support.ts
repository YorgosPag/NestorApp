/**
 * ADR-362 — DimensionRenderer support helpers (SRP split of DimensionRenderer.ts).
 *
 * Pure, `this`-free logic extracted from the renderer class so the class file
 * stays focused on canvas drawing (< Google 500-line limit): entity resolution,
 * grips, hit-test, geometry-offset scaling, and the text-fit computation. No
 * canvas mutation happens here beyond the read-only `ctx.measureText` inside
 * `measureDimPrimaryText` (font SSoT). Behaviour is identical to the inline
 * versions it replaced — this is a mechanical extraction.
 */

import type { EntityModel, GripInfo, Point2D, ViewTransform } from '../../types/Types';
import type { Entity } from '../../../types/entities';
import {
  isDimensionEntity,
  type DimensionEntity,
  type DimStyle,
} from '../../../types/entities';
import type { DxfDimension } from '../../../canvas-v2/dxf-canvas/dxf-types';
import { getDimensionGrips } from '../../../hooks/dimensions/useDimensionGrips';
import {
  buildDimensionGeometry,
  type DimensionLookup,
  type DimGeometry,
} from '../../../systems/dimensions/dim-geometry-builder';
import { resolveDimStyle } from '../../../systems/dimensions/dim-style-resolver';
import type { DimStyleRegistry } from '../../../systems/dimensions/dim-style-registry';
import {
  paperHeightToModel,
  resolveEffectiveDimscale,
  clampDimscaleForReadability,
} from '../../../utils/annotation-scale';
import { useDrawingScaleStore } from '../../../state/drawing-scale-store';
import type { SceneUnits } from '../../../utils/scene-units';
import { measureDimPrimaryText } from './dim-text-renderer';
import {
  assembleDimFit,
  type AssembledDimFit,
} from '../../../systems/dimensions/builders/dim-fit-assemble';
import {
  computeDimHitGeometry,
  buildVariantHitGeometry,
  hitTestDimGeometry,
} from '../../../systems/dimensions/dim-hit-geometry';
import { pointToLineDistance } from '../shared/geometry-utils';
import { calculateDistance } from '../shared/geometry-rendering-utils';

export interface ResolvedDimensionRender {
  readonly entity: DimensionEntity;
  readonly style: DimStyle;
  /** Style with paper-mm geometry offsets pre-scaled to world units (used by
   *  break engine + geometry builder). Rendering fields (dimasz, dimtxt) are
   *  NOT scaled here — those renderers apply dimscale×unitFactor themselves. */
  readonly geoStyle: DimStyle;
  readonly geometry: DimGeometry;
}

/** Resolved text-fit for a linear/aligned OR angular dim (alias of the SSoT). */
export type DimFitRender = AssembledDimFit;

/**
 * Grips for a dimension entity — delegates to the interaction-path SSoT
 * (`getDimensionGrips`) so the DRAWN grips match the PICKABLE ones exactly.
 */
export function computeDimensionGrips(entity: EntityModel): GripInfo[] {
  if (!isDimensionEntity(entity)) return [];
  const dxfDim = { id: entity.id, dimensionEntity: entity as unknown as DimensionEntity } as DxfDimension;
  return getDimensionGrips(dxfDim).map((g) => ({
    id: `${entity.id}-${g.gripIndex}`,
    entityId: entity.id,
    gripIndex: g.gripIndex,
    type: g.type,
    position: g.position,
    isVisible: true,
  }));
}

/**
 * Leaf hit-test bypass used by canvas-v2 paths that hit-test directly against
 * renderers. Shares the `dim-hit-geometry` SSoT with `performDetailedHitTest`
 * so both paths agree (linear/aligned foot points; radial/angular/ordinate via
 * their actual rendered arc/leader/dim-line).
 */
export function dimensionEntityHitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
  const e = entity as Entity;
  if (!isDimensionEntity(e)) return false;
  const dim = e as DimensionEntity;
  const pts = dim.defPoints;
  if (!pts || pts.length === 0) return false;

  const hitGeom = computeDimHitGeometry(dim);
  if (hitGeom) {
    if (calculateDistance(point, hitGeom.textAnchor) <= tolerance * 1.5) return true;
    if (pointToLineDistance(point, hitGeom.footStart, hitGeom.footEnd) <= tolerance) return true;
    if (pointToLineDistance(point, pts[0], hitGeom.footStart) <= tolerance) return true;
    if (pointToLineDistance(point, pts[1], hitGeom.footEnd) <= tolerance) return true;
  } else {
    const variantGeom = buildVariantHitGeometry(dim);
    if (variantGeom && hitTestDimGeometry(variantGeom, point, tolerance)) return true;
  }
  for (const pt of pts) {
    if (calculateDistance(point, pt) <= tolerance) return true;
  }
  return false;
}

/** Scale paper-mm geometry offset fields to world units for the geometry builder
 *  and break engine, via the annotation-scale SSoT (paper × dimscale ×
 *  mmToSceneUnits). `style.dimscale` is already the effective value. */
function scaleGeometryOffsets(style: DimStyle, sceneUnits: SceneUnits): DimStyle {
  const toModel = (paperMm: number) => paperHeightToModel(paperMm, style.dimscale, sceneUnits);
  return {
    ...style,
    dimexo: toModel(style.dimexo),
    dimexe: toModel(style.dimexe),
    dimdli: toModel(style.dimdli),
    dimcen: toModel(style.dimcen),
    breakGap: toModel(style.breakGap),
  };
}

/**
 * Resolve entity → { style, geoStyle, geometry } with the effective annotation
 * scale healed ONCE (imported DIMSCALE>1 wins, else the `drawingScale` SSoT).
 * Returns `null` for non-dimension entities or malformed geometry (swallowed so
 * one broken dim can't crash the whole scene render).
 */
export function resolveDimensionRender(
  entity: EntityModel,
  styleRegistry: DimStyleRegistry,
  sceneUnits: SceneUnits,
  dimensionLookup: DimensionLookup,
  sceneSpan = 0,
): ResolvedDimensionRender | null {
  const e = entity as Entity;
  if (!isDimensionEntity(e)) return null;
  const dim = e as DimensionEntity;
  const rawStyle = resolveDimStyle(dim, styleRegistry);
  const drawingScale = useDrawingScaleStore.getState().drawingScale;
  // ADR-362 — heal the effective annotation scale ONCE, then clamp it so a
  // wildly-mismatched imported DIMSCALE can't blow the text past ~2% of the
  // drawing extent (the "giant dimension cross" on units-mismatched DXFs).
  // `sceneSpan = 0` (unit tests / preview) → clamp is a no-op.
  const effective = resolveEffectiveDimscale(rawStyle.dimscale, drawingScale);
  const style: DimStyle = {
    ...rawStyle,
    dimscale: clampDimscaleForReadability(effective, rawStyle.dimtxt, sceneUnits, sceneSpan),
  };
  const geoStyle = scaleGeometryOffsets(style, sceneUnits);
  let geometry: DimGeometry;
  try {
    geometry = buildDimensionGeometry(dim, geoStyle, dimensionLookup);
  } catch {
    return null;
  }
  return { entity: dim, style, geoStyle, geometry };
}

/**
 * Resolve the DIMATFIT/DIMTMOVE fit for a linear/aligned OR angular dim.
 * Measures the primary text at render-time (reusing the `dim-text-renderer` font
 * SSoT), then delegates the decision + placement to the shared `assembleDimFit`.
 * Returns `null` for radial/ordinate (no DIMATFIT), suppressed text, or a
 * degenerate scale.
 */
export function computeDimFitForRender(
  ctx: CanvasRenderingContext2D,
  transform: ViewTransform,
  sceneUnits: SceneUnits,
  layerColour: string | undefined,
  r: ResolvedDimensionRender,
): DimFitRender | null {
  const geom = r.geometry;
  if (geom.kind === 'radial') return null;
  if (geom.kind === 'linear' && r.entity.dimensionType === 'ordinate') return null;
  const scale = transform.scale;
  if (!(scale > 0)) return null;

  const rect = ctx.canvas.getBoundingClientRect();
  const measured = measureDimPrimaryText(ctx, {
    entity: r.entity,
    geometry: geom,
    style: r.style,
    transform,
    viewport: {
      width: rect.width || ctx.canvas.width,
      height: rect.height || ctx.canvas.height,
    },
    layerColour,
    sceneUnits,
  });
  if (!measured) return null;

  return assembleDimFit({
    geometry: geom,
    style: r.style,
    sceneUnits,
    viewScale: scale,
    measuredWidthPx: measured.widthPx,
  });
}

/** Extension-line accessor (kept module-private on `kind`). */
export function readExtLine(geom: DimGeometry, side: 1 | 2) {
  if (geom.kind === 'linear' || geom.kind === 'angular') {
    return side === 1 ? geom.extLine1 : geom.extLine2;
  }
  return null;
}
