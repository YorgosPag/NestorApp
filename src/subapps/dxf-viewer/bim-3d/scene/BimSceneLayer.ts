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

export class BimSceneLayer {
  readonly group: THREE.Group;

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
    for (const wall of entities.walls) {
      const resolved = resolveEntityBuilding(wall, floors, buildings);
      const buildingId = resolved?.id ?? '';
      if (!this.shouldRender(buildingId, useNewSystem, buildingVisModes, activeBuildingId)) continue;
      const mesh = wallToMesh(wall, floorElevationMm, activeLevelId, resolved?.baseElevation ?? 0);
      if (mesh) { mesh.userData['buildingId'] = buildingId; this.group.add(mesh); }
    }
    for (const column of entities.columns) {
      const resolved = resolveEntityBuilding(column, floors, buildings);
      const buildingId = resolved?.id ?? '';
      if (!this.shouldRender(buildingId, useNewSystem, buildingVisModes, activeBuildingId)) continue;
      const mesh = columnToMesh(column, floorElevationMm, activeLevelId, resolved?.baseElevation ?? 0);
      if (mesh) { mesh.userData['buildingId'] = buildingId; this.group.add(mesh); }
    }
    for (const beam of entities.beams) {
      const resolved = resolveEntityBuilding(beam, floors, buildings);
      const buildingId = resolved?.id ?? '';
      if (!this.shouldRender(buildingId, useNewSystem, buildingVisModes, activeBuildingId)) continue;
      const mesh = beamToMesh(beam, activeLevelId, resolved?.baseElevation ?? 0);
      if (mesh) { mesh.userData['buildingId'] = buildingId; this.group.add(mesh); }
    }
    for (const slab of entities.slabs) {
      const resolved = resolveEntityBuilding(slab, floors, buildings);
      const buildingId = resolved?.id ?? '';
      if (!this.shouldRender(buildingId, useNewSystem, buildingVisModes, activeBuildingId)) continue;
      const mesh = slabToMesh(slab, activeLevelId, resolved?.baseElevation ?? 0);
      if (mesh) { mesh.userData['buildingId'] = buildingId; this.group.add(mesh); }
    }
    // ADR-370 Phase 5 — stairs render as multi-mesh components (treads/risers/
    // stringers/handrails/landings). stairToMeshes returns a flat array; each
    // mesh carries its own userData.stairComponent for raycast resolution.
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
    for (const child of [...this.group.children]) {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    }
    this.group.clear();
  }

  dispose(): void {
    this.clearGroup();
    this.group.parent?.remove(this.group);
  }
}
