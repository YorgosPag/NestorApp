/**
 * ADR-639 Στάδιο 5 — ortho-camera pixel-parity proof.
 *
 * Composes `computeOrthoBounds` → a REAL `THREE.OrthographicCamera` (via
 * `applyToCamera`) → project world points → map NDC to CSS screen px, and asserts
 * the result equals `CoordinateTransforms.worldToScreen` to sub-pixel tolerance
 * across a grid of scale / offset / viewport / world-point cases. This proves both
 * pixel-identity with the Canvas2D layers AND that the two Y-flips (CAD inversion +
 * GL clip-space) cancel — no extra flip is needed. N.17-safe (jest only).
 */

import * as THREE from 'three';
import { computeOrthoBounds, applyToCamera } from '../webgl-line-ortho-camera';
import { CoordinateTransforms } from '../../../rendering/core/CoordinateTransforms';
import type { ViewTransform, Viewport } from '../../../rendering/types/Types';

/** Project a world point through the ortho camera and map NDC → CSS screen px (y-down). */
function projectToScreen(
  camera: THREE.OrthographicCamera,
  wx: number,
  wy: number,
  viewport: Viewport,
): { x: number; y: number } {
  const ndc = new THREE.Vector3(wx, wy, 0).project(camera);
  return {
    x: ((ndc.x + 1) / 2) * viewport.width,
    // NDC y is up; CSS screen y is down → (1 - ndcY)/2 * H.
    y: ((1 - ndc.y) / 2) * viewport.height,
  };
}

const SCALES = [0.01, 1, 1000];
const OFFSETS = [0, 137, -240];
const VIEWPORTS: Viewport[] = [
  { width: 800, height: 600 },
  { width: 1920, height: 1080 },
];
const WORLD_POINTS = [
  { x: 0, y: 0 },
  { x: 100, y: 50 },
  { x: -30, y: 80 },
  { x: 1234, y: -567 },
];

describe('computeOrthoBounds — pixel parity with worldToScreen', () => {
  it('matches worldToScreen across the scale/offset/viewport/point grid', () => {
    const camera = new THREE.OrthographicCamera();
    for (const scale of SCALES) {
      for (const offsetX of OFFSETS) {
        for (const offsetY of OFFSETS) {
          for (const viewport of VIEWPORTS) {
            const transform: ViewTransform = { scale, offsetX, offsetY };
            const bounds = computeOrthoBounds(transform, viewport);
            expect(bounds).not.toBeNull();
            applyToCamera(camera, bounds!);
            camera.updateMatrixWorld();

            for (const p of WORLD_POINTS) {
              const gl = projectToScreen(camera, p.x, p.y, viewport);
              const expected = CoordinateTransforms.worldToScreen(p, transform, viewport);
              expect(gl.x).toBeCloseTo(expected.x, 2); // < 5e-3 px
              expect(gl.y).toBeCloseTo(expected.y, 2);
            }
          }
        }
      }
    }
  });
});

describe('computeOrthoBounds — guards', () => {
  it('returns null for a 0×0 viewport (not laid out yet)', () => {
    expect(computeOrthoBounds({ scale: 1, offsetX: 0, offsetY: 0 }, { width: 0, height: 0 })).toBeNull();
  });

  it('returns null for a zero scale (degenerate denominator)', () => {
    expect(computeOrthoBounds({ scale: 0, offsetX: 0, offsetY: 0 }, { width: 800, height: 600 })).toBeNull();
  });
});
