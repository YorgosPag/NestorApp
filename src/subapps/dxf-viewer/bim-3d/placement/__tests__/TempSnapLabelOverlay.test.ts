/**
 * ADR-363 Φ1G.5 Slice 2i — TempSnapLabelOverlay tests.
 *
 * Verifies the transient snap-type label sprite: hidden at birth, shown with the given
 * (already-localised) text near the marker on `update`, hidden on empty text / `hide`,
 * removed on `dispose`.
 */

import * as THREE from 'three';
import { TempSnapLabelOverlay } from '../TempSnapLabelOverlay';

function findSprite(scene: THREE.Scene): THREE.Sprite | undefined {
  return scene.children.find((o): o is THREE.Sprite => o instanceof THREE.Sprite && o.name === 'temp-snap-label');
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

describe('TempSnapLabelOverlay', () => {
  it('adds an invisible sprite to the scene at construction', () => {
    const scene = new THREE.Scene();
    const overlay = new TempSnapLabelOverlay(scene);
    const sprite = findSprite(scene);
    expect(sprite).toBeDefined();
    expect(sprite!.visible).toBe(false);
    overlay.dispose();
  });

  it('shows the label text near the marker on update', () => {
    const scene = new THREE.Scene();
    const overlay = new TempSnapLabelOverlay(scene);
    overlay.update('Παρειά τοίχου', new THREE.Vector3(1, 0, 0), makeCamera(), makeCanvas());
    const sprite = findSprite(scene)!;
    expect(sprite.visible).toBe(true);
    expect((sprite.material as THREE.SpriteMaterial).map).not.toBeNull();
    // The label sits ABOVE the marker (positive Y lift).
    expect(sprite.position.y).toBeGreaterThan(0);
    overlay.dispose();
  });

  it('hides on empty text and on hide()', () => {
    const scene = new THREE.Scene();
    const overlay = new TempSnapLabelOverlay(scene);
    overlay.update('Γωνία τοίχου', new THREE.Vector3(), makeCamera(), makeCanvas());
    overlay.update('', new THREE.Vector3(), makeCamera(), makeCanvas());
    expect(findSprite(scene)!.visible).toBe(false);
    overlay.update('Παρειά τοίχου', new THREE.Vector3(), makeCamera(), makeCanvas());
    overlay.hide();
    expect(findSprite(scene)!.visible).toBe(false);
    overlay.dispose();
  });

  it('removes the sprite from the scene on dispose()', () => {
    const scene = new THREE.Scene();
    const overlay = new TempSnapLabelOverlay(scene);
    overlay.dispose();
    expect(findSprite(scene)).toBeUndefined();
  });
});
