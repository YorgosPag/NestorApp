/**
 * ADR-575 — unit tests for the GROUP selection-affordance bounds SSoT
 * (`computeGroupSelectionBounds` + `resolveSelectedGroups`).
 */

import { createGroupEntity } from '../group-entity';
import {
  computeGroupSelectionBounds,
  resolveSelectedGroups,
  resolveGroupContainingEntity,
  collectGroupEntities,
} from '../group-selection-bounds';
import type { Entity, GroupEntity } from '../../../types/entities';

const mkLine = (id: string, x0: number, y0: number, x1: number, y1: number): Entity =>
  ({ id, type: 'line', layerId: 'lyr_test', visible: true, start: { x: x0, y: y0 }, end: { x: x1, y: y1 } } as unknown as Entity);

describe('computeGroupSelectionBounds (ADR-575)', () => {
  it('unions the members AABB, centre = midpoint, count = top-level members', () => {
    const group = createGroupEntity([mkLine('a', 0, 0, 1, 0), mkLine('b', 2, 2, 3, 2)]);
    const b = computeGroupSelectionBounds(group);
    expect(b).not.toBeNull();
    expect(b!.min).toEqual({ x: 0, y: 0 });
    expect(b!.max).toEqual({ x: 3, y: 2 });
    expect(b!.center).toEqual({ x: 1.5, y: 1 });
    expect(b!.memberCount).toBe(2);
  });

  it('returns null for an empty group', () => {
    const empty = { id: 'g_empty', type: 'group', layerId: 'l', visible: true, members: [] } as unknown as GroupEntity;
    expect(computeGroupSelectionBounds(empty)).toBeNull();
  });
});

describe('resolveSelectedGroups (ADR-575)', () => {
  it('returns only the selected GROUP containers', () => {
    const group = createGroupEntity([mkLine('a', 0, 0, 1, 0), mkLine('b', 2, 2, 3, 2)]);
    const loose = mkLine('loose', 5, 5, 6, 6);
    const entities: Entity[] = [group as unknown as Entity, loose];

    expect(resolveSelectedGroups(entities, [group.id])).toEqual([group]);
    // A non-group id selected → no groups.
    expect(resolveSelectedGroups(entities, ['loose'])).toEqual([]);
    // Empty selection / empty scene → empty.
    expect(resolveSelectedGroups(entities, [])).toEqual([]);
    expect(resolveSelectedGroups(undefined, [group.id])).toEqual([]);
  });
});

describe('resolveGroupContainingEntity (ADR-575 §selection/hover semantics)', () => {
  const group = createGroupEntity([mkLine('a', 0, 0, 1, 0), mkLine('b', 2, 2, 3, 2)]);
  const loose = mkLine('loose', 5, 5, 6, 6);
  const entities: Entity[] = [group as unknown as Entity, loose];

  it('resolves a group container id to its GroupEntity (every member shares group.id)', () => {
    expect(resolveGroupContainingEntity(entities, group.id)).toBe(group);
  });

  it('returns null for a plain (non-grouped) entity id', () => {
    expect(resolveGroupContainingEntity(entities, 'loose')).toBeNull();
  });

  it('returns null for unknown / empty / missing inputs', () => {
    expect(resolveGroupContainingEntity(entities, 'nope')).toBeNull();
    expect(resolveGroupContainingEntity(entities, null)).toBeNull();
    expect(resolveGroupContainingEntity(undefined, group.id)).toBeNull();
    expect(resolveGroupContainingEntity([], group.id)).toBeNull();
  });
});

describe('collectGroupEntities (ADR-575 §selection/hover semantics)', () => {
  it('keys ONLY the GROUP containers by id, skipping plain entities', () => {
    const g1 = createGroupEntity([mkLine('a', 0, 0, 1, 0), mkLine('b', 2, 2, 3, 2)]);
    const g2 = createGroupEntity([mkLine('c', 4, 4, 5, 4), mkLine('d', 6, 6, 7, 6)]);
    const loose = mkLine('loose', 5, 5, 6, 6);
    const map = collectGroupEntities([g1 as unknown as Entity, loose, g2 as unknown as Entity]);

    expect(map.size).toBe(2);
    expect(map.get(g1.id)).toBe(g1);
    expect(map.get(g2.id)).toBe(g2);
    expect(map.has('loose')).toBe(false);
  });

  it('returns an empty map for undefined / empty input', () => {
    expect(collectGroupEntities(undefined).size).toBe(0);
    expect(collectGroupEntities([]).size).toBe(0);
  });
});
