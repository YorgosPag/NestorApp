/**
 * @jest-environment jsdom
 */
/**
 * ADR-920 Β6.3β — ο κύβος πλοήγησης σε οθόνη αφής.
 *
 * Τρεις ερωτήσεις, η καθεμία με θετικό control ώστε το test να ΜΠΟΡΕΙ να κοκκινίσει:
 *  1. ανήκει η σύρση με το δάχτυλο στον κύβο (`touch-action: none`);
 *  2. μετά από `pointercancel`, μια απλή κίνηση ΔΕΝ περιστρέφει την όψη (όχι «κολλημένο» πάτημα);
 *  3. χωρίς hover, είναι το «σπίτι» ορατό χωρίς να χρειαστεί `mouseenter`;
 */

import type * as THREE from 'three';
import { createViewCube, type ViewCubeEngine } from '../view-cube';
import { inert2dContext } from './fixtures/inert-2d-context';

const homeSpriteRef: { current: THREE.Sprite | null } = { current: null };

jest.mock('../view-cube-mesh', () => {
  const actual = jest.requireActual('../view-cube-mesh');
  return {
    ...actual,
    createHomeButton: () => {
      const built = actual.createHomeButton();
      homeSpriteRef.current = built.sprite;
      return built;
    },
  };
});

function setHoverNone(hoverNone: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({ matches: hoverNone && query === '(hover: none)' }),
  });
}

function pointer(type: string, x: number, y: number): MouseEvent {
  const e = new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  return e;
}

interface Harness {
  readonly cube: ViewCubeEngine;
  readonly hitLayer: HTMLCanvasElement;
  readonly onDragRotate: jest.Mock;
}

function mount(): Harness {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const onDragRotate = jest.fn();
  const camera = { getWorldQuaternion: (q: THREE.Quaternion) => q } as unknown as THREE.PerspectiveCamera;
  const cube = createViewCube({
    container,
    renderer: {} as THREE.WebGLRenderer,
    onRenderNeeded: () => undefined,
    getCamera: () => camera,
    getTarget: () => ({ x: 0, y: 0, z: 0 }) as THREE.Vector3,
    onFaceSnap: () => undefined,
    onDirSnap: () => undefined,
    onHome: () => undefined,
    onDragRotate,
  });
  const hitLayer = container.querySelector('canvas') as HTMLCanvasElement;
  hitLayer.setPointerCapture = () => undefined;
  hitLayer.releasePointerCapture = () => undefined;
  return { cube, hitLayer, onDragRotate };
}

describe('ViewCube σε αφή (ADR-920 Β6.3β)', () => {
  beforeEach(() => {
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => inert2dContext());
    homeSpriteRef.current = null;
    setHoverNone(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('η σύρση με το δάχτυλο ανήκει στον κύβο: touch-action = none', () => {
    const { hitLayer, cube } = mount();
    expect(hitLayer.style.touchAction).toBe('none');
    cube.dispose();
  });

  it('control: πάτημα + σύρση περιστρέφει την όψη', () => {
    const { hitLayer, onDragRotate, cube } = mount();
    hitLayer.dispatchEvent(pointer('pointerdown', 0, 0));
    hitLayer.dispatchEvent(pointer('pointermove', 40, 40));
    expect(onDragRotate).toHaveBeenCalled();
    cube.dispose();
  });

  it('μετά από pointercancel, η κίνηση ΔΕΝ περιστρέφει (κανένα κολλημένο πάτημα)', () => {
    const { hitLayer, onDragRotate, cube } = mount();
    hitLayer.dispatchEvent(pointer('pointerdown', 0, 0));
    hitLayer.dispatchEvent(pointer('pointercancel', 0, 0));
    hitLayer.dispatchEvent(pointer('pointermove', 40, 40));
    expect(onDragRotate).not.toHaveBeenCalled();
    cube.dispose();
  });

  it('μετά από lostpointercapture, η κίνηση ΔΕΝ περιστρέφει', () => {
    const { hitLayer, onDragRotate, cube } = mount();
    hitLayer.dispatchEvent(pointer('pointerdown', 0, 0));
    hitLayer.dispatchEvent(pointer('lostpointercapture', 0, 0));
    hitLayer.dispatchEvent(pointer('pointermove', 40, 40));
    expect(onDragRotate).not.toHaveBeenCalled();
    cube.dispose();
  });

  it('χωρίς hover (αφή): το «σπίτι» είναι ορατό από την αρχή', () => {
    setHoverNone(true);
    const { cube } = mount();
    expect(homeSpriteRef.current?.visible).toBe(true);
    cube.dispose();
  });

  it('control: με hover (desktop) το «σπίτι» μένει κρυφό ώσπου να πλησιάσει ο δείκτης', () => {
    const { cube } = mount();
    expect(homeSpriteRef.current?.visible).toBe(false);
    cube.dispose();
  });
});
