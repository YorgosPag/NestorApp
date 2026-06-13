/**
 * ADR-452 — clip applicator material safelist.
 *
 * The cut-plane / section clip must inject `clippingPlanes` ONLY into built-in
 * mesh materials that ship clipping shader chunks. Fat-line (`LineMaterial`),
 * `ShaderMaterial`, sprites and points lack those chunks → injecting clip planes
 * throws a fragment-shader compile error, so they MUST be skipped.
 */

import * as THREE from 'three';
import {
  applyClippingPlanes,
  clearClippingPlanes,
  isClippableMaterial,
} from '../section-clip-applicator';

describe('isClippableMaterial', () => {
  it('allows built-in mesh materials', () => {
    expect(isClippableMaterial(new THREE.MeshStandardMaterial())).toBe(true);
    expect(isClippableMaterial(new THREE.MeshPhysicalMaterial())).toBe(true);
    expect(isClippableMaterial(new THREE.MeshBasicMaterial())).toBe(true);
  });

  it('skips fat-line / shader / sprite / points materials (clipping injection throws on them)', () => {
    // LineMaterial (three/examples) sets type 'LineMaterial'; emulate via a tagged material.
    // Confirmed at runtime: injecting clip planes into LineMaterial throws a fragment
    // shader compile error on this build → it MUST be skipped (edges handled geometrically).
    const fakeLine = new THREE.MeshBasicMaterial();
    Object.defineProperty(fakeLine, 'type', { value: 'LineMaterial' });
    expect(isClippableMaterial(fakeLine)).toBe(false);

    expect(isClippableMaterial(new THREE.ShaderMaterial())).toBe(false);
    expect(isClippableMaterial(new THREE.SpriteMaterial())).toBe(false);
    expect(isClippableMaterial(new THREE.PointsMaterial())).toBe(false);
  });
});

describe('applyClippingPlanes / clearClippingPlanes', () => {
  const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 3);

  function buildScene() {
    const scene = new THREE.Scene();
    const solid = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    // Fat-line edge overlay child (LineSegments2 extends Mesh → isMesh true).
    const edgeMat = new THREE.MeshBasicMaterial();
    Object.defineProperty(edgeMat, 'type', { value: 'LineMaterial' });
    const edge = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), edgeMat);
    solid.add(edge);
    // Section box part — excluded so it never clips itself.
    const boxPart = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    boxPart.userData['sectionBoxPart'] = true;
    scene.add(solid);
    scene.add(boxPart);
    return { scene, solid, edgeMat, boxPart };
  }

  it('writes planes to solid mesh materials but not to fat-line or box-part materials', () => {
    const { scene, solid, edgeMat, boxPart } = buildScene();
    applyClippingPlanes(scene, [plane]);

    expect((solid.material as THREE.MeshStandardMaterial).clippingPlanes).toEqual([plane]);
    // Fat-line edge stays unclipped (clipping injection throws on LineMaterial); the
    // overlay above the cut is suppressed geometrically by SectionSceneController.
    expect((edgeMat as { clippingPlanes?: unknown }).clippingPlanes ?? null).toBeNull();
    // Section box part excluded (must not clip itself).
    expect((boxPart.material as THREE.MeshBasicMaterial).clippingPlanes ?? null).toBeNull();
  });

  it('clears planes from solid materials', () => {
    const { scene, solid } = buildScene();
    applyClippingPlanes(scene, [plane]);
    clearClippingPlanes(scene);
    expect((solid.material as THREE.MeshStandardMaterial).clippingPlanes).toBeNull();
  });
});
