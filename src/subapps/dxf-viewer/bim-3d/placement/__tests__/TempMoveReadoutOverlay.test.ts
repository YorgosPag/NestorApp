/**
 * ADR-363 — TempMoveReadoutOverlay tests.
 *
 * Verifies the transient 3D move-readout leaf: hidden at birth, shown as a line a→b with
 * a distance label on `update`, hidden on a (near-)zero move and on `hide`, removed on
 * `dispose`, and a no-op `update` after dispose.
 */

import * as THREE from 'three';
import { TempMoveReadoutOverlay } from '../TempMoveReadoutOverlay';

function findGroup(scene: THREE.Scene): THREE.Group | undefined {
  return scene.children.find((o): o is THREE.Group => o instanceof THREE.Group && o.name === 'temp-move-readout');
}

function makeCanvas(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientHeight', { value: 800, configurable: true });
  return el;
}

function makeCamera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  cam.position.set(0, 0, 5);
  cam.updateMatrixWorld(true);
  return cam;
}

describe('TempMoveReadoutOverlay', () => {
  it('adds an invisible group (line + sprite) to the scene at construction', () => {
    const scene = new THREE.Scene();
    const overlay = new TempMoveReadoutOverlay(scene);
    const group = findGroup(scene);
    expect(group).toBeDefined();
    expect(group!.visible).toBe(false);
    expect(group!.children.some((c) => c instanceof THREE.Line)).toBe(true);
    expect(group!.children.some((c) => c instanceof THREE.Sprite)).toBe(true);
    overlay.dispose();
  });

  it('shows the line a→b with a label at the midpoint on update', () => {
    const scene = new THREE.Scene();
    const overlay = new TempMoveReadoutOverlay(scene);
    overlay.update(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 0, 0), makeCamera(), makeCanvas());
    const group = findGroup(scene)!;
    expect(group.visible).toBe(true);
    const line = group.children.find((c): c is THREE.Line => c instanceof THREE.Line)!;
    const pos = line.geometry.getAttribute('position');
    expect(pos.getX(0)).toBeCloseTo(0, 5);
    expect(pos.getX(1)).toBeCloseTo(2, 5);
    const sprite = group.children.find((c): c is THREE.Sprite => c instanceof THREE.Sprite)!;
    expect(sprite.position.x).toBeCloseTo(1, 5); // midpoint
    expect((sprite.material as THREE.SpriteMaterial).map).not.toBeNull();
    overlay.dispose();
  });

  it('hides on a near-zero move and on hide()', () => {
    const scene = new THREE.Scene();
    const overlay = new TempMoveReadoutOverlay(scene);
    overlay.update(new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1), makeCamera(), makeCanvas());
    expect(findGroup(scene)!.visible).toBe(false);
    overlay.update(new THREE.Vector3(0, 0, 0), new THREE.Vector3(3, 0, 0), makeCamera(), makeCanvas());
    overlay.hide();
    expect(findGroup(scene)!.visible).toBe(false);
    overlay.dispose();
  });

  it('removes the group on dispose() and update after dispose is a no-op', () => {
    const scene = new THREE.Scene();
    const overlay = new TempMoveReadoutOverlay(scene);
    overlay.dispose();
    expect(findGroup(scene)).toBeUndefined();
    expect(() =>
      overlay.update(new THREE.Vector3(), new THREE.Vector3(1, 0, 0), makeCamera(), makeCanvas()),
    ).not.toThrow();
  });
});
