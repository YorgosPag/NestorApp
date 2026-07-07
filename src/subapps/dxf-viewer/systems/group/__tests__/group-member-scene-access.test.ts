/**
 * ADR-575 §enter-group — unit tests for the MEMBER-AWARE scene access SSoT
 * (`findEntityOrGroupMember` / `updateEntityOrGroupMember` /
 * `updateEntitiesOrGroupMembers`).
 */

import {
  findEntityOrGroupMember,
  updateEntityOrGroupMember,
  updateEntitiesOrGroupMembers,
} from '../group-member-scene-access';
import type { Entity, GroupEntity } from '../../../types/entities';

const mkLine = (id: string, x0 = 0, y0 = 0, x1 = 1, y1 = 1): Entity =>
  ({ id, type: 'line', layerId: 'lyr_test', visible: true, start: { x: x0, y: y0 }, end: { x: x1, y: y1 } } as unknown as Entity);

const mkGroup = (id: string, members: Entity[]): GroupEntity =>
  ({ id, type: 'group', layerId: 'lyr_test', visible: true, members } as unknown as GroupEntity);

describe('findEntityOrGroupMember (ADR-575)', () => {
  const memberA = mkLine('a');
  const memberB = mkLine('b');
  const group = mkGroup('g1', [memberA, memberB]);
  const loose = mkLine('loose');
  const entities: Entity[] = [group as unknown as Entity, loose];

  it('finds a top-level entity', () => {
    expect(findEntityOrGroupMember(entities, 'loose')).toBe(loose);
  });

  it('finds the group container by its own id (no descent)', () => {
    expect(findEntityOrGroupMember(entities, 'g1')).toBe(group);
  });

  it('finds a member INSIDE a group by the member id', () => {
    expect(findEntityOrGroupMember(entities, 'b')).toBe(memberB);
  });

  it('finds a NESTED group member (groups-of-groups)', () => {
    const inner = mkLine('deep');
    const innerGroup = mkGroup('g_inner', [inner]);
    const outer = mkGroup('g_outer', [innerGroup as unknown as Entity]);
    expect(findEntityOrGroupMember([outer as unknown as Entity], 'deep')).toBe(inner);
  });

  it('returns null for an unknown id / empty inputs', () => {
    expect(findEntityOrGroupMember(entities, 'nope')).toBeNull();
    expect(findEntityOrGroupMember(undefined, 'a')).toBeNull();
    expect(findEntityOrGroupMember(entities, null)).toBeNull();
  });
});

describe('updateEntityOrGroupMember (ADR-575)', () => {
  it('updates a member and writes back a NEW container + NEW members array', () => {
    const memberA = mkLine('a', 0, 0, 1, 0);
    const group = mkGroup('g1', [memberA]);
    const entities: Entity[] = [group as unknown as Entity];

    const next = updateEntityOrGroupMember(entities, 'a', (e) => ({ ...e, start: { x: 9, y: 9 } } as Entity));

    expect(next).not.toBe(entities);                         // new top-level array
    const nextGroup = next[0] as unknown as GroupEntity;
    expect(nextGroup).not.toBe(group);                       // new container ref
    expect(nextGroup.members).not.toBe(group.members);       // new members array
    expect((nextGroup.members[0] as unknown as { start: { x: number } }).start.x).toBe(9);
    // Original is untouched (immutability).
    expect((group.members[0] as unknown as { start: { x: number } }).start.x).toBe(0);
  });

  it('updates a top-level entity directly', () => {
    const loose = mkLine('loose', 0, 0);
    const next = updateEntityOrGroupMember([loose], 'loose', (e) => ({ ...e, start: { x: 5, y: 5 } } as Entity));
    expect((next[0] as unknown as { start: { x: number } }).start.x).toBe(5);
  });

  it('returns the SAME array reference when the id is not found (no-op)', () => {
    const loose = mkLine('loose');
    const group = mkGroup('g1', [mkLine('a')]);
    const entities: Entity[] = [group as unknown as Entity, loose];
    const next = updateEntityOrGroupMember(entities, 'ghost', (e) => e);
    expect(next).toBe(entities);
  });

  it('updates a NESTED member and cascades new refs up the chain', () => {
    const inner = mkLine('deep', 0, 0);
    const innerGroup = mkGroup('g_inner', [inner]);
    const outer = mkGroup('g_outer', [innerGroup as unknown as Entity]);
    const next = updateEntityOrGroupMember([outer as unknown as Entity], 'deep', (e) => ({ ...e, start: { x: 7, y: 7 } } as Entity));

    const nextOuter = next[0] as unknown as GroupEntity;
    const nextInner = nextOuter.members[0] as unknown as GroupEntity;
    expect(nextOuter).not.toBe(outer);
    expect(nextInner).not.toBe(innerGroup);
    expect((nextInner.members[0] as unknown as { start: { x: number } }).start.x).toBe(7);
  });
});

describe('updateEntitiesOrGroupMembers (ADR-575)', () => {
  it('applies patches to members across containers in one pass', () => {
    const a = mkLine('a', 0, 0);
    const b = mkLine('b', 0, 0);
    const group = mkGroup('g1', [a, b]);
    const entities: Entity[] = [group as unknown as Entity];

    const patches = new Map<string, (e: Entity) => Entity>([
      ['a', (e) => ({ ...e, start: { x: 1, y: 1 } } as Entity)],
      ['b', (e) => ({ ...e, start: { x: 2, y: 2 } } as Entity)],
    ]);
    const next = updateEntitiesOrGroupMembers(entities, patches);
    const nextGroup = next[0] as unknown as GroupEntity;
    expect((nextGroup.members[0] as unknown as { start: { x: number } }).start.x).toBe(1);
    expect((nextGroup.members[1] as unknown as { start: { x: number } }).start.x).toBe(2);
  });

  it('returns the same array reference for an empty patch map', () => {
    const entities: Entity[] = [mkLine('a')];
    expect(updateEntitiesOrGroupMembers(entities, new Map())).toBe(entities);
  });
});
