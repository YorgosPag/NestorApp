/**
 * Tests for bim3d-edit-math.ts — the SSoT world↔DXF coordinate bridge for
 * 3D BIM element editing (ADR-402 Phase 1). Pure math, no mocks.
 */

import * as THREE from 'three';
import {
  computeFloorPlane,
  worldDeltaToDxfDelta,
  mmToEntityUnitFactor,
} from '../bim3d-edit-math';
import type { Entity } from '../../../types/entities';
import {
  buildDefaultStairParams,
  buildStairEntity,
} from '../../../hooks/drawing/stair-completion';
import { mmToSceneUnits, inferSceneUnitsFromWidth } from '../../../utils/scene-units';

describe('computeFloorPlane', () => {
  it('returns a Y-up plane through the origin for elevation 0', () => {
    const plane = computeFloorPlane(0);
    expect(plane.normal.x).toBe(0);
    expect(plane.normal.y).toBe(1);
    expect(plane.normal.z).toBe(0);
    expect(plane.distanceToPoint(new THREE.Vector3(5, 0, -7))).toBeCloseTo(0, 6);
  });

  it('places the plane at floor elevation (mm → m) so points on the floor have zero distance', () => {
    // 3000 mm = 3 m
    const plane = computeFloorPlane(3000);
    expect(plane.distanceToPoint(new THREE.Vector3(0, 3, 0))).toBeCloseTo(0, 6);
    // a point on the world origin is 3 m below the plane
    expect(plane.distanceToPoint(new THREE.Vector3(0, 0, 0))).toBeCloseTo(-3, 6);
    // a point above the floor has positive distance
    expect(plane.distanceToPoint(new THREE.Vector3(10, 4, -2))).toBeCloseTo(1, 6);
  });
});

describe('worldDeltaToDxfDelta', () => {
  it('scales metres → mm on the X (east) axis', () => {
    const delta = worldDeltaToDxfDelta(
      new THREE.Vector3(1, 0, 2),
      new THREE.Vector3(1.5, 0, 2),
    );
    expect(delta.x).toBeCloseTo(500, 6);
    expect(delta.y).toBeCloseTo(0, 6);
  });

  it('flips sign on the Z axis (world Z = −DXF north)', () => {
    const delta = worldDeltaToDxfDelta(
      new THREE.Vector3(0, 0, 2),
      new THREE.Vector3(0, 0, 2.5),
    );
    // moving +Z in world = moving −north in DXF
    expect(delta.x).toBeCloseTo(0, 6);
    expect(delta.y).toBeCloseTo(-500, 6);
  });

  it('ignores the vertical (world Y) component', () => {
    const delta = worldDeltaToDxfDelta(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 99, 0),
    );
    expect(delta.x).toBeCloseTo(0, 6);
    expect(delta.y).toBeCloseTo(0, 6);
  });

  it('round-trips a combined horizontal drag', () => {
    const delta = worldDeltaToDxfDelta(
      new THREE.Vector3(2, 5, -3),
      new THREE.Vector3(2.25, 5, -3.4),
    );
    expect(delta.x).toBeCloseTo(250, 6);
    expect(delta.y).toBeCloseTo(400, 6); // −(−3.4 − −3) · 1000 = −(−0.4)·1000 = 400
  });
});

describe('mmToEntityUnitFactor (ADR-402/404 — gizmo move/rotate unit fix)', () => {
  it('returns 1 for an mm-scene wall/column/beam/slab — the mm gizmo delta is already native', () => {
    const mm = { sceneUnits: 'mm' as const };
    expect(mmToEntityUnitFactor({ type: 'wall', params: mm } as unknown as Entity)).toBe(1);
    expect(mmToEntityUnitFactor({ type: 'column', params: mm } as unknown as Entity)).toBe(1);
    expect(mmToEntityUnitFactor({ type: 'beam', params: mm } as unknown as Entity)).toBe(1);
    expect(mmToEntityUnitFactor({ type: 'slab', params: mm } as unknown as Entity)).toBe(1);
  });

  it('defaults to 1 when sceneUnits is absent (legacy mm default → byte-for-byte)', () => {
    expect(mmToEntityUnitFactor({ type: 'wall', params: {} } as unknown as Entity)).toBe(1);
  });

  it('scales mm → metres (0.001) for a metre-scene wall/column/beam/slab — the 1000× off-screen "vanish" fix', () => {
    const m = { sceneUnits: 'm' as const };
    expect(mmToEntityUnitFactor({ type: 'wall', params: m } as unknown as Entity)).toBeCloseTo(0.001, 9);
    expect(mmToEntityUnitFactor({ type: 'column', params: m } as unknown as Entity)).toBeCloseTo(0.001, 9);
    expect(mmToEntityUnitFactor({ type: 'beam', params: m } as unknown as Entity)).toBeCloseTo(0.001, 9);
    expect(mmToEntityUnitFactor({ type: 'slab', params: m } as unknown as Entity)).toBeCloseTo(0.001, 9);
  });

  it('scales mm → cm (0.1) for a centimetre-scene element', () => {
    expect(
      mmToEntityUnitFactor({ type: 'wall', params: { sceneUnits: 'cm' } } as unknown as Entity),
    ).toBeCloseTo(0.1, 9);
  });

  it('uses the stair grip SSoT factor (drawing units), matching getStairGrips / the resize bridge', () => {
    const stair = buildStairEntity(buildDefaultStairParams({ x: 0, y: 0 }, 0), '0');
    const mmStair = { ...stair, params: { ...stair.params, width: 1200 } };
    const mStair = { ...stair, params: { ...stair.params, width: 1.2 } };

    expect(mmToEntityUnitFactor(mmStair)).toBeCloseTo(
      mmToSceneUnits(inferSceneUnitsFromWidth(1200)),
      9,
    );
    expect(mmToEntityUnitFactor(mStair)).toBeCloseTo(
      mmToSceneUnits(inferSceneUnitsFromWidth(1.2)),
      9,
    );
  });

  it('is unit-aware: a mm-scale stair and a metre-scale stair get DIFFERENT factors', () => {
    const stair = buildStairEntity(buildDefaultStairParams({ x: 0, y: 0 }, 0), '0');
    const mmStair = { ...stair, params: { ...stair.params, width: 1200 } };
    const mStair = { ...stair, params: { ...stair.params, width: 1.2 } };
    // This divergence is exactly what the move path was ignoring: the same mm gizmo
    // delta must scale differently per the stair's stored unit.
    expect(mmToEntityUnitFactor(mmStair)).not.toBeCloseTo(mmToEntityUnitFactor(mStair), 9);
  });
});
