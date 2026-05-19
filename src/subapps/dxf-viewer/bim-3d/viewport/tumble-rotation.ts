/**
 * C4D-style quaternion tumble rotation (pole-free orbit).
 * PORT_AS_IS from GenArc tumbleRotation.ts (ADR-366 §8.2 SPEC-3D-004A).
 */

import * as THREE from 'three';
import { TUMBLE_BASE_SPEED, TUMBLE_DAMPING } from './viewport-constants';

export interface TumbleRotation {
  readonly update: () => void;
  readonly setSpeed: (speed: number) => void;
  readonly setEnabled: (enabled: boolean) => void;
  readonly dispose: () => void;
  readonly applyExternalRotation: (dxPx: number, dyPx: number) => void;
}

export interface TumbleOptions {
  readonly getCamera: () => THREE.Camera;
  readonly getTarget: () => THREE.Vector3;
  readonly domElement: HTMLElement;
  readonly onStart: () => void;
  readonly onChange: () => void;
  readonly onEnd: () => void;
}

const DRAG_THRESHOLD_SQ = 9;
const VEL_CUTOFF = 0.01;

const _offset = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _qH = new THREE.Quaternion();
const _qV = new THREE.Quaternion();

export function createTumbleRotation(opts: TumbleOptions): TumbleRotation {
  const { getCamera, getTarget, domElement, onStart, onChange, onEnd } = opts;

  let speed = TUMBLE_BASE_SPEED;
  let enabled = true;
  let pointerDown = false;
  let dragActive = false;
  let startX = 0;
  let startY = 0;
  let prevX = 0;
  let prevY = 0;
  let velX = 0;
  let velY = 0;
  let damping = false;

  function applyRotation(dx: number, dy: number): void {
    const camera = getCamera();
    const target = getTarget();
    _offset.subVectors(camera.position, target);
    _right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    _up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    _qH.setFromAxisAngle(_up, -dx * speed);
    _qV.setFromAxisAngle(_right, -dy * speed);
    _offset.applyQuaternion(_qH).applyQuaternion(_qV);
    camera.position.copy(target).add(_offset);
    const dotY = _offset.y / _offset.length();
    if (Math.abs(dotY) > 0.99) {
      camera.up.set(0, 0, dotY > 0 ? -1 : 1);
    } else {
      camera.up.set(0, 1, 0);
    }
    camera.lookAt(target);
    onChange();
  }

  function onPointerDown(e: PointerEvent): void {
    if (!enabled || e.button !== 0 || !e.altKey) return;
    pointerDown = true;
    dragActive = false;
    damping = false;
    startX = prevX = e.clientX;
    startY = prevY = e.clientY;
    velX = 0;
    velY = 0;
  }

  function onPointerMove(e: PointerEvent): void {
    if (!pointerDown) return;
    const dx = e.clientX - prevX;
    const dy = e.clientY - prevY;
    prevX = e.clientX;
    prevY = e.clientY;
    if (!dragActive) {
      const tx = e.clientX - startX;
      const ty = e.clientY - startY;
      if (tx * tx + ty * ty < DRAG_THRESHOLD_SQ) return;
      dragActive = true;
      onStart();
    }
    velX = dx;
    velY = dy;
    applyRotation(dx, dy);
  }

  function onPointerUp(e: PointerEvent): void {
    if (e.button !== 0 || !pointerDown) return;
    pointerDown = false;
    if (!dragActive) return;
    if (Math.abs(velX) > 0.5 || Math.abs(velY) > 0.5) {
      damping = true;
    } else {
      onEnd();
    }
  }

  function update(): void {
    if (!damping) return;
    velX *= 1 - TUMBLE_DAMPING;
    velY *= 1 - TUMBLE_DAMPING;
    if (Math.abs(velX) < VEL_CUTOFF && Math.abs(velY) < VEL_CUTOFF) {
      damping = false;
      velX = 0;
      velY = 0;
      onEnd();
      return;
    }
    applyRotation(velX, velY);
  }

  function setSpeed(s: number): void { speed = s; }
  function setEnabled(e: boolean): void { enabled = e; }

  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerup', onPointerUp);

  function dispose(): void {
    domElement.removeEventListener('pointerdown', onPointerDown);
    domElement.removeEventListener('pointermove', onPointerMove);
    domElement.removeEventListener('pointerup', onPointerUp);
  }

  return { update, setSpeed, setEnabled, dispose, applyExternalRotation: applyRotation };
}
