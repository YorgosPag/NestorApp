/**
 * Bim3DEntitiesStore — Zustand store for BIM entity data consumed by the 3D renderer.
 *
 * SSoT feed: each *PersistenceHost pushes its entity slice whenever `currentScene`
 * changes (reactive React state, not a new Firestore subscription).
 *
 * ADR-366 Phase 2 (BimToThreeConverter). ADR-040 compliant: BimViewport3D
 * subscribes via useSyncExternalStore (low-freq — entity changes are user-triggered).
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { WallEntity } from '../../bim/types/wall-types';
import type { ColumnEntity } from '../../bim/types/column-types';
import type { BeamEntity } from '../../bim/types/beam-types';
import type { SlabEntity } from '../../bim/types/slab-types';
import type { BuildingRef, FloorRef } from '../../bim/utils/bim-floor-utils';
import { applyBuildingsPreset } from '../utils/building-visibility-state';
import type { BuildingVisMode, BuildingPreset } from '../utils/building-visibility-state';

export type { BuildingVisMode, BuildingPreset };

/**
 * Which z-reference the Floors tab uses to display elevations (ADR-369 §9.2 Q3).
 * 'floor'    → floor.elevation relative to building datum (default)
 * 'building' → building.baseElevation + floor.elevation (project base)
 * 'site'     → sum including project.basePoint (site origin)
 * 'sea'      → geodetic / Mean Sea Level (survey point chain)
 */
export type ElevationReference = 'floor' | 'building' | 'site' | 'sea';

export interface Bim3DEntities {
  readonly walls: readonly WallEntity[];
  readonly columns: readonly ColumnEntity[];
  readonly beams: readonly BeamEntity[];
  readonly slabs: readonly SlabEntity[];
}

interface Bim3DEntitiesStoreState extends Bim3DEntities {
  /** Level currently loaded into the 3D scene. Fed by useLevelId3DSync. */
  activeLevelId: string | null;
  /** Multi-building scene context (ADR-369 §9.2 Q2.1). */
  buildings: readonly BuildingRef[];
  /** Floors with buildingId FK for building resolution chain (ADR-369 Q2.1). */
  floors: readonly FloorRef[];
  /** Active building filter — null = show all buildings (ADR-369 Q2.2). */
  activeBuildingId: string | null;
  /** Per-building visibility modes (ADR-369 Q2.3): empty map = all 'show' (default). */
  buildingVisibilityModes: ReadonlyMap<string, BuildingVisMode>;
  /** Elevation reference system for Floors tab display (ADR-369 §9.2 Q3). */
  elevationReference: ElevationReference;
  setWalls: (walls: readonly WallEntity[]) => void;
  setColumns: (columns: readonly ColumnEntity[]) => void;
  setBeams: (beams: readonly BeamEntity[]) => void;
  setSlabs: (slabs: readonly SlabEntity[]) => void;
  setActiveLevelId: (id: string | null) => void;
  setBuildings: (buildings: readonly BuildingRef[]) => void;
  setFloors: (floors: readonly FloorRef[]) => void;
  setActiveBuildingId: (id: string | null) => void;
  setBuildingMode: (buildingId: string, mode: BuildingVisMode) => void;
  applyBuildingsPreset: (preset: BuildingPreset, focusBuildingId?: string) => void;
  setElevationReference: (ref: ElevationReference) => void;
}

export const useBim3DEntitiesStore = create<Bim3DEntitiesStoreState>()(
  subscribeWithSelector((set) => ({
    walls: [],
    columns: [],
    beams: [],
    slabs: [],
    activeLevelId: null,
    buildings: [],
    floors: [],
    activeBuildingId: null,
    buildingVisibilityModes: new Map<string, BuildingVisMode>(),
    elevationReference: 'floor',
    setWalls: (walls) => set({ walls }),
    setColumns: (columns) => set({ columns }),
    setBeams: (beams) => set({ beams }),
    setSlabs: (slabs) => set({ slabs }),
    setActiveLevelId: (activeLevelId) => set({ activeLevelId }),
    setBuildings: (buildings) => set({ buildings }),
    setFloors: (floors) => set({ floors }),
    setActiveBuildingId: (activeBuildingId) => set({ activeBuildingId }),
    setBuildingMode: (buildingId, mode) =>
      set((s) => {
        const next = new Map(s.buildingVisibilityModes);
        next.set(buildingId, mode);
        return { buildingVisibilityModes: next };
      }),
    applyBuildingsPreset: (preset, focusBuildingId) =>
      set((s) => {
        const effectiveActive = focusBuildingId ?? s.activeBuildingId;
        return {
          buildingVisibilityModes: applyBuildingsPreset(s.buildings, preset, effectiveActive),
        };
      }),
    setElevationReference: (elevationReference) => set({ elevationReference }),
  })),
);

export function selectBim3DEntities(state: Bim3DEntitiesStoreState): Bim3DEntities {
  return {
    walls: state.walls,
    columns: state.columns,
    beams: state.beams,
    slabs: state.slabs,
  };
}
