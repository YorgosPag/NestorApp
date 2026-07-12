/**
 * glyph-atlas-text-lod.test.ts — ADR-645 Φάση C.
 *
 * Two things to prove without a WebGL context:
 *  1. `projectedEmPixelHeight` (the JS reference the GLSL mirrors) computes the on-screen glyph
 *     height correctly and shrinks with camera distance (the declutter signal).
 *  2. `applyTextLodMaterial` injects the discard into the stock `MeshBasicMaterial` shader and its
 *     controller feeds the live viewport uniform.
 */

import * as THREE from 'three';
import {
  applyTextLodMaterial,
  projectedEmPixelHeight,
  TEXT_LOD_VERTEX_BODY,
} from '../glyph-atlas-text-lod';

describe('projectedEmPixelHeight', () => {
  it('maps a world em-vector to its on-screen pixel height (orthographic, 1px per world unit)', () => {
    // Frustum 200 world units tall over a 200px viewport → exactly 1 px per world unit.
    const cam = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 1000);
    cam.position.set(0, 0, 10);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    const px = projectedEmPixelHeight(
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 10, 0), cam, 200, 200,
    );
    expect(px).toBeCloseTo(10, 3); // 10 world units → 10 px
  });

  it('shrinks as the camera moves away (perspective) — the zoom-out declutter signal', () => {
    const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    const em = new THREE.Vector3(0, 1, 0);
    const near = (() => {
      cam.position.set(0, 0, 5); cam.updateMatrixWorld(true);
      return projectedEmPixelHeight(new THREE.Vector3(0, 0, 0), em, cam, 800, 800);
    })();
    const far = (() => {
      cam.position.set(0, 0, 50); cam.updateMatrixWorld(true);
      return projectedEmPixelHeight(new THREE.Vector3(0, 0, 0), em, cam, 800, 800);
    })();
    expect(far).toBeLessThan(near);
    expect(far).toBeGreaterThan(0);
  });
});

describe('applyTextLodMaterial', () => {
  it('injects the em→pixel projection + the sub-legible discard and seeds the uniforms', () => {
    const mat = new THREE.MeshBasicMaterial();
    applyTextLodMaterial(mat, 8);
    expect(typeof mat.onBeforeCompile).toBe('function');

    const shader = {
      uniforms: {} as Record<string, THREE.IUniform>,
      vertexShader: 'void main() {\n#include <project_vertex>\n}',
      fragmentShader: 'void main() {\n  gl_FragColor = vec4( 1.0 );\n}',
    };
    mat.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);

    expect(shader.uniforms.uMinLabelPx.value).toBe(8);
    expect(shader.uniforms.uViewportPx.value).toBeInstanceOf(THREE.Vector2);
    expect(shader.vertexShader).toContain('attribute vec3 aEmVec;');
    expect(shader.vertexShader).toContain(TEXT_LOD_VERTEX_BODY.trim().split('\n')[0]);
    expect(shader.fragmentShader).toContain('if ( vGlyphPx < uMinLabelPx ) discard;');
  });

  it('controller feeds the live viewport size (clamped ≥ 1) into the compiled uniform', () => {
    const mat = new THREE.MeshBasicMaterial();
    const lod = applyTextLodMaterial(mat, 8);
    const shader = {
      uniforms: {} as Record<string, THREE.IUniform>,
      vertexShader: '#include <project_vertex>',
      fragmentShader: 'void main() {}',
    };
    mat.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);

    lod.setViewport(1280, 720);
    expect(shader.uniforms.uViewportPx.value.x).toBe(1280);
    expect(shader.uniforms.uViewportPx.value.y).toBe(720);
    lod.setViewport(0, 0); // never let a not-yet-laid-out canvas zero the divisor
    expect(shader.uniforms.uViewportPx.value.x).toBe(1);
    expect(shader.uniforms.uViewportPx.value.y).toBe(1);
  });
});
