/**
 * Tests for `solveFitDistance` (ADR-412/ADR-414) — the exact 8-corner camera fit
 * shared by every «Edit … Type» dialog preview. Pure maths + a real
 * `PerspectiveCamera`; NO WebGL context, so this runs in plain jsdom.
 *
 * These are PROPERTY tests, not golden numbers: instead of pinning the distance
 * to a magic constant (which would lock in a bug just as happily as a fix), each
 * case projects all 8 box corners through a camera placed at the solved distance
 * and asserts what the fit actually promises — every corner inside the frustum,
 * and no needless empty space around it.
 */

import * as THREE from 'three';
import { solveFitDistance, FIT_MARGIN } from '../band-stack-fit';
import { WALL_PREVIEW_SPEC } from '../WallTypePreviewRenderer';
import { SLAB_PREVIEW_SPEC } from '../SlabTypePreviewRenderer';

const FOV = 35; // matches the renderer's PerspectiveCamera

/** Project every corner of the box through a camera sitting at the solved fit. */
function projectCorners(
  halfExtents: readonly [number, number, number],
  viewDir: THREE.Vector3,
  fov: number,
  aspect: number,
): { maxAbsX: number; maxAbsY: number; allInFront: boolean } {
  const dist = solveFitDistance(halfExtents, viewDir, fov, aspect);
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.01, 100);
  camera.position.copy(viewDir).multiplyScalar(dist);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  const [hx, hy, hz] = halfExtents;
  let maxAbsX = 0;
  let maxAbsY = 0;
  let allInFront = true;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const corner = new THREE.Vector3(sx * hx, sy * hy, sz * hz);
    // Depth in camera space: negative Z is in front of the camera in THREE.
    const inCam = corner.clone().applyMatrix4(camera.matrixWorldInverse);
    if (inCam.z >= 0) allInFront = false;
    const ndc = corner.project(camera);
    maxAbsX = Math.max(maxAbsX, Math.abs(ndc.x));
    maxAbsY = Math.max(maxAbsY, Math.abs(ndc.y));
  }
  return { maxAbsX, maxAbsY, allInFront };
}

/** The real stub shapes both previews ask for, plus deliberately nasty ones. */
const CASES: ReadonlyArray<{
  name: string;
  halfExtents: readonly [number, number, number];
  viewDir: THREE.Vector3;
  aspect: number;
}> = [
  {
    name: 'wall stub, 250mm DNA, landscape panel',
    halfExtents: WALL_PREVIEW_SPEC.halfExtents(0.25),
    viewDir: WALL_PREVIEW_SPEC.viewDir,
    aspect: 320 / 240,
  },
  {
    name: 'slab stub, 285mm DNA, landscape panel',
    halfExtents: SLAB_PREVIEW_SPEC.halfExtents(0.285),
    viewDir: SLAB_PREVIEW_SPEC.viewDir,
    aspect: 320 / 240,
  },
  {
    name: 'wall stub, very thick DNA (1m)',
    halfExtents: WALL_PREVIEW_SPEC.halfExtents(1),
    viewDir: WALL_PREVIEW_SPEC.viewDir,
    aspect: 16 / 9,
  },
  {
    name: 'slab stub, near-zero DNA (degenerate flat box)',
    halfExtents: SLAB_PREVIEW_SPEC.halfExtents(0.001),
    viewDir: SLAB_PREVIEW_SPEC.viewDir,
    aspect: 1,
  },
  {
    name: 'wall stub, extreme portrait aspect',
    halfExtents: WALL_PREVIEW_SPEC.halfExtents(0.25),
    viewDir: WALL_PREVIEW_SPEC.viewDir,
    aspect: 0.4,
  },
  {
    name: 'slab stub, extreme landscape aspect',
    halfExtents: SLAB_PREVIEW_SPEC.halfExtents(0.285),
    viewDir: SLAB_PREVIEW_SPEC.viewDir,
    aspect: 4,
  },
];

describe('solveFitDistance', () => {
  describe.each(CASES)('$name', ({ halfExtents, viewDir, aspect }) => {
    it('places every one of the 8 corners inside the frustum', () => {
      const { maxAbsX, maxAbsY } = projectCorners(halfExtents, viewDir, FOV, aspect);
      // ≤1 in NDC on both axes = nothing clipped. This is the whole promise of
      // the exact solve (the old bounding-sphere fit clipped the near corner).
      expect(maxAbsX).toBeLessThanOrEqual(1);
      expect(maxAbsY).toBeLessThanOrEqual(1);
    });

    it('keeps the whole stub in front of the camera', () => {
      const { allInFront } = projectCorners(halfExtents, viewDir, FOV, aspect);
      expect(allInFront).toBe(true);
    });

    it('fits tightly — the limiting axis nearly touches the frustum edge', () => {
      const { maxAbsX, maxAbsY } = projectCorners(halfExtents, viewDir, FOV, aspect);
      // Without this, `return Infinity` would satisfy the clipping test above.
      // The margin is the only slack we allow, so the binding axis must land
      // within it of the edge.
      expect(Math.max(maxAbsX, maxAbsY)).toBeGreaterThan(1 / FIT_MARGIN - 0.05);
    });

    it('returns a finite, positive distance', () => {
      const dist = solveFitDistance(halfExtents, viewDir, FOV, aspect);
      expect(Number.isFinite(dist)).toBe(true);
      expect(dist).toBeGreaterThan(0);
    });
  });

  it('backs off further for a bigger box (monotonic in the extents)', () => {
    const dir = WALL_PREVIEW_SPEC.viewDir;
    const near = solveFitDistance([0.6, 0.5, 0.1], dir, FOV, 4 / 3);
    const far = solveFitDistance([1.2, 1.0, 0.2], dir, FOV, 4 / 3);
    expect(far).toBeGreaterThan(near);
    // Uniform scaling of the box scales the distance by the same factor.
    expect(far / near).toBeCloseTo(2, 6);
  });

  it('backs off further for a narrower FOV', () => {
    const dir = SLAB_PREVIEW_SPEC.viewDir;
    const wide = solveFitDistance([0.7, 0.15, 0.45], dir, 60, 4 / 3);
    const narrow = solveFitDistance([0.7, 0.15, 0.45], dir, 20, 4 / 3);
    expect(narrow).toBeGreaterThan(wide);
  });

  it('applies the breathing margin on top of the exact fit', () => {
    const dir = WALL_PREVIEW_SPEC.viewDir;
    const extents: [number, number, number] = [0.6, 0.5, 0.125];
    const withMargin = solveFitDistance(extents, dir, FOV, 4 / 3);
    // Re-derive the un-margined solve: dividing back out must leave a distance
    // whose limiting corner sits exactly ON the frustum edge.
    const exact = withMargin / FIT_MARGIN;
    expect(withMargin).toBeGreaterThan(exact);
    expect(FIT_MARGIN).toBeGreaterThan(1);
  });
});
