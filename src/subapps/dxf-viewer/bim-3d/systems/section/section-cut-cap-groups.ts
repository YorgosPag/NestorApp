/**
 * section-cut-cap-groups — scene-grouping + colour-cap helpers for
 * {@link SectionStencilRenderer}.
 *
 * Extracted from `section-stencil-renderer.ts` (file-size SSoT N.7.1). Pure
 * per-frame traversals (group cut BIM meshes by material colour / hatch key) plus
 * the lazily-cached opaque colour-cap material factory. See ADR-452 v2.4.
 */

import * as THREE from 'three';
import { type SectionHatchKey, resolveHatchKey } from './section-hatch-cap';

/**
 * The colour a cut face should be painted = the colour the user SEES on the solid.
 *
 * The «Consistent Colors» visual style (`getConsistentVariant` in MaterialCatalog3D)
 * fakes an unlit flat look by moving the real colour into `emissive` and setting
 * `material.color` to black. Reading `.color` there would group every consistent-mode
 * mesh under black → the per-material cut cap paints the whole section black (visible
 * only at full quality, so it vanishes while orbiting via the v2.7 fast path). When
 * `color` is black but `emissive` carries a colour, the emissive IS the display
 * colour — use it. Otherwise `.color` is the display colour (shaded / realistic).
 */
function displayColorHex(mat: { color?: THREE.Color; emissive?: THREE.Color }): number {
  const colorHex = mat.color ? mat.color.getHex() : 0x000000;
  const emissiveHex = mat.emissive ? mat.emissive.getHex() : 0x000000;
  return colorHex === 0x000000 && emissiveHex !== 0x000000 ? emissiveHex : colorHex;
}

/**
 * ADR-452 v2.4 — group cut BIM meshes by their material colour. Each group's cut
 * face is painted in that colour so multilayer build-ups (concrete core vs
 * plaster finish, etc.) read as distinct bands. Mirrors {@link collectHatchGroups}.
 */
export function collectColorGroups(mainScene: THREE.Scene): Map<number, THREE.Object3D[]> {
  const groups = new Map<number, THREE.Object3D[]>();
  mainScene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if ((obj.userData as Record<string, unknown>)['bimId'] === undefined) return;
    const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
    const color = (mat as { color?: THREE.Color }).color;
    if (!color) return;
    const hex = displayColorHex(mat as { color?: THREE.Color; emissive?: THREE.Color });
    let arr = groups.get(hex);
    if (!arr) { arr = []; groups.set(hex, arr); }
    arr.push(obj);
  });
  return groups;
}

/**
 * Traverse scene once per frame, group BIM meshes by material hatch key.
 * Meshes with null hatch key (glass/unknown) are excluded — grey cap covers them.
 */
export function collectHatchGroups(mainScene: THREE.Scene): Map<SectionHatchKey, THREE.Object3D[]> {
  const groups = new Map<SectionHatchKey, THREE.Object3D[]>();
  mainScene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const bimId = (obj.userData as Record<string, unknown>)['bimId'];
    if (bimId === undefined) return;
    const matId = (obj.userData as Record<string, unknown>)['matId'] as string | undefined;
    const key = resolveHatchKey(matId);
    if (key === null) return;
    let arr = groups.get(key);
    if (!arr) { arr = []; groups.set(key, arr); }
    arr.push(obj);
  });
  return groups;
}

/** Lazily build (and cache) an opaque NotEqual-stencil cap material of a given colour. */
export function getColorCapMaterial(
  cache: Map<number, THREE.MeshBasicMaterial>,
  hex: number,
): THREE.MeshBasicMaterial {
  let mat = cache.get(hex);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({
      color: hex,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
    });
    mat.stencilWrite = true;
    mat.stencilRef = 0;
    mat.stencilFunc = THREE.NotEqualStencilFunc;
    mat.stencilFail = THREE.ReplaceStencilOp;
    mat.stencilZFail = THREE.ReplaceStencilOp;
    mat.stencilZPass = THREE.ReplaceStencilOp;
    cache.set(hex, mat);
  }
  return mat;
}
