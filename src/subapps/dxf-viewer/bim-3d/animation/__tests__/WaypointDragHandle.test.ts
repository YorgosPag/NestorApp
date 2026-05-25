/**
 * ADR-366 §C.1.b — WaypointDragHandleRenderer integration tests.
 *
 * Drives the Three.js renderer with a real Scene + Sprites (jsdom, no WebGL
 * needed). Verifies subscription wiring against AnimationStore, sprite
 * positioning, hover material rebuild, and dispose cleanup.
 */

import * as THREE from 'three';
import { WaypointDragHandleRenderer } from '../WaypointDragHandle';
import { useAnimationStore } from '../AnimationStore';
import type { Waypoint } from '../animation-types';

function makeWaypoint(x = 0, ty = 0): Waypoint {
  return {
    position: { x, y: 0, z: 0 },
    target: { x: 5, y: ty, z: 0 },
    fov: 50,
    easingToNext: 'linear',
  };
}

function findSprite(group: THREE.Group, role: 'position' | 'target'): THREE.Sprite {
  const sprite = group.children.find((c) => c.userData['role'] === role);
  if (!sprite) throw new Error(`sprite ${role} not found`);
  return sprite as THREE.Sprite;
}

beforeEach(() => {
  useAnimationStore.getState().reset();
});

describe('WaypointDragHandleRenderer — visibility gate', () => {
  it('starts hidden when no active waypoint', () => {
    const scene = new THREE.Scene();
    const r = new WaypointDragHandleRenderer(scene);
    expect(r.getHandlesGroup()).toBeNull();
    r.dispose();
  });

  it('exposes group + positions sprites when toolActive + active waypoint set', () => {
    const scene = new THREE.Scene();
    const s = useAnimationStore.getState();
    s.setToolActive(true);
    s.setWaypoints([makeWaypoint(0), makeWaypoint(7, 9)]);
    s.setActiveWaypointIndex(1);

    const r = new WaypointDragHandleRenderer(scene);
    const group = r.getHandlesGroup();
    expect(group).not.toBeNull();

    const positionSprite = findSprite(group!, 'position');
    const targetSprite = findSprite(group!, 'target');
    expect(positionSprite.position.x).toBe(7);
    expect(targetSprite.position.y).toBe(9);
    r.dispose();
  });

  it('hides handles when toolActive flips false', () => {
    const scene = new THREE.Scene();
    const s = useAnimationStore.getState();
    s.setToolActive(true);
    s.setWaypoints([makeWaypoint()]);
    s.setActiveWaypointIndex(0);

    const r = new WaypointDragHandleRenderer(scene);
    expect(r.getHandlesGroup()).not.toBeNull();

    useAnimationStore.getState().setToolActive(false);
    expect(r.getHandlesGroup()).toBeNull();
    r.dispose();
  });
});

describe('WaypointDragHandleRenderer — subscription wiring', () => {
  it('reacts to updateWaypoint by repositioning sprites', () => {
    const scene = new THREE.Scene();
    const s = useAnimationStore.getState();
    s.setToolActive(true);
    s.setWaypoints([makeWaypoint(0)]);
    s.setActiveWaypointIndex(0);

    const r = new WaypointDragHandleRenderer(scene);
    const positionSprite = findSprite(r.getHandlesGroup()!, 'position');
    expect(positionSprite.position.x).toBe(0);

    useAnimationStore.getState().updateWaypoint(0, {
      position: { x: 42, y: 0, z: 0 },
    });
    expect(positionSprite.position.x).toBe(42);
    r.dispose();
  });
});

describe('WaypointDragHandleRenderer — hover state', () => {
  it('setHoverState rebuilds sprite textures on transition', () => {
    const scene = new THREE.Scene();
    const s = useAnimationStore.getState();
    s.setToolActive(true);
    s.setWaypoints([makeWaypoint()]);
    s.setActiveWaypointIndex(0);

    const r = new WaypointDragHandleRenderer(scene);
    const positionSprite = findSprite(r.getHandlesGroup()!, 'position');
    const beforeMap = (positionSprite.material as THREE.SpriteMaterial).map;

    r.setHoverState('position');
    const afterMap = (positionSprite.material as THREE.SpriteMaterial).map;

    expect(afterMap).not.toBe(beforeMap);
    r.dispose();
  });
});

describe('WaypointDragHandleRenderer — dispose', () => {
  it('removes all groups from the scene', () => {
    const scene = new THREE.Scene();
    const r = new WaypointDragHandleRenderer(scene);
    const before = scene.children.length;
    r.dispose();
    // Renderer adds handles group + gizmo group; both removed on dispose.
    expect(scene.children.length).toBe(before - 2);
  });

  it('returns null from getHandlesGroup after dispose', () => {
    const scene = new THREE.Scene();
    const s = useAnimationStore.getState();
    s.setToolActive(true);
    s.setWaypoints([makeWaypoint()]);
    s.setActiveWaypointIndex(0);

    const r = new WaypointDragHandleRenderer(scene);
    expect(r.getHandlesGroup()).not.toBeNull();
    r.dispose();
    expect(r.getHandlesGroup()).toBeNull();
  });
});
