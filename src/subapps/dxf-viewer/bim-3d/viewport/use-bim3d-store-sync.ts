"use client";

import { useEffect, type RefObject } from 'react';
import { useDxfOverlay3DStore } from '../stores/DxfOverlay3DStore';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { useEnvironmentStore } from '../stores/EnvironmentStore';
import { useSectionStore } from '../stores/SectionStore';
import { LIGHT_PRESETS } from '../lighting/lighting-presets';
import { getHdriPreset } from '../lighting/hdri-environment';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';

// ADR-366 store→manager subscription sync. Wires low-frequency store updates
// into the active ThreeJsSceneManager instance. Mounted once by BimViewport3D.
export function useBim3DStoreSync(managerRef: RefObject<ThreeJsSceneManager | null>) {
  useEffect(() => {
    return useDxfOverlay3DStore.subscribe((s) => {
      managerRef.current?.syncDxfOverlay(s.dxfScene);
    });
  }, [managerRef]);

  useEffect(() => {
    return useViewMode3DStore.subscribe(
      (s) => s.floorVisibilityModes,
      (modes) => { managerRef.current?.applyFloorVisibility(modes); },
    );
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
