/**
 * SSoT — "is this entity hidden by a layer / isolate / cut-plane gate?"
 *
 * Extracted verbatim from `DxfRenderer.isEntityLayerSkipped` (ADR-639 Στάδιο 5,
 * N.0.2/N.18) so the Canvas2D renderer AND the WebGL line layer's buffer builder
 * ask the EXACT same question. If the two ever diverged, a frozen/isolated line
 * could be drawn by one layer and suppressed by the other (gap or double-draw).
 *
 * The rules, in order (mirror of the original private method):
 *   • ADR-452 cut-plane (Revit View Range) — base above the active cut → hidden;
 *   • ADR-375 «DXF Σχέδιο» master row off → every raw DXF primitive hidden;
 *   • ADR-358 §5.6.bis isolate FREEZE (entity-scope, then category-scope);
 *   • layer frozen / invisible (LayerStore first, then the scene `layersById`).
 *
 * Pure module function (no `this`, only store/config reads) — same shape as
 * `resolveEntityRenderStyle`. `DxfRenderer` delegates here (STEP 12) so there is
 * one copy, not two.
 *
 * @see canvas-v2/dxf-canvas/DxfRenderer.ts — the Canvas2D consumer (delegates here)
 * @see canvas-v2/webgl-lines/WebglLineLayerManager.ts — the WebGL consumer
 * @see canvas-v2/webgl-lines/is-webgl-owned-line.ts — the ownership predicate that reads this
 */

import type { DxfEntityUnion } from './dxf-types';
import type { SceneLayer } from '../../types/entities';
import { getIsolateEffectsSnapshot } from '../../systems/isolate/IsolateEffectsStore';
import { resolveEntityBimCategory } from '../../bim/visibility/resolve-entity-bim-category';
import { isHiddenByCutPlane } from '../../bim/visibility/entity-z-extents';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import { resolveEntityLayerName, getLayer as getLayerStoreLayer } from '../../stores/LayerStore';

/**
 * TRUE when the entity must NOT be drawn this frame because of a cut-plane, the
 * imported-DXF master toggle, an isolate FREEZE, or a frozen/invisible layer.
 * Reads the live stores at call time (event-time), never a snapshot.
 */
export function isEntityLayerSkipped(
  entity: DxfEntityUnion,
  layersById?: Record<string, SceneLayer>,
): boolean {
  // ADR-358 §5.6.bis — entity-scope isolate in FREEZE mode hides every entity
  // outside the isolated set. (Layer flags are NOT mutated for entity isolate,
  // so the freeze must be enforced here.) Dim mode is handled by applyIsolateAlpha.
  // ADR-452 — cut-plane hide gate (Revit View Range, single horizontal section).
  // Hides BIM entities whose base sits above the active cut elevation so the 2D
  // plan shows only what exists at/below the slider height. No-op when the gate
  // is off, or for raw DXF / un-gated BIM types (getEntityZExtents → null).
  const bimSettings = useBimRenderSettingsStore.getState();
  if (isHiddenByCutPlane(entity, bimSettings.viewRange, bimSettings.cutPlaneActive)) return true;

  // ADR-375 — «DXF Σχέδιο» master visibility (Revit «Imported Categories» row).
  // When the imported-DXF row is toggled off, hide every raw DXF primitive
  // (resolveEntityBimCategory === null). BIM entities stay unaffected.
  if (bimSettings.dxfImport.visible === false && resolveEntityBimCategory(entity) === null) return true;

  const isolate = getIsolateEffectsSnapshot();
  if (isolate.active && isolate.mode === 'freeze' && isolate.isolatedEntityIds.size > 0) {
    return !entity.id || !isolate.isolatedEntityIds.has(entity.id);
  }
  // Category-scope freeze: hide entities whose BimCategory ∉ the isolated set
  // (raw DXF primitives resolve to null → hidden, like Revit "Isolate Category").
  if (isolate.active && isolate.mode === 'freeze' && isolate.isolatedCategories.size > 0) {
    const cat = resolveEntityBimCategory(entity);
    return cat === null || !isolate.isolatedCategories.has(cat);
  }
  if (!entity.layerId && !layersById) return false;
  const storeLayer = entity.layerId ? getLayerStoreLayer(entity.layerId) : null;
  if (storeLayer) {
    return storeLayer.frozen === true || storeLayer.visible === false;
  }
  if (!layersById) return false;
  const layerById = entity.layerId ? layersById[entity.layerId] : undefined;
  const layer = layerById ?? (() => {
    const name = resolveEntityLayerName(entity);
    return name ? layersById[name] : undefined;
  })();
  if (!layer) return false;
  return layer.frozen === true || layer.visible === false;
}
