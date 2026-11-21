/**
 * @jest-environment jsdom
 */
/**
 * ADR-920 §14.5 — τα βέλη κύλισης υπάρχουν ΜΟΝΟ όταν ο καταναλωτής δίνει `onRoll`.
 * Ο θεατής εδάφους δεν δίνει (η κύλιση δεν έχει νόημα σε έδαφος): ορατό βέλος που δεν κάνει τίποτα θα ήταν ψέμα.
 * Θετικό control: με `onRoll` (ο viewer) τα βέλη είναι στη σκηνή, όπως πριν.
 */

import type * as THREE from 'three';

import { createViewCube, type ViewCubeOptions } from '../view-cube';
import { inert2dContext } from './fixtures/inert-2d-context';

const rollRef: { current: { sprites: THREE.Sprite[]; hitMeshes: THREE.Mesh[] } | null } = { current: null };

jest.mock('../view-cube-overlay', () => {
  const actual = jest.requireActual('../view-cube-overlay');
  return {
    ...actual,
    createRollArrows: () => {
      const built = actual.createRollArrows();
      rollRef.current = built;
      return built;
    },
  };
});

function mount(onRoll: ViewCubeOptions['onRoll']): void {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const camera = { getWorldQuaternion: (q: THREE.Quaternion) => q } as unknown as THREE.PerspectiveCamera;
  createViewCube({
    container,
    renderer: {} as THREE.WebGLRenderer,
    onRenderNeeded: () => undefined,
    getCamera: () => camera,
    getTarget: () => ({ x: 0, y: 0, z: 0 }) as THREE.Vector3,
    onFaceSnap: () => undefined,
    onDirSnap: () => undefined,
    onHome: () => undefined,
    onRoll,
  });
}

describe('ViewCube — βέλη κύλισης μόνο με onRoll', () => {
  beforeEach(() => {
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => inert2dContext());
    rollRef.current = null;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('χωρίς onRoll: κανένα βέλος (ούτε εικόνα ούτε στόχος κλικ) στη σκηνή', () => {
    mount(undefined);
    const roll = rollRef.current!;
    expect(roll.sprites.length).toBeGreaterThan(0);
    for (const object of [...roll.sprites, ...roll.hitMeshes]) expect(object.parent).toBeNull();
  });

  it('με onRoll (ο viewer): τα βέλη είναι στη σκηνή, όπως πριν', () => {
    mount(() => undefined);
    for (const object of [...rollRef.current!.sprites, ...rollRef.current!.hitMeshes]) expect(object.parent).not.toBeNull();
  });
});
