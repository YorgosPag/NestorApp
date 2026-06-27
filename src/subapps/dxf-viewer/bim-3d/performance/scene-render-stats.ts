/**
 * scene-render-stats — ADR-366 §B.5 (collector accuracy fix)
 *
 * Pure, render-pipeline-independent geometry stats for a THREE.Scene.
 *
 * WHY: the scene renders through an EffectComposer (SSAO + post-FX overlay passes),
 * so `renderer.info.render` reflects only the LAST pass (a fullscreen quad / overlay),
 * reporting triangles=0 / drawCalls=3 for the whole BIM scene. Counting geometry by
 * traversing the scene is composer-independent and stable.
 *
 * `triangles`/`vertices`/`meshVisible` count only effectively-visible objects
 * (THREE.traverseVisible skips invisible subtrees), mirroring what is drawn.
 * `meshTotal` counts every mesh regardless of visibility. InstancedMesh geometry is
 * multiplied by its instance count.
 */

import * as THREE from 'three';

export interface SceneRenderStats {
  triangles: number;
  vertices: number;
  meshTotal: number;
  meshVisible: number;
}

function geometryTriangles(geometry: THREE.BufferGeometry): number {
  const index = geometry.getIndex();
  if (index) return Math.floor(index.count / 3);
  const position = geometry.getAttribute('position');
  return position ? Math.floor(position.count / 3) : 0;
}

function geometryVertices(geometry: THREE.BufferGeometry): number {
  const position = geometry.getAttribute('position');
  return position ? position.count : 0;
}

/** Instance multiplier for InstancedMesh, else 1. */
function instanceFactor(mesh: THREE.Mesh): number {
  return mesh instanceof THREE.InstancedMesh ? mesh.count : 1;
}

export function computeSceneRenderStats(scene: THREE.Scene): SceneRenderStats {
  let triangles = 0;
  let vertices = 0;
  let meshVisible = 0;
  let meshTotal = 0;

  // Total mesh count — visibility-agnostic.
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) meshTotal += 1;
  });

  // Visible geometry — skips invisible subtrees (mirrors what is rendered).
  scene.traverseVisible((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const geometry = obj.geometry;
    if (!geometry) return;
    const factor = instanceFactor(obj);
    triangles += geometryTriangles(geometry) * factor;
    vertices += geometryVertices(geometry) * factor;
    meshVisible += 1;
  });

  return { triangles, vertices, meshTotal, meshVisible };
}
