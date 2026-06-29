/**
 * SSOT — entity render-style resolution (color / lineweight / alpha / dash).
 *
 * Extracted verbatim from `DxfRenderer.resolveStyleForRender` (+ `applyIsolateAlpha`)
 * so the EXACT same style the committed canvas paints can be reused by the live
 * WYSIWYG preview path (`drawRealEntityPreview` → `buildEntityModelFromDxf`). Both
 * the main canvas and the moving-copy preview resolve through this one function →
 * they cannot diverge. Pure module functions (no `this`, only store/config reads).
 *
 * @see canvas-v2/dxf-canvas/DxfRenderer.ts — delegates here (toEntityModel path)
 * @see rendering/ghost/draw-real-entity-preview.ts — the preview consumer
 * @see ADR-358 §G7 — ByLayer/ByBlock style cascade
 * @see ADR-550 — Unified Entity Render Contract
 */

import type { DxfEntityUnion } from './dxf-types';
import type { SceneLayer } from '../../types/entities';
import { CAD_UI_COLORS } from '../../config/color-config';
import { resolveEntityStyle, entityToStyleInput } from '../../systems/properties/resolve-entity-style';
import { lineweightToPx } from '../../config/lineweight-iso-catalog';
import { resolveAnyDashMm } from '../../config/linetype-aliases';
import { getPrintColorPolicy, applyPlotColor } from '../../config/print-color-policy';
import { adaptEntityColorForCanvas } from '../../config/adaptive-entity-color';
import { resolveEntityLayerName } from '../../stores/LayerStore';
import { getIsolateEffectsSnapshot } from '../../systems/isolate/IsolateEffectsStore';
import { resolveEntityBimCategory } from '../../bim/visibility/resolve-entity-bim-category';
import { dimOpacityToTransparency } from '../../services/layer-isolate-resolver';
import { transparencyToAlpha } from './dxf-renderer-frame-builders';

export interface ResolvedRenderStyle {
  colorHex: string;
  lineWidthPx: number;
  alpha: number;
  dashMm: ReadonlyArray<number>;
}

/**
 * ADR-358 §5.6.bis Phase 10 — Layer Isolate runtime alpha override.
 * Zero-cost passthrough when isolate is inactive (single boolean branch).
 * In `dim` mode, multiplies alpha for layers NOT in the isolated set by the
 * configured dimOpacityPercent. `freeze` mode is handled by the skip-path.
 */
function applyIsolateAlpha(style: ResolvedRenderStyle, entity: DxfEntityUnion): ResolvedRenderStyle {
  const isolate = getIsolateEffectsSnapshot();
  if (!isolate.active || isolate.mode !== 'dim') return style;
  // ADR-358 §5.6.bis — entity-scope isolate (Revit "Isolate Element") takes
  // precedence; then category-scope ("Isolate Category"); then layer-scope.
  // Keep the isolated members at full alpha, dim everything else.
  if (isolate.isolatedEntityIds.size > 0) {
    if (entity.id && isolate.isolatedEntityIds.has(entity.id)) return style;
  } else if (isolate.isolatedCategories.size > 0) {
    const cat = resolveEntityBimCategory(entity);
    if (cat !== null && isolate.isolatedCategories.has(cat)) return style;
  } else {
    const layerId = entity.layerId;
    if (layerId && isolate.isolatedLayerIds.has(layerId)) return style;
  }
  const dimAlpha = transparencyToAlpha(dimOpacityToTransparency(isolate.dimOpacityPercent));
  return { ...style, alpha: Math.min(style.alpha, dimAlpha) };
}

/**
 * ADR-358 §G7 Phase 6 — ByLayer/ByBlock style resolution; falls back to literal
 * values when no `layersById`. SSoT shared by the committed canvas + the live
 * WYSIWYG preview so the moving copy's colour/lineweight/dash match exactly.
 */
export function resolveEntityRenderStyle(
  entity: DxfEntityUnion,
  layersById?: Record<string, SceneLayer>,
): ResolvedRenderStyle {
  // ADR-454 — active only during offscreen print render (null otherwise).
  const printPolicy = getPrintColorPolicy();
  const fallback: ResolvedRenderStyle = {
    colorHex: printPolicy
      ? applyPlotColor(entity.color ?? null, entity.colorAci ?? null, printPolicy)
      : adaptEntityColorForCanvas(entity.color || CAD_UI_COLORS.entity.default),
    lineWidthPx: Math.max(1, entity.lineWidth || 1),
    // ADR-510 Φ2E — even without a layer/cascade context, the entity's OWN
    // linetype must still render dashed. Reuses the SAME `resolveAnyDashMm` SSoT
    // as the BIM renderers — ByLayer/ByBlock/Continuous/unknown ⇒ [] (solid).
    dashMm: resolveAnyDashMm(entity.linetypeName),
    alpha: 1,
  };
  if (!layersById) return applyIsolateAlpha(fallback, entity);
  // ADR-358 Phase 9E-1: id-keyed lookup first (scene.layersById populated by builder).
  // Name-keyed fallback handles legacy/Firestore scenes without layersById.
  const layerById = entity.layerId ? layersById[entity.layerId] : undefined;
  const layer = layerById ?? (() => {
    const name = resolveEntityLayerName(entity);
    return name ? layersById[name] : undefined;
  })();
  if (!layer) return applyIsolateAlpha(fallback, entity);
  const styleInput = entityToStyleInput({
    color: entity.color,
    colorMode: entity.colorMode,
    colorAci: entity.colorAci,
    colorTrueColor: entity.colorTrueColor,
    linetypeName: entity.linetypeName,
    lineweightMm: entity.lineweightMm,
    transparency: entity.transparency,
  });
  const resolved = resolveEntityStyle(styleInput, layer);
  // ADR-454 — print render: convert ISO mm at the real print DPI (not screen 96)
  // and remap colour to a white-safe print colour. No-op when policy is null.
  const px = lineweightToPx(resolved.lineweight, printPolicy ? printPolicy.dpi : 96);
  const colorHex = printPolicy
    ? applyPlotColor(resolved.color, resolved.colorAci, printPolicy)
    : adaptEntityColorForCanvas(resolved.color);
  const baseAlpha = transparencyToAlpha(resolved.transparency);
  return applyIsolateAlpha(
    {
      colorHex,
      lineWidthPx: Math.max(1, px || fallback.lineWidthPx),
      alpha: baseAlpha,
      // ADR-510 Φ2 — resolved metric dash pattern ([] for Continuous).
      dashMm: resolved.linetype.pattern,
    },
    entity,
  );
}
