/**
 * ADR-049 Phase 2 — 3D move delta (`MoveElement(dx,dy,dz)`) unit tests.
 *
 * Covers the command-layer contract of the unified vertical move:
 *  - `reverseDelta` negates the optional `z` (undo restores elevation too)
 *  - a PURE vertical delta (x=y=0, z≠0) is VALID (the axis-Y gizmo)
 *  - merge sums z; a pure-plan merge stays 2D (no spurious `z: 0`)
 *  - `getDelta` round-trips z
 */

import { reverseDelta } from '../move-entity-geometry';
import { MoveEntityCommand, MoveMultipleEntitiesCommand } from '../MoveEntityCommand';
import type { ISceneManager } from '../interfaces';

// validate / mergeWith / getDelta never touch the scene manager.
const sm = {} as unknown as ISceneManager;

describe('ADR-049 Phase 2 — reverseDelta with z', () => {
  it('negates x, y AND z when z is present', () => {
    expect(reverseDelta({ x: 10, y: 20, z: 30 })).toEqual({ x: -10, y: -20, z: -30 });
  });

  it('omits the z key entirely for a 2D delta (no `z: -0`)', () => {
    const r = reverseDelta({ x: 10, y: 20 });
    expect(r).toEqual({ x: -10, y: -20 });
    expect('z' in r).toBe(false);
  });

  it('round-trips: reverse(reverse(d)) === d for a 3D delta', () => {
    const d = { x: 7, y: -3, z: 250 };
    expect(reverseDelta(reverseDelta(d))).toEqual(d);
  });
});

describe('ADR-049 Phase 2 — MoveEntityCommand 3D delta', () => {
  it('validate allows a PURE vertical delta (x=y=0, z≠0)', () => {
    expect(new MoveEntityCommand('e1', { x: 0, y: 0, z: 500 }, sm, false).validate()).toBeNull();
  });

  it('validate rejects an all-zero delta (including z=0)', () => {
    expect(new MoveEntityCommand('e1', { x: 0, y: 0, z: 0 }, sm, false).validate()).not.toBeNull();
    expect(new MoveEntityCommand('e1', { x: 0, y: 0 }, sm, false).validate()).not.toBeNull();
  });

  it('getDelta round-trips the z component', () => {
    expect(new MoveEntityCommand('e1', { x: 1, y: 2, z: 3 }, sm, false).getDelta()).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('mergeWith sums the z of two consecutive drag samples', () => {
    const a = new MoveEntityCommand('e1', { x: 1, y: 2, z: 3 }, sm, true);
    const b = new MoveEntityCommand('e1', { x: 4, y: 5, z: 6 }, sm, true);
    expect((a.mergeWith(b) as MoveEntityCommand).getDelta()).toEqual({ x: 5, y: 7, z: 9 });
  });

  it('mergeWith of two plan-only deltas stays 2D (no spurious z key)', () => {
    const a = new MoveEntityCommand('e1', { x: 1, y: 0 }, sm, true);
    const b = new MoveEntityCommand('e1', { x: 2, y: 0 }, sm, true);
    const merged = (a.mergeWith(b) as MoveEntityCommand).getDelta();
    expect(merged).toEqual({ x: 3, y: 0 });
    expect('z' in merged).toBe(false);
  });

  it('mergeWith drops z when the combined elevation nets to zero', () => {
    const a = new MoveEntityCommand('e1', { x: 1, y: 0, z: 5 }, sm, true);
    const b = new MoveEntityCommand('e1', { x: 1, y: 0, z: -5 }, sm, true);
    const merged = (a.mergeWith(b) as MoveEntityCommand).getDelta();
    expect(merged).toEqual({ x: 2, y: 0 });
    expect('z' in merged).toBe(false);
  });
});

describe('ADR-049 Phase 2 — MoveMultipleEntitiesCommand 3D delta', () => {
  it('validate allows a pure vertical delta', () => {
    expect(new MoveMultipleEntitiesCommand(['a', 'b'], { x: 0, y: 0, z: 300 }, sm, false).validate()).toBeNull();
  });

  it('mergeWith sums z across the batch', () => {
    const a = new MoveMultipleEntitiesCommand(['a', 'b'], { x: 0, y: 0, z: 100 }, sm, true);
    const b = new MoveMultipleEntitiesCommand(['a', 'b'], { x: 0, y: 0, z: 50 }, sm, true);
    expect((a.mergeWith(b) as MoveMultipleEntitiesCommand).getDelta()).toEqual({ x: 0, y: 0, z: 150 });
  });
});
