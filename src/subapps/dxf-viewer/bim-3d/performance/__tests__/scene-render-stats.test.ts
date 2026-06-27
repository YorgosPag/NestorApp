/**
 * Tests for computeSceneRenderStats (ADR-366 §B.5 collector accuracy fix).
 */

import * as THREE from 'three';
import { computeSceneRenderStats } from '../scene-render-stats';

function boxMesh(): THREE.Mesh {
  // BoxGeometry: 24 unique vertices, 36 indices → 12 triangles.
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
}

describe('computeSceneRenderStats', () => {
  it('counts triangles + vertices from a single mesh geometry', () => {
    const scene = new THREE.Scene();
    scene.add(boxMesh());

    const stats = computeSceneRenderStats(scene);
    expect(stats.triangles).toBe(12);
    expect(stats.vertices).toBe(24);
    expect(stats.meshTotal).toBe(1);
    expect(stats.meshVisible).toBe(1);
  });

  it('sums across multiple meshes', () => {
    const scene = new THREE.Scene();
    scene.add(boxMesh(), boxMesh(), boxMesh());

    const stats = computeSceneRenderStats(scene);
    expect(stats.triangles).toBe(36);
    expect(stats.meshTotal).toBe(3);
    expect(stats.meshVisible).toBe(3);
  });

  it('excludes invisible meshes from triangles/visible but keeps them in total', () => {
    const scene = new THREE.Scene();
    const hidden = boxMesh();
    hidden.visible = false;
    scene.add(boxMesh(), hidden);

    const stats = computeSceneRenderStats(scene);
    expect(stats.meshTotal).toBe(2);
    expect(stats.meshVisible).toBe(1);
    expect(stats.triangles).toBe(12); // only the visible box
  });

  it('skips an invisible parent subtree for visible/triangles', () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    group.visible = false;
    group.add(boxMesh());
    scene.add(group, boxMesh());

    const stats = computeSceneRenderStats(scene);
    expect(stats.meshTotal).toBe(2);       // both meshes exist
    expect(stats.meshVisible).toBe(1);     // child under hidden group not rendered
    expect(stats.triangles).toBe(12);
  });

  it('multiplies geometry by InstancedMesh instance count', () => {
    const scene = new THREE.Scene();
    const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 5);
    scene.add(instanced);

    const stats = computeSceneRenderStats(scene);
    expect(stats.triangles).toBe(12 * 5);
    expect(stats.meshVisible).toBe(1);
  });

  it('ignores non-mesh objects (lights, lines)', () => {
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight());
    scene.add(new THREE.Line(new THREE.BufferGeometry()));
    scene.add(boxMesh());

    const stats = computeSceneRenderStats(scene);
    expect(stats.meshTotal).toBe(1);
    expect(stats.triangles).toBe(12);
  });

  it('returns zeros for an empty scene', () => {
    const stats = computeSceneRenderStats(new THREE.Scene());
    expect(stats).toEqual({ triangles: 0, vertices: 0, meshTotal: 0, meshVisible: 0 });
  });
});
