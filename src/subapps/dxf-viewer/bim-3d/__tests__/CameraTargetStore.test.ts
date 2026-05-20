import * as THREE from 'three';
import { useCameraTargetStore } from '../stores/CameraTargetStore';

const INITIAL = { position: { x: 15, y: 10, z: 15 }, target: { x: 0, y: 0, z: 0 }, fov: 50 };

beforeEach(() => {
  useCameraTargetStore.setState(INITIAL);
});

describe('CameraTargetStore — syncFromCamera', () => {
  it('updates position/target/fov from perspective camera', () => {
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(10, 5, 8);
    const target = new THREE.Vector3(2, 0, 3);

    useCameraTargetStore.getState().syncFromCamera(camera, target);

    const s = useCameraTargetStore.getState();
    expect(s.position.x).toBeCloseTo(10);
    expect(s.position.y).toBeCloseTo(5);
    expect(s.position.z).toBeCloseTo(8);
    expect(s.target.x).toBeCloseTo(2);
    expect(s.target.z).toBeCloseTo(3);
    expect(s.fov).toBeCloseTo(60);
  });

  it('dirty-check: no-op when camera matches current state', () => {
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(15, 10, 15); // matches INITIAL
    const target = new THREE.Vector3(0, 0, 0);

    const posRef = useCameraTargetStore.getState().position;
    useCameraTargetStore.getState().syncFromCamera(camera, target);

    // set() not called → position object reference unchanged
    expect(useCameraTargetStore.getState().position).toBe(posRef);
  });

  it('orthographic camera sets fov=0', () => {
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 1000);
    camera.position.set(0, 10, 0);
    const target = new THREE.Vector3(0, 0, 0);

    useCameraTargetStore.getState().syncFromCamera(camera, target);

    expect(useCameraTargetStore.getState().fov).toBe(0);
  });
});
