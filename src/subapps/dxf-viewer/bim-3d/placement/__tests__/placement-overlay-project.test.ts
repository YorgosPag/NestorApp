/**
 * ADR-544 — placement-overlay-project: ο 3D `OverlayProjector` μετατρέπει scene→plan-mm (inverse
 * του unit factor) και προβάλλει μέσω του ΙΔΙΟΥ `makeGripPlanToCanvas`. Locks: το scene σημείο
 * διαιρείται με `mmToSceneUnits(units)` πριν προβληθεί, ώστε mm-scene = 1:1 και m-scene = ×1000.
 */

import * as THREE from 'three';
import { makePlacementOverlayProjector } from '../placement-overlay-project';
import { scenePointToPlanMm } from '../world-to-scene-point';
import { makeGripPlanToCanvas } from '../../grips/grip-3d-screen-project';
import { mmToSceneUnits } from '../../../utils/scene-units';

function fakeCanvas(): HTMLElement {
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }),
  } as unknown as HTMLElement;
}

function frontCamera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  cam.position.set(0, 0, 10);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}

describe('scenePointToPlanMm', () => {
  it('is identity for mm scenes (factor 1)', () => {
    expect(scenePointToPlanMm({ x: 1500, y: -300 }, 'mm')).toEqual({ x: 1500, y: -300 });
  });

  it('scales metre scenes back to mm (÷ factor)', () => {
    const factor = mmToSceneUnits('m'); // 0.001
    expect(scenePointToPlanMm({ x: 5, y: -2 }, 'm')).toEqual({ x: 5 / factor, y: -2 / factor });
  });
});

describe('makePlacementOverlayProjector', () => {
  it('mm scene → projects 1:1 like the grip projector (factor 1)', () => {
    const cam = frontCamera();
    const canvas = fakeCanvas();
    const overlay = makePlacementOverlayProjector(cam, canvas, 'mm', 0);
    const grip = makeGripPlanToCanvas(cam, canvas, () => 0);
    expect(overlay({ x: 0, y: 0 })).toEqual(grip({ x: 0, y: 0 }));
    expect(overlay({ x: 1234, y: 567 })).toEqual(grip({ x: 1234, y: 567 }));
  });

  it('m scene → divides by the unit factor before projecting (scene 5 = plan 5000mm)', () => {
    const cam = frontCamera();
    const canvas = fakeCanvas();
    const factor = mmToSceneUnits('m');
    const overlay = makePlacementOverlayProjector(cam, canvas, 'm', 0);
    const grip = makeGripPlanToCanvas(cam, canvas, () => 0);
    expect(overlay({ x: 5, y: 0 })).toEqual(grip({ x: 5 / factor, y: 0 }));
  });
});
