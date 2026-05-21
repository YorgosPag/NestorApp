/**
 * ADR-366 Phase 4.2 — animation-manager + easing-functions unit tests (6 tests).
 */

import * as THREE from 'three';
import { easeInOutCubic } from '../viewport/easing-functions';
import { createAnimationManager } from '../viewport/animation-manager';
import type { ManagedTickCallback } from '../viewport/animation-manager';
import { PROJECTION_SWITCH_DURATION_MS } from '../viewport/viewport-constants';

// ── Test 1: Cubic ease-in-out curve ─────────────────────────────────────────

describe('easeInOutCubic', () => {
  it('satisfies f(0)=0, f(0.5)=0.5, f(1)=1 and f(0.25)<0.25', () => {
    expect(easeInOutCubic(0)).toBeCloseTo(0, 10);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10);
    expect(easeInOutCubic(1)).toBeCloseTo(1, 10);
    // Ease-in phase: slower than linear at t=0.25
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25);
    // Ease-out phase: faster than linear at t=0.75
    expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75);
  });
});

// ── Test 2: Quaternion slerp ─────────────────────────────────────────────────

describe('AnimationManager — quaternion slerp', () => {
  it('interpolates orientation via slerp at t=0.5', () => {
    const manager = createAnimationManager();

    const fromQ = new THREE.Quaternion(); // identity
    // 90 degrees around Y
    const toQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);

    let capturedOrientation: THREE.Quaternion | undefined;

    const onTick: ManagedTickCallback = (_, _t, _z, _f, orientation) => {
      capturedOrientation = orientation?.clone();
    };

    manager.startTransition({
      from: { position: new THREE.Vector3(), target: new THREE.Vector3(), zoom: 1, orientation: fromQ },
      to:   { position: new THREE.Vector3(), target: new THREE.Vector3(), zoom: 1, orientation: toQ },
      durationMs: 500,
      onTick,
    });

    manager.tick(1000); // startTime = 1000
    manager.tick(1250); // elapsed=250ms → rawProgress=0.5, t=easeInOutCubic(0.5)=0.5

    expect(capturedOrientation).toBeDefined();
    // At t=0.5 slerp from identity to 90deg → should be ~45deg around Y
    const euler = new THREE.Euler().setFromQuaternion(capturedOrientation!);
    expect(Math.abs(euler.y)).toBeCloseTo(Math.PI / 4, 1); // ~45 degrees
  });
});

// ── Test 3: FOV lerp ─────────────────────────────────────────────────────────

describe('AnimationManager — FOV lerp', () => {
  it('linearly interpolates FOV at t=0.5', () => {
    const manager = createAnimationManager();

    let capturedFov: number | undefined;

    manager.startTransition({
      from: { position: new THREE.Vector3(), target: new THREE.Vector3(), zoom: 1, fov: 60 },
      to:   { position: new THREE.Vector3(), target: new THREE.Vector3(), zoom: 1, fov: 90 },
      durationMs: 500,
      onTick: (_, _t, _z, fov) => { capturedFov = fov; },
    });

    manager.tick(0);   // startTime = 0
    manager.tick(250); // elapsed=250 → rawProgress=0.5, t=0.5

    // FOV lerp: 60 + (90 - 60) * 0.5 = 75
    expect(capturedFov).toBeCloseTo(75, 1);
  });
});

// ── Test 4: Cancel + blend (interrupt mid-flight) ────────────────────────────

describe('AnimationManager — smooth interruption blend', () => {
  it('new startTransition while animating begins from current interpolated position', () => {
    const manager = createAnimationManager();

    const origin = new THREE.Vector3(0, 0, 0);
    const t0 = new THREE.Vector3(0, 0, 0);

    // Animation A: x 0 → 10
    manager.startTransition({
      from: { position: origin.clone(), target: t0.clone(), zoom: 1 },
      to:   { position: new THREE.Vector3(10, 0, 0), target: t0.clone(), zoom: 1 },
      durationMs: 500,
      onTick: jest.fn(),
    });

    manager.tick(1000); // startTime = 1000
    manager.tick(1250); // elapsed=250, rawProgress=0.5, t=0.5 → pos.x=5

    // Interrupt with animation B: target x=20
    let firstNewX: number | null = null;
    manager.startTransition({
      from: { position: origin.clone(), target: t0.clone(), zoom: 1 }, // should be ignored
      to:   { position: new THREE.Vector3(20, 0, 0), target: t0.clone(), zoom: 1 },
      durationMs: 500,
      onTick: (pos) => { if (firstNewX === null) firstNewX = pos.x; },
    });

    // First tick of B: rawProgress=0 → lerp(blendPos, to, 0) = blendPos.x ≈ 5
    manager.tick(2000); // new startTime = 2000
    manager.tick(2001); // minimal advancement

    expect(firstNewX).toBeCloseTo(5, 0);
  });
});

// ── Test 5: Interruption — old onComplete NOT called ─────────────────────────

describe('AnimationManager — interruption', () => {
  it('interrupted animation onComplete is NOT called', () => {
    const manager = createAnimationManager();
    const onCompleteA = jest.fn();

    manager.startTransition({
      from: { position: new THREE.Vector3(), target: new THREE.Vector3(), zoom: 1 },
      to:   { position: new THREE.Vector3(10, 0, 0), target: new THREE.Vector3(), zoom: 1 },
      durationMs: 500,
      onTick: jest.fn(),
      onComplete: onCompleteA,
    });

    manager.tick(0);   // startTime = 0
    manager.tick(100); // 20% through — mid-flight

    // Interrupt with B before A completes
    manager.startTransition({
      from: { position: new THREE.Vector3(), target: new THREE.Vector3(), zoom: 1 },
      to:   { position: new THREE.Vector3(20, 0, 0), target: new THREE.Vector3(), zoom: 1 },
      durationMs: 500,
      onTick: jest.fn(),
    });

    // Run B to completion
    manager.tick(100); // B startTime = 100
    manager.tick(600); // 500ms elapsed → B complete

    expect(onCompleteA).not.toHaveBeenCalled();
  });
});

// ── Test 6: Duration validation (A.4.Q1 LOCKED) ─────────────────────────────

describe('PROJECTION_SWITCH_DURATION_MS', () => {
  it('is 500ms per A.4.Q1 locked decision', () => {
    expect(PROJECTION_SWITCH_DURATION_MS).toBe(500);
  });
});
