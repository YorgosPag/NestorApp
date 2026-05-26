"use client";

import { useEffect, type RefObject } from 'react';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import { useBim3DEntitiesStore, type Bim3DEntities } from '../stores/Bim3DEntitiesStore';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';

export const EMPTY_BIM_ENTITIES: Bim3DEntities = {
  walls: [],
  columns: [],
  beams: [],
  slabs: [],
  slabOpenings: [],
  openings: [],
  stairs: [],
};

// ADR-375 Phase C.4 v2.6 — V/G category visibility re-sync wiring.
// BimSceneLayer.sync() filters hidden categories at scene-build time, but
// toggling visibility in the V/G panel must trigger a rebuild. The entities
// store subscription only fires on entity changes, so a dedicated subscription
// on objectStyles re-issues syncBimEntities with the current entity snapshot
// whenever any category toggle, color, or pattern mutates.
export function useBim3DVgResync(
  managerRef: RefObject<ThreeJsSceneManager | null>,
  externalEntitiesMode: boolean,
  bimEntities: Bim3DEntities | null | undefined,
): void {
  useEffect(() => {
    return useBimRenderSettingsStore.subscribe(
      (s) => s.objectStyles,
      () => {
        const manager = managerRef.current;
        if (!manager) return;
        if (externalEntitiesMode) {
          manager.syncBimEntities(bimEntities ?? EMPTY_BIM_ENTITIES, 0, undefined);
          return;
        }
        const s = useBim3DEntitiesStore.getState();
        manager.syncBimEntities(
          { walls: s.walls, columns: s.columns, beams: s.beams, slabs: s.slabs, slabOpenings: s.slabOpenings, openings: s.openings, stairs: s.stairs },
          0,
          s.activeLevelId ?? undefined,
          s.floors,
          s.buildings,
          s.activeBuildingId,
          s.buildingVisibilityModes,
        );
      },
    );
  }, [managerRef, externalEntitiesMode, bimEntities]);
}
