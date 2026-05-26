/**
 * BimSceneLayer — manages Three.js meshes for BIM entities inside a THREE.Group.
 *
 * Phase 2 strategy: rebuild-all on every sync() call (correctness over perf).
 * Phase 3+: incremental dirty-tracking via entity.updatedAt comparison.
 *
 * ADR-366 Phase 2. Owned exclusively by ThreeJsSceneManager.
 */

import * as THREE from 'three';
import type { Bim3DEntities } from '../stores/Bim3DEntitiesStore';
import { wallToMesh, columnToMesh, beamToMesh, slabToMesh } from '../converters/BimToThreeConverter';
import { stairToMeshes } from '../converters/StairToThreeConverter';
import { resolveEntityBuilding } from '../../bim/utils/bim-floor-utils';
import type { BuildingRef, FloorRef } from '../../bim/utils/bim-floor-utils';
import type { BuildingVisMode } from '../utils/building-visibility-state';
import { resolveIsCategoryVisible } from '../../config/bim-line-weight-resolver';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import type { OpeningEntity } from '../../bim/types/opening-types';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';

export class BimSceneLayer {
  readonly group: THREE.Group;
  private _hasMesh = false;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'bim-entities';
    scene.add(this.group);
  }

  sync(
    entities: Bim3DEntities,
    floorElevationMm = 0,
    activeLevelId?: string,
    floors: readonly FloorRef[] = [],
    buildings: readonly BuildingRef[] = [],
    activeBuildingId: string | null = null,
    buildingVisModes: ReadonlyMap<string, BuildingVisMode> = new Map(),
  ): void {
    this.clearGroup();
    const useNewSystem = buildingVisModes.size > 0;
    // ADR-375 Phase C.4 v2.6 — V/G category visibility hotfix.
    // Snapshot lifted once: when a category is hidden via per-view override
    // we skip the entire loop so no mesh + edge overlay reaches the scene.
    // Walls/slabs hidden also remove their hosted opening cutouts; opening
    // categories hidden keep host walls/slabs solid (no THREE.Shape holes).
    const objectStyles = useDrawingScaleStore.getState().objectStyles;
    const wallVisible        = resolveIsCategoryVisible('wall', objectStyles);
    const columnVisible      = resolveIsCategoryVisible('column', objectStyles);
    const beamVisible        = resolveIsCategoryVisible('beam', objectStyles);
    const slabVisible        = resolveIsCategoryVisible('slab', objectStyles);
    const stairVisible       = resolveIsCategoryVisible('stair', objectStyles);
    const openingVisible     = resolveIsCategoryVisible('opening', objectStyles);
    const slabOpeningVisible = resolveIsCategoryVisible('slab-opening', objectStyles);
    const EMPTY_OPENINGS: readonly OpeningEntity[] = [];
    const EMPTY_SLAB_OPENINGS: readonly SlabOpeningEntity[] = [];

    // ADR-363 Bug 2 — wall openings render ως THREE.Shape.holes cutouts στους
    // τοίχους. Mirror του slab→slab-opening pattern: openings filtered per
    // wall με `wallId` FK, passed inline στο wallToMesh.
    if (wallVisible) {
      for (const wall of entities.walls) {
        const resolved = resolveEntityBuilding(wall, floors, buildings);
        const buildingId = resolved?.id ?? '';
        if (!this.shouldRender(buildingId, useNewSystem, buildingVisModes, activeBuildingId)) continue;
        const openingsForWall = openingVisible
          ? entities.openings.filter((o) => o.params.wallId === wall.id)
          : EMPTY_OPENINGS;
        const mesh = wallToMesh(wall, openingsForWall, floorElevationMm, activeLevelId, resolved?.baseElevation ?? 0);
        if (mesh) { mesh.userData['buildingId'] = buildingId; this.group.add(mesh); }
      }
    }
    if (columnVisible) {
      for (const column of entities.columns) {
        const resolved = resolveEntityBuilding(column, floors, buildings);
        const buildingId = resolved?.id ?? '';
        if (!this.shouldRender(buildingId, useNewSystem, buildingVisModes, activeBuildingId)) continue;
        const mesh = columnToMesh(column, floorElevationMm, activeLevelId, resolved?.baseElevation ?? 0);
        if (mesh) { mesh.userData['buildingId'] = buildingId; this.group.add(mesh); }
      }
    }
    if (beamVisible) {
      for (const beam of entities.beams) {
        const resolved = resolveEntityBuilding(beam, floors, buildings);
        const buildingId = resolved?.id ?? '';
        if (!this.shouldRender(buildingId, useNewSystem, buildingVisModes, activeBuildingId)) continue;
        const mesh = beamToMesh(beam, activeLevelId, resolved?.baseElevation ?? 0);
        if (mesh) { mesh.userData['buildingId'] = buildingId; this.group.add(mesh); }
      }
    }
    // ADR-363 §11.Q3 Phase 3.7d + ADR-370 §6 Phase 7 — slab cutouts.
    // Openings live as first-class entities (own Firestore collection) but are
    // rendered as holes in their host slab's extrude (THREE.Shape.holes). No
    // separate loop — passed inline so triangulation cuts the slab geometry.
    if (slabVisible) {
      for (const slab of entities.slabs) {
        const resolved = resolveEntityBuilding(slab, floors, buildings);
        const buildingId = resolved?.id ?? '';
        if (!this.shouldRender(buildingId, useNewSystem, buildingVisModes, activeBuildingId)) continue;
        const openingsForSlab = slabOpeningVisible
          ? entities.slabOpenings.filter((o) => o.params.slabId === slab.id)
          : EMPTY_SLAB_OPENINGS;
        const mesh = slabToMesh(slab, openingsForSlab, activeLevelId, resolved?.baseElevation ?? 0);
        if (mesh) { mesh.userData['buildingId'] = buildingId; this.group.add(mesh); }
      }
    }
    // ADR-370 Phase 5 — stairs render as multi-mesh components (treads/risers/
    // stringers/handrails/landings). stairToMeshes returns a flat array; each
    // mesh carries its own userData.stairComponent for raycast resolution.
    if (stairVisible) {
      for (const stair of entities.stairs) {
        const resolved = resolveEntityBuilding(stair, floors, buildings);
        const buildingId = resolved?.id ?? '';
        if (!this.shouldRender(buildingId, useNewSystem, buildingVisModes, activeBuildingId)) continue;
        const meshes = stairToMeshes(stair, floorElevationMm, activeLevelId, resolved?.baseElevation ?? 0);
        for (const mesh of meshes) {
          mesh.userData['buildingId'] = buildingId;
          this.group.add(mesh);
        }
      }
    }
    let found = false;
    this.group.traverse((obj) => { if (!found && obj instanceof THREE.Mesh) found = true; });
    this._hasMesh = found;
  }

  /** Returns true if a mesh for buildingId should be added to the scene. */
  private shouldRender(
    buildingId: string,
    useNewSystem: boolean,
    modes: ReadonlyMap<string, BuildingVisMode>,
    activeBuildingId: string | null,
  ): boolean {
    if (useNewSystem) return (modes.get(buildingId) ?? 'show') !== 'hide';
    if (activeBuildingId !== null) return buildingId === activeBuildingId;
    return true;
  }

  private clearGroup(): void {
    // ADR-363 Bug 2 — wallToMesh now returns Group για openings (per-segment
    // meshes). Recursive traverse disposes nested geometries.
    for (const child of [...this.group.children]) {
      child.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
        }
      });
    }
    this.group.clear();
  }

  /** True iff BIM group contains ≥1 triangle Mesh (cached from last sync). */
  get hasMesh(): boolean { return this._hasMesh; }

  dispose(): void {
    this.clearGroup();
    this.group.parent?.remove(this.group);
  }
}
