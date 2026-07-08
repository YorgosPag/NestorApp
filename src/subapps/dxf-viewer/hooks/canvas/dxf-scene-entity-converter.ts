/**
 * 🏢 ENTERPRISE: DXF Scene Entity Converter (pure, module-level)
 *
 * @description Pure SceneModel-entity → DxfEntityUnion conversion.
 * Extracted from useDxfSceneConversion.ts to keep that file ≤500 LOC (Google SRP).
 *
 * SSoT: BOTH the cached hook path ({@link useDxfSceneConversion}) and the
 * uncached snapshot path ({@link convertSceneToDxf}) consume {@link convertEntity}
 * — zero duplication of the per-entity projection logic.
 *
 * ADR-587 Φ5 — the per-type `switch (entity.type)` moved to the introspectable
 * {@link TO_DXF_HANDLERS} registry (`dxf-scene-entity-handlers.ts`, SRP split ≤500 LOC).
 * `buildBase` (shared style/layer projection) + the thin dispatcher stay here; the
 * dispatcher owns the per-site `warn+null` default (pinned, not homogenised).
 */

import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { SceneModel } from '../../types/entities';
// ADR-470 — per-element structural component visibility override.
import type { BimElementStyleOverride } from '../../config/bim-object-styles';
import { getLayerNameOrDefault } from '../../config/layer-config';
// 🏢 ADR-358 Phase 9D-3: id-first reader SSoT (LayerStore lookup + legacy name fallback)
import { resolveEntityLayerName } from '../../stores/LayerStore';
import { UI_COLORS } from '../../config/color-config';
import { dwarn } from '../../debug';
// ADR-587 Φ5 — introspectable per-type projection registry (SRP sibling). The type-only
// back-import of SceneEntity/DxfBaseFields there is erased at runtime → no import cycle.
import { TO_DXF_HANDLERS } from './dxf-scene-entity-handlers';

export type SceneEntity = NonNullable<SceneModel['entities']>[number];
export type SceneLayers = NonNullable<SceneModel['layersById']>;
/** Shared base fields produced by {@link buildBase}; consumed by the per-type handlers. */
export type DxfBaseFields = ReturnType<typeof buildBase>;

// ADR-587 Φ5 — re-export the handled-type set so the descriptor-domain coverage test and
// any discovery path can read it from the converter entry point (implementation in the sibling).
export { TO_DXF_SUPPORTED_TYPES } from './dxf-scene-entity-handlers';

/**
 * ADR-358 §G7 Phase 6 — sentinel-aware projection from SceneModel → DxfScene.
 *
 * Legacy path (Phase 1-5 baseline): entity declares concrete `color` + `lineweight`
 *   → flatten to `color` hex + `lineWidth` px (preserves visual baseline).
 *
 * Sentinel path (Phase 6 LIVE): entity declares `colorMode: 'ByLayer'`/'ByBlock' OR
 * `lineweightMm` ∈ { -3 DEFAULT, -2 BYLAYER, -1 BYBLOCK } OR
 * `linetypeName: 'ByLayer'/'ByBlock'`
 *   → forward the sentinel fields, SKIP the flattened legacy fields. The renderer's
 *   `resolveStyleForRender()` then cascades live through `layersById` → layer style.
 */
function buildBase(entity: SceneEntity, layers: SceneLayers, layersById?: SceneLayers) {
  // ADR-358 Phase 9D-3: id-first name resolution via LayerStore, fallback to legacy
  const resolvedLayerName = resolveEntityLayerName(entity);
  // ADR-358 Phase 9E-5: id-first layer object lookup (layersById), name-keyed fallback.
  const layerInfo = (entity.layerId && layersById ? layersById[entity.layerId] : undefined)
    ?? (resolvedLayerName ? layers[resolvedLayerName] : null);
  const m = entity as typeof entity & {
    measurement?: boolean;
    showEdgeDistances?: boolean;
  };
  // ADR-470 — per-element structural component visibility override (BIM entities only).
  const so = entity as typeof entity & { styleOverride?: BimElementStyleOverride };

  const colorByLayer = entity.colorMode === 'ByLayer' || entity.colorMode === 'ByBlock';
  const lwSentinel = entity.lineweightMm !== undefined
    && (entity.lineweightMm === -3 || entity.lineweightMm === -2 || entity.lineweightMm === -1);
  const ltSentinel = entity.linetypeName === 'ByLayer' || entity.linetypeName === 'ByBlock';

  return {
    id: entity.id,
    // ADR-358 Phase 9D-3: id-first name resolution + ADR-130 default fallback
    layer: getLayerNameOrDefault(resolvedLayerName),
    // ADR-358 Phase 9D-2 — forward stable layerId when present. Resolves to id lookup
    // path in DxfRenderer/HitTester once Phase 9E re-keys scene.layers by id.
    ...(entity.layerId !== undefined && { layerId: entity.layerId }),
    // Phase 6: omit `color` when entity opts into ByLayer/ByBlock cascade. Resolver
    // reads `colorMode` + `layersById[layer].color` at render time.
    ...(colorByLayer
      ? {}
      : { color: String(entity.color || layerInfo?.color || UI_COLORS.WHITE) }),
    // Phase 6: omit `lineWidth` when entity declares a sentinel lineweight.
    // Resolver converts `layer.lineweight` mm → px via `lineweightToPx()`.
    ...(lwSentinel ? {} : { lineWidth: entity.lineweight || 1 }),
    visible: entity.visible ?? true,
    // ─── Sentinel forwarding (Phase 6 §G7) ─────────────────────────────
    ...(entity.colorMode !== undefined && { colorMode: entity.colorMode }),
    ...(entity.colorAci !== undefined && { colorAci: entity.colorAci }),
    ...(entity.colorTrueColor !== undefined && { colorTrueColor: entity.colorTrueColor }),
    ...((ltSentinel || entity.linetypeName) && { linetypeName: entity.linetypeName }),
    ...(entity.lineweightMm !== undefined && { lineweightMm: entity.lineweightMm }),
    ...(entity.transparency !== undefined && { transparency: entity.transparency }),
    ...(m.measurement !== undefined && { measurement: m.measurement }),
    ...(m.showEdgeDistances !== undefined && { showEdgeDistances: m.showEdgeDistances }),
    // ADR-470 — forward the per-element structural component visibility override so
    // the scene-level overlay passes (σοβάς/οπλισμός) honour per-element toggles too.
    ...(so.styleOverride !== undefined && { styleOverride: so.styleOverride }),
  };
}

/**
 * Project a SceneModel entity onto its `DxfEntityUnion` render shape.
 *
 * Dispatches via the introspectable {@link TO_DXF_HANDLERS} seam (ADR-587 Φ5). An
 * unregistered type falls to the per-site default — warn + `null` (silent drop) — kept
 * verbatim here so a new renderable type without a handler surfaces via the coverage test,
 * not via an invisible entity on the canvas (the ADR-406/507/583 trap).
 */
export function convertEntity(entity: SceneEntity, layers: SceneLayers, layersById?: SceneLayers): DxfEntityUnion | null {
  const base = buildBase(entity, layers, layersById);
  const handler = TO_DXF_HANDLERS[entity.type];
  if (!handler) {
    dwarn('useDxfSceneConversion', 'Unsupported entity type:', entity.type);
    return null;
  }
  return handler(entity, base);
}
