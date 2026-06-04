import * as THREE from 'three';
import { createTumbleRotation } from '../viewport/tumble-rotation';

function mockElement(): HTMLElement {
  return {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  } as unknown as HTMLElement;
}

describe('createTumbleRotation — quaternion orbit math', () => {
  it('horizontal drag (yaw) rotates camera around Y axis, preserving height', () => {
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 0, 5);
    const target = new THREE.Vector3(0, 0, 0);
    camera.lookAt(target);

    const onChange = jest.fn();
    const tumble = createTumbleRotation({
      getCamera: () => camera,
      getTarget: () => target,
      domElement: mockElement(),
      onStart: jest.fn(),
      onChange,
      onEnd: jest.fn(),
    });

    tumble.applyExternalRotation(100, 0);

    expect(onChange).toHaveBeenCalledTimes(1);
    // Camera moved horizontally but stayed at roughly same height
    expect(camera.position.x).not.toBeCloseTo(0, 0);
    expect(camera.position.y).toBeCloseTo(0, 1);
    // Distance preserved
    expect(camera.position.length()).toBeCloseTo(5, 1);
  });

  it('vertical drag (pitch) raises/lowers camera from target', () => {
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 0, 5);
    const target = new THREE.Vector3(0, 0, 0);
    camera.lookAt(target);

    const tumble = createTumbleRotation({
      getCamera: () => camera,
      getTarget: () => target,
      domElement: mockElement(),
      onStart: jest.fn(),
      onChange: jest.fn(),
      onEnd: jest.fn(),
    });

    tumble.applyExternalRotation(0, 80); // dy > 0 → angle = -dy*speed < 0 → camera pitches up
    expect(camera.position.y).toBeGreaterThan(1);
    expect(camera.position.length()).toBeCloseTo(5, 1);
  });

  it('preserves distance to target after compound yaw+pitch rotation', () => {
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(3, 2, 4);
    const target = new THREE.Vector3(1, 0, 1);
    camera.lookAt(target);

    const tumble = createTumbleRotation({
      getCamera: () => camera,
      getTarget: () => target,
      domElement: mockElement(),
      onStart: jest.fn(),
      onChange: jest.fn(),
      onEnd: jest.fn(),
    });

    const distBefore = camera.position.distanceTo(target);
    tumble.applyExternalRotation(40, 20);
    tumble.applyExternalRotation(-15, -30);
    tumble.applyExternalRotation(70, 0);

    expect(camera.position.distanceTo(target)).toBeCloseTo(distBefore, 2);
  });

  it('pole: orbiting from directly above the target stays finite + preserves distance', () => {
    // The rigid quaternion orbit (orbit-around-pivot SSoT) is pole-free — no
    // camera.up flip needed. At the top-down pole a yaw must not blow up (NaN) and
    // must keep the distance to the target constant.
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 5, 0);
    const target = new THREE.Vector3(0, 0, 0);
    camera.lookAt(target);

    const tumble = createTumbleRotation({
      getCamera: () => camera,
      getTarget: () => target,
      domElement: mockElement(),
      onStart: jest.fn(),
      onChange: jest.fn(),
      onEnd: jest.fn(),
    });

    tumble.applyExternalRotation(60, 0); // yaw at the pole
    expect(Number.isFinite(camera.position.x)).toBe(true);
    expect(Number.isFinite(camera.position.y)).toBe(true);
    expect(Number.isFinite(camera.position.z)).toBe(true);
    expect(camera.position.distanceTo(target)).toBeCloseTo(5, 5);
  });
});

describe('createTumbleRotation — ADR-366 §A.6.Q5 Alt+click orbit-pivot', () => {
  function listenerCapturingElement(): {
    el: HTMLElement;
    fire: (type: string, e: Partial<PointerEvent>) => void;
  } {
    const handlers: Record<string, (e: PointerEvent) => void> = {};
    const el = {
      addEventListener: (type: string, fn: (e: PointerEvent) => void) => { handlers[type] = fn; },
      removeEventListener: () => {},
    } as unknown as HTMLElement;
    const fire = (type: string, e: Partial<PointerEvent>) =>
      handlers[type]?.({ button: 0, ...e } as PointerEvent);
    return { el, fire };
  }

  function makeTumble(onAltClick: jest.Mock) {
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 0, 5);
    const target = new THREE.Vector3(0, 0, 0);
    const { el, fire } = listenerCapturingElement();
    createTumbleRotation({
      getCamera: () => camera,
      getTarget: () => target,
      domElement: el,
      onStart: jest.fn(),
      onChange: jest.fn(),
      onEnd: jest.fn(),
      onAltClick,
    });
    return fire;
  }

  it('fires onAltClick with client coords on static Alt+click (no drag)', () => {
    const onAltClick = jest.fn();
    const fire = makeTumble(onAltClick);
    fire('pointerdown', { altKey: true, clientX: 120, clientY: 240 });
    fire('pointerup', { altKey: true, clientX: 121, clientY: 241 }); // <3px → no drag
    expect(onAltClick).toHaveBeenCalledWith(121, 241);
  });

  it('does NOT fire onAltClick when the gesture became a rotation (drag past threshold)', () => {
    const onAltClick = jest.fn();
    const fire = makeTumble(onAltClick);
    fire('pointerdown', { altKey: true, clientX: 100, clientY: 100 });
    fire('pointermove', { clientX: 140, clientY: 140 }); // >3px → dragActive
    fire('pointerup', { clientX: 140, clientY: 140 });
    expect(onAltClick).not.toHaveBeenCalled();
  });

  it('does NOT fire onAltClick when Alt was not held at pointerdown', () => {
    const onAltClick = jest.fn();
    const fire = makeTumble(onAltClick);
    fire('pointerdown', { altKey: false, clientX: 100, clientY: 100 });
    fire('pointerup', { altKey: false, clientX: 100, clientY: 100 });
    expect(onAltClick).not.toHaveBeenCalled();
  });

  function makeTumbleWithPress(onAltPress: jest.Mock) {
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 0, 5);
    const target = new THREE.Vector3(0, 0, 0);
    const { el, fire } = listenerCapturingElement();
    createTumbleRotation({
      getCamera: () => camera, getTarget: () => target, domElement: el,
      onStart: jest.fn(), onChange: jest.fn(), onEnd: jest.fn(), onAltPress,
    });
    return fire;
  }

  it('fires onAltPress on Alt+left pointer-DOWN (before any drag), so rotation orbits the click point', () => {
    const onAltPress = jest.fn();
    const fire = makeTumbleWithPress(onAltPress);
    fire('pointerdown', { altKey: true, clientX: 200, clientY: 150 });
    expect(onAltPress).toHaveBeenCalledWith(200, 150);
  });

  it('does NOT fire onAltPress when Alt was not held at pointerdown', () => {
    const onAltPress = jest.fn();
    const fire = makeTumbleWithPress(onAltPress);
    fire('pointerdown', { altKey: false, clientX: 200, clientY: 150 });
    expect(onAltPress).not.toHaveBeenCalled();
  });

  it('FULL FLOW: Alt-press sets pivot → the drag orbits around the CLICK point (pivot stays fixed on screen)', () => {
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const target = new THREE.Vector3(0, 0, 0);
    const { el, fire } = listenerCapturingElement();
    const clicked = new THREE.Vector3(0.8, 0.3, 0); // OFF-centre clicked world point
    let tumble!: ReturnType<typeof createTumbleRotation>;
    tumble = createTumbleRotation({
      getCamera: () => camera, getTarget: () => target, domElement: el,
      onStart: jest.fn(), onChange: jest.fn(), onEnd: jest.fn(),
      onAltPress: () => tumble.setPivot(clicked), // mirrors viewport.setOrbitPivot → tumble.setPivot
    });

    const pivotNdcBefore = clicked.clone().project(camera);
    fire('pointerdown', { altKey: true, clientX: 100, clientY: 100 });
    fire('pointermove', { clientX: 150, clientY: 125 }); // drag past threshold → rotate
    camera.updateMatrixWorld(true);
    const pivotNdcAfter = clicked.clone().project(camera);

    // The CLICKED point — not the screen centre — is the fixed rotation centre.
    expect(pivotNdcAfter.x).toBeCloseTo(pivotNdcBefore.x, 3);
    expect(pivotNdcAfter.y).toBeCloseTo(pivotNdcBefore.y, 3);
    // The look target (screen centre) moved → it is NOT the pivot anymore.
    expect(target.distanceTo(new THREE.Vector3(0, 0, 0))).toBeGreaterThan(0.01);
  });
});
