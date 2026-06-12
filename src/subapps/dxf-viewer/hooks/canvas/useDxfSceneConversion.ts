/**
 * 🏢 ENTERPRISE: useDxfSceneConversion Hook
 *
 * @description Converts a SceneModel (level-based scene) into a DxfScene
 * compatible with the Canvas V2 rendering system (DxfCanvas).
 *
 * EXTRACTED FROM: CanvasSection.tsx (lines ~663-766) — ~100 lines of conversion logic
 *
 * PERF (2026-05-10): WeakMap entity cache — when `currentScene` reference
 * changes but individual entity references stay stable, the converted
 * DxfEntityUnion is reused. Eliminates O(N) object spreads per render
 * for unchanged entities (was 667ms self-time on N=large DXF files).
 */

'use client';

import { useEffect, useMemo, useRef } from 'react';

import { perfMark } from '../../debug/perf-line-profile';
import type { DxfScene, DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { SceneModel, Entity } from '../../types/entities';
import { isArrayEntity } from '../../types/entities';
import type { PathParams } from '../../systems/array/types';
import { expandArrayEntity } from '../../systems/array/array-expander';
// 🏢 ADR-358 Phase 9D-3: hydrate the LayerStore SSoT from the active scene snapshot.
import { setLayers as setLayerStoreLayers } from '../../stores/LayerStore';
// ADR-362 Round 5 — seed the runtime DIMSTYLE registry from the active scene
// so Ribbon-created dimensions inherit the source DXF's text/arrow sizes
// instead of falling back to the ISO_129 built-in defaults.
import { registerImportedDimStyles } from '../../systems/dimensions/dim-style-importer';
// ADR-362 R6 — always resolve units via heuristic so DXFs without $INSUNITS
// (scene.units=undefined) get the correct 'm'/'cm' label instead of falling
// back to DxfRenderer's `?? 'mm'` default, which makes DimensionRenderer apply
// no mmToSceneUnits conversion and render dim text at 2.5 world-units (= 2.5m).
import { resolveSceneUnits, mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { immediateSceneScale } from '../../systems/cursor/ImmediateSceneScaleStore';
// Pure per-entity projection SSoT (extracted to keep this file ≤500 LOC).
import { convertEntity } from './dxf-scene-entity-converter';

// ============================================================================
// TYPES
// ============================================================================

export interface UseDxfSceneConversionParams {
  currentScene: SceneModel | null;
  /** ADR-368 — per-file user override for DXF drawing units. When provided,
   *  takes precedence over resolveSceneUnits() so Greek DXF files (declared mm,
   *  actual meters) render correctly without heuristic patches. */
  userDrawingUnits?: SceneUnits;
}

export interface UseDxfSceneConversionReturn {
  dxfScene: DxfScene;
}

// ============================================================================
// PURE SSoT CONVERTER (non-cached) — ADR-399 Phase D
// ============================================================================

/**
 * One-shot SceneModel → DxfScene conversion (SSoT, no WeakMap cache).
 *
 * Shared core extracted from {@link useDxfSceneConversion} so non-active,
 * read-only scenes (e.g. the ADR-399 Phase D «Όλοι οι όροφοι» 2D underlay of
 * other building floors) reuse the exact same `convertEntity` + array-expansion
 * pipeline instead of duplicating it. The hook keeps its per-entity WeakMap cache
 * for the hot active-floor path; static snapshots use this uncached variant.
 *
 * IMPORTANT: pure — performs NONE of the hook's side effects (LayerStore hydration,
 * DIMSTYLE registration). Those are owned exclusively by the active scene so an
 * underlay floor never clobbers the active floor's runtime layer/style registries.
 */
export function convertSceneToDxf(
  scene: SceneModel | null,
  userDrawingUnits?: SceneUnits,
): DxfScene {
  const entities = scene?.entities ?? [];
  const layers = scene?.layersById ?? {};
  const layersById = scene?.layersById;
  const converted: DxfEntityUnion[] = [];

  for (const entity of entities) {
    // ADR-353: ArrayEntity expands 1→N items before conversion.
    if (isArrayEntity(entity)) {
      const pathEnt = entity.arrayKind === 'path' && entity.params.kind === 'path'
        ? (entities as Entity[]).find(e => e.id === (entity.params as PathParams).pathEntityId)
        : undefined;
      for (const e of expandArrayEntity(entity, pathEnt)) {
        const c = convertEntity(e, layers, layersById);
        if (c) converted.push(c);
      }
      continue;
    }
    const c = convertEntity(entity, layers, layersById);
    if (c) converted.push(c);
  }

  return {
    entities: converted,
    layers: Object.keys(layers),
    layersById,
    bounds: scene?.bounds ?? null,
    units: userDrawingUnits ?? resolveSceneUnits(scene),
  };
}

// ============================================================================
// HOOK
// ============================================================================

export function useDxfSceneConversion({
  currentScene,
  userDrawingUnits,
}: UseDxfSceneConversionParams): UseDxfSceneConversionReturn {

  // Per-entity conversion cache. Keyed by entity object identity — when
  // SceneModel.entities is rebuilt but individual entries keep the same ref
  // (the common case for incremental scene updates), conversion is skipped.
  const cacheRef = useRef<WeakMap<object, DxfEntityUnion>>(new WeakMap());
  // ADR-353: 1:N cache for array entities (one ArrayEntity → multiple DxfEntityUnion items).
  const arrayCacheRef = useRef<WeakMap<object, DxfEntityUnion[]>>(new WeakMap());

  const dxfScene = useMemo<DxfScene>(() => perfMark('useDxfSceneConversion.memo', () => {
    const entities = currentScene?.entities ?? [];
    const layers = currentScene?.layersById ?? {};
    // ADR-358 Phase 9E-5: id-keyed primary for buildBase layerInfo lookup.
    const layersById = currentScene?.layersById;
    const cache = cacheRef.current;
    const arrayCache = arrayCacheRef.current;
    const converted: DxfEntityUnion[] = [];

    for (const entity of entities) {
      // ADR-353: ArrayEntity expands 1→N items before conversion.
      if (isArrayEntity(entity)) {
        let items = arrayCache.get(entity);
        if (!items) {
          const pathEnt = entity.arrayKind === 'path' && entity.params.kind === 'path'
            ? (entities as Entity[]).find(e => e.id === (entity.params as PathParams).pathEntityId)
            : undefined;
          const expanded = expandArrayEntity(entity, pathEnt);
          items = expanded.reduce<DxfEntityUnion[]>((acc, e) => {
            const c = convertEntity(e, layers, layersById);
            if (c) acc.push(c);
            return acc;
          }, []);
          if (items.length > 0) arrayCache.set(entity, items);
        }
        for (const item of items) converted.push(item);
        continue;
      }

      let result = cache.get(entity);
      if (!result) {
        const c = convertEntity(entity, layers, layersById);
        if (c) {
          result = c;
          cache.set(entity, c);
        }
      }
      if (result) converted.push(result);
    }

    return {
      entities: converted,
      layers: Object.keys(layers),
      // ADR-358 Phase 9E-5 — id-first primary; name-keyed layers as legacy fallback.
      layersById: currentScene?.layersById,
      bounds: currentScene?.bounds ?? null,
      // ADR-368 — user-specified drawing units take priority (set in import wizard).
      // Falls back to R12 resolveSceneUnits() heuristic for files imported before
      // ADR-368 or when user left the selection on 'auto'.
      units: userDrawingUnits ?? resolveSceneUnits(currentScene),
    };
  }), [currentScene, userDrawingUnits]);

  // ADR-358 §5.6.bis Phase 10 prerequisite — hydrate LayerStore from the
  // SceneModel snapshot whenever the current scene changes. This bridges the
  // cold SceneModel.layersById to the runtime LayerStore SSoT consumed by:
  //   - Phase 7 CurrentLayerPicker / Phase 8 AdminLayerManager (UI subscribers)
  //   - Phase 10 LayerIsolate/Off/Freeze/Lock commands (mutate via upsertLayer)
  // Idempotent — `setLayers` no-ops on identical input.
  useEffect(() => {
    const layersById = currentScene?.layersById;
    if (!layersById) return;
    setLayerStoreLayers(Object.values(layersById));
  }, [currentScene]);

  // ADR-362 Round 5 — seed the runtime DIMSTYLE registry from the source DXF's
  // DIMSTYLE table whenever the active scene changes. Reconciliation wipes the
  // previous import's entries first so switching between DXFs doesn't leak
  // stale styles. Built-in templates remain untouched.
  useEffect(() => {
    registerImportedDimStyles(currentScene);
  }, [currentScene]);

  // Mirror the resolved mm → scene unit scale into the non-React SSoT so the
  // event-time grip-drag step snap can convert a user-typed mm step into the
  // scene units the drag delta lives in (else non-mm drawings never step).
  useEffect(() => {
    immediateSceneScale.set(mmToSceneUnits(dxfScene.units));
  }, [dxfScene.units]);

  return { dxfScene };
}
