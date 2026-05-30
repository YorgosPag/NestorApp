/**
 * ADR-366 §C.1.b — WaypointDragController FSM + plane math tests.
 */

import * as THREE from 'three';
import {
  WaypointDragController,
  computeCameraAlignedPlane,
  setNdcFromClient,
  type DragControllerEvents,
} from '../waypoint-drag-controller';

function makeCamera(position = new THREE.Vector3(0, 0, 10), lookAt = new THREE.Vector3(0, 0, 0)): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  cam.position.copy(position);
  cam.lookAt(lookAt);
  cam.updateMatrixWorld(true);
  return cam;
}

function makeHandleSprite(role: 'position' | 'target', pos: THREE.Vector3): THREE.Sprite {
  // SpriteMaterial μέ αδειο map ώστε raycaster.intersectObject να βρει το sprite
  // (THREE.Sprite raycast checks bbox + material — απαιτεί valid material).
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial());
  sprite.scale.set(0.5, 0.5, 1);
  sprite.position.copy(pos);
  sprite.userData['kind'] = 'waypoint-handle';
  sprite.userData['role'] = role;
  return sprite;
}

function makeHandlesGroup(): { group: THREE.Group; positionSprite: THREE.Sprite; targetSprite: THREE.Sprite } {
  const group = new THREE.Group();
  const positionSprite = makeHandleSprite('position', new THREE.Vector3(1, 0, 0));
  const targetSprite = makeHandleSprite('target', new THREE.Vector3(-1, 0, 0));
  group.add(positionSprite, targetSprite);
  group.updateMatrixWorld(true);
  return { group, positionSprite, targetSprite };
}

function makeFakeCanvas(width = 200, height = 200): HTMLElement {
  return {
    getBoundingClientRect: () =>
      ({ left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect,
  } as unknown as HTMLElement;
}

describe('setNdcFromClient', () => {
  it('maps canvas centre to NDC origin', () => {
    const out = new THREE.Vector2();
    expect(setNdcFromClient(out, makeFakeCanvas(200, 200), 100, 100)).toBe(true);
    expect(out.x).toBeCloseTo(0, 5);
    expect(out.y).toBeCloseTo(0, 5);
  });

  it('maps top-left to (-1, +1)', () => {
    const out = new THREE.Vector2();
    setNdcFromClient(out, makeFakeCanvas(200, 200), 0, 0);
    expect(out.x).toBeCloseTo(-1, 5);
    expect(out.y).toBeCloseTo(1, 5);
  });

  it('maps bottom-right to (+1, -1)', () => {
    const out = new THREE.Vector2();
    setNdcFromClient(out, makeFakeCanvas(200, 200), 200, 200);
    expect(out.x).toBeCloseTo(1, 5);
    expect(out.y).toBeCloseTo(-1, 5);
  });

  it('returns false for zero-size canvas', () => {
    const out = new THREE.Vector2();
    expect(setNdcFromClient(out, makeFakeCanvas(0, 0), 50, 50)).toBe(false);
  });
});

describe('computeCameraAlignedPlane', () => {
  it('produces plane perpendicular to camera forward through given point', () => {
    const cam = makeCamera(new THREE.Vector3(0, 0, 10));
    const point = new THREE.Vector3(2, 3, 0);
    const plane = new THREE.Plane();
    computeCameraAlignedPlane(plane, cam, point);

    // Camera looking down -Z → plane normal should be (0,0,-1)
    expect(plane.normal.x).toBeCloseTo(0, 5);
    expect(plane.normal.y).toBeCloseTo(0, 5);
    expect(plane.normal.z).toBeCloseTo(-1, 5);
    // Plane passes through `point`
    expect(plane.distanceToPoint(point)).toBeCloseTo(0, 5);
  });
});

describe('WaypointDragController — FSM', () => {
  it('starts in idle state', () => {
    expect(new WaypointDragController().getState()).toBe('idle');
  });

  it('idle → hovering on handleHover(role)', () => {
    const c = new WaypointDragController();
    const onHoverChange = jest.fn();
    c.handleHover('position', { onHoverChange });
    expect(c.getState()).toBe('hovering');
    expect(onHoverChange).toHaveBeenCalledWith('position');
  });

  it('hovering → idle on handleHover(null)', () => {
    const c = new WaypointDragController();
    const events: DragControllerEvents = { onHoverChange: jest.fn() };
    c.handleHover('position', events);
    c.handleHover(null, events);
    expect(c.getState()).toBe('idle');
    expect(events.onHoverChange).toHaveBeenLastCalledWith(null);
  });

  it('handleHover is no-op while dragging', () => {
    const c = new WaypointDragController();
    const cam = makeCamera();
    c.startDrag('position', new THREE.Vector3(0, 0, 0), cam);
    const onHoverChange = jest.fn();
    c.handleHover('target', { onHoverChange });
    expect(c.getState()).toBe('dragging');
    expect(onHoverChange).not.toHaveBeenCalled();
  });

  it('startDrag transitions to dragging + fires onDragStart', () => {
    const c = new WaypointDragController();
    const onDragStart = jest.fn();
    c.startDrag('position', new THREE.Vector3(1, 2, 3), makeCamera(), { onDragStart });
    expect(c.getState()).toBe('dragging');
    expect(onDragStart).toHaveBeenCalledWith('position', expect.any(THREE.Vector3));
    expect(onDragStart.mock.calls[0]![1].toArray()).toEqual([1, 2, 3]);
  });

  it('endDrag returns to idle + fires onDragEnd + clears hover', () => {
    const c = new WaypointDragController();
    const onDragEnd = jest.fn();
    const onHoverChange = jest.fn();
    c.startDrag('target', new THREE.Vector3(), makeCamera());
    const role = c.endDrag({ onDragEnd, onHoverChange });
    expect(role).toBe('target');
    expect(c.getState()).toBe('idle');
    expect(onDragEnd).toHaveBeenCalled();
    expect(onHoverChange).toHaveBeenCalledWith(null);
  });

  it('cancelDrag returns to idle + fires onDragCancel', () => {
    const c = new WaypointDragController();
    const onDragCancel = jest.fn();
    c.startDrag('position', new THREE.Vector3(), makeCamera());
    c.cancelDrag({ onDragCancel });
    expect(c.getState()).toBe('idle');
    expect(onDragCancel).toHaveBeenCalledWith('position');
  });

  it('endDrag is a no-op when not dragging', () => {
    const c = new WaypointDragController();
    const onDragEnd = jest.fn();
    expect(c.endDrag({ onDragEnd })).toBeNull();
    expect(onDragEnd).not.toHaveBeenCalled();
  });
});

describe('WaypointDragController — pick + drag projection', () => {
  it('picks the closer sprite when both are under the cursor', () => {
    const c = new WaypointDragController();
    const { group, positionSprite } = makeHandlesGroup();
    // Camera at (1,0,10) explicitly looking at positionSprite world position.
    const cam = makeCamera(new THREE.Vector3(1, 0, 10), new THREE.Vector3(1, 0, 0));
    const canvas = makeFakeCanvas();
    const pick = c.pick(group, cam, canvas, 100, 100);
    expect(pick).not.toBeNull();
    expect(pick?.role).toBe('position');
    expect(pick?.sprite).toBe(positionSprite);
  });

  it('returns null when cursor misses all handles', () => {
    const c = new WaypointDragController();
    const { group } = makeHandlesGroup();
    const cam = makeCamera(new THREE.Vector3(0, 0, 10));
    const canvas = makeFakeCanvas();
    // Cursor at top-left corner — far from sprites at (1,0,0) and (-1,0,0)
    const pick = c.pick(group, cam, canvas, 5, 5);
    expect(pick).toBeNull();
  });

  it('updateDrag projects cursor onto camera-aligned plane', () => {
    const c = new WaypointDragController();
    const cam = makeCamera(new THREE.Vector3(0, 0, 10));
    const canvas = makeFakeCanvas(200, 200);
    const startWorld = new THREE.Vector3(0, 0, 0);
    const onDragMove = jest.fn();
    c.startDrag('position', startWorld, cam, { onDragMove });

    // Cursor at centre → projected world should be near (0,0,0)
    const centre = c.updateDrag(cam, canvas, 100, 100, { onDragMove });
    expect(centre).not.toBeNull();
    expect(centre!.x).toBeCloseTo(0, 4);
    expect(centre!.y).toBeCloseTo(0, 4);
    expect(centre!.z).toBeCloseTo(0, 4);

    // Cursor moved right → projected x should increase
    const right = c.updateDrag(cam, canvas, 150, 100, { onDragMove });
    expect(right).not.toBeNull();
    expect(right!.x).toBeGreaterThan(0);
  });

  it('updateDrag is no-op when not dragging', () => {
    const c = new WaypointDragController();
    const cam = makeCamera();
    const canvas = makeFakeCanvas();
    const onDragMove = jest.fn();
    expect(c.updateDrag(cam, canvas, 50, 50, { onDragMove })).toBeNull();
    expect(onDragMove).not.toHaveBeenCalled();
  });
});
