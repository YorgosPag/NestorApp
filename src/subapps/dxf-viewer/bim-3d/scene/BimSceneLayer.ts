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

export class BimSceneLayer {
  readonly group: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'bim-entities';
    scene.add(this.group);
  }

  sync(entities: Bim3DEntities, floorElevationMm = 0): void {
    this.clearGroup();
    for (const wall of entities.walls) {
      const mesh = wallToMesh(wall, floorElevationMm);
      if (mesh) this.group.add(mesh);
    }
    for (const column of entities.columns) {
      const mesh = columnToMesh(column, floorElevationMm);
      if (mesh) this.group.add(mesh);
    }
    for (const beam of entities.beams) {
      const mesh = beamToMesh(beam);
      if (mesh) this.group.add(mesh);
    }
    for (const slab of entities.slabs) {
      const mesh = slabToMesh(slab);
      if (mesh) this.group.add(mesh);
    }
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
