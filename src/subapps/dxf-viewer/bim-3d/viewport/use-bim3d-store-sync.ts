"use client";

import { useEffect, type RefObject } from 'react';
import { useDxfOverlay3DStore } from '../stores/DxfOverlay3DStore';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { useEnvironmentStore } from '../stores/EnvironmentStore';
import { useSectionStore } from '../stores/SectionStore';
import { LIGHT_PRESETS } from '../lighting/lighting-presets';
import { getHdriPreset } from '../lighting/hdri-environment';
import { subscribeLayerStore, getLayerStoreSnapshot } from '../../stores/LayerStore';
import { useActiveStoreyStore } from '../../systems/levels/active-storey-store';
import { resyncBimScene } from '../scene/bim3d-resync';
import { resyncDxfOverlay } from '../scene/dxf-overlay-resync';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';

// ADR-366 store→manager subscription sync. Wires low-frequency store updates
// into the active ThreeJsSceneManager instance. Mounted once by BimViewport3D.
export function useBim3DStoreSync(managerRef: RefObject<ThreeJsSceneManager | null>) {
  // ADR-399 Phase B — scope-aware: 'single' → active-floor overlay at its storey FFL (Φάση Ε);
  // 'all' → stacked per-floor overlay (active floor's live edits re-enter the
  // multi-floor rebuild here too). resyncDxfOverlay reads the current scope.
  useEffect(() => {
    return useDxfOverlay3DStore.subscribe(() => {
      resyncDxfOverlay(managerRef.current);
    });
  }, [managerRef]);

  // ADR-399 Φάση Ε — the active storey's FFL resolves ASYNCHRONOUSLY (the building's floors come
  // from Firestore via `useActiveStoreySync`). The DXF overlay scene routinely lands FIRST, so the
  // initial resync seats the plan at the `0` fallback — and, unlike the BIM path (which self-heals
  // on its per-entity subscriptions), NOTHING would ever move it again: an upper storey's plan
  // would stay sunk at ground level. Also covers editing the elevation in the «Όροφοι» tab while
  // the floor stays open. Guarded on the datum VALUE, so a same-elevation context object costs zero.
  useEffect(() => {
    let prevElevationMm = useActiveStoreyStore.getState().context?.floorElevationMm ?? null;
    return useActiveStoreyStore.subscribe((s) => {
      const nextElevationMm = s.context?.floorElevationMm ?? null;
      if (nextElevationMm === prevElevationMm) return;
      prevElevationMm = nextElevationMm;
      const manager = managerRef.current;
      if (!manager) return;
      resyncDxfOverlay(manager);
      // Belt-and-suspenders: the BIM single-floor sync reads the SAME datum (`bim3d-resync`), so
      // re-seat it from the same signal instead of relying on an entity subscription to fire.
      resyncBimScene(manager, { externalEntitiesMode: false });
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
