"use client";

import { useEffect, type RefObject } from 'react';
import { useDxfOverlay3DStore } from '../stores/DxfOverlay3DStore';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { useEnvironmentStore } from '../stores/EnvironmentStore';
import { useSectionStore } from '../stores/SectionStore';
import { LIGHT_PRESETS } from '../lighting/lighting-presets';
import { getHdriPreset } from '../lighting/hdri-environment';
import { subscribeLayerStore, getLayerStoreSnapshot } from '../../stores/LayerStore';
import { resyncBimScene } from '../scene/bim3d-resync';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';

// ADR-366 store→manager subscription sync. Wires low-frequency store updates
// into the active ThreeJsSceneManager instance. Mounted once by BimViewport3D.
export function useBim3DStoreSync(managerRef: RefObject<ThreeJsSceneManager | null>) {
  useEffect(() => {
    return useDxfOverlay3DStore.subscribe((s) => {
      managerRef.current?.syncDxfOverlay(s.dxfScene);
    });
  }, [managerRef]);

  // ADR-382 Phase C — floor mode change must trigger BOTH a scene rebuild
  // (so 'hide' modes filter pre-mesh via resolver) AND post-hoc apply for
  // 'show'/'ghost' styling on already-built meshes. Defense-in-depth.
  // ADR-399 — routed through the scope-aware SSoT so a checkbox toggle in
  // "Όλοι οι όροφοι" rebuilds the STACKED building (not just the active level);
  // resyncBimScene re-applies floor visibility itself in the 'all' branch.
  useEffect(() => {
    return useViewMode3DStore.subscribe(
      (s) => s.floorVisibilityModes,
      (modes) => {
        const manager = managerRef.current;
        if (!manager) return;
        resyncBimScene(manager, { externalEntitiesMode: false });
        // 'single' branch needs the explicit visibility pass (the 'all' branch
        // already applies it inside resyncBimScene).
        if (useViewMode3DStore.getState().floor3DScope !== 'all') {
          manager.applyFloorVisibility(modes);
        }
      },
    );
  }, [managerRef]);

  // ADR-382 Phase C — LayerStore.visible / .frozen toggles trigger a 3D rebuild
  // so the resolver's pre-mesh filter removes hidden entities. Without this,
  // toggling a layer in the Layer Manager would only affect 2D (the bug ADR-382
  // resolves). snapshot.version is the monotonic change marker.
  useEffect(() => {
    let prevVersion = getLayerStoreSnapshot().version;
    return subscribeLayerStore(() => {
      const next = getLayerStoreSnapshot();
      if (next.version === prevVersion) return;
      prevVersion = next.version;
      resyncBimScene(managerRef.current, { externalEntitiesMode: false });
    });
  }, [managerRef]);

  useEffect(() => {
    return useViewMode3DStore.subscribe(
      (s) => ({ az: s.sunAzimuthDeg, el: s.sunElevationDeg }),
      ({ az, el }) => { managerRef.current?.updateSunPosition(az, el); },
      { equalityFn: (a, b) => a.az === b.az && a.el === b.el },
    );
  }, [managerRef]);

  useEffect(() => {
    return useViewMode3DStore.subscribe(
      (s) => s.sunPreset,
      (preset) => { managerRef.current?.applyLightPreset(LIGHT_PRESETS[preset]); },
    );
  }, [managerRef]);

  useEffect(() => {
    return useEnvironmentStore.subscribe(
      (s) => s.hdriPresetId,
      (id) => {
        const preset = getHdriPreset(id);
        if (preset) useEnvironmentStore.getState().setHdriUrl(preset.url);
      },
    );
  }, [managerRef]);

  // ADR-366 Group B — when the user removes a custom HDRI, restore the
  // currently-selected preset URL so the scene environment reverts cleanly
  // (otherwise hdriUrl would still point at the cleared custom upload).
  useEffect(() => {
    return useEnvironmentStore.subscribe(
      (s) => s.customHdriUrl,
      (customUrl) => {
        if (customUrl) return;
        const preset = getHdriPreset(useEnvironmentStore.getState().hdriPresetId);
        if (preset) useEnvironmentStore.getState().setHdriUrl(preset.url);
      },
    );
  }, [managerRef]);

  // ADR-366 §A.3 — safety net: user enables section before geometry sync → ensure init runs.
  useEffect(() => {
    return useSectionStore.subscribe(
      (s) => s.enabled,
      (enabled) => { if (enabled) managerRef.current?.initSectionBox(); },
    );
  }, [managerRef]);
}
