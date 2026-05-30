/**
 * ADR-402 §Sub-Phase 2 — Bim3DEditDragController FSM + floor-plane projection.
 *
 * Uses a top-down OrthographicCamera so every cursor ray is vertical (−Y) and
 * the floor-plane intersection is deterministic: NDC (nx, ny) → world
 * (nx·halfW, anchorY, −ny·halfH). Pure math — no WebGL needed.
 */

import * as THREE from 'three';
import { Bim3DEditDragController } from '../bim3d-edit-drag-controller';

const HALF = 5; // ortho frustum half-extent

function makeTopDownCamera(): THREE.OrthographicCamera {
  const cam = new THREE.OrthographicCamera(-HALF, HALF, HALF, -HALF, 0.1, 100);
  cam.position.set(0, 10, 0);
  cam.up.set(0, 0, -1); // screen +Y → world −Z
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  return cam;
}

function makeFakeCanvas(width = 200, height = 200): HTMLElement {
  return {
    getBoundingClientRect: () =>
      ({ left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect,
  } as unknown as HTMLElement;
}

function taggedMesh(kind: string, axis?: 'X' | 'Z'): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
  mesh.userData['kind'] = kind;
  if (axis) mesh.userData['axis'] = axis;
  mesh.updateMatrixWorld(true);
  return mesh;
}

describe('Bim3DEditDragController — pick', () => {
  it('classifies the move-plane disc', () => {
    const controller = new Bim3DEditDragController();
    const group = new THREE.Group();
    group.add(taggedMesh('bim-edit-move-plane'));
    group.updateMatrixWorld(true);
    const pick = controller.pick(group, makeTopDownCamera(), makeFakeCanvas(), 100, 100);
    expect(pick?.kind).toBe('move-plane');
  });

  it('classifies an axis arrow by its userData.axis', () => {
    const controller = new Bim3DEditDragController();
    const group = new THREE.Group();
    const arrow = new THREE.Group();
    arrow.userData['kind'] = 'bim-edit-axis';
    arrow.userData['axis'] = 'Z';
    arrow.add(taggedMesh('arrow-mesh')); // child mesh, tag lives on the parent
    group.add(arrow);
    group.updateMatrixWorld(true);
    const pick = controller.pick(group, makeTopDownCamera(), makeFakeCanvas(), 100, 100);
    expect(pick?.kind).toBe('axis-z');
  });

  it('returns null when the cursor misses every handle', () => {
    const controller = new Bim3DEditDragController();
    const group = new THREE.Group(); // empty
    const pick = controller.pick(group, makeTopDownCamera(), makeFakeCanvas(), 100, 100);
    expect(pick).toBeNull();
  });
});

describe('Bim3DEditDragController — floor-plane drag', () => {
  it('starts on the floor plane at the anchor elevation', () => {
    const controller = new Bim3DEditDragController();
    const ok = controller.startDrag(0, makeTopDownCamera(), makeFakeCanvas(), 100, 100);
    expect(ok).toBe(true);
    expect(controller.isDragging()).toBe(true);
    const start = controller.getStart();
    expect(start.x).toBeCloseTo(0, 5);
    expect(start.y).toBeCloseTo(0, 5);
    expect(start.z).toBeCloseTo(0, 5);
  });

  it('projects the cursor onto the floor plane (no lock)', () => {
    const controller = new Bim3DEditDragController();
    const cam = makeTopDownCamera();
    const canvas = makeFakeCanvas();
    controller.startDrag(0, cam, canvas, 100, 100);
    // client (150,100) → NDC (0.5, 0) → world (2.5, 0, 0)
    const p = controller.updateDrag(cam, canvas, 150, 100, null);
    expect(p?.x).toBeCloseTo(2.5, 5);
    expect(p?.y).toBeCloseTo(0, 5);
    expect(p?.z).toBeCloseTo(0, 5);
  });

  it('locks movement to world X', () => {
    const controller = new Bim3DEditDragController();
    const cam = makeTopDownCamera();
    const canvas = makeFakeCanvas();
    controller.startDrag(0, cam, canvas, 100, 100);
    // client (150,150) → world (2.5, 0, 2.5); X-lock keeps z at start (0)
    const p = controller.updateDrag(cam, canvas, 150, 150, 'X');
    expect(p?.x).toBeCloseTo(2.5, 5);
    expect(p?.z).toBeCloseTo(0, 5);
  });

  it('locks movement to world Z', () => {
    const controller = new Bim3DEditDragController();
    const cam = makeTopDownCamera();
    const canvas = makeFakeCanvas();
    controller.startDrag(0, cam, canvas, 100, 100);
    // client (150,150) → world (2.5, 0, 2.5); Z-lock keeps x at start (0)
    const p = controller.updateDrag(cam, canvas, 150, 150, 'Z');
    expect(p?.x).toBeCloseTo(0, 5);
    expect(p?.z).toBeCloseTo(2.5, 5);
  });

  it('starts the plane through a non-zero anchor elevation', () => {
    const controller = new Bim3DEditDragController();
    const ok = controller.startDrag(3, makeTopDownCamera(), makeFakeCanvas(), 100, 100);
    expect(ok).toBe(true);
    expect(controller.getStart().y).toBeCloseTo(3, 5);
  });

  it('updateDrag returns null when not dragging', () => {
    const controller = new Bim3DEditDragController();
    expect(controller.updateDrag(makeTopDownCamera(), makeFakeCanvas(), 100, 100, null)).toBeNull();
  });

  it('endDrag / cancelDrag return to idle', () => {
    const controller = new Bim3DEditDragController();
    controller.startDrag(0, makeTopDownCamera(), makeFakeCanvas(), 100, 100);
    controller.endDrag();
    expect(controller.isDragging()).toBe(false);
    controller.startDrag(0, makeTopDownCamera(), makeFakeCanvas(), 100, 100);
    controller.cancelDrag();
    expect(controller.isDragging()).toBe(false);
  });
});
