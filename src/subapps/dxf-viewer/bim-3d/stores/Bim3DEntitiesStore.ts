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
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import type { StairEntity } from '../../bim/types/stair-types';
import type { MepFixtureEntity } from '../../bim/types/mep-fixture-types';
import type { ElectricalPanelEntity } from '../../bim/types/electrical-panel-types';
import type { RailingEntity } from '../../bim/types/railing-types';
import type { FurnitureEntity } from '../../bim/types/furniture-types';
import type { MepSegmentEntity } from '../../bim/types/mep-segment-types';
import type { MepFittingEntity } from '../../bim/types/mep-fitting-types';
import type { MepManifoldEntity } from '../../bim/types/mep-manifold-types';
import type { RoofEntity } from '../../bim/types/roof-types';
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
  readonly slabOpenings: readonly SlabOpeningEntity[];
  /** ADR-363 Bug 2 — opening (door/window) entities for wall cutouts σε 3D. */
  readonly openings: readonly OpeningEntity[];
  readonly stairs: readonly StairEntity[];
  /** ADR-406 — point-based MEP fixtures (light fixtures first). */
  readonly fixtures: readonly MepFixtureEntity[];
  /** ADR-408 Φ3 — point-based electrical panels (circuit sources). */
  readonly panels: readonly ElectricalPanelEntity[];
  /** ADR-407 — standalone path-based railings. */
  readonly railings: readonly RailingEntity[];
  /** ADR-410 — mesh-based CC0 furniture (chair first). */
  readonly furnitures: readonly FurnitureEntity[];
  /** ADR-417 — parametric pitched roofs (footprint + per-edge slopes). */
  readonly roofs: readonly RoofEntity[];
  /** ADR-408 Φ8 — linear MEP segments (duct + pipe). */
  readonly mepSegments: readonly MepSegmentEntity[];
  /** ADR-408 Φ11 — auto pipe fittings (point-based junction elements). */
  readonly mepFittings: readonly MepFittingEntity[];
  /** ADR-408 Φ12 — plumbing manifold (point-based distribution source). */
  readonly manifolds: readonly MepManifoldEntity[];
}

/**
 * Empty entity bundle — canonical "no BIM entities" value. Defined here (the
 * type's home) so non-React SSoT helpers can import it without pulling in a
 * React hook module (ADR-399 cycle-avoidance). Re-exported from
 * `use-bim3d-vg-resync` for backward compatibility.
 */
export const EMPTY_BIM_ENTITIES: Bim3DEntities = {
  walls: [],
  columns: [],
  beams: [],
  slabs: [],
  slabOpenings: [],
  openings: [],
  stairs: [],
  fixtures: [],
  panels: [],
  railings: [],
  furnitures: [],
  mepSegments: [],
  mepFittings: [],
  manifolds: [],
};

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
  /**
   * ADR-411 — monotonic counter bumped when ANY mesh-based BIM asset (furniture,
   * light fixture, …) finishes loading into the `bimMeshCache`. Any change
   * triggers the entities-store subscriber in `BimViewport3D` → `resyncBimScene`,
   * so the cache-miss bbox placeholder is replaced by the real mesh on the next
   * sync pass. One shared resync signal for every mesh category (ADR-411 Δ5).
   */
  meshAssetVersion: number;
  /**
   * ADR-413 — monotonic counter bumped when a PBR texture *set* finishes loading
   * into the `bimTextureCache`. Mirrors `meshAssetVersion`: any change triggers
   * the entities-store subscriber in `BimViewport3D` → `resyncBimScene`, so flat
   * materials are swapped for textured `MeshStandardMaterial`s on the next sync
   * pass. One shared resync signal for every texture slug.
   */
  textureAssetVersion: number;
  setWalls: (walls: readonly WallEntity[]) => void;
  setColumns: (columns: readonly ColumnEntity[]) => void;
  setBeams: (beams: readonly BeamEntity[]) => void;
  setSlabs: (slabs: readonly SlabEntity[]) => void;
  setSlabOpenings: (slabOpenings: readonly SlabOpeningEntity[]) => void;
  setOpenings: (openings: readonly OpeningEntity[]) => void;
  setStairs: (stairs: readonly StairEntity[]) => void;
  setFixtures: (fixtures: readonly MepFixtureEntity[]) => void;
  setPanels: (panels: readonly ElectricalPanelEntity[]) => void;
  setRailings: (railings: readonly RailingEntity[]) => void;
  setFurnitures: (furnitures: readonly FurnitureEntity[]) => void;
  /** ADR-417 — feed the parametric pitched roofs slice. */
  setRoofs: (roofs: readonly RoofEntity[]) => void;
  /** ADR-408 Φ8 — feed the linear MEP segments (duct + pipe) slice. */
  setMepSegments: (mepSegments: readonly MepSegmentEntity[]) => void;
  /** ADR-408 Φ11 — feed the auto pipe fittings slice. */
  setMepFittings: (mepFittings: readonly MepFittingEntity[]) => void;
  /** ADR-408 Φ12 — feed the plumbing manifold slice. */
  setManifolds: (manifolds: readonly MepManifoldEntity[]) => void;
  /** ADR-411 — bump after any mesh glTF load resolves (triggers 3D resync). */
  bumpMeshAssetVersion: () => void;
  /** ADR-413 — bump after any PBR texture set load resolves (triggers 3D resync). */
  bumpTextureAssetVersion: () => void;
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
    slabOpenings: [],
    openings: [],
    stairs: [],
    fixtures: [],
    panels: [],
    railings: [],
    furnitures: [],
    roofs: [],
    mepSegments: [],
    mepFittings: [],
    manifolds: [],
    meshAssetVersion: 0,
    textureAssetVersion: 0,
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
    setSlabOpenings: (slabOpenings) => set({ slabOpenings }),
    setOpenings: (openings) => set({ openings }),
    setStairs: (stairs) => set({ stairs }),
    setFixtures: (fixtures) => set({ fixtures }),
    setPanels: (panels) => set({ panels }),
    setRailings: (railings) => set({ railings }),
    setFurnitures: (furnitures) => set({ furnitures }),
    setRoofs: (roofs) => set({ roofs }),
    setMepSegments: (mepSegments) => set({ mepSegments }),
    setMepFittings: (mepFittings) => set({ mepFittings }),
    setManifolds: (manifolds) => set({ manifolds }),
    bumpMeshAssetVersion: () => set((s) => ({ meshAssetVersion: s.meshAssetVersion + 1 })),
    bumpTextureAssetVersion: () => set((s) => ({ textureAssetVersion: s.textureAssetVersion + 1 })),
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
    slabOpenings: state.slabOpenings,
    openings: state.openings,
    stairs: state.stairs,
    fixtures: state.fixtures,
    panels: state.panels,
    railings: state.railings,
    furnitures: state.furnitures,
    roofs: state.roofs,
    mepSegments: state.mepSegments,
    mepFittings: state.mepFittings,
    manifolds: state.manifolds,
  };
}
