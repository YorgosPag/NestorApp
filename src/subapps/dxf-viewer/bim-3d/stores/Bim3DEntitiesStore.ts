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

export interface Bim3DEntities {
  readonly walls: readonly WallEntity[];
  readonly columns: readonly ColumnEntity[];
  readonly beams: readonly BeamEntity[];
  readonly slabs: readonly SlabEntity[];
}

interface Bim3DEntitiesStoreState extends Bim3DEntities {
  /** Level currently loaded into the 3D scene. Fed by useLevelId3DSync. */
  activeLevelId: string | null;
  setWalls: (walls: readonly WallEntity[]) => void;
  setColumns: (columns: readonly ColumnEntity[]) => void;
  setBeams: (beams: readonly BeamEntity[]) => void;
  setSlabs: (slabs: readonly SlabEntity[]) => void;
  setActiveLevelId: (id: string | null) => void;
}

export const useBim3DEntitiesStore = create<Bim3DEntitiesStoreState>()(
  subscribeWithSelector((set) => ({
    walls: [],
    columns: [],
    beams: [],
    slabs: [],
    activeLevelId: null,
    setWalls: (walls) => set({ walls }),
    setColumns: (columns) => set({ columns }),
    setBeams: (beams) => set({ beams }),
    setSlabs: (slabs) => set({ slabs }),
    setActiveLevelId: (activeLevelId) => set({ activeLevelId }),
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
