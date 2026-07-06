/**
 * ADR-575 — group-entity pure engine tests (GROUP «Ομαδοποίηση» + UNGROUP).
 * Mirrors systems/explode/__tests__/explode-entity.test.ts.
 */

import { createGroupEntity, isGroupable, isGroupEntity, ungroupGroup, cloneGroupEntity, GROUP_MIN_MEMBERS } from '../group-entity';
import { explodeEntity } from '../../explode/explode-entity';
import type { Entity, GroupEntity } from '../../../types/entities';

const mkLine = (id: string, x = 0): Entity =>
  ({ id, type: 'line', layerId: 'lyr_test', visible: true, start: { x, y: 0 }, end: { x: x + 1, y: 0 } } as unknown as Entity);

describe('ADR-575 — group-entity (GROUP/UNGROUP SSoT)', () => {
  it('isGroupable requires at least GROUP_MIN_MEMBERS entities', () => {
    expect(isGroupable([])).toBe(false);
    expect(isGroupable([mkLine('a')])).toBe(false);
    expect(isGroupable([mkLine('a'), mkLine('b')])).toBe(true);
    expect(GROUP_MIN_MEMBERS).toBe(2);
  });

  it('createGroupEntity wraps members into a type:group container', () => {
    const group = createGroupEntity([mkLine('a'), mkLine('b', 5)]);
    expect(group.type).toBe('group');
    expect(group.members).toHaveLength(2);
    expect(group.id).toBeTruthy();
    expect(isGroupEntity(group as unknown as Entity)).toBe(true);
  });

  it('createGroupEntity deep-clones members (mutating source leaves the group intact)', () => {
    const src = mkLine('a');
    const group = createGroupEntity([src, mkLine('b')]);
    (src as unknown as { start: { x: number } }).start.x = 999;
    const cloned = group.members[0] as unknown as { start: { x: number } };
    expect(cloned.start.x).toBe(0);
  });

  it('ungroupGroup returns members with FRESH ids (explode convention)', () => {
    const group = createGroupEntity([mkLine('a'), mkLine('b')]);
    const members = ungroupGroup(group);
    expect(members).toHaveLength(2);
    expect(members?.every((m) => m.id !== 'a' && m.id !== 'b')).toBe(true);
    expect(members?.every((m) => m.type === 'line')).toBe(true);
  });

  it('ungroupGroup returns null for an empty container', () => {
    const empty = { id: 'g', type: 'group', visible: true, name: 'x', members: [] } as unknown as GroupEntity;
    expect(ungroupGroup(empty)).toBeNull();
  });

  it('cloneGroupEntity returns an independent copy: fresh container + fresh member ids', () => {
    const group = createGroupEntity([mkLine('a'), mkLine('b', 5)]);
    const copy = cloneGroupEntity(group);
    expect(copy.type).toBe('group');
    expect(copy.id).not.toBe(group.id);                                  // fresh container id
    expect(copy.members).toHaveLength(2);
    const srcIds = group.members.map((m) => m.id);
    expect(copy.members.every((m) => !srcIds.includes(m.id))).toBe(true); // fresh member ids (no collision)
  });

  it('cloneGroupEntity deep-clones members (mutating the copy leaves the source intact)', () => {
    const group = createGroupEntity([mkLine('a'), mkLine('b')]);
    const copy = cloneGroupEntity(group);
    (copy.members[0] as unknown as { start: { x: number } }).start.x = 777;
    const src = group.members[0] as unknown as { start: { x: number } };
    expect(src.start.x).toBe(0);                                          // no shared nested refs
  });

  it('cloneGroupEntity re-ids nested-group members recursively', () => {
    const inner = createGroupEntity([mkLine('a'), mkLine('b')]);
    const outer = createGroupEntity([inner as unknown as Entity, mkLine('c')]);
    const copy = cloneGroupEntity(outer);
    const copiedInner = copy.members.find((m) => isGroupEntity(m)) as unknown as GroupEntity;
    const srcInnerMemberIds = inner.members.map((m) => m.id);
    expect(copiedInner.members.every((m) => !srcInnerMemberIds.includes(m.id))).toBe(true);
  });

  it('explodeEntity delegates the group case to UNGROUP (round-trip)', () => {
    const group = createGroupEntity([mkLine('a'), mkLine('b')]);
    const exploded = explodeEntity(group as unknown as Entity);
    expect(exploded).toHaveLength(2);
    expect(exploded?.every((e) => e.type === 'line')).toBe(true);
  });
});
